import { useState } from 'react'
import { POSITIONS } from './data.js'
import Sidebar from './components/Sidebar.jsx'
import AllPositions from './components/AllPositions.jsx'
import PositionDetail from './components/PositionDetail.jsx'
import NewPositionModal from './components/NewPositionModal.jsx'
import Candidates from './components/Candidates.jsx'
import Dashboard from './components/Dashboard.jsx'
import Dashboard2 from './components/Dashboard2.jsx'
import CadreSearchNotes from './components/CadreSearchNotes.jsx'
import CommitteesAssign from './components/CommitteesAssign.jsx'
import PcMeetings, { PCM_VIEWS } from '../pcm/PcMeetings.jsx'
import './Leap.css'

export default function Leap({ user, onLogout }) {
  const [positions, setPositions] = useState(POSITIONS)
  // The Dashboard, not the wizard: it is the sidebar's first entry and the only screen
  // that answers "where does this constituency stand" without being asked a question
  // first. Opening on the wizard started every session six empty dropdowns deep.
  // CADRE_COMMITTEE_MANAGEMENT only ever decides whether Committees Assign appears in the
  // sidebar (see Sidebar.jsx) — every account still lands on the Dashboard.
  const [view, setView] = useState({ name: 'dashboard' })

  // Which screens have been opened at least once. They stay mounted from then on (see
  // `screen` below) — these components hold their selections in their own state and
  // nowhere else, so unmounting one on a sidebar click threw away the assembly, the six
  // wizard steps or the candidate filters and re-fetched everything on the way back.
  const [opened, setOpened] = useState({ dashboard: true })
  // The last payload each screen was navigated with (the Dashboard's `prefill`/`filter`).
  // Kept per screen rather than read off `view`, because the sidebar navigates with a bare
  // `{ name }` — reading it off `view` would drop the payload and so change the key, which
  // is a remount, which is the very state loss this is fixing.
  const [args, setArgs] = useState({})
  // Below 1025px the sidebar is an off-canvas drawer; this is whether it is showing.
  const [navOpen, setNavOpen] = useState(false)
  // Committees Assign's own panels (KSS/CUBS/Committees) fetch their overview once on
  // mount and otherwise only on their own writes — unlike every other screen here, its
  // numbers (booth fill counts, sections created, …) can go stale from work done
  // elsewhere while the tab sits `hidden` rather than unmounted. Bumped on every sidebar
  // arrival and threaded down as part of that screen's own remount keys, so landing on it
  // always re-fetches rather than showing what was last on screen.
  const [committeesAssignNav, setCommitteesAssignNav] = useState(0)

  const openPosition = (id) => setView({ name: 'detail', id })

  // The sidebar only ever switches to a bare view; the Dashboard's location view icon
  // hands over a full view object (name plus the election type/location it was on), so
  // both go through the same setter.
  const navigate = ({ name, ...payload }) => {
    setOpened((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
    if (Object.keys(payload).length) setArgs((prev) => ({ ...prev, [name]: payload }))
    if (name === 'committeesAssign') setCommitteesAssignNav((k) => k + 1)
    setView({ name, ...payload })
    setNavOpen(false)
  }

  // A plain function, not a component: a component declared inside the render is a new
  // type on every render, which remounts its children — again the thing being fixed.
  // `hidden` is display:none plus removal from the a11y tree, and nothing styles this
  // wrapper (`.leap-main` is a plain block, so an extra div changes no layout).
  const screen = (name, node) =>
    opened[name] ? (
      <div key={name} hidden={view.name !== name}>
        {node}
      </div>
    ) : null

  const advanceStage = (id, delta) => {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stageIndex: Math.max(0, p.stageIndex + delta) } : p))
    )
  }

  const activePosition = view.name === 'detail' ? positions.find((p) => p.id === view.id) : null

  return (
    <div className="leap-app">
      <Sidebar
        user={user}
        onLogout={onLogout}
        view={view.name}
        onNavigate={(name) => navigate({ name })}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />
      {navOpen && (
        <button
          className="leap-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <button
        className="leap-nav-toggle"
        type="button"
        aria-label="Open navigation"
        onClick={() => setNavOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {/* PC-Meetings paints its own ground and carries its own padding (it is a
          whole console, not a panel), so the main column drops both for it. */}
      <main className={`leap-main${PCM_VIEWS[view.name] ? ' pcm-active' : ''}`}>
        {screen('dashboard', <Dashboard user={user} onNavigate={navigate} />)}
        {/* An alternate layout over the same election, on its own read-only backend
            (/dash2api). It draws the tree from the same ../electionTree.js the Dashboard
            above does, so the two cannot disagree about the shape of the election. */}
        {screen('dashboard2', <Dashboard2 />)}
        {/* The key still remounts the wizard, but only when the Dashboard hands over a
            *different* prefill — a bare sidebar click reuses the stored one. */}
        {screen(
          'newPosition',
          <NewPositionModal
            key={args.newPosition?.prefill ? JSON.stringify(args.newPosition.prefill) : 'wizard'}
            initial={args.newPosition?.prefill}
          />
        )}
        {screen(
          'candidates',
          <Candidates
            key={args.candidates?.filter ? JSON.stringify(args.candidates.filter) : 'all'}
            initialFilter={args.candidates?.filter}
          />
        )}
        {screen('cadreSearch', <CadreSearchNotes user={user} />)}
        {screen('committeesAssign', <CommitteesAssign user={user} navKey={committeesAssignNav} />)}
        {/* One mounted module behind all three of its nav entries, rather than
            one `screen` each: it holds the meetings list, the member pages and
            the rollups already fetched, and switching entries must not throw
            those away. Hidden by the group, not by a single view name. */}
        {Object.keys(PCM_VIEWS).some((v) => opened[v]) && (
          <div hidden={!PCM_VIEWS[view.name]}>
            <PcMeetings view={view.name} />
          </div>
        )}
        {view.name === 'positions' && (
          <AllPositions
            positions={positions}
            filter={view.filter}
            onFilterChange={(filter) => setView({ name: 'positions', filter })}
            onOpen={openPosition}
          />
        )}
        {view.name === 'detail' && activePosition && (
          <PositionDetail
            key={activePosition.id}
            position={activePosition}
            onBack={() => setView({ name: 'newPosition' })}
            onAdvance={() => advanceStage(activePosition.id, 1)}
            onRetreat={() => advanceStage(activePosition.id, -1)}
          />
        )}
      </main>
    </div>
  )
}
