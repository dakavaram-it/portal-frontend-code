import { useEffect, useState } from 'react'
import Login from './Login.jsx'
import Leap from './leap/Leap.jsx'
import { clearSessionCache, clearToken, logout, me, prefetchSession, setUnauthorizedHandler } from './leap/api.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // Both ways in — restoring a session on reload and a fresh login — have to warm the
  // picklists and must never inherit the previous user's, so they go through one setter
  // rather than being handed straight to setUser.
  const signIn = (next) => {
    clearSessionCache()
    setUser(next)
    if (next) prefetchSession()
  }

  // A stored token may already have expired, and only the backend can say: ask `/me`.
  // Show a splash until it answers, rather than flashing the login screen at someone
  // who is already signed in.
  useEffect(() => {
    // Any data call that comes back 401 has outlived its session; drop straight back
    // to the login screen instead of leaving cadre data on screen behind a dead one.
    // clearToken as well as the picklists: the token that just came back 401 is spent,
    // and leaving it in sessionStorage would have the login screen's own calls present it.
    setUnauthorizedHandler(() => { clearSessionCache(); clearToken(); setUser(null) })
    me()
      .then(signIn)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  // `/logout` is stateless — the token stays valid until it expires, so dropping the local
  // copy below is what actually ends the session here.
  // A session that already lapsed makes logout answer 401, and a dead backend makes it
  // throw outright. React does not consume the promise an onClick returns, so without
  // the catch either case escapes as an unhandled rejection. Returning to the login
  // screen is the right outcome regardless of why the call failed.
  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // ignored on purpose — see above
    } finally {
      // The cached assemblies are the outgoing user's own grants; whoever signs in next
      // on this machine must not be served them.
      clearSessionCache()
      // After the await, never before: `/logout` is behind the auth guard, so the call needs
      // the token to get past it.
      clearToken()
      setUser(null)
    }
  }

  // `/me` is one round trip, but on a cold backend it is a slow one, and a white page for
  // the length of it reads as a broken app rather than a loading one.
  if (checking) {
    return (
      <div className="app-splash" role="status" aria-live="polite">
        <span className="app-splash-mark" />
        <span className="app-splash-text">Signing you in…</span>
      </div>
    )
  }
  return user ? (
    <Leap user={user} onLogout={handleLogout} />
  ) : (
    <Login onLoginSuccess={signIn} />
  )
}
