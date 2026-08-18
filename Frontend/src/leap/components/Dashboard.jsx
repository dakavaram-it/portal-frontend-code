import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getAssemblies,
  getDashboardCandidatesByStatus,
  getDashboardPositions,
  getNominationFileUrl,
  uploadNominationFile,
  useLoadable,
} from '../api.js'
import { Dropdown, PhotoViewer, initials } from './NewPositionModal.jsx'

// proposal_status's own ids (1 Proposed, 2 Shortlisted, 3 Confirmed) — the two the
// Dashboard's stat tiles drill into. Shortlisted has no tile here, so it is not listed.
const PROPOSED_STATUS_ID = 1
const CONFIRMED_STATUS_ID = 3

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

function IconCheck() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 12.5l3 3 6-6.5" />
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

// The election hierarchy as the party runs it: two tiers, each holding the bodies that
// tier elects, each body holding the posts contested in it. It is written down here
// rather than derived from getDashboardPositions because the tree is the *plan* — a post nobody has
// configured a proposal constituency for yet still has to appear, as a static card, or
// the screen would silently pretend that half the election does not exist.
//
// `types` are matched against a row's `election_type`; `roles` (when present) narrow that
// to one post inside a shared type, since e.g. MPP and Vice-MPP are two roles of one
// election type. Names are compared normalized, so 'Vice-MPP' and 'Vice MPP' are one.
// Anything the tree does not claim is still shown — see `otherBody` below.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const ELECTION_TIERS = [
  {
    id: 'panchayat-raj',
    label: 'Panchayat Raj Elections',
    sub: 'Mandal & District tier',
    bodies: [
      {
        label: 'Mandal Parishad',
        sub: 'per Mandal',
        icon: <IconLayers />,
        accent: '#2563eb',
        cards: [
          // The chair rows are filed under the MPTC election type, not under an MPP one —
          // so MPTC has to name its own role or it claims them as well, and its two
          // siblings have to claim that type or the rows land nowhere.
          { label: 'MPTC', types: ['MPTC'], roles: ['MPTC Member', 'MPTC'] },
          { label: 'MPP', types: ['MPTC', 'MPP'], roles: ['MPP', 'President', 'Chairman', 'Chairperson'] },
          { label: 'Vice-MPP', types: ['MPTC', 'MPP', 'Vice-MPP'], roles: ['Vice-MPP', 'Vice-President', 'Vice-Chairman'] },
        ],
      },
      {
        label: 'Zilla Parishad',
        sub: 'per District',
        icon: <IconPin />,
        accent: '#7c3aed',
        cards: [
          { label: 'ZPTC', types: ['ZPTC'] },
          { label: 'ZP Chairman', types: ['ZP'], roles: ['Chairman', 'Chairperson', 'President', 'ZP Chairman'] },
          { label: 'Vice-Chairman', types: ['ZP'], roles: ['Vice-Chairman', 'Vice-President', 'Vice-Chairperson'] },
        ],
      },
    ],
  },
  {
    id: 'local-body',
    label: 'Local Body Elections',
    sub: 'Panchayat / Municipality / Corporation',
    bodies: [
      {
        label: 'Gram Panchayat',
        sub: 'Village',
        icon: <IconSeats />,
        accent: '#059669',
        cards: [
          { label: 'Ward Member', types: ['Ward', 'Ward Member'] },
          { label: 'Sarpanch', types: ['Panchayat'], roles: ['Sarpanch', 'President', 'Chairman'] },
          { label: 'Upa Sarpanch', types: ['Panchayat'], roles: ['Upa Sarpanch', 'Vice-President', 'Vice-Sarpanch'] },
        ],
      },
      {
        label: 'Municipality',
        sub: 'Town',
        icon: <IconLayers />,
        accent: '#d97706',
        cards: [
          { label: 'Ward Councillor', types: ['Municipal Ward', 'Ward Councillor'] },
          { label: 'Chairperson', types: ['Municipality'], roles: ['Chairperson', 'Chairman', 'President'] },
          { label: 'Vice-Chairperson', types: ['Municipality'], roles: ['Vice-Chairperson', 'Vice-Chairman', 'Vice-President'] },
        ],
      },
      {
        label: 'Municipal Corporation',
        sub: 'City',
        icon: <IconPin />,
        accent: '#0891b2',
        cards: [
          // MPTC is in the type list for the same reason it is on the MPP cards: a
          // Corporator row is filed under it. `roles` keeps that from making this card
          // claim the MPTC members as well.
          { label: 'Corporator', types: ['Corporation Ward', 'Corporator', 'MPTC'], roles: ['Corporator'] },
          { label: 'Mayor', types: ['Corporation'], roles: ['Mayor', 'President', 'Chairperson'] },
          { label: 'Deputy Mayor', types: ['Corporation'], roles: ['Deputy Mayor', 'Vice-Mayor', 'Vice-President'] },
        ],
      },
    ],
  },
]

