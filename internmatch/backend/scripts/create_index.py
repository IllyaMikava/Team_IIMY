"""Create the Atlas Vector Search index `vector_index` and wait until it's queryable.

Run from the backend/ folder (after or before ingest — both work):
    python scripts/create_index.py

If this fails on your cluster tier, create it in the Atlas UI instead — see README_INDEX.md.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pymongo.errors import OperationFailure, PyMongoError  # noqa: E402
from pymongo.operations import SearchIndexModel  # noqa: E402

from app.db import get_db, listings  # noqa: E402
from app.embeddings import DIMENSIONS  # noqa: E402
from app.search import VECTOR_INDEX  # noqa: E402

DEFINITION = {
    "fields": [
        {"type": "vector", "path": "embedding", "numDimensions": DIMENSIONS, "similarity": "cosine"},
    ]
}
WAIT_SECONDS = 600


def main() -> None:
    db = get_db()
    if "listings" not in db.list_collection_names():
        db.create_collection("listings")  # search indexes need an existing collection
    coll = listings()

    existing = {idx["name"]: idx for idx in coll.list_search_indexes()}
    if VECTOR_INDEX in existing:
        print(f"✓ '{VECTOR_INDEX}' already exists (status: {existing[VECTOR_INDEX].get('status')})")
    else:
        try:
            coll.create_search_index(SearchIndexModel(definition=DEFINITION, name=VECTOR_INDEX, type="vectorSearch"))
        except OperationFailure as exc:
            sys.exit(f"✗ Atlas refused to create the index: {exc}\n  Create it in the Atlas UI instead — see README_INDEX.md.")
        print(f"→ Created '{VECTOR_INDEX}'. Waiting for Atlas to build it (usually 1–5 min)...")

    deadline = time.time() + WAIT_SECONDS
    while time.time() < deadline:
        idx = next(iter(coll.list_search_indexes(VECTOR_INDEX)), {})
        if idx.get("queryable"):
            print(f"✓ '{VECTOR_INDEX}' is {idx.get('status')} and queryable. Vector search is ready.")
            return
        print(f"  status: {idx.get('status', 'PENDING')}...")
        time.sleep(10)
    sys.exit(f"✗ Index still not queryable after {WAIT_SECONDS // 60} min. Check Atlas → Search & Vector Search.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        sys.exit(f"✗ {exc}")
    except PyMongoError as exc:
        sys.exit(f"✗ MongoDB error: {exc}")
