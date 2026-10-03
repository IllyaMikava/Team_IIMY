export default function Toast({ message, type }) {
  if (!message) return null
  return (
    <div className={`toast${type === 'error' ? ' toast-error' : ''}`} role="alert">
      {message}
    </div>
  )
}
