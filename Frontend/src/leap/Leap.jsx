import { useState } from 'react'
import { POSITIONS } from './data.js'
import Sidebar from './components/Sidebar.jsx'
import AllPositions from './components/AllPositions.jsx'
import PositionDetail from './components/PositionDetail.jsx'
import NewPositionModal from './components/NewPositionModal.jsx'
import Candidates from './components/Candidates.jsx'
import Dashboard from './components/Dashboard.jsx'
import './Leap.css'

export default function Leap({ user, onLogout }) {
  const [positions, setPositions] = useState(POSITIONS)
  // The Dashboard, not the wizard: it is the sidebar's first entry and the only screen
  // that answers "where does this constituency stand" without being asked a question
  // first. Opening on the wizard started every session six empty dropdowns deep.
  const [view, setView] = useState({ name: 'dashboard' })

  const openPosition = (id) => setView({ name: 'detail', id })

  // The sidebar only ever switches to a bare view; the Dashboard's location view icon
  // hands over a full view object (name plus the election type/location it was on), so
  // both go through the same setter.
  const navigate = (next) => setView(next)

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
        {view.name === 'dashboard' && <Dashboard user={user} onNavigate={navigate} />}
        {view.name === 'newPosition' && (
          <NewPositionModal
            key={view.prefill ? JSON.stringify(view.prefill) : 'wizard'}
            initial={view.prefill}
          />
        )}
        {view.name === 'candidates' && <Candidates initialFilter={view.filter} />}
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
