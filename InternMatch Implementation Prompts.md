# InternMatch AI — Implementation Prompts (3 Parts)

Hand each part to an AI coding assistant (Claude Code / Cursor) one at a time, in order.
Stack: **React + Vite (frontend)**, **Python + FastAPI (backend)**, **MongoDB Atlas Vector Search**, **Voyage AI embeddings**, **Gmail SMTP email**.

Flow: upload CV + email → parse CV text → embed → `$vectorSearch` over job descriptions → keep all matches above a threshold → send **one email per match**, each stating that job's predefined **`next_step`**.

> **No scraping anywhere in this project.** Job descriptions are a committed, pre-authored dataset seeded into MongoDB. The app only matches CV text against those stored listings.

Repo layout the prompts assume:
```
internmatch/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── db.py
│   │   ├── embeddings.py
│   │   ├── cv_parser.py
│   │   ├── search.py
│   │   ├── emailer.py
│   │   └── models.py
│   ├── scripts/
│   │   ├── seed.py
│   │   └── ingest.py
│   ├── data/listings.json
│   ├── requirements.txt
│   └── .env
└── frontend/   (Vite React app)
```

---

# PART 1 — Data Pipeline + MongoDB + Embeddings

> **Goal:** Stand up MongoDB Atlas, build a pipeline that seeds ~300 pre-authored job descriptions (each with a predefined `next_step`), embeds them with Voyage AI, and creates the vector index. **No scraping** — the dataset is generated/committed directly. By the end, the DB is queryable.

**Prompt to paste:**

```
You are building the data layer for "InternMatch AI", a semantic internship finder for a MongoDB hackathon.

Stack: Python 3.11, FastAPI (later), MongoDB Atlas, Voyage AI embeddings (model "voyage-3", 1024 dims).

Create a `backend/` folder with:

1. `requirements.txt`: fastapi, uvicorn, python-multipart, pymongo, python-dotenv, voyageai, pydantic, pdfplumber, python-docx, anthropic.

2. `backend/app/db.py`:
   - Load MONGODB_URI from .env.
   - `get_db()` returning the "internmatch" database; helpers for the `listings` and `match_events` collections.
   - pymongo MongoClient (sync is fine).

3. `backend/app/embeddings.py`:
   - Load VOYAGE_API_KEY from .env.
   - `embed_texts(texts) -> list[list[float]]` using voyageai, model "voyage-3", input_type="document", batched (max 128/call) with simple retry.
   - `embed_query(text) -> list[float]` with input_type="query".

4. `backend/scripts/seed.py`:
   - This project does NO scraping. Generate a committed, pre-authored dataset of ~300
     job/internship listings and write it to `backend/data/listings.json`.
   - Realistic variety: titles (frontend, backend, data, ML, devops, security, QA interns),
     companies, Irish + remote locations, 2–4 sentence descriptions, a `skills` array, AND a
     `next_step` free-text field decided upfront per job (e.g. "Recruiter will schedule a
     30-min Zoom call", "Complete a short online assessment", "Take-home coding task",
     "Phone screen with the team").
   - Each record: {title, company, location, url, description, skills, next_step, source}.
   - Make the generation deterministic/seeded so the dataset is stable and committable.

5. `backend/scripts/ingest.py`:
   - Read `data/listings.json`.
   - Embedding input per listing = title + "\n" + description + "\n" + ", ".join(skills).
   - Batch-embed via embeddings.embed_texts.
   - Upsert into `listings` with the `embedding` field, keeping `next_step`, and an `ingested_at` timestamp.
   - Print progress and a final count.

6. `backend/README_INDEX.md`:
   - Exact steps + JSON to create the Atlas Vector Search index named "vector_index":
     field path "embedding", 1024 dims, similarity "cosine". Note it must be created in the
     Atlas UI/API and takes a few minutes to build.

7. `.env.example` with MONGODB_URI, VOYAGE_API_KEY, ANTHROPIC_API_KEY, MATCH_THRESHOLD=0.75,
   MAX_EMAILS=5, GMAIL_ADDRESS, GMAIL_APP_PASSWORD.

Runnable with:
  pip install -r requirements.txt
  python scripts/seed.py
  python scripts/ingest.py

Keep it simple and well-commented, with clear success/error messages. Do not build the API yet.
```

**Done when:** `ingest.py` reports ~300 docs (each with `embedding` + `next_step`) in Atlas, and the `vector_index` is ACTIVE.

---

# PART 2 — FastAPI Backend: CV Upload, Parse, Vector Match

> **Goal:** Build the API. `/api/upload-cv` accepts a CV file + email, extracts the CV text, embeds it, runs Atlas `$vectorSearch`, and returns all matches above the threshold (with optional one-line "why matched" reasons). No email yet — that's Part 3.

**Prompt to paste:**

