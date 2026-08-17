function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M497 273c9.4-9.4 9.4-24.6 0-33.9L369 111c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l87 87H192c-13.3 0-24 10.7-24 24s10.7 24 24 24h230.1l-87 87c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0L497 273zM168 80c13.3 0 24-10.7 24-24s-10.7-24-24-24H120C53.7 32 0 85.7 0 152v208c0 66.3 53.7 120 120 120h48c13.3 0 24-10.7 24-24s-10.7-24-24-24H120c-39.8 0-72-32.2-72-72V152c0-39.8 32.2-72 72-72h48z" />
    </svg>
  )
}

const NAV_ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function IconGauge() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
    </svg>
  )
}

function IconBallot() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <path d="M5 21V8.5L12 3l7 5.5V21z" />
      <path d="M9.5 13.5l1.8 1.8 3.4-3.6" />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.2 20a5.8 5.8 0 0 1 11.6 0" />
      <circle cx="17.5" cy="9.2" r="2.4" />
      <path d="M15.4 14.6A5.2 5.2 0 0 1 21 19.4" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </svg>
  )
}

function IconCommittee() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <circle cx="12" cy="6.5" r="2.6" />
      <circle cx="5.5" cy="17" r="2.3" />
      <circle cx="18.5" cy="17" r="2.3" />
      <path d="M12 9.1V13" />
      <path d="M7.4 15.3 10.4 13" />
      <path d="M16.6 15.3 13.6 13" />
    </svg>
  )
}

// The nav's own entries, by the `view.name` each one switches Leap to.
const NAV = [
  { view: 'dashboard', label: 'Dashboard', icon: <IconGauge /> },
  { view: 'newPosition', label: 'Local Body Elections', icon: <IconBallot /> },
  { view: 'candidates', label: 'Candidates', icon: <IconPeople /> },
  { view: 'cadreSearch', label: 'Cadre Search', icon: <IconSearch /> },
]

// An account carrying CADRE_COMMITTEE_MANAGEMENT does committee work only — the
// nomination-workflow screens above don't apply to it, so they're hidden rather than
// merely unreachable. Order matches how the request named them: Committees Assign, then
// Cadre Search.
const COMMITTEE_NAV = [
  { view: 'committeesAssign', label: 'Committees Assign', icon: <IconCommittee /> },
  { view: 'cadreSearch', label: 'Cadre Search', icon: <IconSearch /> },
]

export default function Sidebar({ user, onLogout, view, onNavigate }) {
  // Most `user` rows carry no firstname/lastname, so fall back to the login name.
  const displayName = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username
  const initials = displayName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const nav = user?.entitlements?.includes('CADRE_COMMITTEE_MANAGEMENT') ? COMMITTEE_NAV : NAV

  return (
    <aside className="leap-sidebar">
      <div className="leap-sidebar-brand">
        <span className="leap-brand-mark"><img src="/tdp-logo.png" alt="TDP" /></span>
        <div>
          <div className="leap-brand-title">Telugu Desam Party</div>
        </div>
      </div>

      <nav className="leap-nav">
        {nav.map((item) => (
          <button
            type="button"
            key={item.view}
            className={`leap-nav-btn ${view === item.view ? 'active' : ''}`}
            aria-current={view === item.view ? 'page' : undefined}
            onClick={() => onNavigate(item.view)}
          >
            <span className="leap-nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
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
