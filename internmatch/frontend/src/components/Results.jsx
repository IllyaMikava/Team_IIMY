import MatchCard from './MatchCard.jsx'

export default function Results({ data }) {
  // No search run yet.
  if (!data) return null

  const { matches = [], total_emailed = 0 } = data

  // Searched but nothing cleared the threshold.
  if (!matches.length) {
    return (
      <section className="empty-state">
        <div className="container">
          <div className="empty-inner">
            <div className="empty-icon">🔍</div>
            <h3>No strong matches yet</h3>
            <p>
              We couldn't find a confident match for this CV. Try a more detailed
              CV or check back as new roles are added.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="results-section">
      <div className="container">
        <div className="summary-banner">
          <span className="summary-icon">✓</span>
          <span>
            We emailed you about {total_emailed} matching role
            {total_emailed === 1 ? '' : 's'}.
          </span>
        </div>

        <h2 className="results-title">Your matches</h2>
        <div className="results-grid">
          {matches.map((m, i) => (
            <MatchCard key={m.url || `${m.job_title}-${i}`} match={m} />
          ))}
        </div>
      </div>
    </section>
  )
}
