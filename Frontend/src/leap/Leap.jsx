import { useState } from 'react'
import { POSITIONS } from './data.js'
import Sidebar from './components/Sidebar.jsx'
import AllPositions from './components/AllPositions.jsx'
import PositionDetail from './components/PositionDetail.jsx'
import NewPositionModal from './components/NewPositionModal.jsx'
import Candidates from './components/Candidates.jsx'
import Dashboard from './components/Dashboard.jsx'
import CadreSearchNotes from './components/CadreSearchNotes.jsx'
import './Leap.css'

export default function Leap({ user, onLogout }) {
  const [positions, setPositions] = useState(POSITIONS)
  // The Dashboard, not the wizard: it is the sidebar's first entry and the only screen
  // that answers "where does this constituency stand" without being asked a question
  // first. Opening on the wizard started every session six empty dropdowns deep.
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

  const openPosition = (id) => setView({ name: 'detail', id })

  // The sidebar only ever switches to a bare view; the Dashboard's location view icon
  // hands over a full view object (name plus the election type/location it was on), so
  // both go through the same setter.
  const navigate = ({ name, ...payload }) => {
    setOpened((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
    if (Object.keys(payload).length) setArgs((prev) => ({ ...prev, [name]: payload }))
    setView({ name, ...payload })
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
      />
      <main className="leap-main">
        {screen('dashboard', <Dashboard user={user} onNavigate={navigate} />)}
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
