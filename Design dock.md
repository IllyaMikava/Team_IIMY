# InternMatch AI — Design Document

**MongoDB Hackathon · Team of 4**
**Theme:** AI-native hiring / internship discovery
**Date:** 2026-10-03

---

## 1. Problem Statement

Generic job boards return hundreds of keyword-matched, mostly irrelevant results. Students struggle because:

- Job search is **keyword-based**, not **meaning-based**. A CV describing "built a React dashboard with a Postgres backend" won't surface a "Backend Engineering Intern — SQL" role, even though it's a great fit.
- Students apply manually to dozens of roles with no idea which actually fit.
- Recruiters drown in irrelevant applications.

**InternMatch AI** flips this: a student uploads their **CV once** (plus their email), the app semantically matches it against all stored job descriptions, and **automatically emails the student** about every strong match. Each email states that job's **predefined next step** (e.g. a Zoom call or assessment), which the recruiter sets upfront when the job is posted.

---

## 2. Goals & Non-Goals

### Goals
- Upload a CV (PDF/DOCX) + enter email → parse → semantic match against job descriptions.
- Return **all** strong matches above a similarity threshold (not just the top one).
- For **each** strong match, send the student **one email** naming the role and its **predefined next step**.
- The next step is a field on each job, **decided upfront when the job is posted** (not AI-generated).

### Non-Goals (for the hackathon)
- **No scraping of any kind.** Job descriptions are pre-seeded directly into MongoDB from a committed dataset. The app only matches CV text against those stored listings.
- User accounts / login / recruiter dashboard.
- Generating or grading assessments (the next step is just stated; recruiter handles it).
- GitHub repo analysis (removed from scope).

---

## 3. High-Level Architecture

```
┌─────────────┐     ┌────────────────────────┐     ┌──────────────────────┐
│  React UI   │────▶│   FastAPI Backend       │────▶│  MongoDB Atlas       │
│ (Vite)      │◀────│   (Python)              │◀────│  + Vector Search     │
│ upload CV   │     │                         │     │  (job descriptions)  │
│ + email     │     │                         │     │                      │
└─────────────┘     └───────────┬────────────┘     └──────────────────────┘
                                │
                 ┌──────────────┼────────────────┐
                 ▼              ▼                 ▼
          ┌───────────┐  ┌────────────┐   ┌──────────────┐
          │ CV parser │  │ Voyage AI  │   │ Gmail SMTP   │
          │ pdf/docx  │  │ embeddings │   │ (one email   │
          │ → text    │  │            │   │  per match)  │
          └───────────┘  └────────────┘   └──────────────┘
```

**End-to-end flow:**
1. User uploads CV file + enters their email in the React UI.
2. Backend extracts text from the CV (pdfplumber / python-docx).
3. Backend embeds the CV text with Voyage AI (`voyage-3`, 1024 dims).
4. Atlas `$vectorSearch` ranks job descriptions; keep all with `score >= THRESHOLD`.
5. For each strong match, send the student **one email** via Gmail SMTP, stating the role and that job's **`next_step`**.
6. UI confirms which jobs were matched and emailed.
7. The recruiter runs the stated next step (Zoom call / assessment / etc.) — outside the app.

---

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind | Fast dev, clean demo UI, file upload |
| Backend | Python + FastAPI | Great for parsing/embeddings; async |
| Database | MongoDB Atlas (M0 free tier) | Required; native Vector Search |
| Embeddings | **Voyage AI** (`voyage-3`, 1024 dims) | MongoDB's partner; judges favor it |
| CV parsing | pdfplumber + python-docx | Plain text extraction from PDF/DOCX |
| Match reasons (optional) | **Claude** (`claude-haiku-4-5`) | One-line "why matched" per result |
| Email | **Gmail SMTP** (smtplib + app password) | Zero signup, works instantly |

---

## 5. Data Model (MongoDB)

### Collection: `listings` (job descriptions)
```json
{
  "_id": "ObjectId",
  "title": "Backend Engineering Intern",
  "company": "Acme Fintech",
  "location": "Dublin, Ireland",
  "url": "https://...",
  "description": "Full job description text...",
  "skills": ["Python", "SQL", "REST APIs"],
  "next_step": "Recruiter will schedule a 30-minute Zoom intro call.",
  "source": "IrishJobs.ie",
  "embedding": [0.013, -0.021, ...],   // 1024-dim Voyage vector
  "ingested_at": "2026-10-03T10:00:00Z"
}
```

