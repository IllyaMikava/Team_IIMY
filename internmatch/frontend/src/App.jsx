import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import UploadCard from './components/UploadCard.jsx'
import Results from './components/Results.jsx'
import HowItWorks from './components/HowItWorks.jsx'
import Footer from './components/Footer.jsx'
import Toast from './components/Toast.jsx'
import RecruiterPage from './components/recruiter/RecruiterPage.jsx'
import Login from './components/Login.jsx'
import { uploadCv } from './api.js'

const ROLE_KEY = 'internmatch.role'

function getSavedRole() {
  try { return sessionStorage.getItem(ROLE_KEY) } catch { return null }
}

export default function App() {
  const [role, setRole] = useState(getSavedRole) // null = show login
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  function handleLogin(userRole) {
    try { sessionStorage.setItem(ROLE_KEY, userRole) } catch {}
    setRole(userRole)
  }

  function handleLogout() {
    try { sessionStorage.removeItem(ROLE_KEY) } catch {}
    setRole(null)
  }

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  async function handleSubmit({ file, email, error }) {
    // Client-side validation errors bubble up through the same callback.
    if (error) {
      showToast(error)
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const data = await uploadCv(file, email)
      setResult(data)
      // Scroll results into view on the next frame.
      requestAnimationFrame(() => {
        document
          .querySelector('.results-section, .empty-state')
          ?.scrollIntoView({ behavior: 'smooth' })
      })
    } catch (e) {
      showToast(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!role) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <>
      <Header page={role} onLogout={handleLogout} />
      <main>
        {role === 'recruiter' ? (
          <RecruiterPage showToast={showToast} />
        ) : (
          <>
            <Hero />
            <UploadCard onSubmit={handleSubmit} loading={loading} />
            <Results data={result} />
            <HowItWorks />
          </>
        )}
      </main>
      <Footer />
      <Toast message={toast?.message} type={toast?.type} />
    </>
  )
}
