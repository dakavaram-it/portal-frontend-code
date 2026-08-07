import { useEffect, useMemo, useState } from 'react'
import { getAssemblies, getDashboardPositions, useList } from '../api.js'
import { Dropdown } from './NewPositionModal.jsx'

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function IconPin() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 21s7-7.58 7-12a7 7 0 1 0-14 0c0 4.42 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  )
}

function IconSeats() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15 14.2A5 5 0 0 1 20.5 19" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3 3 8l9 5 9-5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  )
}

function IconArrowUp() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  )
}

function IconDashedCircle() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3.5 4" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function IconEye() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const NOMINATION_CLASS = {
  'Not Started': 'not-started',
  'In Progress': 'in-progress',
  Completed: 'completed',
}

function StatTile({ icon, label, value, accent }) {
  return (
    <div className="leap-stat-tile">
      <span className="leap-stat-icon" style={{ background: `${accent}1a`, color: accent }}>
        {icon}
      </span>
      <div>
        <div className="leap-stat-value">{value}</div>
        <div className="leap-stat-label">{label}</div>
      </div>
    </div>
  )
}

// S22 returns every position under the chosen assembly in one call — across every
// election type and every local body. Election types render as cards, one per type
// present; clicking a card drops down that type's stat tiles and location table right
// under it, instead of hiding them behind a <select>.
export default function Dashboard({ user, onNavigate }) {
  const [assemblyId, setAssemblyId] = useState('')
  const [openTypeId, setOpenTypeId] = useState('')

  const assemblies = useList(getAssemblies, [])

  // The user's own home constituency (`user.constituency_id`, from the `user` table —
  // distinct from S21's "assemblies this user is granted" list) pre-fills the dropdown
  // when it's one of the assemblies granted to them, so their own constituency's numbers
  // are on screen without having to search for it first.
  useEffect(() => {
    if (assemblyId || !user?.constituency_id || assemblies.length === 0) return
    const own = assemblies.find((a) => String(a.constituency_id) === String(user.constituency_id))
    if (own) setAssemblyId(String(own.constituency_id))
  }, [assemblies, user])

  // Fetched by hand rather than through useList: that hook reports a failed load as an
  // empty list, which would read as "nothing configured" rather than "couldn't reach
  // the server". null = loading, [] = loaded, found none.
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    setOpenTypeId('')
    if (!assemblyId) {
      setRows(null)
      return
    }
    let cancelled = false
    setLoadError('')
    setRows(null)
    getDashboardPositions(assemblyId)
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setLoadError(err.message)
        setRows([])
      })
    return () => { cancelled = true }
  }, [assemblyId])

  // One group per election type, in the order S22 already sorted them (by
  // election_type), each carrying just its own rows.
  const electionTypeGroups = useMemo(() => {
    const seen = new Map()
    for (const r of rows || []) {
      const id = String(r.proposal_election_type_id)
      if (!seen.has(id)) seen.set(id, { id, label: r.election_type, positions: [] })
      seen.get(id).positions.push(r)
    }
    return [...seen.values()]
  }, [rows])

  // The first election type's stats open on their own rather than waiting for a click —
  // there's always something worth showing as soon as the constituency is picked, and
  // the cards are still there for switching to any other type.
  useEffect(() => {
    if (electionTypeGroups.length > 0) {
      setOpenTypeId(electionTypeGroups[0].id)
    }
  }, [electionTypeGroups])

  const openGroup = electionTypeGroups.find((g) => g.id === openTypeId) || null

  const assemblyPicked = !!assemblyId
  const loading = assemblyPicked && !loadError && rows === null

  return (
    <div className="leap-view">
      <div className="leap-view-header">
        <div className="leap-view-header-brand">
          <div>
            <h1>Dashboard</h1>
            <p>Nomination progress across a state assembly, by election type.</p>
          </div>
        </div>
      </div>

      <div className="leap-dash-filters">
        <div className="leap-modal-step">
          <div className="leap-modal-step-header"><span className="num">1</span><b>Assembly</b></div>
          <Dropdown
            value={assemblyId}
            onChange={(id) => setAssemblyId(id)}
            searchable
            placeholder="Select…"
            options={assemblies.map((a) => ({
              value: String(a.constituency_id),
              label: a.constituency_name,
            }))}
          />
        </div>
      </div>

      {!assemblyPicked && <p className="leap-field-hint">Select an assembly to see its positions, by election type.</p>}

      {assemblyPicked && loadError && <div className="leap-form-error">{loadError}</div>}

      {assemblyPicked && !loadError && loading && (
        <div className="leap-members-empty">Loading this assembly's positions…</div>
      )}

      {assemblyPicked && !loadError && !loading && electionTypeGroups.length === 0 && (
        <div className="leap-members-empty">No local body of any election type is configured under this assembly.</div>
      )}

      {electionTypeGroups.length > 0 && (
        <div className="leap-dash-type-cards">
          {electionTypeGroups.map((group) => {
            const isOpen = group.id === openTypeId
            const locations = new Set(group.positions.map((p) => p.proposal_constituency_id)).size
            return (
              <button
                type="button"
                key={group.id}
                className={`leap-dash-type-card ${isOpen ? 'open' : ''}`}
                onClick={() => setOpenTypeId(isOpen ? '' : group.id)}
              >
                <div>
                  <div className="leap-dash-type-card-label">{group.label}</div>
                  <div className="leap-dash-type-card-sub">{locations} location{locations !== 1 ? 's' : ''}</div>
                </div>
                <span className="leap-dash-type-card-chevron"><IconChevronDown /></span>
              </button>
            )
          })}
        </div>
      )}

      {openGroup && (
        <ElectionTypeSection
          label={openGroup.label}
          positions={openGroup.positions}
          assemblyId={assemblyId}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

// One election type's stat tiles and location table. Kept as its own component (rather
// than inlined in a .map) so its derived stats memoize per group instead of recomputing
// for every group on every render.
function ElectionTypeSection({ label, positions, assemblyId, onNavigate }) {
  const stats = useMemo(() => {
    const requiredPositions = positions.reduce((n, p) => n + p.max_positions, 0)
    const maxProposals = positions.reduce((n, p) => n + p.max_proposals, 0)
    const proposed = positions.reduce((n, p) => n + p.proposed_status_cnt, 0)
    const confirmed = positions.reduce((n, p) => n + p.conformed_status_cnt, 0)
    const notStarted = positions.filter((p) => p.proposed_cnt === 0).length
    return {
      totalLocations: new Set(positions.map((p) => p.proposal_constituency_id)).size,
      requiredPositions,
      maxProposals,
      proposed,
      confirmed,
      notStarted,
    }
  }, [positions])

  // Same three numbers as the tiles above, per location — plus a rolled-up nomination
  // status: Not Started while every role there is still untouched, Completed once every
  // role has used up its proposal slots, In Progress for anything in between.
  const locationStats = useMemo(() => {
    const byLocation = new Map()
    for (const p of positions) {
      const id = p.proposal_constituency_id
      if (!byLocation.has(id)) byLocation.set(id, { id, name: p.local_body_name, rows: [] })
      byLocation.get(id).rows.push(p)
    }
    return [...byLocation.values()].map(({ id, name, rows: locRows }) => {
      const requiredPositions = locRows.reduce((n, p) => n + p.max_positions, 0)
      const maxProposals = locRows.reduce((n, p) => n + p.max_proposals, 0)
      const proposed = locRows.reduce((n, p) => n + p.proposed_status_cnt, 0)
      const confirmed = locRows.reduce((n, p) => n + p.conformed_status_cnt, 0)
      const everyRoleFull = locRows.every((p) => p.max_proposals > 0 && p.proposed_cnt >= p.max_proposals)
      const noRoleStarted = locRows.every((p) => p.proposed_cnt === 0)
      const status = everyRoleFull ? 'Completed' : noRoleStarted ? 'Not Started' : 'In Progress'
      // Any role at this location having a live candidate is what decides where the view
      // icon goes — not just the "Proposed" status column above, which is one of three.
      const proposedCnt = locRows.reduce((n, p) => n + p.proposed_cnt, 0)
      const first = locRows[0]
      return {
        id,
        name,
        requiredPositions,
        maxProposals,
        proposed,
        confirmed,
        status,
        proposedCnt,
        electionTypeId: first.proposal_election_type_id,
        tehsilId: first.tehsil_id,
        townId: first.town_id,
      }
    })
  }, [positions])

  // Candidates already exist somewhere at this location — go look at them. Otherwise
  // there is nothing to look at yet, so jump the wizard straight to this location's
  // Add Members search instead of making the click a dead end.
  const viewLocation = (l) => {
    if (l.proposedCnt > 0) {
      onNavigate({
        name: 'candidates',
        filter: { electionTypeId: String(l.electionTypeId), assemblyId: String(assemblyId) },
      })
      return
    }
    const locationKey = l.tehsilId ? `m:${l.tehsilId}` : l.townId ? `t:${l.townId}` : ''
    onNavigate({
      name: 'newPosition',
      prefill: {
        electionTypeId: String(l.electionTypeId),
        assemblyId: String(assemblyId),
        locationKey,
        proposalConstituencyId: String(l.id),
        membersAction: 'add',
      },
    })
  }

  if (positions.length === 0) return null

  return (
    <div className="leap-dash-election-type">
      <h2 className="leap-dash-election-type-title">{label}</h2>

      <div className="leap-stat-row">
        <StatTile icon={<IconPin />} accent="#2563eb" label="TOTAL LOCATIONS" value={stats.totalLocations} />
        <StatTile icon={<IconSeats />} accent="#7c3aed" label="REQUIRED POSITIONS" value={stats.requiredPositions} />
        <StatTile icon={<IconLayers />} accent="#d97706" label="MAX PROPOSALS" value={stats.maxProposals} />
        <StatTile icon={<IconArrowUp />} accent="#0891b2" label="PROPOSED" value={stats.proposed} />
        <StatTile icon={<IconCheck />} accent="#059669" label="CONFIRMED" value={stats.confirmed} />
        <StatTile icon={<IconDashedCircle />} accent="#dc2626" label="NOT STARTED" value={stats.notStarted} />
      </div>

      <div className="leap-section">
        <div className="leap-section-header">
          <h3>By Location</h3>
          <span className="leap-section-sub">{locationStats.length} location{locationStats.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="leap-table-card">
          <table className="leap-table">
            <thead>
              <tr>
                <th>LOCATION</th>
                <th>REQUIRED POSITIONS</th>
                <th>MAX PROPOSALS</th>
                <th>PROPOSED</th>
                <th>CONFIRMED</th>
                <th>NOMINATION</th>
                <th>VIEW</th>
              </tr>
            </thead>
            <tbody>
              {locationStats.map((l) => (
                <tr key={l.id}>
                  <td className="leap-table-title">{l.name}</td>
                  <td>{l.requiredPositions}</td>
                  <td>{l.maxProposals}</td>
                  <td>{l.proposed}</td>
                  <td>{l.confirmed}</td>
                  <td>
                    <span className={`leap-nom-badge ${NOMINATION_CLASS[l.status]}`}>
                      <span className="dot" />
                      {l.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="leap-table-view-btn"
                      title={l.proposedCnt > 0 ? 'View candidates' : 'Add candidates'}
                      onClick={() => viewLocation(l)}
                    >
                      <IconEye />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
