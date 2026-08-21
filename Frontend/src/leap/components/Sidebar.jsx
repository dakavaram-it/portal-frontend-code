import { useEffect, useRef, useState } from 'react'
import { hasEntitlement } from '../api.js'

function CloseIcon() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

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

function IconChevron() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <path d="M6 9l6 6 6-6" />
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

function IconCalendar() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <path d="M9 4.5h6a1.5 1.5 0 0 1 1.5 1.5v.5h1.5a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h1.5V6A1.5 1.5 0 0 1 9 4.5z" />
      <path d="M8.5 12.5h7M8.5 16h4.5" />
    </svg>
  )
}

// The nav's own entries, by the `view.name` each one switches Leap to. Everyone gets the
// same base list — CADRE_COMMITTEE_MANAGEMENT only ever decides whether the Committees
// Assign entry itself is inserted, nothing else on this list.
const BASE_NAV = [
  { view: 'dashboard', label: 'Dashboard', icon: <IconGauge /> },
  // An alternate layout over the same election (Dashboard2.jsx), served read-only by
  // its own backend on /dash2api rather than by /leapapi.
  { view: 'dashboard2', label: 'Dashboard 2', icon: <IconGauge /> },
  { view: 'newPosition', label: 'Assign Members', icon: <IconBallot /> },
  { view: 'candidates', label: 'View Members', icon: <IconPeople /> },
]

const COMMITTEES_ASSIGN_ITEM = { view: 'committeesAssign', label: 'Committees Assign', icon: <IconCommittee /> }

// PC-Meetings, the committee-meetings console. Each entry carries its own grant — the
// two halves are separate features against separate data (meetings against `meetings`,
// Programmes against `party_track`), so a user is routinely given one and not the other.
// Calendar is the meetings list drawn on a date grid and holds nothing of its own, so it
// rides along with either grant rather than having a third.
const PCM_MEETINGS_ITEM = { view: 'pcmMeetings', label: 'Committee Meetings', icon: <IconGauge /> }
const PCM_PROGRAMS_ITEM = { view: 'pcmPrograms', label: 'Programmes', icon: <IconClipboard /> }
const PCM_CALENDAR_ITEM = { view: 'pcmCalendar', label: 'Calendar', icon: <IconCalendar /> }
const CADRE_SEARCH_ITEM = { view: 'cadreSearch', label: 'Cadre Search', icon: <IconSearch /> }

export default function Sidebar({ user, onLogout, view, onNavigate, open, onClose }) {
  const closeRef = useRef(null)
  // The election group collapses, but it opens the session — it holds every screen a
  // session actually starts on, so shipping it shut would hide the whole app behind a
  // click.
  const [electionsOpen, setElectionsOpen] = useState(true)
  // PC-Meetings ships collapsed: a session starts on the Dashboard, in the group above.
  const [meetingsOpen, setMeetingsOpen] = useState(false)

  // Drawer mode (below 1025px): Escape closes it, the page behind stays put, and focus
  // moves into the drawer then back to the button that opened it.
  useEffect(() => {
    if (!open) return undefined

    const opener = document.activeElement
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current.focus()

    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [open, onClose])

  // Most `user` rows carry no firstname/lastname, so fall back to the login name.
  const displayName = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username
  const initials = displayName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  // user_id 1 is the operations account and is handed every screen without needing the
  // grants (the same escape hatch CadreSearchNotes' Add Note button already has) —
  // except Committees Assign, which is deliberately outside that blanket: it writes to
  // the PSA committee service, so it is only ever reached through its own entitlement.
  const isSuperUser = user?.user_id === 1
  const hasCommitteeAccess = !isSuperUser && hasEntitlement(user, 'CADRE_COMMITTEE_MANAGEMENT')
  const electionNav = [...BASE_NAV, ...(hasCommitteeAccess ? [COMMITTEES_ASSIGN_ITEM] : [])]

  const canSeeMeetings = isSuperUser || hasEntitlement(user, 'MEETING_REMARKS_UPDATE')
  const canSeePrograms = isSuperUser || hasEntitlement(user, 'LEADER_PROGRAMS_UPDATE')
  const meetingsNav = [
    ...(canSeeMeetings ? [PCM_MEETINGS_ITEM] : []),
    ...(canSeePrograms ? [PCM_PROGRAMS_ITEM] : []),
    ...(canSeeMeetings || canSeePrograms ? [PCM_CALENDAR_ITEM] : []),
  ]

  const navButton = (item) => (
    <button
      type="button"
      key={item.view}
      className={`leap-nav-btn ${view === item.view ? 'active' : ''}`}
      aria-current={view === item.view ? 'page' : undefined}
      onClick={() => onNavigate(item.view)}
    >
      <span className="leap-nav-icon">{item.icon}</span>
      <span>{item.label}</span>
    </button>
  )

  return (
    <aside className="leap-sidebar" data-open={open ? 'true' : 'false'}>
      <div className="leap-sidebar-brand">
        <span className="leap-brand-mark"><img src="/tdp-logo.png" alt="TDP" /></span>
        <div>
          <div className="leap-brand-title">Telugu Desam Party</div>
        </div>
        <button
          type="button"
          className="leap-sidebar-close"
          ref={closeRef}
          onClick={onClose}
          aria-label="Close navigation"
        >
          <CloseIcon />
        </button>
      </div>

      <nav className="leap-nav">
        <button
          type="button"
          className="leap-nav-group-label leap-nav-group-toggle"
          aria-expanded={electionsOpen}
          onClick={() => setElectionsOpen((o) => !o)}
        >
          <span>LOCAL BODY ELECTIONS</span>
          <IconChevron />
        </button>
        {electionsOpen && electionNav.map(navButton)}

        {meetingsNav.length > 0 && (
          <>
            <button
              type="button"
              className="leap-nav-group-label leap-nav-group-toggle"
              aria-expanded={meetingsOpen}
              onClick={() => setMeetingsOpen((o) => !o)}
            >
              <span>PC-MEETINGS</span>
              <IconChevron />
            </button>
            {meetingsOpen && meetingsNav.map(navButton)}
          </>
        )}

        <div className="leap-nav-group-label">CADRE</div>
        {navButton(CADRE_SEARCH_ITEM)}
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
