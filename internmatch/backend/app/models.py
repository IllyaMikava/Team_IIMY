"""Response models for the API."""
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
