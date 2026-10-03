"""Embed data/listings.json with Voyage AI and upsert it into MongoDB Atlas.

Run from the backend/ folder:
    python scripts/ingest.py                 # embed new/changed listings, update the rest
    python scripts/ingest.py --dry-run       # validate the dataset only (no network)
    python scripts/ingest.py --limit 50      # quick first run (milestone M1)
    python scripts/ingest.py --force         # re-embed everything
    python scripts/ingest.py --batch-size 32 # smaller batches if Voyage rate-limits you

Listings are keyed by (title, company). A listing is only re-embedded when its
title/description/skills text changed, so re-running is cheap.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))  # so `import app` works when run as `python scripts/ingest.py`

from pymongo import ASCENDING, UpdateOne  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402

from app.db import listings  # noqa: E402
from app.embeddings import MAX_BATCH, embed_texts  # noqa: E402
from app.jobs import listing_text, text_hash  # noqa: E402

DATA_FILE = BACKEND_DIR / "data" / "listings.json"
REQUIRED = ("title", "company", "location", "url", "description", "skills", "next_step")


def load_listings(limit: int | None) -> list[dict]:
    jobs = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    problems = [
        f"  #{i} {job.get('title', '?')!r}: missing {', '.join(f for f in REQUIRED if not job.get(f))}"
        for i, job in enumerate(jobs)
        if any(not job.get(f) for f in REQUIRED)
    ]
    keys = [(j.get("title"), j.get("company")) for j in jobs]
    dupes = {k for k in keys if keys.count(k) > 1}
    problems += [f"  duplicate (title, company): {k}" for k in sorted(dupes)]
    if problems:
        sys.exit("✗ listings.json has problems:\n" + "\n".join(problems))
    return jobs[:limit] if limit else jobs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, help="only ingest the first N listings")
    parser.add_argument("--batch-size", type=int, default=MAX_BATCH, help=f"listings per Voyage call (max {MAX_BATCH})")
    parser.add_argument("--force", action="store_true", help="re-embed every listing")
    parser.add_argument("--dry-run", action="store_true", help="validate listings.json and exit")
    args = parser.parse_args()

    jobs = load_listings(args.limit)
    print(f"✓ Loaded {len(jobs)} valid listings from {DATA_FILE.relative_to(BACKEND_DIR)}")
    if args.dry_run:
        return

    coll = listings()
    coll.create_index([("title", ASCENDING), ("company", ASCENDING)], unique=True)

    texts = [listing_text(j) for j in jobs]
    hashes = [text_hash(t) for t in texts]
    stored = {
        (d["title"], d["company"]): d.get("embed_hash")
        for d in coll.find({"embedding": {"$exists": True}}, {"title": 1, "company": 1, "embed_hash": 1})
    }
    to_embed = [
        i for i, (job, h) in enumerate(zip(jobs, hashes)) if args.force or stored.get((job["title"], job["company"])) != h
    ]
    to_embed_set = set(to_embed)
    unchanged = [i for i in range(len(jobs)) if i not in to_embed_set]

    # Unchanged listings: refresh metadata (e.g. an edited next_step) without spending embedding quota.
    if unchanged:
        coll.bulk_write([UpdateOne({"title": jobs[i]["title"], "company": jobs[i]["company"]}, {"$set": jobs[i]}) for i in unchanged])
        print(f"✓ {len(unchanged)} listings unchanged (metadata refreshed, not re-embedded)")

    if to_embed:
        print(f"→ Embedding {len(to_embed)} listings with Voyage AI (batch size {args.batch_size})...")
    batch_size = max(1, min(args.batch_size, MAX_BATCH))
    for start in range(0, len(to_embed), batch_size):
        batch = to_embed[start : start + batch_size]
        vectors = embed_texts([texts[i] for i in batch], batch_size=batch_size)
        now = datetime.now(timezone.utc)
        coll.bulk_write(
            [
                UpdateOne(
                    {"title": jobs[i]["title"], "company": jobs[i]["company"]},
                    {"$set": {**jobs[i], "embedding": vec, "embed_hash": hashes[i], "ingested_at": now}},
                    upsert=True,
                )
                for i, vec in zip(batch, vectors)
            ]
        )
        print(f"  {min(start + batch_size, len(to_embed))}/{len(to_embed)} embedded + saved")

    total = coll.count_documents({})
    embedded = coll.count_documents({"embedding": {"$exists": True}})
    print(f"✓ Done. listings collection: {total} docs, {embedded} with embeddings.")
    print("  Next: create the vector index if you haven't →  python scripts/create_index.py")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:  # missing env vars etc.
        sys.exit(f"✗ {exc}")
    except PyMongoError as exc:
        sys.exit(f"✗ MongoDB error: {exc}\n  Check MONGODB_URI and that your IP is allowed in Atlas → Network Access.")
