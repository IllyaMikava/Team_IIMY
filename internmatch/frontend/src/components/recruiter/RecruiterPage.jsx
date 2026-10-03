import { useCallback, useEffect, useState } from 'react'
import { closeJob, createJob, inviteCandidate, listJobs, listMatches, updateJob } from '../../api.js'
import PostRoleForm from './PostRoleForm.jsx'
import CandidatesTable from './CandidatesTable.jsx'
import RolesList from './RolesList.jsx'

const COMPANY_KEY = 'internmatch.recruiter.company'

function loadCompany() {
  try {
    return localStorage.getItem(COMPANY_KEY) || ''
  } catch {
    return ''
  }
}

export default function RecruiterPage({ showToast }) {
  const [company, setCompany] = useState(loadCompany)
  const [jobs, setJobs] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [invitingId, setInvitingId] = useState(null)

  const refresh = useCallback(
    async (name = company) => {
      setLoading(true)
      try {
        const [j, m] = await Promise.all([listJobs(name), listMatches(name)])
        setJobs(j)
        setMatches(m)
      } catch (e) {
        showToast(e.message || "Couldn't load recruiter data.")
      } finally {
        setLoading(false)
      }
    },
    [company, showToast],
  )

  // Reload when the company filter settles (debounced so typing doesn't spam the API).
  useEffect(() => {
    const t = setTimeout(() => refresh(company), 300)
    try {
      localStorage.setItem(COMPANY_KEY, company)
    } catch {
      /* storage unavailable — filter just won't be remembered */
    }
    return () => clearTimeout(t)
  }, [company]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePost(job) {
    const created = await createJob(job) // errors bubble to the form, which shows them
    showToast(`“${created.title}” is live. New CV uploads can match it now.`, 'success')
    if (!company.trim()) setCompany(created.company)
    else refresh()
    return created
  }

  async function handleClose(job) {
    if (!window.confirm(`Close “${job.title}”? It will stop matching new CVs.`)) return
    try {
      await closeJob(job.id)
      setJobs((js) => js.filter((j) => j.id !== job.id))
      showToast(`Closed “${job.title}”.`, 'success')
    } catch (e) {
      showToast(e.message || "Couldn't close that role.")
    }
  }

  async function handleInvite(match) {
    setInvitingId(match.id)
    try {
      const updated = await inviteCandidate(match.id)
      setMatches((ms) => ms.map((m) => (m.id === updated.id ? updated : m)))
      showToast(`Invited ${updated.candidate_email}. They've been emailed your next step.`, 'success')
    } catch (e) {
      showToast(e.message || "Couldn't send the invite.")
    } finally {
      setInvitingId(null)
    }
  }

  async function handleToggleInvite(job) {
    const invite_mode = job.invite_mode === 'manual' ? 'auto' : 'manual'
    try {
      const updated = await updateJob(job.id, { invite_mode })
      setJobs((js) => js.map((j) => (j.id === updated.id ? updated : j)))
      showToast(
        invite_mode === 'manual'
          ? `“${job.title}” now waits for your review before inviting.`
          : `“${job.title}” now invites matching students automatically.`,
        'success',
      )
    } catch (e) {
      showToast(e.message || "Couldn't update that role.")
    }
  }

  const strong = matches.filter((m) => !m.best_available)
  const candidates = new Set(strong.map((m) => m.candidate_email)).size
  const emailed = matches.filter((m) => m.emailed).length
  const toReview = matches.filter((m) => m.awaiting_review).length

  return (
    <>
      <section className="hero rec-hero">
        <div className="container hero-inner">
          <p className="eyebrow">For recruiters</p>
          <h1>Post a role once. Meet the students who actually fit.</h1>
          <p className="hero-sub">
            Describe the role and decide the <strong>next step</strong> upfront. Every CV
            that matches it by meaning gets emailed that next step and shows up here.
          </p>
        </div>
      </section>

      <section className="rec-toolbar-section">
        <div className="container">
          <div className="card rec-toolbar">
            <div className="field rec-company">
              <label htmlFor="rec-company" className="field-label">
                Your company
              </label>
              <input
                id="rec-company"
                className="text-input"
                placeholder="e.g. Stripe (leave empty to see every company)"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
              />
            </div>
            <dl className="stat-grid" aria-live="polite">
              <Stat label="Open roles" value={jobs.length} loading={loading} />
              <Stat label="Candidates matched" value={candidates} loading={loading} />
              <Stat label="Emails sent" value={emailed} loading={loading} />
              <Stat label="To review" value={toReview} loading={loading} highlight={toReview > 0} />
            </dl>
          </div>
        </div>
      </section>

      <section id="post" className="rec-section">
        <div className="container">
          <PostRoleForm defaultCompany={company} onSubmit={handlePost} />
        </div>
      </section>

      <section id="candidates" className="rec-section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Matched candidates</h2>
              <p className="section-sub">Students whose CVs matched your roles, newest first.</p>
            </div>
            <button type="button" className="btn" onClick={() => refresh()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <CandidatesTable matches={matches} loading={loading} onInvite={handleInvite} invitingId={invitingId} />
        </div>
      </section>

      <section id="roles" className="rec-section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>{company.trim() ? `${company.trim()} roles` : 'All roles'}</h2>
              <p className="section-sub">What candidates are being matched against right now.</p>
            </div>
          </div>
          <RolesList jobs={jobs} loading={loading} onClose={handleClose} onToggleInvite={handleToggleInvite} />
        </div>
      </section>
    </>
  )
}

function Stat({ label, value, loading, highlight }) {
  return (
    <div className={`stat${highlight ? ' stat-highlight' : ''}`}>
      <dt>{label}</dt>
      <dd>{loading ? '–' : value}</dd>
    </div>
  )
}
