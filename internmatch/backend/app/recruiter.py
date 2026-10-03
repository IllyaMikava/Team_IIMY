"""Recruiter API: post roles (embedded on the spot, so they're searchable immediately),
list roles with match counts, close roles, and see which candidates matched.

No auth: this is a hackathon demo (accounts are a non-goal in the design doc).
"""
import logging
import re
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Query, Response
from pymongo import DESCENDING, ReturnDocument
from pymongo.errors import PyMongoError

from .db import listings, match_events
from .emailer import send_match_email
from .embeddings import embed_texts
from .jobs import listing_text, text_hash
from .models import CandidateMatch, JobIn, JobOut, JobUpdate, MatchResult

log = logging.getLogger("internmatch.recruiter")

router = APIRouter(prefix="/api/recruiter", tags=["recruiter"])

RECRUITER_SOURCE = "InternMatch recruiter page"


def _company_filter(company: str | None) -> dict:
    """Case-insensitive 'contains' match on company, or no filter."""
    company = (company or "").strip()
    return {"company": {"$regex": re.escape(company), "$options": "i"}} if company else {}


def _job_out(doc: dict, match_count: int = 0) -> JobOut:
    return JobOut(
        id=str(doc["_id"]),
        title=doc["title"],
        company=doc["company"],
        location=doc.get("location", ""),
        url=doc.get("url", ""),
        description=doc.get("description", ""),
        skills=doc.get("skills", []),
        next_step=doc.get("next_step", ""),
        source=doc.get("source", ""),
        invite_mode=doc.get("invite_mode", "auto"),
        posted_at=doc.get("posted_at") or doc.get("ingested_at"),
        match_count=match_count,
    )


def _candidate_out(r: dict) -> CandidateMatch:
    return CandidateMatch(
        id=str(r["_id"]),
        candidate_email=r.get("candidate_email", ""),
        job_id=str(r["listing_id"]) if r.get("listing_id") else None,
        job_title=r.get("job_title", ""),
        company=r.get("company", ""),
        score=r.get("score", 0.0),
        next_step=r.get("next_step", ""),
        match_reason=r.get("match_reason", ""),
        emailed=r.get("emailed", False),
        best_available=r.get("best_available", False),
        awaiting_review=r.get("awaiting_review", False),
        invited_at=r.get("invited_at"),
        created_at=r.get("created_at"),
    )


def _object_id(value: str, what: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId:
        raise HTTPException(400, f"Invalid {what} id.")


def _db_error(exc: Exception):
    log.exception("Recruiter DB call failed")
    raise HTTPException(503, "Database is unavailable right now. Check MONGODB_URI in backend/.env.") from exc


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(company: str | None = None):
    """Roles (newest first), each with how many candidates strongly matched it."""
    try:
        docs = list(
            listings()
            .find(_company_filter(company), {"embedding": 0, "embed_hash": 0})
            .sort([("posted_at", DESCENDING), ("ingested_at", DESCENDING)])
        )
        counts = {
            row["_id"]: row["n"]
            for row in match_events().aggregate([
                {"$match": {"best_available": {"$ne": True}, "listing_id": {"$in": [d["_id"] for d in docs]}}},
                {"$group": {"_id": "$listing_id", "n": {"$sum": 1}}},
            ])
        }
    except PyMongoError as exc:
        _db_error(exc)
    return [_job_out(d, counts.get(d["_id"], 0)) for d in docs]


@router.post("/jobs", response_model=JobOut, status_code=201)
def create_job(job: JobIn):
    """Post a role. It's embedded now, so the next CV upload can match it."""
    doc = job.model_dump()
    try:
        if listings().count_documents({"title": doc["title"], "company": doc["company"]}, limit=1):
            raise HTTPException(409, f"{doc['company']} already has a role called '{doc['title']}'.")
    except PyMongoError as exc:
        _db_error(exc)

    text = listing_text(doc)
    try:
        embedding = embed_texts([text])[0]
    except Exception as exc:
        log.exception("Embedding a posted role failed")
        raise HTTPException(503, "Couldn't embed this role right now. Please try again.") from exc

    now = datetime.now(timezone.utc)
    doc |= {
        "source": RECRUITER_SOURCE,
        "embedding": embedding,
        "embed_hash": text_hash(text),
        "posted_at": now,
        "ingested_at": now,
    }
    try:
        doc["_id"] = listings().insert_one(doc).inserted_id
    except PyMongoError as exc:
        _db_error(exc)
    log.info("Posted role: %s at %s", doc["title"], doc["company"])
    return _job_out(doc)


@router.patch("/jobs/{job_id}", response_model=JobOut)
def update_job(job_id: str, update: JobUpdate):
    """Switch a role between auto invite and manual invite. Applies to future matches."""
    oid = _object_id(job_id, "role")
    try:
        doc = listings().find_one_and_update(
            {"_id": oid},
            {"$set": {"invite_mode": update.invite_mode}},
            projection={"embedding": 0, "embed_hash": 0},
            return_document=ReturnDocument.AFTER,
        )
        if doc is None:
            raise HTTPException(404, "Role not found. It may have been closed.")
        count = match_events().count_documents({"listing_id": oid, "best_available": {"$ne": True}})
    except PyMongoError as exc:
        _db_error(exc)
    return _job_out(doc, count)


@router.delete("/jobs/{job_id}", status_code=204)
def close_job(job_id: str):
    """Close (delete) a role so it stops matching. Past match_events are kept."""
    oid = _object_id(job_id, "role")
    try:
        deleted = listings().delete_one({"_id": oid}).deleted_count
    except PyMongoError as exc:
        _db_error(exc)
    if not deleted:
        raise HTTPException(404, "Role not found. It may already be closed.")
    return Response(status_code=204)


@router.get("/matches", response_model=list[CandidateMatch])
def list_matches(company: str | None = None, limit: int = Query(200, ge=1, le=1000)):
    """Candidates matched to roles (newest first), from the match_events audit log."""
    try:
        rows = list(match_events().find(_company_filter(company)).sort("created_at", DESCENDING).limit(limit))
    except PyMongoError as exc:
        _db_error(exc)
    return [_candidate_out(r) for r in rows]


@router.post("/matches/{match_id}/invite", response_model=CandidateMatch)
def invite_candidate(match_id: str):
    """Recruiter clicked Invite: email this candidate the role's next step now."""
    oid = _object_id(match_id, "match")
    try:
        event = match_events().find_one({"_id": oid})
        if event is None:
            raise HTTPException(404, "Match not found.")
        if event.get("emailed"):
            raise HTTPException(409, f"{event.get('candidate_email')} has already been emailed about this role.")
        role = listings().find_one({"_id": event.get("listing_id")}, {"location": 1, "url": 1}) or {}
    except PyMongoError as exc:
        _db_error(exc)

    match = MatchResult(
        job_title=event.get("job_title", ""),
        company=event.get("company", ""),
        location=role.get("location", ""),
        url=role.get("url", ""),
        score=event.get("score", 0.0),
        next_step=event.get("next_step", ""),
        match_reason=event.get("match_reason", ""),
    )
    if not send_match_email(event["candidate_email"], match):
        raise HTTPException(502, "Couldn't send the invite email. Check the Gmail settings in backend/.env.")

    update = {"emailed": True, "awaiting_review": False, "invited_at": datetime.now(timezone.utc)}
    try:
        match_events().update_one({"_id": oid}, {"$set": update})
    except PyMongoError as exc:
        _db_error(exc)
    log.info("Invited %s to %s at %s", event["candidate_email"], match.job_title, match.company)
    return _candidate_out(event | update)
