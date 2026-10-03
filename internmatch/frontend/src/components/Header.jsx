export default function Header({ user, onLogout }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">
            InternMatch<span className="brand-ai">AI</span>
          </span>
        </div>
        {user && (
          <nav className="header-nav">
            {user.role === 'student' && (
              <>
                <a href="#how">How it works</a>
                <a href="#upload" className="nav-cta">Get matched</a>
              </>
            )}
            <span className="header-user" title={user.email}>{user.email}</span>
            <button type="button" className="btn btn-sm" onClick={onLogout}>
              Log out
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
