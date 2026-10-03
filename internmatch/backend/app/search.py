"""Vector search over job listings + threshold filtering + optional "why matched" reasons."""
import logging

import anthropic
from pydantic import BaseModel

from . import config
from .db import candidates, listings
from .embeddings import embed_query

log = logging.getLogger("internmatch.search")

VECTOR_INDEX = "vector_index"                      # on listings.embedding
CANDIDATES_INDEX = "candidates_vector_index"        # on candidates.embedding
REASON_MODEL = "claude-haiku-4-5"


def _vector_search(coll, index: str, query_vector: list[float], project: dict, k: int) -> list[dict]:
    """Shared $vectorSearch pipeline: rank docs in `coll` by closeness to `query_vector`."""
    pipeline = [
        {
            "$vectorSearch": {
                "index": index,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": 100,
                "limit": k,
            }
        },
        {"$project": {**project, "score": {"$meta": "vectorSearchScore"}}},
    ]
    return list(coll.aggregate(pipeline))


def vector_search(cv_text: str, k: int = 15) -> list[dict]:
    """Return the k listings closest to the CV, best first, each with a `score` (0–1)."""
    return _vector_search(
        listings(),
        VECTOR_INDEX,
        embed_query(cv_text),
        {"title": 1, "company": 1, "location": 1, "url": 1, "description": 1, "skills": 1, "next_step": 1},
        k,
    )


def search_candidates(job_text: str, k: int = 25) -> list[dict]:
    """Return the k candidates whose CVs are closest to a job, best first, each with a `score` (0–1)."""
    return _vector_search(
        candidates(),
        CANDIDATES_INDEX,
        embed_query(job_text),
        {"email": 1, "name": 1, "cv_text": 1},
        k,
    )


def filter_strong(results: list[dict], threshold: float | None = None, max_results: int | None = None) -> list[dict]:
    """Keep results with score >= threshold, capped at max_results.

    If nothing clears the bar, return just the top result flagged `best_available=True`
    so the UI always has something to show.
    """
    threshold = config.MATCH_THRESHOLD if threshold is None else threshold
    max_results = config.MAX_EMAILS if max_results is None else max_results

    strong = [r for r in results if r["score"] >= threshold]
    if not strong and results:
        return [{**results[0], "best_available": True}]
    return strong[:max_results]


class _Reasons(BaseModel):
    reasons: list[str]


_claude: anthropic.Anthropic | None = None


def _claude_client() -> anthropic.Anthropic:
    global _claude
    if _claude is None:
        # Short timeout + one retry: reasons are a nice-to-have and must not stall the upload.
        _claude = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=20.0, max_retries=1)
    return _claude


def explain_matches(cv_text: str, matches: list[dict]) -> list[str]:
    """One Claude call → one short reason per match (same order). Returns "" for each on any failure."""
    empty = [""] * len(matches)
    if not matches or not config.ANTHROPIC_API_KEY:
        return empty

    jobs = "\n\n".join(
        f"Job {i}: {m['title']} at {m['company']}\n{m.get('description', '')}\nSkills: {', '.join(m.get('skills', []))}"
        for i, m in enumerate(matches, start=1)
    )
    prompt = (
        "A student uploaded the CV below. A semantic search matched it to the jobs listed after it.\n"
        f"For each job, in order, write ONE sentence (under 20 words) telling the student why it fits them. "
        "Name concrete skills or projects from their CV, and point out transferable skills when the link "
        "isn't obvious. Speak to the student as \"you\".\n"
        f"Return exactly {len(matches)} reasons.\n\n"
        f"<cv>\n{cv_text}\n</cv>\n\n<jobs>\n{jobs}\n</jobs>"
    )

    try:
        response = _claude_client().messages.parse(
            model=REASON_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
            output_format=_Reasons,
        )
    except (anthropic.APIError, ValueError) as exc:  # API/network errors, or output that failed validation
        log.warning("Match reasons unavailable: %s", exc)
        return empty

    if response.parsed_output is None:  # e.g. stop_reason == "max_tokens" or "refusal"
        log.warning("Match reasons unavailable: stop_reason=%s", response.stop_reason)
        return empty

    reasons = [r.strip() for r in response.parsed_output.reasons]
    if len(reasons) != len(matches):
        log.warning("Claude returned %d reasons for %d matches; padding/trimming", len(reasons), len(matches))
    return (reasons + empty)[: len(matches)]
