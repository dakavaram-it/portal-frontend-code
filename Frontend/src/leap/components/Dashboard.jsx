import { useEffect, useMemo, useState } from 'react'
import { getAssemblies, getDashboardPositions, useLoadable } from '../api.js'
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

function IconRefresh() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  )
}

const NOMINATION_CLASS = {
  'Not Started': 'not-started',
  'In Progress': 'in-progress',
  Completed: 'completed',
}

// Sort order for the Nomination column: the pipeline's own order, so sorting by it
// groups the work still to do at one end rather than alphabetically scattering it.
const NOMINATION_RANK = { 'Not Started': 0, 'In Progress': 1, Completed: 2 }

const STATUS_FILTERS = ['All', 'Not Started', 'In Progress', 'Completed']

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

// One filled track, used for both the per-election-type headline and the per-location
// row. Tone follows the nomination status so the bar and the badge beside it never
// disagree; the value is always spelled out in text too, so the colour is decoration
// rather than the only carrier of the number.
function ProgressBar({ value, total, tone = 'in-progress', label, color }) {
  const filled = pct(value, total)
  return (
    <div
      className={`leap-progress ${tone}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
    >
      <div className="leap-progress-track">
        {/* `color` is the stat tile's own accent: inside a tile the bar measures that
            tile's metric, not a nomination status, so the status tones would be lying. */}
        <div
          className="leap-progress-fill"
          style={{ width: `${filled}%`, ...(color ? { background: color } : null) }}
        />
      </div>
      <span className="leap-progress-value">{filled}%</span>
    </div>
  )
}

// `of` is the denominator the count is measured against, and only three of the six tiles
// have one — proposed and confirmed run against the proposal slots, not-started against
// the roles. The other three (locations, required positions, max proposals) are totals
// with nothing to reach, so they keep the plain count and their `sub` line: inventing a
// target for them would read as progress toward something that does not exist.
function StatTile({ icon, label, value, sub, of, accent }) {
  const hasTarget = of !== undefined
  return (
    <div className="leap-stat-tile">
      <span className="leap-stat-icon" style={{ background: `${accent}1a`, color: accent }}>
        {icon}
      </span>
      <div className="leap-stat-body">
        <div className="leap-stat-value">
          {value}
          {hasTarget && <span className="leap-stat-of">/ {of}</span>}
        </div>
        <div className="leap-stat-label">{label}</div>
        {hasTarget ? (
          <ProgressBar value={value} total={of} color={accent} label={`${label}: ${value} of ${of}`} />
        ) : (
          sub && <div className="leap-stat-sub">{sub}</div>
        )}
      </div>
    </div>
  )
}

// Shown while S22 is in flight. It mirrors the real layout — six tiles over a table —
// so the screen does not jump when the data lands, and so the wait reads as "this is
// filling in" rather than "there is nothing here".
function DashboardSkeleton() {
  return (
    <div className="leap-skeleton" aria-hidden="true">
      <div className="leap-dash-type-cards">
        {[0, 1, 2].map((i) => <div key={i} className="leap-skel leap-skel-card" />)}
      </div>
      <div className="leap-stat-row">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="leap-skel leap-skel-tile" />)}
      </div>
      <div className="leap-skel leap-skel-table" />
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
  // Bumped by the refresh button. S22's counts move whenever anyone proposes or removes
  // a candidate, and this screen has no other reason to re-read them.
  const [reloadKey, setReloadKey] = useState(0)

  const { items: assemblies, loading: assembliesLoading } = useLoadable(getAssemblies, [])

  // An assembly always selects itself, so the screen opens with numbers on it rather than
  // an empty dropdown and an instruction. Preference is the user's own home constituency
  // (`user.constituency_id`, from the `user` table — distinct from S21's "assemblies this
  // user is granted" list); when that is not one of their grants, or they have none on
  // record, the first granted assembly stands in. S21 sorts by name, so that is
  // alphabetically first and the same every time.
  //
  // `assemblyId` is read but deliberately not a dep: the effect must not re-run and
  // re-pick after the user has chosen something else.
  useEffect(() => {
    if (assemblyId || assemblies.length === 0) return
    const own = assemblies.find((a) => String(a.constituency_id) === String(user?.constituency_id))
    setAssemblyId(String((own || assemblies[0]).constituency_id))
  }, [assemblies, user])

  // Fetched by hand rather than through useList: that hook reports a failed load as an
  // empty list, which would read as "nothing configured" rather than "couldn't reach
  // the server". null = loading, [] = loaded, found none.
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
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
  }, [assemblyId, reloadKey])

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
  // the cards are still there for switching to any other type. A refresh keeps whichever
  // type was open, since the groups it rebuilds are the same ones.
  useEffect(() => {
    setOpenTypeId((current) =>
      electionTypeGroups.some((g) => g.id === current)
        ? current
        : (electionTypeGroups[0]?.id ?? '')
    )
  }, [electionTypeGroups])

  const openGroup = electionTypeGroups.find((g) => g.id === openTypeId) || null

  const assemblyPicked = !!assemblyId
  // Since the assembly picks itself, "the grants are still arriving" and "this assembly's
  // rows are still arriving" are one uninterrupted wait from the user's side — one
  // skeleton covers both, rather than flashing a "select an assembly" prompt at someone
  // who is never going to have to.
  const loading = assembliesLoading || (assemblyPicked && !loadError && rows === null)
  const assemblyName = assemblies.find((a) => String(a.constituency_id) === assemblyId)?.constituency_name

  return (
    <div className="leap-view">
      <div className="leap-view-header">
        <div className="leap-view-header-brand">
          <div>
            <h1>Dashboard</h1>
            <p>
              {assemblyName
                ? `Nomination progress across ${assemblyName}, by election type.`
                : 'Nomination progress across a state assembly, by election type.'}
            </p>
          </div>
        </div>

        <div className="leap-header-actions">
          <div className="leap-dash-filter">
            <label className="leap-dash-filter-label" htmlFor="dash-assembly">Assembly</label>
            {assembliesLoading ? (
              <div className="leap-skel leap-skel-input" aria-label="Loading assemblies" />
            ) : (
              <div id="dash-assembly">
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
            )}
          </div>
          <button
            type="button"
            className="leap-refresh-btn"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={!assemblyPicked || loading}
            title="Reload this assembly's counts"
            aria-label="Reload this assembly's counts"
          >
            <IconRefresh />
          </button>
        </div>
      </div>

      {!assembliesLoading && assemblies.length === 0 && (
        <div className="leap-members-empty">
          No assembly is granted to this account, so there is nothing to show. Ask an
          administrator for access to a constituency.
        </div>
      )}

      {assemblyPicked && loadError && (
        <div className="leap-form-error">
          {loadError}
          <button type="button" className="leap-inline-retry" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {!loadError && loading && <DashboardSkeleton />}

      {assemblyPicked && !loadError && !loading && electionTypeGroups.length === 0 && (
        <div className="leap-members-empty">No local body of any election type is configured under this assembly.</div>
      )}

      {electionTypeGroups.length > 0 && (
        <div className="leap-dash-type-cards">
          {electionTypeGroups.map((group) => {
            const isOpen = group.id === openTypeId
            const locations = new Set(group.positions.map((p) => p.proposal_constituency_id)).size
            // The same filled ratio the section below opens with, so the cards can be
            // compared without opening each one.
            const slots = group.positions.reduce((n, p) => n + p.max_proposals, 0)
            const taken = group.positions.reduce((n, p) => n + p.proposed_cnt, 0)
            return (
              <button
                type="button"
                key={group.id}
                className={`leap-dash-type-card ${isOpen ? 'open' : ''}`}
                aria-expanded={isOpen}
                onClick={() => setOpenTypeId(isOpen ? '' : group.id)}
              >
                <div className="leap-dash-type-card-body">
                  <div className="leap-dash-type-card-label">{group.label}</div>
                  <div className="leap-dash-type-card-sub">
                    {locations} location{locations !== 1 ? 's' : ''} · {taken} of {slots} slots filled
                  </div>
                  <ProgressBar
                    value={taken}
                    total={slots}
                    tone={taken === 0 ? 'not-started' : taken >= slots ? 'completed' : 'in-progress'}
                    label={`${group.label} proposal slots filled`}
                  />
                </div>
                <span className="leap-dash-type-card-chevron"><IconChevronDown /></span>
              </button>
            )
          })}
        </div>
      )}

      {openGroup && (
        <ElectionTypeSection
          key={openGroup.id}
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  const stats = useMemo(() => {
    const requiredPositions = positions.reduce((n, p) => n + p.max_positions, 0)
    const maxProposals = positions.reduce((n, p) => n + p.max_proposals, 0)
    const proposed = positions.reduce((n, p) => n + p.proposed_status_cnt, 0)
    const confirmed = positions.reduce((n, p) => n + p.conformed_status_cnt, 0)
    const notStarted = positions.filter((p) => p.proposed_cnt === 0).length
    // Every live candidate whatever their status — this is what fills a proposal slot,
    // and so what the headline bar measures against maxProposals.
    const filled = positions.reduce((n, p) => n + p.proposed_cnt, 0)
    return {
      totalLocations: new Set(positions.map((p) => p.proposal_constituency_id)).size,
      requiredPositions,
      maxProposals,
      proposed,
      confirmed,
      notStarted,
      filled,
      roles: positions.length,
    }
  }, [positions])

  // Same three numbers as the tiles above, per location — plus a rolled-up nomination
  // status: Not Started while every role there is still untouched, Completed once every
  // role has used up its proposal slots, In Progress for anything in between.
  const locationStats = useMemo(() => {
    const byLocation = new Map()
    for (const p of positions) {
      const id = p.proposal_constituency_id
      if (!byLocation.has(id)) {
        byLocation.set(id, { id, name: p.local_body_name, where: p.mandal_town_name, rows: [] })
      }
      byLocation.get(id).rows.push(p)
    }
    return [...byLocation.values()].map(({ id, name, where, rows: locRows }) => {
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
      // Which roles the required-positions count is made of. Deduped, in S22's own
      // PR.order_no order — most locations here hold one role, but a local body can have
      // several (President + Vice-President), and the bare number does not say which.
      const roleNames = [...new Set(locRows.map((p) => p.role_name))].join(', ')
      const first = locRows[0]
      return {
        id,
        name,
        where,
        requiredPositions,
        roleNames,
        maxProposals,
        proposed,
        confirmed,
        status,
        proposedCnt,
        filledPct: pct(proposedCnt, maxProposals),
        electionTypeId: first.proposal_election_type_id,
        tehsilId: first.tehsil_id,
        townId: first.town_id,
      }
    })
  }, [positions])

  const statusCounts = useMemo(() => {
    const counts = { All: locationStats.length, 'Not Started': 0, 'In Progress': 0, Completed: 0 }
    for (const l of locationStats) counts[l.status] += 1
    return counts
  }, [locationStats])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = locationStats.filter((l) => {
      if (statusFilter !== 'All' && l.status !== statusFilter) return false
      if (!needle) return true
      return `${l.name} ${l.where || ''}`.toLowerCase().includes(needle)
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') return dir * a.name.localeCompare(b.name)
      if (sort.key === 'status') return dir * (NOMINATION_RANK[a.status] - NOMINATION_RANK[b.status])
      return dir * (a[sort.key] - b[sort.key])
    })
  }, [locationStats, search, statusFilter, sort])

  const toggleSort = (key) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))

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
      <div className="leap-dash-election-type-head">
        <h2 className="leap-dash-election-type-title">{label}</h2>
        <div className="leap-dash-headline">
          <span className="leap-dash-headline-label">
            {stats.filled} of {stats.maxProposals} proposal slots filled
          </span>
          <ProgressBar
            value={stats.filled}
            total={stats.maxProposals}
            tone={stats.filled === 0 ? 'not-started' : stats.filled >= stats.maxProposals ? 'completed' : 'in-progress'}
            label={`${label} proposal slots filled`}
          />
        </div>
      </div>

      <div className="leap-stat-row">
        <StatTile icon={<IconPin />} accent="#2563eb" label="TOTAL LOCATIONS" value={stats.totalLocations} sub={`${stats.roles} roles in all`} />
        <StatTile icon={<IconSeats />} accent="#7c3aed" label="REQUIRED POSITIONS" value={stats.requiredPositions} sub="seats to be filled" />
        <StatTile icon={<IconLayers />} accent="#d97706" label="MAX PROPOSALS" value={stats.maxProposals} sub="candidate slots" />
        <StatTile icon={<IconArrowUp />} accent="#0891b2" label="PROPOSED" value={stats.proposed} of={stats.maxProposals} />
        <StatTile icon={<IconCheck />} accent="#059669" label="CONFIRMED" value={stats.confirmed} of={stats.maxProposals} />
        <StatTile icon={<IconDashedCircle />} accent="#dc2626" label="NOT STARTED" value={stats.notStarted} of={stats.roles} />
      </div>

      <div className="leap-section">
        <div className="leap-section-header">
          <h3>By Location</h3>
          <span className="leap-section-sub">
            {visible.length === locationStats.length
              ? `${locationStats.length} location${locationStats.length !== 1 ? 's' : ''}`
              : `${visible.length} of ${locationStats.length} locations`}
          </span>
        </div>

        <div className="leap-dash-toolbar">
          <div className="leap-search-field">
            <span className="leap-search-icon"><IconSearch /></span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations…"
              aria-label="Search locations"
            />
          </div>
          <div className="leap-filter-chips" role="group" aria-label="Filter by nomination status">
            {STATUS_FILTERS.map((s) => (
              <button
                type="button"
                key={s}
                className={`leap-filter-chip ${statusFilter === s ? 'active' : ''} ${NOMINATION_CLASS[s] || ''}`}
                aria-pressed={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              >
                {s} <span className="leap-filter-chip-count">{statusCounts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="leap-table-card">
          <table className="leap-table">
            <thead>
              <tr>
                <SortHeader label="LOCATION" sortKey="name" sort={sort} onSort={toggleSort} />
                <SortHeader label="REQUIRED POSITIONS" sortKey="requiredPositions" sort={sort} onSort={toggleSort} numeric />
                <SortHeader label="MAX PROPOSALS" sortKey="maxProposals" sort={sort} onSort={toggleSort} numeric />
                <SortHeader label="PROPOSED" sortKey="proposed" sort={sort} onSort={toggleSort} numeric />
                <SortHeader label="CONFIRMED" sortKey="confirmed" sort={sort} onSort={toggleSort} numeric />
                <SortHeader label="FILLED" sortKey="filledPct" sort={sort} onSort={toggleSort} />
                <SortHeader label="NOMINATION" sortKey="status" sort={sort} onSort={toggleSort} />
                <th>VIEW</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr className="leap-table-empty-row">
                  <td colSpan={8}>No location here matches that search.</td>
                </tr>
              )}
              {visible.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => viewLocation(l)}
                  title={l.proposedCnt > 0 ? 'View candidates' : 'Add candidates'}
                >
                  <td className="leap-table-title">
                    {l.name}
                    {l.where && <div className="leap-table-sub">{l.where}</div>}
                  </td>
                  <td>
                    {l.requiredPositions}
                    {l.roleNames && <div className="leap-table-sub">{l.roleNames}</div>}
                  </td>
                  <td>{l.maxProposals}</td>
                  <td>{l.proposed}</td>
                  <td>{l.confirmed}</td>
                  <td className="leap-table-progress">
                    <ProgressBar
                      value={l.proposedCnt}
                      total={l.maxProposals}
                      tone={NOMINATION_CLASS[l.status]}
                      label={`${l.name} proposal slots filled`}
                    />
                  </td>
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
                      aria-label={`${l.proposedCnt > 0 ? 'View' : 'Add'} candidates for ${l.name}`}
                      // The row is clickable too; without this the button's click would
                      // run the same navigation a second time.
                      onClick={(e) => { e.stopPropagation(); viewLocation(l) }}
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

function SortHeader({ label, sortKey, sort, onSort, numeric }) {
  const active = sort.key === sortKey
  return (
    <th
      className={numeric ? 'leap-th-numeric' : undefined}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={`leap-th-sort ${active ? 'active' : ''}`} onClick={() => onSort(sortKey)}>
        {label}
        <span className="leap-th-arrow">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}