// A row belongs to a card when its election type is one the card claims and — for the
// cards that share a type with a sibling — its role is one the card names too.
const cardMatches = (card, row) => {
  if (!card.types.some((t) => norm(t) === norm(row.election_type))) return false
  return !card.roles || card.roles.some((r) => norm(r) === norm(row.role_name))
}

const NOMINATION_CLASS = {
  'Not Started': 'not-started',
  Started: 'in-progress',
}

// Sort order for the Nomination column: the pipeline's own order, so sorting by it
// groups the work still to do at one end rather than alphabetically scattering it.
const NOMINATION_RANK = { 'Not Started': 0, Started: 1 }

// Reserved only sits in the same group as the nomination statuses and so is exclusive
// with them — it is not a status, it is the other question the By Location list gets
// asked, and the Total Locations tile's Reservation row selects it.
const RESERVED_FILTER = 'Reserved only'
const STATUS_FILTERS = ['All', 'Not Started', 'Started', RESERVED_FILTER]

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
function StatTile({ icon, label, value, sub, of, accent, onClick, active, className, actionLabel = 'view list', name }) {
  const hasTarget = of !== undefined
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`leap-stat-tile${onClick ? ' leap-stat-tile-clickable' : ''}${active ? ' leap-stat-tile-active' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      aria-label={onClick ? `${name ?? label ?? value}: ${actionLabel}` : undefined}
    >
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
    </Tag>
  )
}

// A stat tile that carries a breakdown under its headline instead of a meter. Three of
// these stand in the space six `StatTile`s used, so each is a column of the same row and
// twice as tall — the detail rows are what fill that height.
// A row is `{ label, value }`, plus an optional `onClick` (rendered as a button) and
// `active` for the ones that open a drill-down.
function StatCard({ icon, label, value, accent, rows }) {
  return (
    <div className="leap-stat-tile leap-stat-card">
      <div className="leap-stat-card-head">
        <span className="leap-stat-icon" style={{ background: `${accent}1a`, color: accent }}>
          {icon}
        </span>
        <div className="leap-stat-body">
          <div className="leap-stat-value">{value}</div>
          <div className="leap-stat-label">{label}</div>
        </div>
      </div>
      <div className="leap-stat-card-rows">
        {rows.map((r) => {
          const Tag = r.onClick ? 'button' : 'div'
          return (
            <Tag
              key={r.label}
              type={r.onClick ? 'button' : undefined}
              className={`leap-stat-card-row${r.onClick ? ' leap-stat-card-row-clickable' : ''}${r.active ? ' leap-stat-card-row-active' : ''}`}
              onClick={r.onClick}
              aria-pressed={r.onClick ? !!r.active : undefined}
            >
              <span className="leap-stat-card-row-label">{r.label}</span>
              <span className="leap-stat-card-row-value" style={r.active ? { color: accent } : undefined}>
                {r.value}
              </span>
            </Tag>
          )
        })}
      </div>
    </div>
  )
}

// Shown while getDashboardPositions is in flight. It mirrors the real layout — six tiles over a table —
// so the screen does not jump when the data lands, and so the wait reads as "this is
// filling in" rather than "there is nothing here".
function DashboardSkeleton() {
  return (
    <div className="leap-skeleton" aria-hidden="true">
      <div className="leap-dash-tier-cards">
        {[0, 1].map((i) => <div key={i} className="leap-skel leap-skel-tier" />)}
      </div>
      <div className="leap-stat-row">
        {[0, 1, 2].map((i) => <div key={i} className="leap-skel leap-skel-tile" />)}
      </div>
      <div className="leap-stat-row">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="leap-skel leap-skel-tile" />)}
      </div>
      <div className="leap-skel leap-skel-table" />
    </div>
  )
}

// getDashboardPositions returns every position under the chosen assembly in one call — across every
// election type and every local body. Election types render as cards, one per type
// present; clicking a card drops down that type's stat tiles and location table right
// under it, instead of hiding them behind a <select>.
export default function Dashboard({ user, onNavigate }) {
  const [assemblyId, setAssemblyId] = useState('')
  const [tierId, setTierId] = useState(ELECTION_TIERS[0].id)
  const [cardKey, setCardKey] = useState('')
  // Bumped by the refresh button. getDashboardPositions's counts move whenever anyone proposes or removes
  // a candidate, and this screen has no other reason to re-read them.
  const [reloadKey, setReloadKey] = useState(0)

  const { items: assemblies, loading: assembliesLoading } = useLoadable(getAssemblies, [])

  // An assembly always selects itself, so the screen opens with numbers on it rather than
  // an empty dropdown and an instruction. Preference is the user's own home constituency
  // (`user.constituency_id`, from the `user` table — distinct from getAssemblies's "assemblies this
  // user is granted" list); when that is not one of their grants, or they have none on
  // record, the first granted assembly stands in. getAssemblies sorts by name, so that is
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

  // getDashboardPositions's rows poured into the static tree: every post keeps its card whether or not
  // the database has a proposal constituency for it, and anything the tree does not claim
  // is appended as its own body group rather than dropped — the tree is a guess about
  // naming, and a wrong guess must not hide live data.
  const tiers = useMemo(() => {
    const built = ELECTION_TIERS.map((tier) => ({
      ...tier,
      bodies: tier.bodies.map((body) => ({
        ...body,
        cards: body.cards.map((card) => ({ ...card, key: `${tier.id}/${card.label}`, positions: [] })),
      })),
    }))
    const allCards = built.flatMap((t) => t.bodies.flatMap((b) => b.cards))
    const unmatched = new Map()
    for (const r of rows || []) {
      const card = allCards.find((c) => cardMatches(c, r))
      if (card) {
        card.positions.push(r)
        continue
      }
      const key = `other/${r.proposal_election_type_id}/${r.role_name}`
      if (!unmatched.has(key)) unmatched.set(key, { key, label: `${r.election_type} — ${r.role_name}`, positions: [] })
      unmatched.get(key).positions.push(r)
    }
    if (unmatched.size > 0) {
      built[built.length - 1].bodies.push({
        label: 'Other',
        sub: 'configured in the database, outside the standard tree',
        icon: <IconSeats />,
        accent: '#64748b',
        cards: [...unmatched.values()],
      })
    }
    return built
  }, [rows])

  const tier = tiers.find((t) => t.id === tierId) || tiers[0]
  const tierCards = tier.bodies.flatMap((b) => b.cards)

  // A post's stats open on their own rather than waiting for a click, so the tier lands
  // with numbers on it. Only a card that actually has rows can be opened — a static card
  // has nothing to put in the tiles. A refresh keeps whichever post was open.
  useEffect(() => {
    setCardKey((current) =>
      tierCards.some((c) => c.key === current && c.positions.length > 0)
        ? current
        : (tierCards.find((c) => c.positions.length > 0)?.key ?? '')
    )
  }, [tiers, tierId])

  const openCard = tierCards.find((c) => c.key === cardKey && c.positions.length > 0) || null

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

      {assemblyPicked && !loadError && !loading && (rows || []).length === 0 && (
        <div className="leap-members-empty">No local body of any election type is configured under this assembly.</div>
      )}

      {!loading && (
        <>
          <div className="leap-dash-tier-cards" role="tablist" aria-label="Election tier">
            {tiers.map((t, i) => {
              const positions = t.bodies.flatMap((b) => b.cards).flatMap((c) => c.positions)
              const slots = positions.reduce((n, p) => n + p.max_proposals, 0)
              const filled = positions.reduce((n, p) => n + p.proposed_cnt, 0)
              const isOpen = t.id === tier.id
              return (
                <button
                  type="button"
                  role="tab"
                  key={t.id}
                  aria-selected={isOpen}
                  className={`leap-dash-tier-card ${isOpen ? 'open' : ''}`}
                  onClick={() => setTierId(t.id)}
                >
                  <span className="leap-dash-tier-icon">{i === 0 ? <IconLayers /> : <IconPin />}</span>
                  <span className="leap-dash-tier-text">
                    <span className="leap-dash-tier-card-label">{t.label}</span>
                    <span className="leap-dash-tier-card-sub">{t.sub}</span>
                  </span>
                  <span className="leap-dash-tier-figure">
                    {slots > 0 ? (
                      <>
                        <b>{filled}</b>
                        <span className="leap-dash-tier-figure-of">/ {slots}</span>
                        <span className="leap-dash-tier-figure-label">slots filled</span>
                      </>
                    ) : (
                      <span className="leap-dash-tier-figure-label">nothing configured</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {tier.bodies.map((body) => {
            const configured = body.cards.filter((c) => c.positions.length > 0).length
            return (
              <div className="leap-dash-body-group" key={`${tier.id}/${body.label}`}>
                <div className="leap-dash-body-head">
                  <h2>{body.label}</h2>
                  {body.sub && <span className="leap-dash-body-sub">{body.sub}</span>}
                  <span className="leap-dash-body-rule" />
                  <span className="leap-dash-body-count">
                    {configured} of {body.cards.length} configured
                  </span>
                </div>
                {/* The same row the six metric tiles use, so a post card is the same
                    object as a metric card — same width, same three columns, same
                    breakpoints — rather than a second card language on one screen. */}
                <div className="leap-stat-row">
                  {body.cards.map((card) => {
                    const isOpen = card.key === cardKey && card.positions.length > 0
                    // No rows means no proposal constituency is configured for this post
                    // yet. The card still stands — it is part of the election — but there is
                    // nothing behind it to open.
                    const empty = card.positions.length === 0
                    // The tier card's own pair — live candidates over proposal slots — so
                    // the posts under a tier add up to the figure on it. Not
                    // proposed_status_cnt over max_positions: that counts one status of
                    // three against a smaller denominator, which reads as 2 / 1 for a
                    // post with two candidates on its single seat.
                    const slots = card.positions.reduce((n, p) => n + p.max_proposals, 0)
                    const filled = card.positions.reduce((n, p) => n + p.proposed_cnt, 0)
                    return (
                      <StatTile
                        key={card.key}
                        // `name` because `value` is markup here, and the accessible name
                        // has to be the post's name rather than that element.
                        name={card.label}
                        // The post's name and its slot figure are the whole card, and the
                        // figure is the tier card's markup so the two read as one thing at
                        // two scales. Not `of` — that draws a meter against a value that
                        // is text here.
                        className={`leap-dash-post${empty ? ' leap-dash-post-empty' : ''}`}
                        icon={body.icon}
                        accent={empty ? '#9ca3af' : body.accent}
                        value={
                          <>
                            {card.label}
                            {!empty && (
                              <span className="leap-dash-tier-figure">
                                <b>{filled}</b>
                                <span className="leap-dash-tier-figure-of">/ {slots}</span>
                                <span className="leap-dash-tier-figure-label">slots filled</span>
                              </span>
                            )}
                          </>
                        }
                        active={isOpen}
                        actionLabel="show this post's numbers"
                        // An empty post has nothing behind it to open, so it renders as a
                        // plain tile rather than a button.
                        onClick={empty ? undefined : () => setCardKey(isOpen ? '' : card.key)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}

      {!loading && !openCard && (rows || []).length > 0 && (
        <div className="leap-members-empty">
          No post in this tier is configured under this assembly. Pick the other tier to see
          what is.
        </div>
      )}

      {openCard && (
        <ElectionTypeSection
          key={openCard.key}
          label={openCard.label}
          positions={openCard.positions}
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
  // { statusId, statusLabel } while the Proposed/Confirmed drill-down is open, else null.
  const [statusModal, setStatusModal] = useState(null)
  // Bumped by the Total Locations tile's Reservation row so the scroll runs from an
  // effect, i.e. after By Location has actually rendered.
  const [reservedTick, setReservedTick] = useState(0)
  const byLocationRef = useRef(null)
  // A card is one *post*, which can be one role inside an election type (MPP and Vice-MPP
  // are two cards over one type) or span more than one type. getDashboardCandidatesByStatus is scoped by
  // election type alone, so the drill-down asks for every type these rows use and then
  // keeps only the roles this card actually covers.
  const electionTypeIds = [...new Set(positions.map((p) => p.proposal_election_type_id))]
  const roleNames = [...new Set(positions.map((p) => p.role_name))]

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

  // One line per role for the Positions tile — "President 2 / 3". A position counts as
  // filled once a candidate is *proposed* for it, so this is proposed_status_cnt over
  // max_positions — the same number the tile's own Proposed row totals.
  const roleStats = useMemo(() => {
    const byRole = new Map()
    for (const p of positions) {
      const cur = byRole.get(p.role_name) || { role: p.role_name, filled: 0, total: 0 }
      cur.filled += p.proposed_status_cnt
      cur.total += p.max_positions
      byRole.set(p.role_name, cur)
    }
    return [...byRole.values()]
  }, [positions])

  // Same three numbers as the tiles above, per location — plus a proposal status rolled up
  // from each role's own proposal_position.started_time: a location can hold more than one
  // role (President + Vice-President), each started independently, so the location itself
  // reads Started the moment any one of them has been.
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
      // Any role at this location having a live candidate is what decides where the view
      // icon goes — not just the "Proposed" status column above, which is one of three.
      const proposedCnt = locRows.reduce((n, p) => n + p.proposed_cnt, 0)
      // Which roles the required-positions count is made of. Deduped, in getDashboardPositions's own
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
        status: locRows.some((p) => p.started_time) ? 'Started' : 'Not Started',
        proposedCnt,
        electionTypeId: first.proposal_election_type_id,
        tehsilId: first.tehsil_id,
        townId: first.town_id,
        reservationType: first.reservation_type,
      }
    })
  }, [positions])

  const statusCounts = useMemo(() => {
    const counts = {
      All: locationStats.length,
      'Not Started': 0,
      Started: 0,
      // Not a status, so it is counted separately rather than by the loop below.
      [RESERVED_FILTER]: locationStats.filter((l) => l.reservationType).length,
    }
    for (const l of locationStats) counts[l.status] += 1
    return counts
  }, [locationStats])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = locationStats.filter((l) => {
      if (statusFilter === RESERVED_FILTER) {
        if (!l.reservationType) return false
      } else if (statusFilter !== 'All' && l.status !== statusFilter) return false
      if (!needle) return true
      return `${l.name} ${l.where || ''}`.toLowerCase().includes(needle)
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') return dir * a.name.localeCompare(b.name)
      if (sort.key === 'roleNames') return dir * a.roleNames.localeCompare(b.roleNames)
      if (sort.key === 'reservationType') return dir * (a.reservationType || '').localeCompare(b.reservationType || '')
      if (sort.key === 'status') return dir * (NOMINATION_RANK[a.status] - NOMINATION_RANK[b.status])
      return dir * (a[sort.key] - b[sort.key])
    })
  }, [locationStats, search, statusFilter, sort])

  // Runs after By Location is on the screen — the Reservation row can be clicked while
  // the status drill-down is open, in which case the section does not exist yet at click
  // time. Bumping the tick rather than watching the filter also re-scrolls when the
  // filter is already on.
  useEffect(() => {
    if (reservedTick > 0) byLocationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [reservedTick])

  const showReserved = () => {
    setStatusModal(null)
    setStatusFilter(RESERVED_FILTER)
    setReservedTick((n) => n + 1)
  }

  const toggleSort = (key) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))

  // A location still has an open proposal slot while proposed < max_proposals — the
  // Assign button stays enabled up to that cap and disables once it's reached.
  const hasRoom = (l) => l.maxProposals > 0 && l.proposedCnt < l.maxProposals

  const assignLocation = (l) => {
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

  const viewLocationCandidates = (l) => {
    onNavigate({
      name: 'candidates',
      filter: { electionTypeId: String(l.electionTypeId), assemblyId: String(assemblyId) },
    })
  }

  // The row itself keeps one smart default action — straight to Assign while a slot is
  // open, otherwise to View — the Assign button and View icon in its own column offer
  // both explicitly regardless of which one this would have picked.
  const viewLocation = (l) => (hasRoom(l) ? assignLocation(l) : viewLocationCandidates(l))

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

      {/* Three cards over the width six tiles used. The Proposed and Confirmed drill-downs
          moved onto the rows of the last two — those tiles are gone, the drill-down is not. */}
      <div className="leap-stat-row leap-stat-row-trio">
        <StatCard
          icon={<IconPin />}
          accent="#2563eb"
          label="TOTAL LOCATIONS"
          value={stats.totalLocations}
          rows={[
            { label: 'Started', value: statusCounts.All - statusCounts['Not Started'] },
            { label: 'Not Started', value: statusCounts['Not Started'] },
            {
              label: 'Reservation',
              value: statusCounts[RESERVED_FILTER],
              onClick: showReserved,
              active: statusFilter === RESERVED_FILTER,
            },
          ]}
        />
        <StatCard
          icon={<IconSeats />}
          accent="#7c3aed"
          label="POSITIONS"
          value={stats.requiredPositions}
          rows={[
            ...roleStats.map((r) => ({ label: r.role, value: `${r.filled} / ${r.total}` })),
            { label: 'Max proposals', value: stats.maxProposals },
            {
              label: 'Proposed',
              value: stats.proposed,
              active: statusModal?.statusId === PROPOSED_STATUS_ID,
              onClick: () =>
                setStatusModal((cur) =>
                  cur?.statusId === PROPOSED_STATUS_ID ? null : { statusId: PROPOSED_STATUS_ID, statusLabel: 'Proposed' }
                ),
            },
          ]}
        />
        <StatCard
          icon={<IconCheck />}
          accent="#059669"
          label="CONFIRMED POSITIONS"
          value={stats.confirmed}
          rows={[
            { label: 'Total Positions Required', value: stats.requiredPositions },
            {
              label: 'Confirmed',
              value: stats.confirmed,
              active: statusModal?.statusId === CONFIRMED_STATUS_ID,
              onClick: () =>
                setStatusModal((cur) =>
                  cur?.statusId === CONFIRMED_STATUS_ID ? null : { statusId: CONFIRMED_STATUS_ID, statusLabel: 'Confirmed' }
                ),
            },
            // Locations that have got going, out of all of them. It counted Completed
            // ones until the status model became the two `started_time` states — there is
            // no completed to count any more.
            { label: 'Nominations', value: `${statusCounts.Started} / ${statusCounts.All}` },
          ]}
        />
      </div>

      <div className="leap-section">
        {statusModal ? (
          <CandidateStatusSection
            electionTypeIds={electionTypeIds}
            roleNames={roleNames}
            assemblyId={assemblyId}
            statusId={statusModal.statusId}
            statusLabel={statusModal.statusLabel}
            onBack={() => setStatusModal(null)}
          />
        ) : (
          <>
            <div className="leap-section-header" ref={byLocationRef}>
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

            <div className="leap-table-card leap-table-card-tall">
              <table className="leap-table">
                <thead>
                  <tr>
                    <SortHeader label="LOCATION" sortKey="name" sort={sort} onSort={toggleSort} />
                    <SortHeader label="POSITION NAME" sortKey="roleNames" sort={sort} onSort={toggleSort} />
                    <SortHeader label="REQUIRED POSITIONS" sortKey="requiredPositions" sort={sort} onSort={toggleSort} numeric />
                    <SortHeader label="RESERVATION" sortKey="reservationType" sort={sort} onSort={toggleSort} />
                    <SortHeader label="MAX PROPOSALS" sortKey="maxProposals" sort={sort} onSort={toggleSort} numeric />
                    <SortHeader label="PROPOSED" sortKey="proposed" sort={sort} onSort={toggleSort} numeric />
                    <SortHeader label="CONFIRMED" sortKey="confirmed" sort={sort} onSort={toggleSort} numeric />
                    <SortHeader label="PROPOSAL STATUS" sortKey="status" sort={sort} onSort={toggleSort} />
                    <th>ASSIGN</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr className="leap-table-empty-row">
                      <td colSpan={9}>No location here matches that search.</td>
                    </tr>
                  )}
                  {visible.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => viewLocation(l)}
                      title={hasRoom(l) ? 'Add candidates' : 'View candidates'}
                    >
                      <td className="leap-table-title">
                        {l.name}
                        {l.where && <div className="leap-table-sub">{l.where}</div>}
                      </td>
                      <td>{l.roleNames || '—'}</td>
                      <td>{l.requiredPositions}</td>
                      <td>
                        <span className={`leap-nom-badge ${NOMINATION_CLASS[l.status]}`}>
                          {l.reservationType || 'Unreserved'}
                        </span>
                      </td>
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
                        <div className="leap-table-actions">
                          <button
                            type="button"
                            className="leap-btn-ghost"
                            disabled={!hasRoom(l)}
                            title={hasRoom(l) ? 'Assign candidates' : 'No open proposal slots left'}
                            aria-label={`Assign candidates for ${l.name}`}
                            // The row is clickable too; without this the button's click would
                            // run the same navigation a second time.
                            onClick={(e) => { e.stopPropagation(); assignLocation(l) }}
                          >
                            Assign
                          </button>
                          <button
                            type="button"
                            className="leap-table-view-btn"
                            disabled={l.proposedCnt === 0}
                            title={l.proposedCnt > 0 ? 'View candidates' : 'No candidates proposed yet'}
                            aria-label={`View candidates for ${l.name}`}
                            onClick={(e) => { e.stopPropagation(); viewLocationCandidates(l) }}
                          >
                            <IconEye />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// The candidate list behind one Proposed/Confirmed stat tile — getDashboardCandidatesByStatus, scoped to the same
// (assembly, election type) the tile itself was summed over. Renders in place of the "By
// Location" table rather than as an overlay, the same way an election-type card's stats
// replace the previous one's below it, so the section never has two things open at once.
// Confirmed carries a nomination column the other status has no use for: the PDF upload
// is only meaningful once a candidate is confirmed, so Proposed rows do not render it.
function CandidateStatusSection({ electionTypeIds, roleNames, assemblyId, statusId, statusLabel, onBack }) {
  const [rows, setRows] = useState(null) // null = loading
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const isConfirmed = statusId === CONFIRMED_STATUS_ID
  // proposal_candidate_id -> true while its own upload is in flight, so one row's spinner
  // never disables another's button.
  const [uploading, setUploading] = useState({})
  // proposal_candidate_id -> the upload's own error text, separate from `error` above
  // (the list load) since one candidate's failed upload must not blank the whole table.
  const [uploadErrors, setUploadErrors] = useState({})
  // The one candidate whose view link is being fetched, or null. Reused as the upload
  // errors' key too — a failed view is just as much this row's problem as a failed upload.
  const [viewingId, setViewingId] = useState(null)
  // { url, name } of the PDF currently open in the in-page viewer, or null.
  const [pdfViewer, setPdfViewer] = useState(null)
  // The candidate row whose photo is open in the lightbox, or null.
  const [zoomed, setZoomed] = useState(null)

  // Joined rather than passed as arrays: the parent rebuilds both on every render, so the
  // arrays themselves are new objects each time and would re-fire this effect forever.
  const idsKey = electionTypeIds.join(',')
  const rolesKey = roleNames.join(',')

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    const roles = new Set(rolesKey.split(',').map(norm))
    Promise.all(
      idsKey.split(',').map((id) => getDashboardCandidatesByStatus(assemblyId, id, statusId))
    )
      .then((lists) => {
        if (cancelled) return
        setRows(lists.flat().filter((c) => roles.has(norm(c.role_name))))
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setError(err.message)
        setRows([])
      })
    return () => { cancelled = true }
  }, [assemblyId, idsKey, rolesKey, statusId, reloadKey])

  useEffect(() => {
    if (!pdfViewer) return
    const onKey = (e) => { if (e.key === 'Escape') setPdfViewer(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pdfViewer])

  // Patches `nomination_file_path` in place on success rather than refetching getDashboardCandidatesByStatus, so the
  // badge flips to Done without the row order or scroll position jumping.
  const handleUpload = async (candidateId, file, inputEl) => {
    if (!file) return
    setUploadErrors((prev) => ({ ...prev, [candidateId]: '' }))
    if (file.type !== 'application/pdf') {
      setUploadErrors((prev) => ({ ...prev, [candidateId]: 'Only PDF files are accepted.' }))
      if (inputEl) inputEl.value = ''
      return
    }
    setUploading((prev) => ({ ...prev, [candidateId]: true }))
    try {
      const result = await uploadNominationFile(candidateId, file)
      setRows((prev) =>
        prev.map((r) =>
          r.proposal_candidate_id === candidateId ? { ...r, nomination_file_path: result.file_path } : r
        )
      )
    } catch (err) {
      console.error(err)
      setUploadErrors((prev) => ({ ...prev, [candidateId]: err.message }))
    } finally {
      setUploading((prev) => ({ ...prev, [candidateId]: false }))
      if (inputEl) inputEl.value = ''
    }
  }

  // The presigned URL is fetched fresh on every click rather than cached on the row: it
  // expires in 5 minutes (getNominationFileUrl), and stashing a link that may already be dead would just
  // move the failure from here to whenever the viewer was reopened.
  const handleView = async (candidate) => {
    const candidateId = candidate.proposal_candidate_id
    setUploadErrors((prev) => ({ ...prev, [candidateId]: '' }))
    setViewingId(candidateId)
    try {
      const { url } = await getNominationFileUrl(candidateId)
      setPdfViewer({ url, name: candidate.member_name })
    } catch (err) {
      console.error(err)
      setUploadErrors((prev) => ({ ...prev, [candidateId]: err.message }))
    } finally {
      setViewingId(null)
    }
  }

  return (
    <>
      <div className="leap-section-header">
        <div className="leap-dash-status-heading">
          <button type="button" className="leap-back-link" onClick={onBack}>
            <span className="leap-back-link-arrow"><IconChevronDown /></span> Back to Locations
          </button>
          <h3>{statusLabel} Candidates</h3>
        </div>
        {rows && rows.length > 0 && (
          <span className="leap-section-sub">{rows.length} candidate{rows.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {error && (
        <div className="leap-form-error">
          {error}
          <button type="button" className="leap-inline-retry" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {!error && rows === null && (
        <div className="leap-skel leap-skel-table" aria-label="Loading candidates" />
      )}

      {!error && rows && rows.length === 0 && (
        <div className="leap-members-empty">No candidate is {statusLabel.toLowerCase()} here yet.</div>
      )}

      {!error && rows && rows.length > 0 && (
        <div className="leap-table-card">
          <table className="leap-table">
            <thead>
              <tr>
                <th>CANDIDATE</th>
                <th>MEMBERSHIP ID</th>
                <th>MOBILE</th>
                <th>{isConfirmed ? 'CONFIRMED ROLE' : 'PROPOSED ROLE'}</th>
                <th>LOCATION</th>
                {isConfirmed && <th>NOMINATION</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.proposal_candidate_id}>
                  <td className="leap-table-title">
                    <div className="leap-table-candidate">
                      {/* Same photo, fallback and lightbox as the MemberCard, so a
                          candidate looks the same here as on the other screens. */}
                      {c.img_url ? (
                        <button
                          type="button"
                          className="leap-member-photo-btn"
                          title={`Enlarge ${c.member_name}'s photo`}
                          onClick={() => setZoomed(c)}
                        >
                          <img className="leap-mcard-photo" src={c.img_url} alt={c.member_name} />
                        </button>
                      ) : (
                        <span className="leap-mcard-photo initials">{initials(c.member_name)}</span>
                      )}
                      {c.member_name}
                    </div>
                  </td>
                  <td>{c.membership_id}</td>
                  <td>{c.mobile_no}</td>
                  <td>{c.role_name}</td>
                  <td>
                    {c.local_body_name}
                    {c.mandal_town_name && <div className="leap-table-sub">{c.mandal_town_name}</div>}
                  </td>
                  {isConfirmed && (
                    <td>
                      <div className="leap-nomination-cell">
                        <span className={`leap-nom-badge ${c.nomination_file_path ? 'completed' : 'in-progress'}`}>
                          <span className="dot" />
                          {c.nomination_file_path ? 'Nomination Done' : 'Pending'}
                        </span>
                        {c.nomination_file_path && (
                          <button
                            type="button"
                            className="leap-table-view-btn"
                            title="View the uploaded nomination PDF"
                            aria-label={`View nomination PDF for ${c.member_name}`}
                            disabled={viewingId === c.proposal_candidate_id}
                            onClick={() => handleView(c)}
                          >
                            <IconEye />
                          </button>
                        )}
                        {!c.nomination_file_path && (
                          <label
                            className={`leap-upload-btn ${uploading[c.proposal_candidate_id] ? 'busy' : ''}`}
                            title="Upload the nomination PDF"
                          >
                            {uploading[c.proposal_candidate_id] ? 'Uploading…' : 'Upload PDF'}
                            <input
                              type="file"
                              accept="application/pdf"
                              disabled={!!uploading[c.proposal_candidate_id]}
                              onChange={(e) => handleUpload(c.proposal_candidate_id, e.target.files[0], e.target)}
                            />
                          </label>
                        )}
                        {uploadErrors[c.proposal_candidate_id] && (
                          <span className="leap-upload-error">{uploadErrors[c.proposal_candidate_id]}</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {zoomed && <PhotoViewer cadre={zoomed} onClose={() => setZoomed(null)} />}

      {pdfViewer && (
        <div className="leap-modal-overlay" onClick={() => setPdfViewer(null)}>
          <div className="leap-pdf-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="leap-modal-title-row">
              <div>
                <h3>Nomination PDF</h3>
                <p>{pdfViewer.name}</p>
              </div>
              <button type="button" className="leap-modal-close" onClick={() => setPdfViewer(null)}>✕</button>
            </div>
            <iframe
              src={pdfViewer.url}
              title={`Nomination PDF — ${pdfViewer.name}`}
              className="leap-pdf-viewer-frame"
            />
          </div>
        </div>
      )}
    </>
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
