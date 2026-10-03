"""Create the Atlas Vector Search indexes and wait until they're queryable.

Run from the backend/ folder (after or before ingest — both work):
    python scripts/create_index.py            # listings + candidates indexes
    python scripts/create_index.py candidates  # just the candidates index

If this fails on your cluster tier, create it in the Atlas UI instead — see README_INDEX.md.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pymongo.errors import OperationFailure, PyMongoError  # noqa: E402
from pymongo.operations import SearchIndexModel  # noqa: E402

from app.db import candidates, get_db, listings  # noqa: E402
from app.embeddings import DIMENSIONS  # noqa: E402
from app.search import CANDIDATES_INDEX, VECTOR_INDEX  # noqa: E402

WAIT_SECONDS = 600


def _definition() -> dict:
    return {
        "fields": [
            {"type": "vector", "path": "embedding", "numDimensions": DIMENSIONS, "similarity": "cosine"},
        ]
    }


def ensure_index(coll_name: str, coll, index_name: str) -> None:
    db = get_db()
    if coll_name not in db.list_collection_names():
        db.create_collection(coll_name)  # search indexes need an existing collection

    existing = {idx["name"]: idx for idx in coll.list_search_indexes()}
    if index_name in existing:
        print(f"✓ '{index_name}' already exists (status: {existing[index_name].get('status')})")
    else:
        try:
            coll.create_search_index(SearchIndexModel(definition=_definition(), name=index_name, type="vectorSearch"))
        except OperationFailure as exc:
            sys.exit(f"✗ Atlas refused to create '{index_name}': {exc}\n  Create it in the Atlas UI instead — see README_INDEX.md.")
        print(f"→ Created '{index_name}'. Waiting for Atlas to build it (usually 1–5 min)...")

    deadline = time.time() + WAIT_SECONDS
    while time.time() < deadline:
        idx = next(iter(coll.list_search_indexes(index_name)), {})
        if idx.get("queryable"):
            print(f"✓ '{index_name}' is {idx.get('status')} and queryable.")
            return
        print(f"  {index_name} status: {idx.get('status', 'PENDING')}...")
        time.sleep(10)
    sys.exit(f"✗ '{index_name}' still not queryable after {WAIT_SECONDS // 60} min. Check Atlas → Search & Vector Search.")


def main() -> None:
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "listings"):
        ensure_index("listings", listings(), VECTOR_INDEX)
    if which in ("all", "candidates"):
        ensure_index("candidates", candidates(), CANDIDATES_INDEX)
    print("✓ Vector search is ready.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        sys.exit(f"✗ {exc}")
    except PyMongoError as exc:
        sys.exit(f"✗ MongoDB error: {exc}")
