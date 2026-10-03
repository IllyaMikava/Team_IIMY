import { useState } from 'react'
import { validateLogin } from '../auth.js'

const ROLES = {
  student: {
    tab: 'Student',
    title: 'Student login',
    desc: 'Log in with your college email to get matched to internships.',
    label: 'College email',
    placeholder: 'you@tcd.ie',
  },
  recruiter: {
    tab: 'Recruiter',
    title: 'Recruiter login',
    desc: 'Log in with your company email to manage your listings.',
    label: 'Company email',
    placeholder: 'you@company.com',
  },
}

export default function Login({ onLogin }) {
  const [role, setRole] = useState('student')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const copy = ROLES[role]

  function switchRole(next) {
    setRole(next)
    setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const result = validateLogin(email, role)
    if (result.error) {
      setError(result.error)
      return
    }
    onLogin?.({ email: result.email, role })
  }

  return (
    <section className="login-section">
      <div className="container">
        <div className="card login-card">
          <div className="role-tabs" role="tablist" aria-label="Account type">
            {Object.entries(ROLES).map(([key, r]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={role === key}
                className={`role-tab${role === key ? ' active' : ''}`}
                onClick={() => switchRole(key)}
              >
                {r.tab}
              </button>
            ))}
          </div>

          <h2 className="card-title">{copy.title}</h2>
          <p className="card-desc">{copy.desc}</p>

          <form className="match-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="login-email" className="field-label">
                {copy.label}
              </label>
              <input
                id="login-email"
                type="email"
                className="text-input"
                placeholder={copy.placeholder}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <p className="field-error">{error}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              Log in as {copy.tab.toLowerCase()}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