```
Continue the "InternMatch AI" backend. The `listings` collection in MongoDB Atlas has 300 docs with a 1024-dim "embedding" field, a "next_step" field, and an active vector index "vector_index". Reuse backend/app/db.py and backend/app/embeddings.py from Part 1.

Build:

1. `backend/app/models.py` — Pydantic models:
   - MatchResult { job_title, company, location, url, score, next_step, match_reason, emailed }
   - UploadResponse { candidate_email, matches: list[MatchResult], total_emailed }

2. `backend/app/cv_parser.py`:
   - `extract_text(file_bytes, filename) -> str`:
     * .pdf  -> pdfplumber (concatenate page text)
     * .docx -> python-docx (join paragraphs)
     * .txt  -> decode utf-8
     * else  -> raise a clear ValueError
   - Collapse whitespace; cap to ~15k chars.

3. `backend/app/search.py`:
   - `vector_search(cv_text, k=15) -> list[dict]`:
     * embed_query(cv_text)
     * aggregation with $vectorSearch:
         { "$vectorSearch": { "index":"vector_index", "path":"embedding",
           "queryVector": <vec>, "numCandidates":100, "limit":k } }
       then $project title, company, location, url, description, next_step,
       "score": { "$meta":"vectorSearchScore" }.
   - `filter_strong(results, threshold) -> list[dict]`:
     * keep score >= threshold (from MATCH_THRESHOLD env, default 0.75)
     * if none pass, return the single top result flagged best_available=True
     * cap length to MAX_EMAILS (default 5).
   - (optional) `explain_matches(cv_text, listings) -> list[str]`: ONE Claude call
     ("claude-haiku-4-5") returning a JSON array of one-sentence reasons (same order/length),
     each <20 words referencing the candidate's actual skills. On failure return "" for each.

4. `backend/app/main.py` — FastAPI with CORS open to http://localhost:5173:
   - GET  /api/health -> {status:"ok"}
   - POST /api/upload-cv (multipart: file: UploadFile, email: str form field):
       * extract_text -> vector_search -> filter_strong
       * attach match_reason via explain_matches (optional)
       * build UploadResponse (do NOT return embeddings or raw description); set emailed=False for now
       * total_emailed = 0 for now
   - Run: uvicorn app.main:app --reload --port 8000

Graceful errors: bad file type -> 400 with a clear message; Claude failure -> empty reasons, not 500.
Log timings. Keep it clean and commented.

Test: a curl example POSTing a sample PDF + email to /api/upload-cv, expecting ranked matches
with next_step echoed from each listing.
```

**Done when:** uploading a CV returns ranked matches above the threshold, each carrying its `next_step`.

---

# PART 3 — Email (Gmail SMTP) + React Frontend + Demo Polish

> **Goal:** Send one email per strong match (stating that job's `next_step`), record each send, then build the React upload UI and polish for the demo.

**Prompt to paste:**

```
Finish "InternMatch AI". Backend has POST /api/upload-cv returning matches (each with next_step). Add email sending, then build the frontend.

BACKEND ADDITIONS:

1. `backend/app/emailer.py`:
   - Load GMAIL_ADDRESS + GMAIL_APP_PASSWORD from .env.
   - `send_match_email(to_email, match) -> bool` using smtplib + SSL (smtp.gmail.com:465):
       Subject: "You matched: {job_title} at {company}"
       Body (plain + simple HTML):
         - one-line intro,
         - optional match_reason,
         - "Next step: {next_step}"  (verbatim from the job's next_step field),
         - a link to the job url.
     Return True on success, False on failure (never raise into the request).
   - If GMAIL_* are missing, fall back to MOCK mode: log the full email to console and return True,
     so the demo works offline. Print clearly whether it SENT or MOCKED.

2. Extend `backend/app/main.py` /api/upload-cv:
   - After computing strong matches, for each one call send_match_email(email, match), set
     match.emailed accordingly, and insert a `match_events` record
     {candidate_email, listing_id, job_title, company, score, next_step, emailed, created_at}.
   - Set total_emailed = count of emailed==True. Respect MAX_EMAILS.

FRONTEND (`frontend/`, Vite + React + Tailwind):

3. Scaffold a Vite React app. Single-page UI:
   - Header: "InternMatch AI — upload your CV, get matched, get contacted".
   - A file dropzone for the CV (PDF/DOCX/TXT) + an email input field + "Find my matches" button
     -> POST multipart to /api/upload-cv (file + email).
   - Loading state while matching ("Scanning job descriptions…").
   - Results: cards per match showing job_title, company, location, a score bar, the match_reason
     in an accent color, a highlighted "Next step: {next_step}" pill, an "emailed ✓" badge, and a
     "View job" link. Sort by score desc.
   - A summary banner: "We emailed you about N matching roles."
   - Empty state + error toasts (bad file type, no matches).
   - Clean modern look: rounded cards, generous spacing, one accent color.

4. frontend `.env` with VITE_API_BASE=http://localhost:8000, used in fetch calls.

5. Root `README.md` with run steps for backend + frontend, Gmail app-password setup notes, and a
   "Demo script" section:
     1) upload a messy project-heavy CV + enter a demo email,
     2) show multiple matches incl. a non-obvious backend match via DB skills,
     3) switch to the inbox and show one email per matched job,
     4) open one email and point out it names the role AND its predefined next step,
     5) frame it: discovery -> semantic match -> automated outreach; recruiter's next step was set upfront.

Keep components small and readable. Prioritize a smooth demo over feature breadth.
```

**Done when:** uploading a CV emails the student one message per strong match (each stating `next_step`), and the UI reflects what was matched + emailed.

---

## Quick order of operations for the team

1. **P1** spins up Atlas + ingest (Part 1) — unblocks everyone. Create the index *first thing* (it builds slowly). Make sure every listing has a `next_step`.
2. **P2** builds CV upload + match API (Part 2) as soon as the collection has data.
3. **P3** builds the Gmail sender (Part 3 backend additions) in parallel — can test with a hardcoded match object before P2 is done.
4. **P4** scaffolds the frontend against mocked JSON, then wires to real endpoints.
5. Everyone converges on the **demo script** and rehearses twice.

## Guardrails for a safe demo
- Commit `backend/data/listings.json` (with `next_step`) — it's the whole dataset; there is no scraping.
- Set up + test the **Gmail app password** on day 1; keep the MOCK email fallback so a bad network never breaks the demo.
- Use a **real inbox you control** and pre-send once (check spam folder).
- Make `MATCH_THRESHOLD` and `MAX_EMAILS` env vars so you can tune live.
- Lock embedding dims to **1024** everywhere (query + documents + index).
```
