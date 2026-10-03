import { useEffect, useState } from 'react'

const NEXT_STEP_PRESETS = [
  'Recruiter will schedule a 30-minute Zoom intro call.',
  'Complete a short online coding assessment (60 minutes).',
  'Take-home task, due within 3 days, followed by a technical interview.',
  'Phone screen with the engineering team.',
]

const EMPTY = { title: '', company: '', location: '', url: '', description: '', skills: '', next_step: '' }

const parseSkills = (s) =>
  [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))]

export default function PostRoleForm({ defaultCompany, onSubmit }) {
  const [form, setForm] = useState({ ...EMPTY, company: defaultCompany })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [autoInvite, setAutoInvite] = useState(true)

  // Prefill company from the page filter until the recruiter types their own.
  useEffect(() => {
    setForm((f) => (f.companyTouched ? f : { ...f, company: defaultCompany }))
  }, [defaultCompany])

  const set = (key) => (e) => {
    setError('')
    setForm((f) => ({ ...f, [key]: e.target.value, ...(key === 'company' && { companyTouched: true }) }))
  }

  const skills = parseSkills(form.skills)

  function validate() {
    if (form.title.trim().length < 2) return 'Add a role title.'
    if (!form.company.trim()) return 'Add your company name.'
    if (form.description.trim().length < 40)
      return 'Describe the role in a bit more detail (at least 40 characters). Matching works on meaning, so more detail means better matches.'
    if (!skills.length) return 'Add at least one skill, separated by commas.'
    if (form.next_step.trim().length < 5) return 'Choose or write the next step candidates should expect.'
    if (form.url && !/^https?:\/\//i.test(form.url.trim())) return 'The job link should start with http:// or https://'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = validate()
    setError(problem)
    if (problem) return

    setSaving(true)
    try {
      await onSubmit({
        title: form.title.trim(),
        company: form.company.trim(),
        location: form.location.trim(),
        url: form.url.trim(),
        description: form.description.trim(),
        skills,
        next_step: form.next_step.trim(),
        invite_mode: autoInvite ? 'auto' : 'manual',
      })
      setForm({ ...EMPTY, company: form.company, companyTouched: form.companyTouched })
    } catch (err) {
      setError(err.message || "Couldn't post this role.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card rec-form-card">
      <div className="rec-form-head">
        <h2 className="card-title">Post a role</h2>
        <p className="card-desc">
          It goes live immediately. The next CV that matches it gets your next step by email.
        </p>
      </div>

      <form className="rec-form" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <Field id="r-title" label="Role title" required>
            <input id="r-title" className="text-input" value={form.title} onChange={set('title')}
              placeholder="Backend Engineering Intern" maxLength={120} />
          </Field>
          <Field id="r-company" label="Company" required>
            <input id="r-company" className="text-input" value={form.company} onChange={set('company')}
              placeholder="Acme Fintech" maxLength={80} autoComplete="organization" />
          </Field>
          <Field id="r-location" label="Location">
            <input id="r-location" className="text-input" value={form.location} onChange={set('location')}
              placeholder="Dublin, Ireland · Remote (EU)" maxLength={80} />
          </Field>
          <Field id="r-url" label="Job link">
            <input id="r-url" className="text-input" type="url" value={form.url} onChange={set('url')}
              placeholder="https://careers.example.com/backend-intern" maxLength={300} />
          </Field>
        </div>

        <Field id="r-desc" label="What the intern will do" required
          hint="Write it like you'd explain it to a student. Matching reads meaning, not keywords.">
          <textarea id="r-desc" className="text-input textarea" rows={4} value={form.description}
            onChange={set('description')} maxLength={4000}
            placeholder="Join the payments team to build REST APIs on Postgres, write tests, and ship small features to production with a mentor." />
        </Field>

        <Field id="r-skills" label="Skills" required hint="Separate with commas.">
          <input id="r-skills" className="text-input" value={form.skills} onChange={set('skills')}
            placeholder="Python, SQL, REST APIs, Git" />
          {skills.length > 0 && (
            <div className="chip-row" aria-label="Skills preview">
              {skills.map((s) => <span key={s} className="chip">{s}</span>)}
            </div>
          )}
        </Field>

        <Field id="r-next" label="Next step for matched candidates" required
          hint="Copied word for word into every match email. Decide it now, not later.">
          <div className="preset-row">
            {NEXT_STEP_PRESETS.map((p) => (
              <button key={p} type="button"
                className={`preset${form.next_step === p ? ' active' : ''}`}
                aria-pressed={form.next_step === p}
                onClick={() => {
                  setError('')
                  setForm((f) => ({ ...f, next_step: p }))
                }}>
                {p}
              </button>
            ))}
          </div>
          <input id="r-next" className="text-input" value={form.next_step} onChange={set('next_step')}
            placeholder="…or write your own" maxLength={300} />
        </Field>

        {error && <p className="field-error" role="alert">{error}</p>}

        <div className="rec-form-actions">
          <label className="check">
            <input
              type="checkbox"
              checked={autoInvite}
              onChange={(e) => setAutoInvite(e.target.checked)}
              aria-describedby="r-invite-hint"
            />
            <span className="check-box" aria-hidden="true" />
            <span className="check-text">
              <span className="check-label">
                {autoInvite ? 'Auto invite' : 'Manual invite'}
              </span>
              <span id="r-invite-hint" className="field-hint">
                {autoInvite
                  ? 'Matching students get your next step by email straight away.'
                  : "Matches wait for your review. You choose who gets invited."}
              </span>
            </span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" aria-hidden="true" /> : null}
            {saving ? 'Posting…' : 'Post role'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ id, label, hint, required, children }) {
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}
