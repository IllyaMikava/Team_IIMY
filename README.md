# Team_IIMY — InternMatch AI

MongoDB Hackathon · Team of 4

**Upload your CV once → we match it by meaning against every stored internship → you get one email per strong match, each stating that job's predefined next step.**

Full spec: [Design dock.md](Design%20dock.md) · Build prompts: [InternMatch Implementation Prompts.md](InternMatch%20Implementation%20Prompts.md)

---

## How it works

```
 Student                    FastAPI backend                         MongoDB Atlas
┌──────────┐  CV + email  ┌──────────────────────────────┐        ┌──────────────────┐
│  Web UI  │ ───────────▶ │ 1. extract CV text           │        │ listings         │
│          │              │    (pdfplumber/python-docx)  │        │  + embedding     │
│          │              │ 2. embed text (Voyage AI)    │ ─────▶ │  + next_step     │
│          │              │ 3. $vectorSearch             │ ◀───── │ vector_index     │
│          │              │ 4. keep score ≥ threshold    │        │                  │
│          │ ◀─────────── │ 5. email each match (Gmail)  │ ─────▶ │ match_events     │
└──────────┘   matches    └──────────────────────────────┘        └──────────────────┘
```

1. The student uploads a CV (PDF, DOCX or TXT) and enters their email.
2. The backend extracts plain text from the CV.
3. The text is embedded with **Voyage AI** (`voyage-3`, 1024 dims, `input_type="query"`).
4. Atlas **`$vectorSearch`** ranks the stored job descriptions (`numCandidates=100`, `limit=15`).
5. Every match with `score >= MATCH_THRESHOLD` (default `0.75`) is kept, capped at `MAX_EMAILS` (default `5`). If none clear the bar, the single best match is returned and flagged "best available" (shown in the UI but not emailed).
6. *(Optional)* One Claude call (`claude-haiku-4-5`) writes a one-line "why this matched" for each result.
7. For each match, **one email** goes out via Gmail SMTP:
   `You matched: {job_title} at {company}`, with the reason, **`Next step: {next_step}`** copied verbatim from the job, and the job link.
   If Gmail isn't configured, the email is logged to the console instead (MOCK mode).
8. Each send is recorded in the `match_events` collection, and the UI shows the matches plus an "emailed ✓" badge.
9. The recruiter runs the next step (Zoom call, assessment, etc.) outside the app.

**Out of scope:** scraping (the dataset is committed), accounts/login, recruiter dashboard, GitHub repo analysis.

---

## Status

### ✅ Done

| Item | Where | Notes |
|---|---|---|
| Design doc + build prompts (CV → match → email flow) | `Design dock.md`, `InternMatch Implementation Prompts.md` | Latest plan. `Design dock.docx` is generated from the `.md`. |
| Job dataset | `internmatch/backend/data/listings.json` | **271** listings, all with `title, company, location, url, description, skills, next_step, source`. Embeddings are added in Atlas by `ingest.py`. |
| **Backend: data pipeline** | `backend/app/db.py`, `embeddings.py`, `scripts/ingest.py`, `scripts/create_index.py` | Voyage `voyage-3` (1024 dims), batched with retry. Ingest saves after every batch and only re-embeds listings whose text changed. |
| **Backend: API** | `backend/app/main.py`, `cv_parser.py`, `search.py`, `models.py` | `GET /api/health`, `POST /api/upload-cv` (PDF/DOCX/TXT → text → `$vectorSearch` → threshold → reasons → email → `match_events`). |
| **Backend: email** | `backend/app/emailer.py` | Gmail SMTP, one email per strong match with `Next step:` verbatim. **MOCK mode** (prints the email) when Gmail isn't configured. |
| Match reasons (optional) | `backend/app/search.py` → `explain_matches` | One `claude-haiku-4-5` call with structured output; blank reasons if no key or on any error. |
| Frontend page + styles | `internmatch/frontend/index.html`, `style.css` | Static HTML/CSS: hero, CV dropzone, email field, result cards, summary banner, empty state, toast. |

The backend passes an offline test run with the network services faked: CV parsing, threshold and fallback, reasons, email building, and every API success and error path.
It has **not** yet been run against a real Atlas cluster or a real Voyage or Gmail account, because that needs the team's keys.

### ⏳ Not done yet

**Accounts and keys (do these first)**
- [ ] Create an Atlas cluster (M0 is fine): add a DB user, allow your IP under Network Access, and copy the connection string into `backend/.env`
- [ ] Get a Voyage API key → `backend/.env`. Adding a payment method lifts the very low free-tier rate limits; the free token allowance still applies.
- [ ] Run `python scripts/ingest.py`, then `python scripts/create_index.py`, then `python scripts/try_search.py --file data/sample_cv.txt`
- [ ] Gmail app password → `backend/.env`, then send a test to an inbox you control and check spam
- [ ] *(optional)* Anthropic API key for match reasons

