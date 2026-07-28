import { useEffect, useState } from 'react'
import Login from './Login.jsx'
import Leap from './leap/Leap.jsx'
import { logout, me, setUnauthorizedHandler } from './leap/api.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // The session cookie is httpOnly, so the only way to know whether one is still live
  // is to ask S15. Render nothing until it answers, rather than flashing the login
  // screen at someone who is already signed in.
  useEffect(() => {
    // Any data call that comes back 401 has outlived its session; drop straight back
    // to the login screen instead of leaving cadre data on screen behind a dead one.
    setUnauthorizedHandler(() => setUser(null))
    me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  // Clear the session server-side too, so the token cannot be replayed.
  // A session that already lapsed makes S16 answer 401, and a dead backend makes it
  // throw outright. React does not consume the promise an onClick returns, so without
  // the catch either case escapes as an unhandled rejection. Returning to the login
  // screen is the right outcome regardless of why the call failed.
  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // ignored on purpose — see above
    } finally {
      setUser(null)
    }
  }

  if (checking) return null
  return user ? (
    <Leap user={user} onLogout={handleLogout} />
  ) : (
    <Login onLoginSuccess={setUser} />
  )
}
