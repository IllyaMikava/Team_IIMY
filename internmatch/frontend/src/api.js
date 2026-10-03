// API base: in dev, Vite proxies /api -> localhost:8000 (see vite.config.js),
// so the default empty base works. Override with VITE_API_BASE in prod.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// Set VITE_USE_MOCK=true to run the UI with no backend (demo / standalone).
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/**
 * Upload a CV + email, get back { candidate_email, matches, total_emailed }.
 * @param {File} file
 * @param {string} email
 */
export async function uploadCv(file, email) {
  if (USE_MOCK) return mockUpload(email)

  const form = new FormData()
  form.append('file', file)
  form.append('email', email)

  const res = await fetch(`${API_BASE}/api/upload-cv`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  return res.json()
}

// --- mock response, shape-identical to the real backend ---
function mockUpload(email) {
  const matches = [
    {
      job_title: 'Backend Engineering Intern',
      company: 'Acme Fintech',
      location: 'Dublin, Ireland',
      url: 'https://example.com/jobs/backend-intern',
      score: 0.87,
      match_reason:
        'Your Postgres + REST API project maps directly to this SQL-heavy backend role.',
      next_step: 'Recruiter will schedule a 30-minute Zoom intro call.',
      emailed: true,
    },
    {
      job_title: 'Data Engineering Intern',
      company: 'Docklands Data Co.',
      location: 'Dublin, Ireland',
      url: 'https://example.com/jobs/data-intern',
      score: 0.79,
      match_reason:
        'Your Python + pandas dashboard shows the pipeline skills this role needs.',
      next_step: 'Complete a short take-home SQL task.',
      emailed: true,
    },
    {
      job_title: 'Full-Stack Intern',
      company: 'Harbour Health',
      location: 'Remote (Ireland)',
      url: 'https://example.com/jobs/fullstack-intern',
      score: 0.74,
      match_reason:
        'React front end plus a backend service is a strong fit for this full-stack role.',
      next_step: 'Phone screen with the engineering team.',
      emailed: true,
    },
  ]
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          candidate_email: email,
          matches,
          total_emailed: matches.length,
        }),
      900,
    ),
  )
}
