export default function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">
            InternMatch<span className="brand-ai">AI</span>
          </span>
        </div>
        <nav className="header-nav">
          <a href="#how">How it works</a>
          <a href="#upload" className="nav-cta">Get matched</a>
        </nav>
      </div>
    </header>
  )
}
