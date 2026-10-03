import { useState } from 'react'

const PAGE = 12

export default function RolesList({ jobs, loading, onClose }) {
  const [shown, setShown] = useState(PAGE)

  if (loading && !jobs.length) return <p className="rec-empty">Loading roles…</p>
  if (!jobs.length) {
    return (
      <div className="rec-empty card">
        <p className="rec-empty-title">No roles yet</p>
        <p>Post your first role above. It starts matching CVs straight away.</p>
      </div>
    )
  }

  return (
    <>
      <div className="role-grid">
        {jobs.slice(0, shown).map((job) => (
          <article key={job.id} className="role-card">
            <div className="match-head">
              <div>
                <h3 className="match-title">{job.title}</h3>
                <p className="match-company">
                  {job.company}
                  {job.location && ` · ${job.location}`}
                </p>
              </div>
              <span className={`badge ${job.match_count ? 'badge-accent' : 'badge-muted'}`}>
                {job.match_count} {job.match_count === 1 ? 'match' : 'matches'}
              </span>
            </div>

            <div className="chip-row">
              {job.skills.slice(0, 6).map((s) => <span key={s} className="chip">{s}</span>)}
              {job.skills.length > 6 && <span className="chip chip-more">+{job.skills.length - 6}</span>}
            </div>

            <div className="next-step-pill">
              <span className="next-step-label">Next step</span>
              <span className="next-step-text">{job.next_step}</span>
            </div>

            <div className="role-actions">
              {job.url ? (
                <a className="match-link" href={job.url} target="_blank" rel="noopener noreferrer">View posting →</a>
              ) : <span />}
              <button type="button" className="btn-link-danger" onClick={() => onClose(job)}>
                Close role
              </button>
            </div>
          </article>
        ))}
      </div>
      {jobs.length > shown && (
        <div className="show-more">
          <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE * 2)}>
            Show more ({jobs.length - shown} more)
          </button>
        </div>
      )}
    </>
  )
}
