"""InternMatch AI API.

Run from the backend/ folder:
    uvicorn app.main:app --reload --port 8000
"""
import logging
import re
import time
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from . import config
from .cv_parser import extract_text
from .db import match_events
from .emailer import is_mock_mode, send_match_email
from .models import MatchResult, UploadResponse
from .recruiter import router as recruiter_router
from .search import explain_matches, filter_strong, vector_search

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
app.include_router(recruiter_router)


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
                "match_reason": match.match_reason,
                "emailed": match.emailed,
                "best_available": match.best_available,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except PyMongoError as exc:
        log.warning("Couldn't record match_event: %s", exc)
