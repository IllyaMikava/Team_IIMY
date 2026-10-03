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

// --------------------------------------------------------------- recruiter API

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      // FastAPI validation errors come back as a list of {loc, msg}.
      if (Array.isArray(body?.detail)) {
        detail = body.detail
          .map((d) => `${d.loc?.at(-1) ?? 'field'}: ${d.msg}`)
          .join(' · ')
      } else if (body?.detail) {
        detail = body.detail
      }
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  return res.status === 204 ? null : res.json()
}

const companyQuery = (company) =>
  company?.trim() ? `?company=${encodeURIComponent(company.trim())}` : ''

/** Roles (newest first) with match_count. Optional company filter. */
export function listJobs(company) {
  if (USE_MOCK) return Promise.resolve(mockJobs.filter((j) => byCompany(j, company)))
  return request(`/api/recruiter/jobs${companyQuery(company)}`)
}

/** Post a role: { title, company, location, url, description, skills[], next_step }. */
export function createJob(job) {
  if (USE_MOCK) {
    const created = { ...job, id: `mock-${Date.now()}`, source: 'InternMatch recruiter page', posted_at: new Date().toISOString(), match_count: 0 }
    mockJobs.unshift(created)
    return Promise.resolve(created)
  }
  return request('/api/recruiter/jobs', { method: 'POST', body: JSON.stringify(job) })
}

/** Close (delete) a role so it stops matching. */
export function closeJob(id) {
  if (USE_MOCK) {
    mockJobs = mockJobs.filter((j) => j.id !== id)
    return Promise.resolve(null)
  }
  return request(`/api/recruiter/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Candidates matched to roles (newest first). Optional company filter. */
export function listMatches(company) {
  if (USE_MOCK) return Promise.resolve(mockMatches.filter((m) => byCompany(m, company)))
  return request(`/api/recruiter/matches${companyQuery(company)}`)
}

// --- recruiter mocks, shape-identical to the real backend ---
const byCompany = (row, company) =>
  !company?.trim() || row.company.toLowerCase().includes(company.trim().toLowerCase())

let mockJobs = [
  {
    id: 'mock-1',
    title: 'Backend Engineering Intern',
    company: 'Acme Fintech',
    location: 'Dublin, Ireland',
    url: 'https://example.com/jobs/backend-intern',
    description: 'Build and maintain REST APIs backed by Postgres for our payments platform.',
    skills: ['Python', 'SQL', 'REST APIs', 'Postgres'],
    next_step: 'Recruiter will schedule a 30-minute Zoom intro call.',
    invite_mode: 'auto',
    source: 'InternMatch recruiter page',
    posted_at: new Date(Date.now() - 86400000).toISOString(),
    match_count: 2,
  },
  {
    id: 'mock-2',
    title: 'Data Engineering Intern',
    company: 'Acme Fintech',
    location: 'Remote (EU)',
    url: '',
    description: 'Help build batch pipelines that move transaction data into our warehouse.',
    skills: ['Python', 'Airflow', 'SQL'],
    next_step: 'Complete a short take-home SQL task.',
    invite_mode: 'manual',
    source: 'InternMatch recruiter page',
    posted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    match_count: 1,
  },
]

const mockMatches = [
  {
    id: 'm1', candidate_email: 'alex.murphy@example.com', job_id: 'mock-1',
    job_title: 'Backend Engineering Intern', company: 'Acme Fintech', score: 0.81,
    next_step: 'Recruiter will schedule a 30-minute Zoom intro call.',
    match_reason: 'Their Postgres + REST API gym tracker maps directly to this role.',
    emailed: true, best_available: false, created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'm2', candidate_email: 'sam.oconnor@example.com', job_id: 'mock-1',
    job_title: 'Backend Engineering Intern', company: 'Acme Fintech', score: 0.77,
    next_step: 'Recruiter will schedule a 30-minute Zoom intro call.', match_reason: '',
    emailed: true, best_available: false, created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'm3', candidate_email: 'priya.n@example.com', job_id: 'mock-2',
    job_title: 'Data Engineering Intern', company: 'Acme Fintech', score: 0.75,
    next_step: 'Complete a short take-home SQL task.', match_reason: '',
    emailed: false, best_available: false, awaiting_review: true, created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

/** Switch a role between 'auto' and 'manual' invite. */
export function updateJob(id, patch) {
  if (USE_MOCK) {
    const job = mockJobs.find((j) => j.id === id)
    Object.assign(job, patch)
    return Promise.resolve({ ...job })
  }
  return request(`/api/recruiter/jobs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

/** Manual invite: email this matched candidate the role's next step now. */
export function inviteCandidate(matchId) {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === matchId)
    Object.assign(m, { emailed: true, awaiting_review: false, invited_at: new Date().toISOString() })
    return Promise.resolve({ ...m })
  }
  return request(`/api/recruiter/matches/${encodeURIComponent(matchId)}/invite`, { method: 'POST' })
}
