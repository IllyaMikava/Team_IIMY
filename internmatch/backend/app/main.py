"""InternMatch AI API.

Run from the backend/ folder:
    uvicorn app.main:app --reload --port 8000
"""
import logging
import re
import time
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pymongo import DESCENDING
from pymongo.errors import PyMongoError

from . import config
from .cv_parser import extract_text
from .db import candidate_matches, candidates, jobs, match_events
from .embeddings import embed_query
from .emailer import is_mock_mode, send_match_email
from .models import (
    CandidateMatchOut,
    DecisionIn,
    JobIn,
    JobOut,
    MatchResult,
    UploadResponse,
)
from .search import explain_matches, filter_strong, search_candidates, vector_search

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("internmatch.api")

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = FastAPI(title="InternMatch AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "email_mode": "mock" if is_mock_mode() else "gmail"}


# Plain `def` (not async): pymongo, Voyage and smtplib are blocking, so FastAPI runs this in a thread pool.
@app.post("/api/upload-cv", response_model=UploadResponse)
def upload_cv(file: UploadFile = File(...), email: str = Form(...)) -> UploadResponse:
    started = time.perf_counter()
    timings: dict[str, float] = {}

    def lap(name: str, since: float) -> float:
        now = time.perf_counter()
        timings[name] = round(now - since, 2)
        return now

    email = email.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Please enter a valid email address.")

    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "CV is larger than 5 MB.")

    # 1. CV → text
    try:
        cv_text = extract_text(data, file.filename)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    t = lap("parse", started)

    # 1b. store/update this candidate so recruiters can match jobs against them
    _upsert_candidate(email, cv_text)
    t = lap("store_candidate", t)

    # 2. text → vector → $vectorSearch
    try:
        results = vector_search(cv_text)
    except Exception:
        log.exception("Vector search failed")
        raise HTTPException(503, "Matching is unavailable right now. Check the MongoDB / Voyage settings in backend/.env.")
    t = lap("search", t)

    # 3. threshold + cap, then optional reasons
    strong = filter_strong(results)
    reasons = explain_matches(cv_text, strong)
    t = lap("reasons", t)

    # 4. one email per strong match (the "best available" fallback isn't a strong match, so it isn't emailed)
    matches: list[MatchResult] = []
    for doc, reason in zip(strong, reasons):
        match = MatchResult(
            job_title=doc["title"],
            company=doc["company"],
            location=doc.get("location", ""),
            url=doc.get("url", ""),
            score=round(doc["score"], 4),
            next_step=doc["next_step"],
            match_reason=reason,
            best_available=doc.get("best_available", False),
        )
        if not match.best_available:
            match.emailed = send_match_email(email, match)
        _record_match_event(email, doc, match)
        matches.append(match)
    lap("email", t)

    total_emailed = sum(m.emailed for m in matches)
    log.info(
        "upload-cv: %d chars, %d candidates, %d matches, %d emailed, timings=%s total=%.2fs",
        len(cv_text), len(results), len(matches), total_emailed, timings, time.perf_counter() - started,
    )
    return UploadResponse(candidate_email=email, matches=matches, total_emailed=total_emailed)


