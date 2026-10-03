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
5. Every match with `score >= MATCH_THRESHOLD` (default `0.75`) is kept, capped at `MAX_EMAILS` (default `5`). If none clear the bar, the single best match is returned and flagged "best available".
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
| Job dataset | `internmatch/backend/data/listings.json` | **271** listings, all with `title, company, location, url, description, skills, next_step, source`. No embeddings (those are added in Atlas by `ingest.py`). |
| Frontend page + styles | `internmatch/frontend/index.html`, `style.css` | Static HTML/CSS: hero, CV dropzone, email field, result cards (score bar, reason, next-step pill, emailed badge), summary banner, empty state, toast. |
| `.gitignore` | root | Ignores `.env`, venvs, `node_modules`, etc. |

### ⏳ Not done yet

**Part 1 — Data (P1)**
- [ ] MongoDB Atlas cluster + `vector_index` (path `embedding`, 1024 dims, cosine). Create it **first**, because it takes a few minutes to build.
- [ ] `backend/requirements.txt`
- [ ] `backend/app/db.py` (`listings` + `match_events` helpers)
- [ ] `backend/app/embeddings.py` (`embed_texts`, `embed_query`)
- [ ] `backend/scripts/ingest.py` (embed `listings.json` → upsert into Atlas)
- [ ] `backend/README_INDEX.md`, `backend/.env.example`

**Part 2 — Backend / Match (P2)**
- [ ] `backend/app/models.py` (`MatchResult`, `UploadResponse`)
- [ ] `backend/app/cv_parser.py` (PDF / DOCX / TXT → text)
- [ ] `backend/app/search.py` (`vector_search`, `filter_strong`, optional `explain_matches`)
- [ ] `backend/app/main.py` (`GET /api/health`, `POST /api/upload-cv`)

**Part 3 — Email + Frontend (P3 / P4)**
- [ ] `backend/app/emailer.py` (Gmail SMTP + MOCK fallback)
- [ ] `match_events` inserts + `total_emailed` in `/api/upload-cv`
- [ ] **`internmatch/frontend/script.js`**: `index.html` loads it, but the file doesn't exist yet, so the page is static and the form does nothing
- [ ] Point the frontend at `http://localhost:8000`
- [ ] Run steps (below) verified end to end, then rehearse the demo twice

### ⚠️ Open decisions (repo vs. plan)

1. **Frontend tech.** The plan says *Vite + React + Tailwind*, but what's built is plain HTML/CSS. Recommendation: keep the plain page and add `script.js` (it's already built and has no build step). If we stay plain, `VITE_API_BASE` becomes a constant in `script.js`.
2. **Dataset size and `seed.py`.** The plan says `seed.py` generates ~300 listings, but `listings.json` was hand-authored with 271 entries. Recommendation: skip `seed.py` and have `ingest.py` read `listings.json` directly. 271 is plenty for the demo.

---

## Run it (once Parts 1–3 are built)

**Backend**
```bash
cd internmatch/backend
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                                # fill in the keys below
python scripts/ingest.py                            # embeds + uploads listings.json
uvicorn app.main:app --reload --port 8000
```

**Frontend**: open `internmatch/frontend/index.html` in a browser (or serve the folder, e.g. `python -m http.server 5173`).

**`backend/.env`**
```
MONGODB_URI=mongodb+srv://...
VOYAGE_API_KEY=...
ANTHROPIC_API_KEY=...          # only for match reasons
MATCH_THRESHOLD=0.75
MAX_EMAILS=5
GMAIL_ADDRESS=youraddr@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # Google Account → Security → 2-Step Verification → App passwords
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
