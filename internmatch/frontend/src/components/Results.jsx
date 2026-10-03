import { useEffect, useState } from 'react'
import MatchCard from './MatchCard.jsx'

const matchKey = (m, i) => m.url || `${m.job_title}-${i}`

export default function Results({ data }) {
  // { [matchKey]: 'accepted' | 'rejected' } — kept in the browser only.
  const [decisions, setDecisions] = useState({})

  // A new search starts with a clean slate.
  useEffect(() => setDecisions({}), [data])

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

  function decide(key, decision) {
    setDecisions((prev) => {
      const next = { ...prev }
      if (decision) next[key] = decision
      else delete next[key]
      return next
    })
  }

  const values = Object.values(decisions)
  const accepted = values.filter((d) => d === 'accepted').length
  const rejected = values.length - accepted
  const pending = matches.length - values.length

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

        <div className="results-head">
          <h2 className="results-title">Your matches</h2>
          <p className="results-tally">
            <span className="tally-accepted">{accepted} accepted</span>
            <span className="tally-rejected">{rejected} rejected</span>
            <span>{pending} to review</span>
          </p>
        </div>
        <div className="results-grid">
          {matches.map((m, i) => {
            const key = matchKey(m, i)
            return (
              <MatchCard
                key={key}
                match={m}
                index={i}
                decision={decisions[key]}
                onDecide={(d) => decide(key, d)}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
