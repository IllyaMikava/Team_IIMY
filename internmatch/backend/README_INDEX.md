# Atlas Vector Search index: `vector_index`

`$vectorSearch` only works once this index exists **and is ACTIVE**. Building it takes a few minutes, so create it as early as possible.

## Option A: script (easiest)

From `internmatch/backend/`, with `MONGODB_URI` set in `.env`:

```bash
python scripts/create_index.py
```

It creates the `listings` collection if needed, creates the index, and waits until Atlas reports it as queryable.

## Option B: Atlas UI

1. Atlas → your cluster → **Search & Vector Search** (or the **Atlas Search** tab) → **Create Search Index**.
2. Choose **Vector Search** → **JSON Editor**.
3. Database: `internmatch` · Collection: `listings` · Index name: **`vector_index`**
4. Paste:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    }
  ]
}
```

5. **Create**, then wait until the status shows **ACTIVE** (usually 1–5 minutes).

## Rules that must line up

| Setting | Value | Where else it's used |
|---|---|---|
| Index name | `vector_index` | `app/search.py` → `VECTOR_INDEX` |
| Field path | `embedding` | `scripts/ingest.py` writes it |
| Dimensions | `1024` | `voyage-3` output (`app/embeddings.py` → `DIMENSIONS`) |
| Similarity | `cosine` | `vectorSearchScore` = (1 + cosine) / 2, so scores run 0–1 and `MATCH_THRESHOLD=0.75` means cosine ≥ 0.5 |

## Check it works

```bash
python scripts/try_search.py "I built a React dashboard backed by Postgres with a REST API"
```

If you get no results, either the index is still building or the listings haven't been ingested (`python scripts/ingest.py`).
