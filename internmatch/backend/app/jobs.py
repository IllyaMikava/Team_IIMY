"""Helpers shared by scripts/ingest.py and the recruiter API, so a job posted from the
recruiter page is embedded exactly like the jobs in data/listings.json."""
import hashlib


def listing_text(job: dict) -> str:
    """The text we embed for a job: title + description + skills."""
    return f"{job['title']}\n{job['description']}\n{', '.join(job['skills'])}"


def text_hash(text: str) -> str:
    """Fingerprint of the embedded text, so ingest can skip unchanged jobs."""
    return hashlib.sha1(text.encode("utf-8")).hexdigest()
