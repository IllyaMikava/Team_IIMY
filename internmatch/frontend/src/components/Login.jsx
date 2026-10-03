import { useState } from 'react'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="login-wrapper">
      <div className="card login-card">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <span className="brand-mark">◆</span>
          <span className="brand-name">
            InternMatch<span className="brand-ai">AI</span>
          </span>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Welcome</h2>
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Enter your details and choose how you want to continue
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="text-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="text-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => onLogin('student')}>
            Log in as Student
          </button>
          <button className="btn btn-primary" onClick={() => onLogin('recruiter')}>
            Log in as Recruiter
          </button>
        </div>
      </div>
    </div>
  )
}

