import { useState } from 'react'
import circleImage from './circle.svg'
import { login } from './leap/api.js'
import './Login.css'

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
      <path d="M224 256c70.7 0 128-57.3 128-128S294.7 0 224 0 96 57.3 96 128s57.3 128 128 128zm0-208c44.1 0 80 35.9 80 80s-35.9 80-80 80-80-35.9-80-80 35.9-80 80-80zm0 256c-85.3 0-160 49.7-160 128 0 44.2 35.8 80 80 80h160c44.2 0 80-35.8 80-80 0-78.3-74.7-128-160-128zm80 240H144c-17.6 0-32-14.4-32-32 0-51.6 53.7-80 112-80s112 28.4 112 80c0 17.6-14.4 32-32 32z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
      <path d="M400 224h-24v-72C376 68.2 307.8 0 224 0S72 68.2 72 152v72H48c-26.5 0-48 21.5-48 48v192c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V272c0-26.5-21.5-48-48-48zm-104 0H152v-72c0-39.7 32.3-72 72-72s72 32.3 72 72v72z" />
    </svg>
  )
}

export default function Login({ onLoginSuccess }) {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(userName, password)
      onLoginSuccess?.(user)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="cycle">
      <img id="circle-image" src={circleImage} alt="Telugu Desam Party" />

      <div className="loginblock">
        <div className="welcomeblock">
          <span className="yellow-circle" />
          <span className="red-circle" />
          <span className="green-rect" />
          <h1>WELCOME</h1>
        </div>
        <h4>PLEASE LOGIN</h4>

        <form name="loginForm" onSubmit={handleSubmit}>
          <div className="input-group">
            <span className="input-group-addon">
              <UserIcon />
            </span>
            <input
              type="text"
              id="userName1"
              name="userName"
              autoComplete="username"
              className="form-control"
              placeholder="User Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <span className="input-group-addon">
              <LockIcon />
            </span>
            <input
              type="password"
              id="passWord_Id1"
              name="password"
              autoComplete="current-password"
              className="form-control"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </form>

        <p className="copyright">© 2017 Telugu Desam Party</p>
      </div>
    </div>
  )
}