> `next_step` is **free text, set when the job is posted** (decided upfront). The email reads it verbatim; the app never generates it.

### Collection: `match_events` (audit of what was emailed)
```json
{
  "_id": "ObjectId",
  "candidate_email": "student@example.com",
  "listing_id": "ObjectId of matched listing",
  "job_title": "Backend Engineering Intern",
  "company": "Acme Fintech",
  "score": 0.87,
  "next_step": "Recruiter will schedule a 30-minute Zoom intro call.",
  "emailed": true,
  "created_at": "2026-10-03T10:05:00Z"
}
```

### Atlas Vector Search Index (`vector_index`)
```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" }
  ]
}
```

---

## 6. API Design (FastAPI)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/upload-cv` | multipart: CV file + `email`. Parses, matches, emails all strong matches, returns summary. |
| `GET` | `/api/health` | Health check. |

**`/api/upload-cv` response:**
```json
{
  "candidate_email": "student@example.com",
  "matches": [
    {
      "job_title": "Backend Engineering Intern",
      "company": "Acme Fintech",
      "score": 0.87,
      "match_reason": "Your Postgres + API project maps to this SQL-heavy backend role.",
      "next_step": "Recruiter will schedule a 30-minute Zoom intro call.",
      "emailed": true
    }
  ],
  "total_emailed": 3
}
```

---

## 7. Matching Logic

- Embed full CV text as a single query vector (`input_type="query"`).
- `$vectorSearch` with `numCandidates=100`, `limit=15`, project `vectorSearchScore`.
- Keep matches where `score >= MATCH_THRESHOLD` (default **0.75**, tune during the demo).
- Cap at `MAX_EMAILS` (e.g. 5) to avoid spamming during a demo.
- If **zero** matches clear the threshold, return the top 1 anyway, flagged "best available".

---

## 8. Email

- For each strong match, send one email via Gmail SMTP:
  - Subject: `You matched: {job_title} at {company}`
  - Body: a short match note (optionally the one-line `match_reason`) + **"Next step: {next_step}"** pulled straight from the job's `next_step` field + a link to the job `url`.
- Record each send in `match_events`.
- The recruiter then runs that next step — outside the app.

---

## 9. Demo Script (the money shot)

1. Upload a sample CV (messy, project-heavy) + enter a demo email.
2. App shows **multiple** strong matches ranked by score — including a **non-obvious** one (backend role matched via DB skills in the CV).
3. Switch to the inbox → show the **emails that arrived**, one per matched job.
4. Open one email → point out it names the role **and the predefined next step** (e.g. "Recruiter will schedule a Zoom call").
5. Frame it: the app automated discovery → semantic match → outreach, and the recruiter's next step was decided upfront per job.

---

## 10. Team Split (4 people)

| Person | Owns |
|---|---|
| **P1 — Data** | Author ~300 sample job descriptions (incl. `next_step`) as a committed dataset, MongoDB schema, Voyage pipeline, Atlas index |
| **P2 — Backend/Match** | FastAPI, CV parsing, `$vectorSearch`, threshold logic, `match_events` |
| **P3 — Email** | Gmail SMTP sender, one-email-per-match, optional Claude match reasons |
| **P4 — Frontend** | React UI: CV upload + email field, matches view, demo polish |

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scraping | **None** — out of scope; listings are pre-seeded data |
| Gmail SMTP app-password issues | Set up + test the app password on day 1; have a mock-send fallback that logs the email |
| Emails land in spam | Use a real test inbox you control; pre-send once before the demo |
| Threshold too strict/loose | Make `MATCH_THRESHOLD` an env var; tune live |
| Dimension mismatch | Lock `voyage-3` = 1024 dims everywhere |
| Demo spam | Cap `MAX_EMAILS` per upload (e.g. 5) |

---

## 12. Build Milestones

- **M1 (first 2h):** Atlas up, `vector_index` created, ~300 sample job descriptions seeded with embeddings + `next_step`.
- **M2:** `/api/upload-cv` parses a CV and returns ranked matches (no email yet).
- **M3:** Threshold filtering + `match_events` records.
- **M4:** Gmail SMTP sends one email per match, stating `next_step`.
- **M5:** React upload UI + matches view + rehearse the demo twice.

---

## 13. Environment Variables

```
# backend/.env
MONGODB_URI=mongodb+srv://...
VOYAGE_API_KEY=...
ANTHROPIC_API_KEY=...          # only if using match reasons
MATCH_THRESHOLD=0.75
MAX_EMAILS=5
GMAIL_ADDRESS=youraddr@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```
