// Email-only login, checked in the browser. There is no password and no backend
// session yet: the email's domain alone decides whether it is accepted for a role.

const STORAGE_KEY = 'internmatch.user'

// Irish university / college domains. Subdomains match too (mail.dcu.ie, student.ncirl.ie).
const STUDENT_DOMAINS = [
  'tcd.ie',
  'dcu.ie',
  'tudublin.ie',
  'mytudublin.ie',
  'ucd.ie',
  'ucdconnect.ie',
  'universityofgalway.ie',
  'nuigalway.ie',
  'ul.ie',
  'ucc.ie',
  'mu.ie',
  'mumail.ie',
  'atu.ie',
  'setu.ie',
  'mtu.ie',
  'mymtu.ie',
  'tus.ie',
  'dkit.ie',
  'ncirl.ie',
  'iadt.ie',
  'rcsi.ie',
  'rcsi.com',
  'griffith.ie',
  'dbs.ie',
  'mydbs.ie',
]

// Academic domains outside the list above: foo.edu, foo.ac.uk, foo.edu.au, ...
const ACADEMIC_PATTERN = /\.(edu|ac)(\.[a-z]{2})?$/

// Personal mailboxes are neither a university nor a company.
const FREE_MAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'live.ie',
  'msn.com',
  'yahoo.com',
  'yahoo.ie',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'eircom.net',
]

function matchesDomain(domain, list) {
  return list.some((d) => domain === d || domain.endsWith(`.${d}`))
}

function isStudentDomain(domain) {
  return matchesDomain(domain, STUDENT_DOMAINS) || ACADEMIC_PATTERN.test(domain)
}

// Returns { email } on success or { error } with a message to show under the field.
export function validateLogin(rawEmail, role) {
  const email = rawEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }
  const domain = email.split('@')[1]
  const student = isStudentDomain(domain)

  if (role === 'student') {
    if (!student) {
      return { error: 'Use your college email, e.g. name@tcd.ie, name@mail.dcu.ie or name@mytudublin.ie.' }
    }
    return { email }
  }

  if (student) {
    return { error: 'That is a student email. Switch to the Student tab to log in.' }
  }
  if (matchesDomain(domain, FREE_MAIL_DOMAINS)) {
    return { error: 'Use your company email, not a personal mailbox.' }
  }
  return { email }
}

// localStorage can throw (private windows, blocked site data), so every access is guarded.
export function loadUser() {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return user?.email && user?.role ? user : null
  } catch {
    return null
  }
}

export function saveUser(user) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } catch {
    /* stay logged in for this tab only */
  }
}

export function clearUser() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing stored */
  }
}
