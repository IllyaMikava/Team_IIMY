import { useRef, useState } from 'react'

const ACCEPT = '.pdf,.docx,.txt'
const MAX_BYTES = 5 * 1024 * 1024

export default function UploadCard({ onSubmit, loading, defaultEmail = '' }) {
  const [file, setFile] = useState(null)
  const [email, setEmail] = useState(defaultEmail)
  const [emailError, setEmailError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  function pickFile(f) {
    if (!f) return
    if (f.size > MAX_BYTES) {
      onSubmit?.({ error: 'That file is larger than 5 MB.' })
      return
    }
    setFile(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  function removeFile(e) {
    e.preventDefault()
    e.stopPropagation()
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleSubmit(e) {
    e.preventDefault()
    setEmailError('')

    if (!file) {
      onSubmit?.({ error: 'Please upload your CV first.' })
      return
    }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!valid) {
      setEmailError('Please enter a valid email address.')
      return
    }
    onSubmit?.({ file, email })
  }

  return (
    <section id="upload" className="upload-section">
      <div className="container">
        <div className="card upload-card">
          <h2 className="card-title">Find my matches</h2>
          <p className="card-desc">
            Drop your CV, add your email, and we'll do the rest.
          </p>

          <form className="match-form" onSubmit={handleSubmit} noValidate>
            {/* Dropzone */}
            <label
              className={`dropzone${dragOver ? ' over' : ''}`}
              onDragEnter={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                hidden
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {!file ? (
                <div className="dropzone-inner">
                  <div className="dropzone-icon">⬆</div>
                  <p className="dropzone-primary">
                    <span className="dz-strong">Click to upload</span> or drag &amp; drop
                  </p>
                  <p className="dropzone-hint">PDF, DOCX or TXT · max 5 MB</p>
                </div>
              ) : (
                <div className="file-chip">
                  <span className="file-chip-icon">📄</span>
                  <span className="file-chip-name">{file.name}</span>
                  <button
                    type="button"
                    className="file-chip-remove"
                    aria-label="Remove file"
                    onClick={removeFile}
                  >
                    ✕
                  </button>
                </div>
              )}
            </label>

            {/* Email */}
            <div className="field">
              <label htmlFor="email-input" className="field-label">
                Your email
              </label>
              <input
                id="email-input"
                type="email"
                className="text-input"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {emailError && <p className="field-error">{emailError}</p>}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <span>Find my matches</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
