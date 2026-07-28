import { PARTY_SHORT } from '../data.js'

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M497 273c9.4-9.4 9.4-24.6 0-33.9L369 111c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l87 87H192c-13.3 0-24 10.7-24 24s10.7 24 24 24h230.1l-87 87c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0L497 273zM168 80c13.3 0 24-10.7 24-24s-10.7-24-24-24H120C53.7 32 0 85.7 0 152v208c0 66.3 53.7 120 120 120h48c13.3 0 24-10.7 24-24s-10.7-24-24-24H120c-39.8 0-72-32.2-72-72V152c0-39.8 32.2-72 72-72h48z" />
    </svg>
  )
}

export default function Sidebar({ user, onLogout }) {
  // Most `user` rows carry no firstname/lastname, so fall back to the login name.
  const displayName = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username
  const initials = displayName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <aside className="leap-sidebar">
      <div className="leap-sidebar-brand">
        <span className="leap-brand-mark">{PARTY_SHORT}</span>
        <div>
          <div className="leap-brand-title">Telugu Desam Party</div>
        </div>
      </div>

      <nav className="leap-nav">
        <button type="button" className="leap-nav-btn active">Local Body Elections</button>
      </nav>

      <div className="leap-sidebar-footer">
        <span className="leap-avatar">{initials}</span>
        <span className="leap-sidebar-user" title={displayName}>{displayName}</span>
        <button
          type="button"
          className="leap-logout-btn"
          onClick={onLogout}
          title="Log out"
          aria-label="Log out"
        >
          <LogoutIcon />
        </button>
      </div>
    </aside>
  )
}
