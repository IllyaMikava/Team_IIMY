"""Response models for the API."""
from typing import Literal

from pydantic import BaseModel


class MatchResult(BaseModel):
    job_title: str
    company: str
    location: str = ""
    url: str = ""
    score: float                 # Atlas vectorSearchScore, 0–1 (higher = closer match)
    next_step: str               # predefined per job, copied verbatim into the email
    match_reason: str = ""       # optional one-liner from Claude; "" if unavailable
    emailed: bool = False
    best_available: bool = False  # True when nothing cleared the threshold and this is just the top hit


class UploadResponse(BaseModel):
    candidate_email: str
    matches: list[MatchResult]
    total_emailed: int


# --- recruiter side -------------------------------------------------------

class JobIn(BaseModel):
    title: str
    company: str
    location: str = ""
    description: str
    next_step: str = ""


class JobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str = ""
    description: str = ""
    next_step: str = ""
    created_at: str
    candidate_count: int = 0


class CandidateMatchOut(BaseModel):
    id: str
    candidate_name: str
    candidate_email: str
    score: float
    status: Literal["new", "accepted", "declined"] = "new"


class DecisionIn(BaseModel):
    decision: Literal["accepted", "declined"]