**Frontend (P4)**
- [ ] **`internmatch/frontend/script.js`**: `index.html` loads it, but the file doesn't exist yet, so the form does nothing. It should POST `file` + `email` as multipart to `http://localhost:8000/api/upload-cv` and render `matches`.
- [ ] Full demo run end to end, then rehearse twice

### ⚠️ Open decisions (repo vs. plan)

1. **Frontend tech.** The plan says *Vite + React + Tailwind*, but what's built is plain HTML/CSS. Recommendation: keep the plain page and add `script.js` (it's already built and has no build step). The backend allows any origin by default (`CORS_ORIGINS=*`), so this works even when the page is opened straight from disk.
2. **`seed.py` skipped.** `listings.json` was hand-authored (271 entries), so there is no generator script. `ingest.py` reads `listings.json` directly and validates it first (`--dry-run`).

---

## Run it

**1. Backend setup (once)**
```bash
cd internmatch/backend
python -m venv .venv
.venv/Scripts/activate                  # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                    # then fill in the keys
```

**2. Load the data (once, or after editing `listings.json`)**
```bash
python scripts/ingest.py --dry-run      # validates listings.json, no network
python scripts/ingest.py                # embeds with Voyage + upserts into Atlas
python scripts/create_index.py          # creates vector_index and waits until it's ready
python scripts/try_search.py --file data/sample_cv.txt   # sanity check: prints ranked jobs + scores
```
If Voyage rate-limits you, use `python scripts/ingest.py --batch-size 32`. Rerunning is safe because it skips what's already embedded.
Index details and the Atlas UI alternative are in [`internmatch/backend/README_INDEX.md`](internmatch/backend/README_INDEX.md).

**3. Start the API**
```bash
uvicorn app.main:app --reload --port 8000
```
- Health check: http://localhost:8000/api/health → `{"status":"ok","email_mode":"mock"|"gmail"}`
- Interactive docs: http://localhost:8000/docs
- Test without the frontend:
  ```bash
  curl -X POST http://localhost:8000/api/upload-cv -F "file=@data/sample_cv.txt" -F "email=you@example.com"
  ```

**4. Frontend**: open `internmatch/frontend/index.html` in a browser (or `python -m http.server 5173` in that folder).

### API contract

`POST /api/upload-cv` (multipart: `file` = PDF/DOCX/TXT up to 5 MB, `email`)
```json
{
  "candidate_email": "student@example.com",
  "matches": [
    {
      "job_title": "Backend Engineering Intern",
      "company": "Acme Fintech",
      "location": "Dublin, Ireland",
      "url": "https://...",
      "score": 0.87,
      "next_step": "Recruiter will schedule a 30-minute Zoom intro call.",
      "match_reason": "Your Postgres + API project maps to this SQL-heavy backend role.",
      "emailed": true,
      "best_available": false
    }
  ],
  "total_emailed": 3
}
```
- `matches` holds every result with `score >= MATCH_THRESHOLD`, best first, capped at `MAX_EMAILS`. Each one gets an email.
- If nothing clears the threshold, you get the single best result with `best_available: true`. It is **not emailed**, because it isn't a strong match.
- Errors return `{"detail": "..."}`: `400` for a bad file type, unreadable file or bad email; `413` for a file over 5 MB; `503` when search is unavailable (MongoDB/Voyage not configured or not reachable).

### `backend/.env`
```
MONGODB_URI=mongodb+srv://...
VOYAGE_API_KEY=...
ANTHROPIC_API_KEY=...                    # optional: match reasons
MATCH_THRESHOLD=0.75                     # vectorSearchScore = (1 + cosine) / 2
MAX_EMAILS=5
GMAIL_ADDRESS=youraddr@gmail.com         # leave both Gmail values empty → MOCK mode (emails print to the console)
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # Google Account → Security → 2-Step Verification → App passwords
CORS_ORIGINS=*
```

---

## Demo script

1. Upload a messy, project-heavy CV and enter a demo email (an inbox you control; check spam once beforehand).
2. Show **multiple** ranked matches, including a non-obvious one (e.g. a backend role matched through database skills).
3. Switch to the inbox: there's one email per matched job.
4. Open one: it names the role **and** its predefined next step.
5. Frame it: discovery → semantic match → automated outreach, with the recruiter's next step set upfront.

## Team split

| Person | Owns |
|---|---|
| P1 — Data | Dataset, Atlas + `vector_index`, Voyage ingest |
| P2 — Backend/Match | FastAPI, CV parsing, `$vectorSearch`, threshold, `match_events` |
| P3 — Email | Gmail SMTP sender, optional Claude match reasons |
| P4 — Frontend | Upload UI, matches view, demo polish |
