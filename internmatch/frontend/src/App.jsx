import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import UploadCard from './components/UploadCard.jsx'
import Results from './components/Results.jsx'
import HowItWorks from './components/HowItWorks.jsx'
import Footer from './components/Footer.jsx'
import Toast from './components/Toast.jsx'
import RecruiterPage from './components/recruiter/RecruiterPage.jsx'
import { uploadCv } from './api.js'

// Two pages, chosen by URL path: "/" for students, "/recruiter" for recruiters.
// (Vite's dev server serves index.html for any path, so no router library is needed.)
const PAGE = window.location.pathname.startsWith('/recruiter') ? 'recruiter' : 'student'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null) // { message, type }
  const toastTimer = useRef(null)

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

  return (
    <>
      <Header page={PAGE} />
      <main>
        {PAGE === 'recruiter' ? (
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
