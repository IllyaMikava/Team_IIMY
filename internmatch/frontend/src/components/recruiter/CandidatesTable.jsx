const pct = (score) => Math.round((score ?? 0) <= 1 ? (score ?? 0) * 100 : score)

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function CandidatesTable({ matches, loading }) {
  if (loading && !matches.length) return <p className="rec-empty">Loading candidates…</p>
  if (!matches.length) {
    return (
      <div className="rec-empty card">
        <p className="rec-empty-title">No candidates yet</p>
        <p>When a student uploads a CV that matches one of your roles, they'll appear here.</p>
      </div>
    )
  }

  return (
    <div className="card table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            <th scope="col">Matched role</th>
            <th scope="col">Match</th>
            <th scope="col">Next step</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id}>
              <td data-label="Candidate">
                <a className="cell-strong" href={`mailto:${m.candidate_email}`}>{m.candidate_email}</a>
                <span className="cell-dim">{timeAgo(m.created_at)}</span>
              </td>
              <td data-label="Matched role">
                <span className="cell-strong">{m.job_title}</span>
                <span className="cell-dim">{m.company}</span>
                {m.match_reason && <span className="cell-reason">{m.match_reason}</span>}
              </td>
              <td data-label="Match">
                <div className="score-row score-row-sm">
                  <div className="score-bar"><div className="score-fill" style={{ width: `${pct(m.score)}%` }} /></div>
                  <span className="score-pct">{pct(m.score)}%</span>
                </div>
              </td>
              <td data-label="Next step" className="cell-next">{m.next_step}</td>
              <td data-label="Status">
                {m.best_available ? (
                  <span className="badge badge-muted" title="Closest role, but below the match threshold, so it wasn't emailed">Closest match</span>
                ) : m.emailed ? (
                  <span className="match-badge">emailed ✓</span>
                ) : (
                  <span className="badge badge-miss">email failed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