def _record_match_event(email: str, doc: dict, match: MatchResult) -> None:
    """Audit log of what was matched/emailed. Failure here must not break the request."""
    try:
        match_events().insert_one(
            {
                "candidate_email": email,
                "listing_id": doc.get("_id"),
                "job_title": match.job_title,
                "company": match.company,
                "score": match.score,
                "next_step": match.next_step,
                "emailed": match.emailed,
                "best_available": match.best_available,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except PyMongoError as exc:
        log.warning("Couldn't record match_event: %s", exc)


# ---------------------------------------------------------------- candidates

def _name_from_cv(cv_text: str, email: str) -> str:
    """Best-effort candidate name: first plausible line of the CV, else the email's local part."""
    for line in cv_text.splitlines():
        line = line.strip()
        if not line or "@" in line or any(ch.isdigit() for ch in line):
            continue
        if 2 <= len(line) <= 60 and line.replace(" ", "").replace("-", "").replace(".", "").isalpha():
            return line.title()
    return email.split("@")[0].replace(".", " ").replace("_", " ").title()


def _upsert_candidate(email: str, cv_text: str) -> None:
    """Store the CV + its embedding by email so recruiter jobs can match against it. Non-fatal."""
    try:
        now = datetime.now(timezone.utc)
        candidates().update_one(
            {"email": email},
            {
                "$set": {
                    "email": email,
                    "name": _name_from_cv(cv_text, email),
                    "cv_text": cv_text,
                    "embedding": embed_query(cv_text),
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
    except PyMongoError as exc:
        log.warning("Couldn't upsert candidate %s: %s", email, exc)


# ---------------------------------------------------------------- recruiter: jobs

@app.post("/api/jobs", response_model=JobOut)
def create_job(job: JobIn) -> JobOut:
    """Create a job, then immediately match stored candidate CVs against it."""
    now = datetime.now(timezone.utc)
    doc = {
        "title": job.title.strip(),
        "company": job.company.strip(),
        "location": job.location.strip(),
        "description": job.description.strip(),
        "next_step": job.next_step.strip(),
        "embedding": embed_query(f"{job.title}\n{job.description}\n{job.location}"),
        "created_at": now,
    }
    try:
        job_id = jobs().insert_one(doc).inserted_id
    except PyMongoError as exc:
        log.exception("Job insert failed")
        raise HTTPException(503, "Couldn't save the job. Check the MongoDB settings in backend/.env.") from exc

    # match stored candidates to this job
    try:
        results = search_candidates(f"{job.title}\n{job.description}")
    except Exception:
        log.exception("Candidate search failed")
        results = []
    strong = filter_strong(results)

    rows = [
        {
            "job_id": job_id,
            "candidate_email": c["email"],
            "candidate_name": c.get("name", c["email"]),
            "score": round(c["score"], 4),
            "status": "new",
            "created_at": now,
        }
        for c in strong
        if not c.get("best_available")  # only real matches become candidate rows
    ]
    if rows:
        candidate_matches().insert_many(rows)

    return JobOut(
        id=str(job_id),
        title=doc["title"],
        company=doc["company"],
        location=doc["location"],
        description=doc["description"],
        next_step=doc["next_step"],
        created_at=now.isoformat(),
        candidate_count=len(rows),
    )


@app.get("/api/jobs", response_model=list[JobOut])
def list_jobs() -> list[JobOut]:
    out: list[JobOut] = []
    for j in jobs().find().sort("created_at", DESCENDING):
        count = candidate_matches().count_documents({"job_id": j["_id"]})
        out.append(
            JobOut(
                id=str(j["_id"]),
                title=j.get("title", ""),
                company=j.get("company", ""),
                location=j.get("location", ""),
                description=j.get("description", ""),
                next_step=j.get("next_step", ""),
                created_at=j.get("created_at", datetime.now(timezone.utc)).isoformat(),
                candidate_count=count,
            )
        )
    return out


@app.get("/api/jobs/{job_id}/candidates", response_model=list[CandidateMatchOut])
def job_candidates(job_id: str) -> list[CandidateMatchOut]:
    oid = _object_id(job_id)
    rows = candidate_matches().find({"job_id": oid}).sort("score", DESCENDING)
    return [
        CandidateMatchOut(
            id=str(r["_id"]),
            candidate_name=r.get("candidate_name", r.get("candidate_email", "")),
            candidate_email=r.get("candidate_email", ""),
            score=r.get("score", 0.0),
            status=r.get("status", "new"),
        )
        for r in rows
    ]


@app.post("/api/candidate-matches/{match_id}/decision", response_model=CandidateMatchOut)
def decide_candidate(match_id: str, body: DecisionIn) -> CandidateMatchOut:
    oid = _object_id(match_id)
    r = candidate_matches().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": body.decision}},
        return_document=True,
    )
    if not r:
        raise HTTPException(404, "Candidate match not found.")
    return CandidateMatchOut(
        id=str(r["_id"]),
        candidate_name=r.get("candidate_name", r.get("candidate_email", "")),
        candidate_email=r.get("candidate_email", ""),
        score=r.get("score", 0.0),
        status=r.get("status", "new"),
    )


def _object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(404, "Not found.") from exc
