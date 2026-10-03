"""Sanity-check vector search from the terminal (no email, no Claude).

Run from the backend/ folder:
    python scripts/try_search.py "I built a React dashboard backed by Postgres with a REST API"
    python scripts/try_search.py --file data/sample_cv.txt
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config  # noqa: E402
from app.cv_parser import extract_text  # noqa: E402
from app.search import vector_search  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("text", nargs="?", help="query text")
    parser.add_argument("--file", help="a CV file (.pdf/.docx/.txt) to use as the query")
    parser.add_argument("-k", type=int, default=10)
    args = parser.parse_args()

    if args.file:
        path = Path(args.file)
        query = extract_text(path.read_bytes(), path.name)
    elif args.text:
        query = args.text
    else:
        parser.error("give query text or --file")

    results = vector_search(query, k=args.k)
    if not results:
        sys.exit("✗ No results. Is the vector_index ACTIVE and are listings ingested?")

    print(f"Top {len(results)} (threshold {config.MATCH_THRESHOLD}):\n")
    for r in results:
        mark = "✓" if r["score"] >= config.MATCH_THRESHOLD else " "
        print(f"{mark} {r['score']:.3f}  {r['title']} — {r['company']} ({r.get('location', '')})")
        print(f"         next step: {r['next_step']}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError) as exc:  # missing env vars, unreadable CV file
        sys.exit(f"✗ {exc}")
