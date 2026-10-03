const DECISION_LABEL = { accepted: '✓ Accepted', rejected: '✕ Rejected' }

export default function MatchCard({ match, index = 0, decision, onDecide }) {
  // score may come as 0..1 (cosine) or 0..100; normalise to a percentage.
  const raw = match.score ?? 0
  const pct = Math.round(raw <= 1 ? raw * 100 : raw)

  return (
    <article
      className={`match-card${decision ? ` ${decision}` : ''}`}
      // Cards arrive one after another rather than all at once.
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="match-head">
        <div>
          <h3 className="match-title">{match.job_title}</h3>
          <p className="match-company">{match.company}</p>
        </div>
        {match.emailed && <span className="match-badge">emailed ✓</span>}
      </div>

      {match.location && <p className="match-location">{match.location}</p>}

      <div className="score-row">
        <div className="score-bar">
          <div className="score-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="score-pct">{pct}%</span>
      </div>

      {match.match_reason && <p className="match-reason">{match.match_reason}</p>}

      {match.next_step && (
        <div className="next-step-pill">
          <span className="next-step-label">Next step</span>
          <span className="next-step-text">{match.next_step}</span>
        </div>
      )}

      {match.url && (
        <a
          className="match-link"
          href={match.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View job →
        </a>
      )}

      {decision ? (
        <div className="match-decision">
          {/* key restarts the stamp animation when the decision flips */}
          <span key={decision} className={`decision-stamp ${decision}`}>
            {DECISION_LABEL[decision]}
          </span>
          <button
            type="button"
            className="decision-undo"
            onClick={() => onDecide?.(null)}
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="match-actions">
          <button
            type="button"
            className="btn btn-reject"
            onClick={() => onDecide?.('rejected')}
          >
            Reject
          </button>
          <button
            type="button"
            className="btn btn-accept"
            onClick={() => onDecide?.('accepted')}
          >
            Accept
          </button>
        </div>
      )}
    </article>
  )
}
