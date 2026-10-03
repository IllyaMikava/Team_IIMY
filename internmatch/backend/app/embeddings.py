"""Local embeddings via sentence-transformers (all-MiniLM-L6-v2, 384 dims).

Free and offline — no API key. Keeps the same public API as before
(embed_texts / embed_query / DIMENSIONS / MAX_BATCH) so the ingest script,
index creation and search code need no changes.
"""
from collections.abc import Callable

from sentence_transformers import SentenceTransformer

MODEL = "all-MiniLM-L6-v2"
DIMENSIONS = 384  # must match numDimensions in the Atlas vector_index
MAX_BATCH = 64    # encode batch size; also drives progress reporting in ingest.py

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    """Load the model once per process (~80 MB, downloaded on first use, then cached)."""
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL)
    return _model


def _encode(texts: list[str]) -> list[list[float]]:
    # normalize_embeddings=True → unit vectors, so Atlas cosine similarity is clean.
    vectors = _get_model().encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    out = [v.tolist() for v in vectors]  # plain Python floats so pymongo/BSON can store them
    if any(len(v) != DIMENSIONS for v in out):
        raise RuntimeError(f"Expected {DIMENSIONS}-dim vectors from {MODEL}; got {len(out[0])}.")
    return out


def embed_texts(
    texts: list[str],
    batch_size: int = MAX_BATCH,
    on_batch: Callable[[int, int], None] | None = None,
) -> list[list[float]]:
    """Embed documents (job listings). `on_batch(done, total)` is called after each batch."""
    batch_size = max(1, min(batch_size, MAX_BATCH))
    vectors: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        vectors.extend(_encode(texts[start : start + batch_size]))
        if on_batch:
            on_batch(len(vectors), len(texts))
    return vectors


def embed_query(text: str) -> list[float]:
    """Embed a search query (the CV text)."""
    return _encode([text])[0]
