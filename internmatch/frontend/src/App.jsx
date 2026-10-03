import { useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import UploadCard from './components/UploadCard.jsx'
import Results from './components/Results.jsx'
import HowItWorks from './components/HowItWorks.jsx'
import Footer from './components/Footer.jsx'
import Toast from './components/Toast.jsx'
import Login from './components/Login.jsx'
import RecruiterHome from './components/RecruiterHome.jsx'
import { uploadCv } from './api.js'
import { clearUser, loadUser, saveUser } from './auth.js'

export default function App() {
  const [user, setUser] = useState(loadUser) // { email, role } or null
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null) // { message, type }
  const toastTimer = useRef(null)

  function showToast(message, type = 'error') {
    setToast({ message, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

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

  function handleLogin(next) {
    saveUser(next)
    setUser(next)
  }

  function handleLogout() {
    clearUser()
    setUser(null)
    setResult(null)
  }

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <main>
        {!user && <Login onLogin={handleLogin} />}
        {user?.role === 'recruiter' && <RecruiterHome user={user} />}
        {user?.role === 'student' && (
          <>
            <Hero />
            <UploadCard
              onSubmit={handleSubmit}
              loading={loading}
              defaultEmail={user.email}
            />
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
