"""Voyage AI embeddings (voyage-3, 1024 dims) with batching + simple retry."""
import time
from collections.abc import Callable

import voyageai
import voyageai.error

from . import config

MODEL = "voyage-3"
DIMENSIONS = 1024  # must match numDimensions in the Atlas vector_index
MAX_BATCH = 128
MAX_ATTEMPTS = 5

_RETRYABLE = (
    voyageai.error.RateLimitError,
    voyageai.error.ServerError,
    voyageai.error.ServiceUnavailableError,
    voyageai.error.APIConnectionError,
    voyageai.error.Timeout,
)

_client: voyageai.Client | None = None


def _get_client() -> voyageai.Client:
    global _client
    if _client is None:
        if not config.VOYAGE_API_KEY:
            raise RuntimeError("VOYAGE_API_KEY is not set. Copy backend/.env.example to backend/.env and fill it in.")
        _client = voyageai.Client(api_key=config.VOYAGE_API_KEY, max_retries=0)  # we retry ourselves, below
    return _client


def _embed_batch(texts: list[str], input_type: str) -> list[list[float]]:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            vectors = _get_client().embed(texts, model=MODEL, input_type=input_type).embeddings
            break
        except _RETRYABLE as exc:
            if attempt == MAX_ATTEMPTS:
                raise
            # Rate limits on new Voyage accounts reset per minute, so wait longer for those.
            wait = 20 * attempt if isinstance(exc, voyageai.error.RateLimitError) else 2**attempt
            print(f"  Voyage {type(exc).__name__} (attempt {attempt}/{MAX_ATTEMPTS}), retrying in {wait}s...")
            time.sleep(wait)

    if any(len(v) != DIMENSIONS for v in vectors):
        raise RuntimeError(f"Expected {DIMENSIONS}-dim vectors from {MODEL}; got {len(vectors[0])}.")
    return vectors


def embed_texts(
    texts: list[str],
    batch_size: int = MAX_BATCH,
    on_batch: Callable[[int, int], None] | None = None,
) -> list[list[float]]:
    """Embed documents (job listings). `on_batch(done, total)` is called after each batch."""
    batch_size = max(1, min(batch_size, MAX_BATCH))
    vectors: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        vectors.extend(_embed_batch(texts[start : start + batch_size], input_type="document"))
        if on_batch:
            on_batch(len(vectors), len(texts))
    return vectors


def embed_query(text: str) -> list[float]:
    """Embed a search query (the CV text)."""
    return _embed_batch([text], input_type="query")[0]
