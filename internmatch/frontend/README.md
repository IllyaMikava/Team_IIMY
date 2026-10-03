# InternMatch AI — Frontend (React + Vite)

CV-upload UI for InternMatch AI. Upload a CV + email, get back semantically
matched job listings, each showing the recruiter's predefined next step.

## Run

```bash
cd internmatch/frontend
npm install
npm run dev          # http://localhost:5173
```

In dev, requests to `/api/*` are proxied to the FastAPI backend at
`http://localhost:8000` (see `vite.config.js`). Start the backend separately.

### Standalone / demo mode (no backend)

Run the UI with built-in mock matches:

```bash
VITE_USE_MOCK=true npm run dev
```

## Build

```bash
npm run build        # outputs to dist/
npm run preview      # serve the production build
```

## Config

Copy `.env.example` to `.env` and adjust:

- `VITE_API_BASE` — backend base URL for production (empty in dev).
- `VITE_USE_MOCK` — `true` to use mock data with no backend.

## Structure

```
src/
├── main.jsx            # entry
├── App.jsx             # state: upload → fetch → results, toasts
├── api.js              # uploadCv() + mock fallback
├── styles.css          # design system (tokens, cards, pills)
└── components/
    ├── Header.jsx
    ├── Hero.jsx
    ├── UploadCard.jsx  # file drag-drop + email + validation
    ├── Results.jsx     # summary banner + grid / empty state
    ├── MatchCard.jsx   # score bar, match reason, next-step pill
    ├── HowItWorks.jsx
    ├── Footer.jsx
    └── Toast.jsx
```
