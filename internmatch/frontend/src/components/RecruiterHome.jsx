export default function RecruiterHome({ user }) {
  return (
    <section className="empty-state">
      <div className="container">
        <div className="empty-inner">
          <div className="empty-icon">🏢</div>
          <h2>Recruiter dashboard coming soon</h2>
          <p>
            You are logged in as {user.email}. Posting and managing listings
            isn't built yet.
          </p>
        </div>
      </div>
    </section>
  )
}
