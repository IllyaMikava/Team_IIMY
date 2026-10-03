"""Request / response models for the API."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# "auto": matching students are emailed the next step straight away.
# "manual": matches wait on the recruiter page until the recruiter clicks Invite.
InviteMode = Literal["auto", "manual"]


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
    awaiting_review: bool = False  # role uses manual invite: the recruiter decides whether to email


class UploadResponse(BaseModel):
    candidate_email: str
    matches: list[MatchResult]
    total_emailed: int


# ---------------------------------------------------------------- recruiter page


class JobIn(BaseModel):
    """A role posted from the recruiter page. `next_step` is decided here, upfront."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=2, max_length=120)
    company: str = Field(min_length=1, max_length=80)
    location: str = Field(default="", max_length=80)
    url: str = Field(default="", max_length=300)
    description: str = Field(min_length=40, max_length=4000)
    skills: list[str] = Field(min_length=1, max_length=20)
    next_step: str = Field(min_length=5, max_length=300)
    invite_mode: InviteMode = "auto"

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, skills: list[str]) -> list[str]:
        seen, out = set(), []
        for s in (s.strip() for s in skills):
            if s and s.lower() not in seen:
                seen.add(s.lower())
                out.append(s[:40])
        if not out:
            raise ValueError("add at least one skill")
        return out


class JobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str = ""
    url: str = ""
    description: str
    skills: list[str]
    next_step: str
    source: str = ""
    invite_mode: InviteMode = "auto"
    posted_at: datetime | None = None
    match_count: int = 0  # strong matches recorded in match_events


class JobUpdate(BaseModel):
    invite_mode: InviteMode


class CandidateMatch(BaseModel):
    """One row of match_events, as shown to recruiters."""

    id: str
    candidate_email: str
    job_id: str | None = None
    job_title: str
    company: str
    score: float
    next_step: str
    match_reason: str = ""
    emailed: bool = False
    best_available: bool = False
    awaiting_review: bool = False  # manual-invite role: waiting for the recruiter to click Invite
    invited_at: datetime | None = None  # set when the recruiter invited them manually
    created_at: datetime | None = None
