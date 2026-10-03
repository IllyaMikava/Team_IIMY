export default function Header({ page = 'student', onLogout }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href="/">
          <span className="brand-mark">◆</span>
          <span className="brand-name">
            InternMatch<span className="brand-ai">AI</span>
          </span>
        </a>
        {page === 'recruiter' ? (
          <nav className="header-nav">
            <a href="#candidates">Candidates</a>
            <a href="#roles">Your roles</a>
            <a href="#post" className="nav-cta">Post a role</a>
            <button className="nav-switch btn-link" onClick={onLogout}>Log out</button>
          </nav>
        ) : (
          <nav className="header-nav">
            <a href="#how">How it works</a>
            <a href="#upload" className="nav-cta">Get matched</a>
            <button className="nav-switch btn-link" onClick={onLogout}>Log out</button>
          </nav>
        )}
      </div>
    </header>
  )
}
