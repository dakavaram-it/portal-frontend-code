import { useEffect, useState } from 'react'
import {
  confirmCandidate,
  getGeoBreakdown,
  getLocations,
  getPositionSummary,
  getReservationSummary,
  markNominated,
  removeCandidate,
} from '../dashboard2Api.js'
import { CLAIMED_ROLE_IDS, ELECTION_TREE, cardMatches } from '../electionTree.js'
// Scores come from /leapapi, not from this screen's own backend. They live in a second,
// optional database (report_ratings) and Total Score is a real formula — half the
// performance points plus half the leader-feedback points, null and never 0 when a cadre
// has neither. That logic already exists once, in api.js's getCadreScores, and every other
// screen reads it through this same loader. A copy inside portal-frontend-code-2 would be a
// second definition of the number, free to drift from the one the rest of the portal shows.
import { TIER_COLOR, loadScores, scoreTier } from './NewPositionModal.jsx'

// Dashboard 2 — an alternate dashboard layout over the same local-body election data,
// served by its own backend (PSA-Backend-code/portal-frontend-code-2) through the
// `/dash2api` proxy. It keeps the original design mockup's visual language (fonts, colors,
// spacing) rather than Leap.css's `leap-` classes, so it looks distinct from the rest of
// the app — but the numbers are live.
//
// READ-ONLY. That backend serves GETs and nothing else; the writes (propose, confirm,
// upload nomination) live in the /leapapi backend behind Assign Members. Every action
// button here says so rather than pretending to work.
//
// THREE OF THE SEVEN STAGES HAVE NO DATA. Door to Door, Door to Door - 2 and Result have
// no source table in dakavara_pa, so the backend returns 0 for them and names them in each
// response's `stagesUnavailable`. They are still drawn — the pipeline is the plan, and
// hiding half of it would misrepresent where the work stands — but they read 0 until those
// tables exist. Do not "fix" the zeros here.
//
// SCOPE. The top-level calls send no scope pair at all, which the backend reads as STATE
// access. Only the location list scopes down, to the assembly the user drilled into.

// ---- inline "CSS text" -> React style object, so the JSX below can keep
// the mockup's original style strings almost verbatim. ----
function sx(css) {
  const style = {}
  css.split(';').forEach((decl) => {
    const i = decl.indexOf(':')
    if (i < 0) return
    const prop = decl.slice(0, i).trim()
    if (!prop) return
    const value = decl.slice(i + 1).trim()
    const key = prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    style[key] = value
  })
  return style
}

const DASH2_CSS = `
.leap-dash2{background:#f1f3f2;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#1a2422;-webkit-font-smoothing:antialiased}
.leap-dash2 *{box-sizing:border-box}
.leap-dash2 button{font-family:inherit}
.d2-btn{transition:background .12s,border-color .12s,color .12s}
.d2-btn:hover{background:#f1f7f6;border-color:#0d7a6f;color:#0d7a6f}
.d2-link:hover{color:#0a5b53}
.d2-card{transition:border-color .12s}
.d2-card:hover{border-color:#0d7a6f}
.d2-row:hover{background:#fafbfb}
.d2-geo-row:hover{background:#f4f8f7}
`

const T = { ink: '#1a2422', mute: '#6b7873', teal: '#0d7a6f', red: '#c0392b', amber: '#b06f0a', green: '#1c7a45', purple: '#5b4bbd', crim: '#b3123b', blue: '#1d5fbd' }
const n = (v) => Number(v || 0).toLocaleString('en-IN')
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0)

const STEPS = [
  ['Proposal', 'Which locations have names put forward, and which are still empty. Several names on one location is normal.'],
  ['Confirmation', 'Compare the names on a location side by side and confirm exactly one.'],
  ['Nomination', 'Confirmed candidates who filed their papers before the deadline.'],
  ['Door to door', 'First round of field coverage against the voter list. No source table yet — reads 0.'],
  ['Door to door 2', 'Second round of visits. No source table yet — reads 0.'],
  ['Result', 'Declared outcomes as mandal users enter them. No source table yet — reads 0.'],
]
const STAGES = ['Not started', 'Proposal received', 'Confirmed', 'Nomination filed', 'Door to Door done', 'Door to Door - 2 done', 'Result declared']
const SS = { 'Not started': ['#fdecec', '#a52a1f'], 'Proposal received': ['#fdf3e3', '#8a5a05'], Confirmed: ['#eaf6ef', '#1c7a45'], 'Nomination filed': ['#e9f3f2', '#0a5b53'], 'Door to Door done': ['#e8f0fb', '#1d5fbd'], 'Door to Door - 2 done': ['#e4ecfa', '#164a9e'], 'Result declared': ['#f0eefc', '#4a3bb0'] }
const PROPOSED_STATUS_ID = 1
const CHIPS = [
  ['Total locations', 'total', 0, 0, T.ink, 'every location in this position'],
  ['Started', 'proposed', 1, 0, T.green, 'at least one name received'],
  ['Confirmed', 'confirmed', 2, 1, T.green, 'one name settled'],
  ['Nomination filed', 'noms', 3, 2, T.teal, 'papers submitted'],
  ['Door to Door', 'vloc', 4, 3, T.blue, 'no source table yet'],
  ['Door to Door - 2', 'vloc2', 5, 4, '#164a9e', 'no source table yet'],
  ['Result declared', 'declared', 6, 5, T.purple, 'no source table yet'],
]
// Every counter the screen names, and the field the backend returns it as. One map, so a
// chip, a geo column and a step bar can never read a different number for the same thing.
const API_FIELD = {
  total: 'total_locations', proposed: 'started', confirmed: 'confirmed', noms: 'nominated',
  vloc: 'door_to_door', vloc2: 'door_to_door_2', declared: 'declared',
}
const DOCS = [
  ['Form-1 · Nomination paper', 'Signed by candidate and proposer', true],
  ['Form-26 · Affidavit', 'Assets, liabilities and cases', true],
  ['Caste certificate', 'Needed for reserved seats only', false],
  ['Security deposit receipt', "Paid at the returning officer's counter", true],
]
const nm = (k) => k + (k === 1 ? ' name' : ' names')
// Each pending column names its own baseline, since the baseline stage itself isn't shown.
const PENDING_LABEL = ['', 'Not started', 'Started, not confirmed', 'Confirmed, not filed', 'Door to Door pending', 'Door to Door - 2 pending', 'Visited, result pending']
// The location-list filter speaks the stage's own language: done here / still pending here.
const FILTER_WORDS = [
  ['All locations', '', ''],
  ['All locations', 'Name received', 'Not started'],
  ['All locations', 'Confirmed', 'Awaiting confirmation'],
  ['All locations', 'Nomination filed', 'Papers pending'],
  ['All locations', 'Door to Door done', 'Door to Door pending'],
  ['All locations', 'Door to Door - 2 done', 'Door to Door - 2 pending'],
  ['All locations', 'Result declared', 'Result pending'],
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDate = (value) => {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// The layout comes from ../electionTree.js, shared with the Dashboard screen — the two must
// draw the same tree. Only the palette is this screen's own: the tree's `accent` is the
// other dashboard's colour scheme, so it is deliberately ignored here and the tone is
// looked up by body label instead. A body the tree adds and this map does not name still
// renders, in the default tone.
const BODY_ACCENT = {
  'Mandal Parishad': T.teal, 'Zilla Parishad': T.teal,
  Municipality: T.crim, 'Municipal Corporation': '#7a5b0d', 'Gram Panchayat': T.crim,
  Other: T.mute,
}
const TIER_STYLE = [
  { title: 'A · Panchayat Raj elections', accent: T.teal, border: '#d3e5e2', headBorder: '#bcdcd7', bg: '#f6fbfa' },
  { title: 'B · Local body elections', accent: T.crim, border: '#eed6dc', headBorder: '#e8c6ce', bg: '#fdf7f8' },
]
// The counters a card sums out of the rows it claims. Listed rather than derived so a new
// field on a row has to be added here deliberately — a silently-missing counter would read
// as a real zero.
const CARD_COUNTERS = [
  'total', 'proposed', 'confirmed', 'noms', 'names',
  'houses', 'visited', 'hPending', 'vloc', 'visited2', 'hPending2', 'vloc2',
  'declared', 'won', 'lost',
]
// Reservation cards keep the reservation's own name; the tone is picked off its caste half.
const RES_TONE = { GENERAL: '#3d4a46', SC: T.purple, ST: T.teal, BC: T.amber }
const resTone = (label) => RES_TONE[String(label || '').split(/[-\s]/)[0]] || T.mute

const ACCENT = T.teal

// One backend position row -> the shape every derived block below reads. The three ids are
// carried through because they are the post's identity: role 5 (Corporator) serves both
// Municipal Ward and Corporation Ward, so the drill-downs need all three, not the role.
const toRow = (p) => ({
  proposal_role_id: p.proposal_role_id,
  mainElectionTypeId: p.main_election_type_id,
  proposalElectionTypeId: p.proposal_election_type_id,
  electionType: p.election_type,
  roleName: p.role_name,
  total: p.total_locations, proposed: p.started, confirmed: p.confirmed, noms: p.nominated,
  names: p.proposed_names,
  houses: p.total_houses, visited: p.houses_visited, hPending: p.houses_pending,
  vloc: p.door_to_door, visited2: p.houses_visited_2, hPending2: p.houses_pending_2,
  vloc2: p.door_to_door_2, declared: p.declared, won: p.won, lost: p.lost,
})

const toCand = (c, rating) => ({
  id: c.proposal_candidate_id,
  score: rating && rating.total_score != null ? Math.round(rating.total_score * 10) / 10 : null,
  name: [c.member_name, c.last_name].filter(Boolean).join(' ').trim() || '—',
  phone: c.mobile_no || '—',
  gender: c.gender === 'F' ? 'Female' : c.gender === 'M' ? 'Male' : '—',
  age: c.age == null ? '—' : String(c.age),
  casteGroup: c.category_name || '—',
  subCaste: c.caste_name || '—',
  occupation: c.occupation || '—',
  education: c.education || '—',
  since: c.party_member_since ? String(c.party_member_since) : '—',
  membershipId: c.membership_id ? String(c.membership_id) : '—',
  status: c.proposal_status || 'Proposed',
  isConfirmed: c.proposal_status_id === 2,
  isNominated: c.is_nominated === 'Y',
})

// Proposing a name still belongs to Assign Members: that flow owns cadre search and the
// eligibility rules, and none of it is duplicated here.
const PROPOSE_ELSEWHERE = 'To put a new name forward, use Assign Members.'

export default function Dashboard2() {
  const [state, setStateRaw] = useState({
    step: 0, detail: null, chip: 1, pc: null, ac: null, quota: 'All locations',
    drawer: null, compare: null, pick: null, busy: false, toast: null, docs: {}, lfilter: 'all',
  })
  const setState = (patch) => setStateRaw((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }))

  const [summary, setSummary] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [geo, setGeo] = useState(null)
  const [reservations, setReservations] = useState(null)
  const [locs, setLocs] = useState(null)
  const [scores, setScores] = useState({})

  const st = state
  const step = st.step
  const accent = ACCENT
  const detail = st.detail

  const flash = (msg) => {
    setState({ toast: msg })
    setTimeout(() => setState({ toast: null }), 3000)
  }

  // 1. The whole main table, state-wide, once.
  useEffect(() => {
    let live = true
    getPositionSummary()
      .then((body) => { if (live) setSummary(body) })
      .catch((err) => { if (live) setLoadError(err.message) })
    return () => { live = false }
  }, [])

  // 2. One open post's geo split and reservation split. Keyed on the post's own triple, not
  //    on the detail object, which the render rebuilds every pass.
  const posKey = detail ? detail.key : null
  useEffect(() => {
    if (!posKey) return undefined
    let live = true
    setGeo(null)
    setReservations(null)
    Promise.all([getGeoBreakdown(detail), getReservationSummary(detail)])
      .then(([g, r]) => {
        if (!live) return
        setGeo(g)
        setReservations(r)
        // Land on the first assembly that holds locations for this post, so the list below
        // is never empty on arrival.
        const firstAc = (g.assemblies || [])[0]
        setState({ pc: firstAc ? firstAc.parliament_id : null, ac: firstAc ? firstAc.assembly_id : null })
      })
      .catch((err) => { if (live) flash(err.message) })
    return () => { live = false }
  }, [posKey])

  // 3. The locations inside the selected assembly. This is the one call that sends a scope
  //    pair: state-wide would be 12,451 rows for MPTC.
  useEffect(() => {
    if (!posKey || !st.ac) { setLocs(null); return undefined }
    let live = true
    setLocs(null)
    getLocations(detail, st.ac)
      .then((body) => { if (live) setLocs(body) })
      .catch((err) => { if (live) flash(err.message) })
    return () => { live = false }
  }, [posKey, st.ac])

  // getCadreScores is lookup-first and runs two stored procedures for a cadre nobody has
  // rated yet, so loadScores fires one membership id at a time and the badges fill in as
  // they land. Scoped to the location being compared: a page of 200 locations would
  // otherwise queue a request per name on the screen.
  useEffect(() => {
    if (!st.compare || !locs) return
    const loc = locs.locations.filter((x) => x.proposal_position_id === st.compare)[0]
    if (!loc) return
    loadScores((loc.candidates || []).map((c) => c.membership_id), setScores)
  }, [st.compare, locs])

  // Every write goes through here: it blocks a second click, refetches the locations the
  // change affected, and surfaces the backend's own {detail} text — the 409s ("already has
  // a confirmed candidate", "confirm before filing") are the useful half of this screen.
  const runWrite = async (fn, done) => {
    if (state.busy) return
    setState({ busy: true })
    try {
      await fn()
      const body = await getLocations(detail, st.ac)
      setLocs(body)
      flash(done)
    } catch (err) {
      flash(err.message)
    } finally {
      setState({ busy: false })
    }
  }

  const openDetail = (r, chip) => setState({ detail: r, chip, pick: null, step: CHIPS[chip][3], drawer: null, compare: null, lfilter: 'all', quota: 'All locations' })
  const setStep = (i) => {
    const c = CHIPS.filter((x) => x[3] === i && x[2] > 0)[0]
    setState({ step: i, chip: c ? c[2] : 1, drawer: null, compare: null, lfilter: 'all' })
  }
  const closeDetail = () => setState({ detail: null, drawer: null, compare: null })
  const closeCompare = () => setState({ compare: null, pick: null })
  const closeDrawer = () => setState({ drawer: null })

  const docState = (id, stage) => state.docs[id] || DOCS.map((doc) => (stage >= 3 ? true : doc[2]))
  const toggleDoc = (id, stage, i) => {
    const cur = docState(id, stage).slice()
    cur[i] = !cur[i]
    setState({ docs: { ...state.docs, [id]: cur } })
  }

  if (loadError) {
    return (
      <div className="leap-dash2">
        <style>{DASH2_CSS}</style>
        <div style={sx('padding:60px 40px;max-width:820px')}>
          <h1 style={sx(`margin:0 0 10px;font:700 24px/1.2 'Bitter',Georgia,serif`)}>Dashboard 2 could not load</h1>
          <div style={sx(`font:400 14px/1.6 'IBM Plex Sans';color:#6b7873`)}>
            {loadError}
            <br />Its backend is <code>portal-frontend-code-2</code>, mounted on the gateway at{' '}
            <code>/portal-frontend-code-2</code>. Check that the gateway is running on port 6644.
          </div>
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="leap-dash2">
        <style>{DASH2_CSS}</style>
        <div style={sx('padding:60px 40px')}>
          <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.14em;text-transform:uppercase;color:#8a9793`)}>Loading election data…</div>
        </div>
      </div>
    )
  }

  const ALL = summary.positions.map(toRow)
  const totals = summary.totals
  const sum = (k) => totals[API_FIELD[k]] || 0

  const PROG = [['proposed', 'total'], ['confirmed', 'proposed'], ['noms', 'confirmed'], ['vloc', 'noms'], ['vloc2', 'vloc'], ['declared', 'vloc2']]

  const steps = STEPS.map(([name], i) => {
    const p = pc(sum(PROG[i][0]), sum(PROG[i][1])), cur = i === step, past = i < step
    return {
      name, mark: past ? '✓' : String(i + 1), barW: p + '%',
      barFg: cur ? accent : past ? '#9fc0bb' : '#c9d2cf',
      ring: cur || past ? accent : '#d7dedc', dotBg: cur ? accent : past ? '#e2efed' : '#fff',
      dotFg: cur ? '#fff' : past ? accent : '#a6b1ad', labelFg: cur ? T.ink : '#7d8a86',
      leftLine: i === 0 ? 'transparent' : i <= step ? accent : '#e2e7e5',
      rightLine: i === STEPS.length - 1 ? 'transparent' : i < step ? accent : '#e2e7e5',
      go: () => setStep(i),
    }
  })

  const colDefs = [
    [['Locations', 'total', T.ink, 0], ['Started', 'proposed', T.green, 1], ['Not started', '_np', T.red, 0], ['Proposal (names)', 'names', T.amber, 1]],
    [['Started', 'proposed', T.amber, 1], ['Confirmed', 'confirmed', T.green, 2], ['Pending', '_cp', T.purple, 2]],
    [['Confirmed', 'confirmed', T.green, 2], ['Nomination filed', 'noms', T.teal, 3], ['Pending', '_fp', T.red, 3]],
    [['Total houses', 'houses', T.ink, 4], ['Visits', 'visited', T.blue, 4], ['Pending', 'hPending', T.red, 4]],
    [['Total houses', 'houses', T.ink, 5], ['Visits', 'visited2', '#164a9e', 5], ['Pending', 'hPending2', T.red, 5]],
    [['Declared', 'declared', T.purple, 6], ['Won', 'won', T.green, 6], ['Lost', 'lost', T.crim, 6]],
  ][step]

  const val = (r, k) => (k === '_np' ? r.total - r.proposed : k === '_cp' ? r.proposed - r.confirmed : k === '_fp' ? r.confirmed - r.noms : r[k])
  const mkRow = (r) => ({
    name: r.name, sub: r.sub,
    // A card with no rows behind it is a post nobody has configured a proposal constituency
    // for. It still gets its place — the tree is the plan — but there is nothing to open.
    open: () => (r.configured ? openDetail(r, CHIPS.filter((c) => c[3] === step && c[2] > 0)[0][2]) : flash(r.name + ' has no positions configured yet')),
    cells: colDefs.map(([label, k, tone, chip]) => ({
      v: r.configured ? n(val(r, k)) : '—', tone: r.configured ? tone : '#c9d2cf',
      line: r.configured && chip > 0 ? 'underline' : 'none',
      hint: r.configured ? 'Open ' + r.name + ' · ' + label : r.name + ' — not configured',
      go: () => (r.configured ? openDetail(r, chip || 1) : flash(r.name + ' has no positions configured yet')),
    })),
  })

  // Pour the summary rows into the shared tree. A card claims by proposal_role_id and
  // nothing else, so one card can span several election types — Corporator claims role 5
  // under Municipal Ward, Corporation Ward and a stray MPTC constituency, and counts all
  // three together, exactly as the Dashboard screen does.
  const foldCard = (card, tier, body) => {
    const claimed = ALL.filter((r) => cardMatches(card, r))
    const folded = {
      key: tier.id + '/' + card.label, name: card.label, body: body.label,
      roleIds: card.roleIds, configured: claimed.length > 0,
    }
    // Counted over everything the card claims — a Municipal Ward seat is still a Corporator
    // seat, and the Dashboard screen counts it the same way.
    CARD_COUNTERS.forEach((k) => { folded[k] = claimed.reduce((s, r) => s + (r[k] || 0), 0) })
    // Named after this body's own slice of them, so the Corporator card under Municipal
    // Corporation reads "Corporation Ward" rather than listing all three types its role
    // spans. Falls back to the whole set when nothing matches, so a card whose rows all sit
    // outside its body still says what they are instead of going blank.
    const inBody = claimed.filter((r) => r.mainElectionTypeId === body.mainElectionTypeId)
    const named = inBody.length ? inBody : claimed
    const types = []
    named.forEach((r) => { if (types.indexOf(r.electionType) < 0) types.push(r.electionType) })
    // A card with no rows of its own (Ward Councillor, Ward Member) has nothing to derive
    // from, so the tree names its election type by id and the name is read off any row that
    // carries it — still never a hardcoded type name. Its counters stay "—", which is what
    // says the post is unconfigured; the label only says which election it belongs to.
    const byId = ALL.filter((r) => r.proposalElectionTypeId === card.electionTypeId)[0]
    folded.sub = claimed.length ? types.join(' · ') : byId ? byId.electionType : 'Not configured'
    return folded
  }
  const sections = ELECTION_TREE.map((tier, ti) => {
    const style = TIER_STYLE[ti] || TIER_STYLE[TIER_STYLE.length - 1]
    const bodies = tier.bodies.map((body) => {
      const rows = body.cards.map((card) => foldCard(card, tier, body))
      const live = rows.filter((r) => r.configured).length
      return {
        title: body.label, accent: BODY_ACCENT[body.label] || T.mute, firstCol: 'Position',
        meta: live + ' of ' + rows.length + ' configured',
        rows: rows.map(mkRow), _rows: rows,
      }
    })
    return {
      title: style.title, sub: tier.sub, accent: style.accent, border: style.border,
      headBorder: style.headBorder, bg: style.bg,
      count: n(bodies.reduce((s, b) => s + b._rows.reduce((x, r) => x + r.proposed, 0), 0)),
      countLabel: 'locations started', groups: bodies,
    }
  })

  // Anything the tree does not claim is still shown, grouped by (election type, role) into
  // an "Other" body on the last tier. The tree is a guess about which roles exist; a wrong
  // guess must never hide live data. If a row lands here, a new proposal_role was added and
  // ../electionTree.js has not been told about it.
  const unclaimed = ALL.filter((r) => !CLAIMED_ROLE_IDS.has(Number(r.proposal_role_id)))
  if (unclaimed.length) {
    const byKey = new Map()
    unclaimed.forEach((r) => {
      const key = 'other/' + r.proposalElectionTypeId + '/' + r.roleName
      if (!byKey.has(key)) byKey.set(key, { key, name: r.electionType + ' — ' + r.roleName, body: 'Other', roleIds: [Number(r.proposal_role_id)], configured: true, sub: r.electionType })
      const folded = byKey.get(key)
      CARD_COUNTERS.forEach((k) => { folded[k] = (folded[k] || 0) + (r[k] || 0) })
    })
    const rows = [...byKey.values()]
    sections[sections.length - 1].groups.push({
      title: 'Other', accent: BODY_ACCENT.Other, firstCol: 'Position',
      meta: 'configured in the database, outside the standard tree',
      rows: rows.map(mkRow), _rows: rows,
    })
  }

  // ---- detail-view derived state ----
  let chips = [], resCards = [], geoCols = [], pcRows = [], acRows = [], rows = []
  let cmp = { cands: [], attrs: [] }
  let dw = { timeline: [], facts: [] }
  let hasDrawer = false, hasCompare = false, listEmpty = false
  let dName = '', dBody = '', dPc = '', dAc = '', chipName = '', listTitle = '', listFoot = ''
  let showMetric = false, metricCol = '', docsList = [], resObj = {}, lfilters = []
  let d2d = { houses: '0', visited: '0', pct: 0, barW: '0%', workers: [] }
  let pcTotal = '', acTotal = '', geoNote = '', geoFoot = ''

  const d = detail
  if (d) {
    const chipDef = CHIPS[st.chip]
    const allLocations = locs ? locs.locations : []
    const locById = (id) => allLocations.filter((x) => x.proposal_position_id === id)[0]
    const pcRow = geo ? (geo.parliaments || []).filter((x) => x.parliament_id === st.pc)[0] : null
    const acRow = geo ? (geo.assemblies || []).filter((x) => x.assembly_id === st.ac)[0] : null
    const pcName = pcRow ? pcRow.parliament_name : '—'
    const acName = acRow ? acRow.assembly_name : '—'

    chips = CHIPS.map(([label, k, , si, tone, note], i) => {
      const on = i === st.chip
      return {
        label, tone, value: n(d[k]), note,
        border: on ? accent : '#e9edeb', bg: on ? '#f4faf9' : '#fff', labelFg: on ? accent : '#8a9793',
        arrow: i === CHIPS.length - 1 ? '' : '›', arrowFg: i < st.chip ? accent : '#cfd8d5',
        go: () => setState({ chip: i, step: si, drawer: null, compare: null, lfilter: 'all' }),
      }
    })

    // The reservation cards, straight off /reservationSummary — the reservations actually
    // configured on this post's positions, never a fixed SC/ST/BC/General list. A post with
    // none (every Gram Panchayat position today) gets the "not configured" card instead.
    const resRows = reservations ? reservations.reservations : []
    resCards = [{ label: 'All locations', tone: T.mute, total: d.total, confirmed: d.confirmed, share: '100%' }]
      .concat(resRows.map((r) => ({
        label: r.reservation_type || 'No reservation set',
        tone: r.reservation_type ? resTone(r.reservation_type) : T.red,
        total: r.total_locations, confirmed: r.confirmed,
        share: pc(r.total_locations, d.total) + '%',
      })))
      .map((c) => {
        const on = st.quota === c.label
        return {
          label: c.label, tone: c.tone, total: n(c.total),
          confirmed: n(c.confirmed), pending: n(c.total - c.confirmed), share: c.share,
          barW: pc(c.confirmed, c.total) + '%',
          border: on ? accent : '#e9edeb', bg: on ? '#f4faf9' : '#fff',
          go: () => setState({ quota: c.label, drawer: null, compare: null }),
        }
      })

    // Total, plus the stage being viewed — intermediate stages are noise here.
    const keepIdx = st.chip === 0 ? [0] : [0, st.chip]
    geoCols = keepIdx.map((i) => ({ label: CHIPS[i][0], fg: i === st.chip ? accent : '#8a9793' }))
      .concat(st.chip > 0 ? [{ label: PENDING_LABEL[st.chip], fg: T.red }] : [])
    const geoCells = (g) => {
      const cells = keepIdx.map((ki) => ({ v: n(g[API_FIELD[CHIPS[ki][1]]]), fg: ki === st.chip ? accent : T.ink, w: ki === st.chip ? '700' : '600' }))
      if (st.chip > 0) cells.push({ v: n(g[API_FIELD[CHIPS[st.chip - 1][1]]] - g[API_FIELD[CHIPS[st.chip][1]]]), fg: T.red, w: '600' })
      return cells
    }
    pcRows = (geo ? geo.parliaments : []).map((g) => {
      const on = g.parliament_id === st.pc
      const acs = (geo.assemblies || []).filter((a) => a.parliament_id === g.parliament_id)
      return {
        name: 'PC · ' + g.parliament_name, sub: acs.length + ' assembly segments',
        bg: on ? '#f4faf9' : '#fff', nameFg: on ? accent : T.ink,
        mark: on ? '▸' : '', cells: geoCells(g),
        go: () => setState({ pc: g.parliament_id, ac: acs.length ? acs[0].assembly_id : null, drawer: null, compare: null }),
      }
    })
    acRows = (geo ? geo.assemblies : []).filter((a) => a.parliament_id === st.pc).map((a) => {
      const on = a.assembly_id === st.ac
      return {
        name: 'AC · ' + a.assembly_name, sub: 'in PC · ' + (a.parliament_name || '—'),
        bg: on ? '#f4faf9' : '#fff', nameFg: on ? accent : T.ink,
        mark: on ? '▸' : '', cells: geoCells(a),
        go: () => setState({ ac: a.assembly_id, drawer: null, compare: null }),
      }
    })
    geoNote = 'Highlighted column = ' + chipDef[0]
    geoFoot = 'Each column adds up down the rows to the position total — every location is counted under exactly one assembly.'
    pcTotal = n(d.total) + ' locations across ' + pcRows.length + ' parliament constituencies'
    acTotal = pcRow ? n(pcRow.total_locations) + ' locations in PC · ' + pcName : 'Pick a parliament constituency'

    const level = chipDef[2]
    const lf = st.lfilter || 'all'
    const quotaOf = (l) => l.reservation_type || 'No reservation set'
    const inQuota = (l) => st.quota === 'All locations' || quotaOf(l) === st.quota
    const scoped = allLocations.filter(inQuota)
    const tally = { all: 0, done: 0, pending: 0, behind: 0 }
    scoped.forEach((l) => {
      if (level > 0 && l.stage > level) return
      tally.all += 1
      if (l.stage >= level) tally.done += 1
      else if (l.stage === level - 1) tally.pending += 1
      else tally.behind += 1
    })
    const shown = scoped.filter((l) => {
      // Scoped to the stage being viewed: nothing already past it.
      if (level > 0 && l.stage > level) return false
      if (lf === 'done') return l.stage >= level
      if (lf === 'pending') return l.stage === level - 1
      if (lf === 'behind') return l.stage < level - 1
      return true
    })
    const words = FILTER_WORDS[level]
    const chipDefs = level === 0
      ? [['all', words[0]]]
      : [['all', words[0]], ['done', words[1]], ['pending', words[2]]].concat(level > 1 && tally.behind ? [['behind', 'Not yet at this stage']] : [])
    lfilters = chipDefs.map(([fkey, label]) => ({
      label: label + ' (' + tally[fkey] + ')',
      go: () => setState({ lfilter: fkey, drawer: null, compare: null }),
      border: lf === fkey ? accent : '#dfe4e2',
      bg: lf === fkey ? '#f1f7f6' : '#fff',
      fg: lf === fkey ? accent : T.mute,
    }))

    // Best score first, unscored last — the same ranking the Candidates screen uses.
    // `?? -1` and not `?? 0`: a cadre nobody has rated must sort below a real zero, never
    // as one. Sorted here rather than in each consumer so the comparison table, the
    // "Leading:" line on the location row and the drawer all name the same candidate.
    // The order settles as loadScores fills the badges in, one membership id at a time.
    const candsOf = (l) =>
      (l.candidates || [])
        .map((c) => toCand(c, scores[String(c.membership_id)]))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    const leadOf = (l) => {
      const cands = candsOf(l)
      if (!cands.length) return { c: null, tag: 'Empty' }
      const conf = cands.filter((c) => c.isConfirmed)[0]
      if (conf) return { c: conf, tag: 'Confirmed' }
      return { c: cands[0], tag: nm(cands.length) + ' proposed' }
    }

    rows = shown.map((l) => {
      const sty = SS[STAGES[l.stage]], cands = candsOf(l), ld = leadOf(l)
      const started = fmtDate(l.started_time)
      return {
        name: l.local_body_name,
        sub: (l.mandal_town_name || l.assembly_name || '') + (started ? ' · started ' + started : ''),
        quota: quotaOf(l),
        namesLabel: !cands.length ? 'No name yet' : l.confirmed_names ? nm(cands.length) + ' · 1 confirmed' : nm(cands.length),
        leadTag: ld.tag,
        leadBg: ld.c ? (l.confirmed_names ? SS.Confirmed[0] : '#f1f4f3') : SS['Not started'][0],
        leadFg: ld.c ? (l.confirmed_names ? SS.Confirmed[1] : T.mute) : SS['Not started'][1],
        leadName: !ld.c ? 'No name proposed yet' : (l.confirmed_names ? 'Confirmed candidate: ' : 'Leading: ') + ld.c.name + ' · ' + ld.c.casteGroup + ' · ' + ld.c.gender,
        stage: STAGES[l.stage], pillBg: sty[0], pillFg: sty[1],
        metric: step === 3 || step === 4 ? '0 / 0' : step === 5 ? '—' : cands.length ? String(cands.length) : '—',
        metricTone: T.mute,
        btn: cands.length ? 'View names' : '—',
        btnBorder: cands.length ? accent : 'transparent',
        btnBg: cands.length ? accent : 'transparent',
        btnFg: cands.length ? '#fff' : '#c9d2cf',
        compare: () => setState(cands.length ? { compare: l.proposal_position_id } : { drawer: l.proposal_position_id }),
        go: () => setState(cands.length ? { compare: l.proposal_position_id } : { drawer: l.proposal_position_id }),
      }
    })

    const ci = st.compare
    if (ci) {
      const l = locById(ci)
      const cands = l ? candsOf(l) : []
      const quota = l ? quotaOf(l) : '—'
      const cell = (v, tone) => ({ v, tone: tone || T.ink, best: '' })
      // The name holding the seat, if any. A location may hold at most one — the backend
      // refuses a second with a 409 rather than trusting the screen to prevent it.
      const confirmedId = (cands.filter((c) => c.isConfirmed)[0] || {}).id || null
      cmp = {
        crumb: d.name + ' · ' + d.body + ' · AC ' + acName,
        title: (l ? l.local_body_name : '') + ' — ' + nm(cands.length) + ' proposed',
        // Deliberately not a verdict. Whether a name may be assigned to this seat is decided
        // by eligibility_flag() in the /leapapi backend, on the write — restating that rule
        // here would be a second copy free to drift from it.
        help: 'Location reserved for ' + quota + '. Pick a name, then confirm it.',
        cands: cands.map((c) => ({
          // null, not 0, while the score is still in flight or the cadre is unrated — and
          // '—' rather than a number for both, because unrated must not read as zero.
          name: c.name, phone: c.phone, score: c.score == null ? '—' : String(c.score),
          // Tinted by the same scoreTier the other screens use. Unrated is its own grey
          // tier, never the worst-candidate red — the score is null and not 0 when nobody
          // has rated them yet, and it reads grey while the request is still in flight.
          scoreFg: TIER_COLOR[scoreTier(c.score)],
          border: (st.pick ?? confirmedId) === c.id ? accent : '#e9edeb',
          bg: (st.pick ?? confirmedId) === c.id ? '#f4faf9' : '#fff',
          dotRing: (st.pick ?? confirmedId) === c.id ? accent : '#cfd8d5',
          dotFill: (st.pick ?? confirmedId) === c.id ? accent : '#fff',
          fit: c.casteGroup + ' · ' + c.gender,
          fitBg: '#f1f4f3', fitFg: T.mute,
          state: c.isConfirmed ? 'Confirmed' : c.status,
          stateBg: c.isConfirmed ? '#e9f3f2' : '#f1f4f3', stateFg: c.isConfirmed ? '#0a5b53' : T.mute,
          pick: () => setState({ pick: c.id }),
          // Soft delete: the slot reopens and who was proposed survives.
          removeLabel: state.busy ? '…' : 'Remove',
          remove: () => runWrite(() => removeCandidate(c.id), c.name + ' removed from this location'),
        })),
        attrs: [
          { label: 'Status', cells: cands.map((c) => cell(c.isNominated ? 'Nomination filed' : c.status, c.isConfirmed ? T.green : T.ink)) },
          { label: 'Membership ID', cells: cands.map((c) => cell(c.membershipId)) },
          { label: 'Caste category · caste', cells: cands.map((c) => cell(c.casteGroup + ' · ' + c.subCaste)) },
          { label: 'Gender · age', cells: cands.map((c) => cell(c.gender + ' · ' + c.age)) },
          { label: 'Occupation', cells: cands.map((c) => cell(c.occupation)) },
          { label: 'Education', cells: cands.map((c) => cell(c.education)) },
          { label: 'Member since', cells: cands.map((c) => cell(c.since)) },
          { label: 'Mobile', cells: cands.map((c) => cell(c.phone)) },
        ].map((a, i2) => Object.assign(a, { rowBg: i2 % 2 ? '#fbfcfc' : '#fff' })),
        foot: confirmedId
          ? 'A candidate is confirmed for this seat. Un-confirm to pick a different name. ' + PROPOSE_ELSEWHERE
          : st.pick
            ? 'Confirming settles this seat — no further name can be proposed for it. ' + PROPOSE_ELSEWHERE
            : 'Select one name above to enable confirmation. ' + PROPOSE_ELSEWHERE,
        btnLabel: state.busy ? 'Saving…' : confirmedId ? 'Un-confirm' : 'Confirm candidate',
        btnBg: state.busy || (!confirmedId && !st.pick) ? '#e6ebe9' : accent,
        btnFg: state.busy || (!confirmedId && !st.pick) ? '#7d8a86' : '#fff',
        btnCursor: state.busy || (!confirmedId && !st.pick) ? 'default' : 'pointer',
        confirmGo: () => {
          if (state.busy) return
          if (confirmedId) {
            runWrite(() => confirmCandidate(confirmedId, PROPOSED_STATUS_ID), 'Confirmation withdrawn')
            return
          }
          if (!st.pick) { flash('Select a name first'); return }
          runWrite(() => confirmCandidate(st.pick), 'Candidate confirmed')
        },
      }
    }
    hasCompare = !!ci

    const di = st.drawer
    if (di) {
      const l = locById(di)
      const stage = l ? l.stage : 0
      const cands = l ? candsOf(l) : []
      const c = l ? leadOf(l).c : null
      const ACTS = [
        ['No name for this location yet', 'Nothing has gone up for this seat. Names are added in Assign Members.'],
        ['Names are waiting to be compared', 'Compare the names on this seat side by side, then confirm one.'],
        ['Candidate confirmed', 'The seat is settled. Mark the nomination filed once the papers are in.'],
        ['Nomination filed', 'Papers are on record for this location. Withdrawing puts it back to Confirmed.'],
        ['Door to Door', 'No source table for field visits yet — this stage reads 0 everywhere.'],
        ['Door to Door - 2', 'No source table for the second round yet — this stage reads 0 everywhere.'],
        ['Result declared', 'No source table for declared results yet — this stage reads 0 everywhere.'],
      ]
      const act = ACTS[stage]
      dw = {
        loc: (l ? l.local_body_name : '') + ' · AC ' + acName,
        name: c ? c.name : 'No candidate yet',
        role: d.name + ' · ' + d.body + ' · seat reserved for ' + (l ? quotaOf(l) : '—'),
        phone: c ? c.phone : '—',
        stage: STAGES[stage], pillBg: SS[STAGES[stage]][0], pillFg: SS[STAGES[stage]][1],
        compareLabel: cands.length ? (cands.length === 1 ? 'View the 1 name on this location' : 'Compare all ' + cands.length + ' names on this location') : 'No names on this location yet',
        compareGo: () => { if (cands.length) setState({ compare: di, drawer: null }) },
        timeline: STAGES.slice(1).map((label, i) => {
          const done = i < stage - 1, cur = i === stage - 1
          return {
            label, mark: done ? '✓' : '', ring: done || cur ? accent : '#d7dedc',
            fill: done ? accent : cur ? '#e2efed' : '#fff', line: i < stage - 1 ? accent : '#e2e7e5',
            fg: cur ? T.ink : done ? '#3d4a46' : '#a6b1ad',
            note: done ? 'Done' : cur ? 'Current stage' : 'Not reached yet',
          }
        }),
        facts: [
          ['Profile', c ? c.gender + ' · ' + c.age + ' · ' + c.casteGroup : '—'],
          ['Occupation', c ? c.occupation : '—'],
          ['Education', c ? c.education : '—'],
          ['Member since', c ? c.since : '—'],
          ['Reserved for', l ? quotaOf(l) : '—'],
          ['Names on location', String(cands.length)],
        ].map(([k, v]) => ({ k, v })),
        actionStep: 'Stage ' + stage,
        actionTitle: act[0], actionHelp: act[1],
        isDocs: stage >= 2, isD2d: false, isResult: false,
        // One button, whatever the location's next real step is. Stage 0 has nothing to act
        // on here — a new name is proposed in Assign Members, not on this screen.
        primary: state.busy ? 'Saving…'
          : stage === 0 ? 'Nothing to do here'
          : stage === 1 ? 'Compare and confirm'
          : stage === 2 ? 'Mark nomination filed'
          : 'Withdraw nomination',
        primaryBg: state.busy || stage === 0 ? '#e6ebe9' : accent,
        primaryFg: state.busy || stage === 0 ? '#7d8a86' : '#fff',
        primaryGo: () => {
          if (state.busy) return
          if (stage === 0) { flash(PROPOSE_ELSEWHERE); return }
          if (stage === 1) { setState({ compare: di, drawer: null, pick: null }); return }
          const confirmed = (cands.filter((x) => x.isConfirmed)[0] || {}).id
          if (!confirmed) { flash('No confirmed candidate on this location'); return }
          runWrite(
            () => markNominated(confirmed, stage === 2 ? 'Y' : 'N'),
            stage === 2 ? 'Nomination marked as filed' : 'Nomination withdrawn',
          )
        },
      }
      // The papers checklist is a local scratchpad — there is no per-document endpoint.
      // Only the location's Nomination filed stage is real.
      docsList = DOCS.map(([name, note], i) => {
        const ok = docState(di, stage)[i]
        return { name, note, mark: ok ? '✓' : '!', state: ok ? 'Ticked (local only)' : 'Not ticked', tone: ok ? T.green : T.red, go: () => toggleDoc(di, stage, i) }
      })
      resObj = {
        won: { border: '#e2e7e5', bg: '#fff', fg: '#9aa5a1', w: '1px' },
        lost: { border: '#e2e7e5', bg: '#fff', fg: '#9aa5a1', w: '1px' },
        note: 'No source table for declared results yet.',
        wonGo: () => flash('No source table for declared results yet.'),
        lostGo: () => flash('No source table for declared results yet.'),
      }
    }
    hasDrawer = !!di

    dName = d.name; dBody = d.body; dPc = pcName; dAc = acName; chipName = chipDef[0]
    listTitle = d.name + ' · PC ' + pcName + ' · AC ' + acName
    listFoot = (!locs
      ? 'Loading this assembly’s locations…'
      : level === 0
        ? 'Every location in this position, whatever stage it has reached.'
        : lf === 'done'
          ? 'Locations that have completed “' + CHIPS[level][0] + '”.'
          : lf === 'pending'
            ? 'Locations waiting at this stage.'
            : lf === 'behind'
              ? 'Locations still short of this stage.'
              : 'Every location up to this stage. Locations already past it are hidden.')
      + ' AC · ' + acName + ', reservation ' + st.quota + '.'
      + (locs && locs.total > locs.locations.length ? ' Showing ' + locs.locations.length + ' of ' + locs.total + '.' : '')
    listEmpty = rows.length === 0
    showMetric = step >= 3
    metricCol = step === 3 || step === 4 ? 'Visits / total houses' : 'Margin'
  }

  return (
    <div className="leap-dash2">
      <style>{DASH2_CSS}</style>
      <div style={sx('max-width:1440px;margin:0 auto;padding:0 0 70px;font-variant-numeric:tabular-nums;position:relative')}>

        <div style={sx('padding:24px 40px 20px;background:#fff;border-bottom:1px solid #dfe4e2')}>
          <div style={sx('display:flex;align-items:flex-end;justify-content:space-between;gap:32px;flex-wrap:wrap')}>
            <div>
              <div style={sx(`font:600 11px/1 'IBM Plex Sans';letter-spacing:.16em;text-transform:uppercase;color:#8a9793;margin-bottom:8px`)}>Party Core Dashboard</div>
              <h1 style={sx(`margin:0;font:700 29px/1.1 'Bitter',Georgia,serif`)}>Local Body Election</h1>
              <div style={sx(`margin-top:7px;font:400 13px/1.4 'IBM Plex Sans';color:#6b7873`)}>One location per row, all its names compared side by side. Steps, numbers and reservation all filter the same list.</div>
            </div>
            <div style={sx('display:flex;align-items:center;gap:10px')}>
              <div style={sx(`font:500 11.5px/1 'IBM Plex Sans';color:#8a9793;padding:10px 12px;border:1px solid #dfe4e2;border-radius:7px;white-space:nowrap`)}>Andhra Pradesh · 2026</div>
            </div>
          </div>
        </div>

        <div style={sx('padding:22px 40px 0')}>
          <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;padding:20px 24px 18px')}>
            <div style={sx('display:flex;align-items:flex-start;flex-wrap:wrap;gap:8px')}>
              {steps.map((s, i) => (
                <div key={i} style={sx('flex:1;display:flex;flex-direction:column;min-width:110px')}>
                  <div style={sx('display:flex;align-items:center;height:30px')}>
                    <div style={sx(`flex:1;height:2px;background:${s.leftLine}`)} />
                    <button type="button" onClick={s.go} style={sx(`width:30px;height:30px;flex:none;border-radius:50%;cursor:pointer;border:2px solid ${s.ring};background:${s.dotBg};color:${s.dotFg};font:700 12.5px/1 'IBM Plex Sans';display:flex;align-items:center;justify-content:center`)}>{s.mark}</button>
                    <div style={sx(`flex:1;height:2px;background:${s.rightLine}`)} />
                  </div>
                  <div style={sx('text-align:center;padding:9px 10px 0')}>
                    <div style={sx(`font:600 12.5px/1.25 'IBM Plex Sans';color:${s.labelFg}`)}>{s.name}</div>
                    <div style={sx('margin:9px auto 0;width:76px;height:3px;border-radius:2px;background:#e6eae8;overflow:hidden')}>
                      <div style={sx(`height:3px;border-radius:2px;background:${s.barFg};width:${s.barW}`)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={sx('padding:24px 40px 0')}>
          <div style={sx('display:flex;align-items:baseline;gap:13px')}>
            <div style={sx(`font:600 11px/1 'IBM Plex Sans';letter-spacing:.16em;text-transform:uppercase;color:#0d7a6f`)}>Step {step + 1}</div>
            <h2 style={sx(`margin:0;font:600 21px/1.2 'Bitter',Georgia,serif`)}>{STEPS[step][0]}</h2>
          </div>
          <div style={sx(`margin-top:6px;font:400 13.5px/1.5 'IBM Plex Sans';color:#6b7873;max-width:820px`)}>{STEPS[step][1]}</div>
        </div>

        {!st.detail && (
          <div style={sx('padding:18px 40px 0;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap')}>
            {sections.map((sec, si) => (
              <div key={si} style={sx(`flex:1;min-width:320px;border:1px solid ${sec.border};border-radius:12px;background:${sec.bg};padding:14px`)}>
                <div style={sx(`display:flex;align-items:center;justify-content:space-between;gap:20px;padding:13px 16px;margin-bottom:14px;border:1px solid ${sec.headBorder};border-radius:9px;background:#fff`)}>
                  <div>
                    <div style={sx(`font:700 13px/1 'IBM Plex Sans';letter-spacing:.09em;text-transform:uppercase;color:${sec.accent}`)}>{sec.title}</div>
                    <div style={sx(`margin-top:6px;font:400 12px/1.3 'IBM Plex Sans';color:#8a9793`)}>{sec.sub}</div>
                  </div>
                </div>
                <div style={sx('display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start')}>
                  {sec.groups.map((g, gi) => (
                    <div key={gi} style={sx('flex:1 1 100%;min-width:0;background:#fff;border:1px solid #dfe4e2;border-radius:10px;overflow:hidden')}>
                      <div style={sx('display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e9edeb')}>
                        <div style={sx('display:flex;align-items:center;gap:10px')}>
                          <div style={sx(`width:3px;height:16px;border-radius:2px;background:${g.accent}`)} />
                          <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.05em;text-transform:uppercase`)}>{g.title}</div>
                        </div>
                        <div style={sx(`font:500 11.5px/1 'IBM Plex Sans';color:#8a9793`)}>{g.meta}</div>
                      </div>
                      <div style={sx('display:flex;align-items:center;padding:9px 18px;background:#f7f9f8;border-bottom:1px solid #e9edeb')}>
                        <div style={sx(`flex:1.7;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.12em;text-transform:uppercase;color:#8a9793`)}>{g.firstCol}</div>
                        {colDefs.map(([label], ci3) => (
                          <div key={ci3} style={sx(`flex:1;text-align:right;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.1em;text-transform:uppercase;color:#8a9793`)}>{label}</div>
                        ))}
                      </div>
                      {g.rows.map((r, ri) => (
                        <div key={ri} onClick={r.open} className="d2-geo-row" style={sx('display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #f0f3f2;cursor:pointer')}>
                          <div style={sx('flex:1.7;min-width:0')}>
                            <div style={sx(`font:600 13px/1.25 'IBM Plex Sans';color:#0d7a6f`)}>{r.name}</div>
                            <div style={sx(`font:400 11px/1.3 'IBM Plex Sans';color:#9aa5a1;margin-top:2px`)}>{r.sub}</div>
                          </div>
                          {r.cells.map((cell, cei) => (
                            <div key={cei} style={sx(`flex:1;text-align:right;font:700 13.5px/1.2 'IBM Plex Sans';color:${cell.tone}`)}>{cell.v}</div>
                          ))}
                        </div>
                      ))}
                      <div style={sx(`padding:11px 18px;background:#fafbfb;font:400 11.5px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>Click a position name to open its locations.</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!!st.detail && (
          <div style={sx('padding:18px 40px 0')}>

            <div style={sx('display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #dfe4e2;border-radius:10px;padding:13px 18px;margin-bottom:14px;flex-wrap:wrap')}>
              <button type="button" className="d2-btn" onClick={closeDetail} style={sx(`cursor:pointer;flex:none;white-space:nowrap;font:600 11px/1 'IBM Plex Sans';letter-spacing:.09em;text-transform:uppercase;padding:9px 13px;border-radius:6px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>← All positions</button>
              <div style={sx(`display:flex;align-items:center;gap:9px;flex-wrap:wrap;font:500 12.5px/1 'IBM Plex Sans';color:#8a9793`)}>
                <span style={sx('font-weight:700;color:#1a2422;font-size:14px')}>{dName}</span>
                <span>·</span><span>{dBody}</span>
                <span style={sx('color:#c9d2cf')}>/</span><span>PC · {dPc}</span>
                <span style={sx('color:#c9d2cf')}>/</span><span>AC · {dAc}</span>
                <span style={sx('color:#c9d2cf')}>/</span><span style={sx('color:#0d7a6f;font-weight:600')}>Step {step + 1} · {chipName}</span>
              </div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;padding:15px 18px 17px;margin-bottom:14px')}>
              <div style={sx(`font:600 10.5px/1 'IBM Plex Sans';letter-spacing:.13em;text-transform:uppercase;color:#8a9793;margin-bottom:12px`)}>Where the {dName} locations stand — click a stage to move the step above and filter the list below</div>
              <div style={sx('display:flex;align-items:stretch;flex-wrap:wrap;gap:6px')}>
                {chips.map((c, i) => (
                  <div key={i} style={sx('display:flex;align-items:center;flex:1;min-width:130px')}>
                    <button type="button" className="d2-card" onClick={c.go} style={sx(`flex:1;min-width:0;cursor:pointer;text-align:left;padding:13px 14px;border-radius:9px;border:1.5px solid ${c.border};background:${c.bg}`)}>
                      <div style={sx(`font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.1em;text-transform:uppercase;color:${c.labelFg}`)}>{c.label}</div>
                      <div style={sx(`margin-top:8px;font:700 20px/1 'IBM Plex Sans';color:${c.tone}`)}>{c.value}</div>
                      <div style={sx(`margin-top:6px;font:500 10.5px/1.2 'IBM Plex Sans';color:#9aa5a1`)}>{c.note}</div>
                    </button>
                    <div style={sx(`flex:none;width:16px;text-align:center;font:600 13px/1 'IBM Plex Sans';color:${c.arrowFg}`)}>{c.arrow}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;padding:15px 18px 17px;margin-bottom:14px')}>
              <div style={sx('display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:12px')}>
                <div style={sx(`font:600 10.5px/1 'IBM Plex Sans';letter-spacing:.13em;text-transform:uppercase;color:#8a9793`)}>Reservation summary — click a quota to filter the locations below</div>
                <div style={sx(`font:400 11.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>Women is a cross-cutting quota, so it overlaps the others</div>
              </div>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:11px')}>
                {resCards.map((q, i) => (
                  <button type="button" key={i} className="d2-card" onClick={q.go} style={sx(`cursor:pointer;text-align:left;border:1.5px solid ${q.border};border-radius:9px;padding:12px 13px 11px;background:${q.bg}`)}>
                    <div style={sx('display:flex;align-items:center;justify-content:space-between')}>
                      <div style={sx(`font:700 12px/1 'IBM Plex Sans';letter-spacing:.06em;color:${q.tone}`)}>{q.label}</div>
                      <div style={sx(`font:500 10.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>{q.share}</div>
                    </div>
                    <div style={sx(`margin-top:10px;font:700 20px/1 'IBM Plex Sans'`)}>{q.total}</div>
                    <div style={sx('margin-top:7px;height:4px;border-radius:2px;background:#eceff0;overflow:hidden')}><div style={sx(`height:4px;background:${q.tone};width:${q.barW}`)} /></div>
                    <div style={sx(`margin-top:8px;display:flex;justify-content:space-between;font:500 10.5px/1.3 'IBM Plex Sans'`)}><span style={sx('color:#1c7a45')}>{q.confirmed} conf.</span><span style={sx('color:#c0392b')}>{q.pending} left</span></div>
                  </button>
                ))}
              </div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;overflow:hidden;margin-bottom:14px')}>
              <div style={sx('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid #e9edeb;flex-wrap:wrap')}>
                <div style={sx('display:flex;align-items:center;gap:10px')}>
                  <div style={sx('width:3px;height:16px;border-radius:2px;background:#0d7a6f')} />
                  <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.05em;text-transform:uppercase`)}>Parliament constituency wise</div>
                </div>
                <div style={sx('display:flex;align-items:baseline;gap:12px')}>
                  <div style={sx(`font:400 11.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>{pcTotal}</div>
                  <div style={sx(`font:500 11px/1 'IBM Plex Sans';color:#0d7a6f`)}>{geoNote}</div>
                </div>
              </div>
              <div style={sx('display:flex;padding:9px 18px;background:#f7f9f8;border-bottom:1px solid #e9edeb')}>
                <div style={sx(`flex:1.9;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Parliament constituency</div>
                {geoCols.map((c, i) => (
                  <div key={i} style={sx(`flex:1;text-align:right;font:600 9.5px/1.25 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;color:${c.fg}`)}>{c.label}</div>
                ))}
              </div>
              {pcRows.map((g, i) => (
                <div key={i} onClick={g.go} className="d2-geo-row" style={sx(`display:flex;align-items:center;padding:11px 18px;border-bottom:1px solid #f0f3f2;cursor:pointer;background:${g.bg}`)}>
                  <div style={sx('flex:1.9;min-width:0;display:flex;align-items:baseline;gap:7px')}>
                    <div style={sx(`flex:none;width:9px;font:700 10px/1.4 'IBM Plex Sans';color:#0d7a6f`)}>{g.mark}</div>
                    <div style={sx('min-width:0')}>
                      <div style={sx(`font:700 12.5px/1.25 'IBM Plex Sans';color:${g.nameFg}`)}>{g.name}</div>
                      <div style={sx(`font:400 10.5px/1.3 'IBM Plex Sans';color:#9aa5a1;margin-top:2px`)}>{g.sub}</div>
                    </div>
                  </div>
                  {g.cells.map((cell, ci4) => (
                    <div key={ci4} style={sx(`flex:1;text-align:right;font:${cell.w} 12.5px/1.2 'IBM Plex Sans';color:${cell.fg}`)}>{cell.v}</div>
                  ))}
                </div>
              ))}
              <div style={sx(`padding:11px 18px;background:#fafbfb;font:400 11.5px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>{geoFoot} Click a row to load its assembly segments below.</div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;overflow:hidden;margin-bottom:14px')}>
              <div style={sx('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid #e9edeb;flex-wrap:wrap')}>
                <div style={sx('display:flex;align-items:center;gap:10px')}>
                  <div style={sx('width:3px;height:16px;border-radius:2px;background:#b3123b')} />
                  <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.05em;text-transform:uppercase`)}>Assembly constituency wise — {dPc}</div>
                </div>
                <div style={sx('display:flex;align-items:baseline;gap:12px')}>
                  <div style={sx(`font:400 11.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>{acTotal}</div>
                  <div style={sx(`font:500 11px/1 'IBM Plex Sans';color:#0d7a6f`)}>{geoNote}</div>
                </div>
              </div>
              <div style={sx('display:flex;padding:9px 18px;background:#f7f9f8;border-bottom:1px solid #e9edeb')}>
                <div style={sx(`flex:1.9;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Assembly constituency</div>
                {geoCols.map((c, i) => (
                  <div key={i} style={sx(`flex:1;text-align:right;font:600 9.5px/1.25 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;color:${c.fg}`)}>{c.label}</div>
                ))}
              </div>
              {acRows.map((g, i) => (
                <div key={i} onClick={g.go} className="d2-geo-row" style={sx(`display:flex;align-items:center;padding:11px 18px;border-bottom:1px solid #f0f3f2;cursor:pointer;background:${g.bg}`)}>
                  <div style={sx('flex:1.9;min-width:0;display:flex;align-items:baseline;gap:7px')}>
                    <div style={sx(`flex:none;width:9px;font:700 10px/1.4 'IBM Plex Sans';color:#0d7a6f`)}>{g.mark}</div>
                    <div style={sx('min-width:0')}>
                      <div style={sx(`font:700 12.5px/1.25 'IBM Plex Sans';color:${g.nameFg}`)}>{g.name}</div>
                      <div style={sx(`font:400 10.5px/1.3 'IBM Plex Sans';color:#9aa5a1;margin-top:2px`)}>{g.sub}</div>
                    </div>
                  </div>
                  {g.cells.map((cell, ci5) => (
                    <div key={ci5} style={sx(`flex:1;text-align:right;font:${cell.w} 12.5px/1.2 'IBM Plex Sans';color:${cell.fg}`)}>{cell.v}</div>
                  ))}
                </div>
              ))}
              <div style={sx(`padding:11px 18px;background:#fafbfb;font:400 11.5px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>Each column adds up down these four rows to the {dPc} row above. Click a row to filter the locations list.</div>
            </div>

            <div style={sx('background:#fff;border:1px solid #dfe4e2;border-radius:10px;overflow:hidden')}>
              <div style={sx('display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e9edeb;flex-wrap:wrap;gap:6px')}>
                <div style={sx('display:flex;align-items:center;gap:10px')}>
                  <div style={sx('width:3px;height:16px;border-radius:2px;background:#0d7a6f')} />
                  <div style={sx(`font:600 13px/1 'IBM Plex Sans';letter-spacing:.05em;text-transform:uppercase`)}>{listTitle}</div>
                </div>
                <div style={sx('display:flex;align-items:center;gap:6px;flex-wrap:wrap')}>
                  {lfilters.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={f.go}
                      style={sx(`cursor:pointer;white-space:nowrap;font:600 10.5px/1 'IBM Plex Sans';letter-spacing:.05em;padding:8px 11px;border-radius:6px;border:1px solid ${f.border};background:${f.bg};color:${f.fg}`)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={sx('display:flex;padding:9px 18px;background:#f7f9f8;border-bottom:1px solid #e9edeb')}>
                <div style={sx(`flex:1.5;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Location</div>
                <div style={sx(`flex:.85;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Reserved for</div>
                <div style={sx(`flex:1.5;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Names proposed</div>
                <div style={sx(`flex:1.15;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Stage reached</div>
                {showMetric && (
                  <div style={sx(`flex:.95;text-align:right;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>{metricCol}</div>
                )}
                <div style={sx(`flex:1.15;text-align:right;font:600 10px/1.2 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#8a9793`)}>Action</div>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="d2-row" style={sx('display:flex;align-items:center;padding:12px 18px;border-bottom:1px solid #f0f3f2;flex-wrap:wrap')}>
                  <div style={sx('flex:1.5;min-width:140px')}>
                    <div style={sx(`font:600 13px/1.25 'IBM Plex Sans'`)}>{r.name}</div>
                    <div style={sx(`font:400 11px/1.3 'IBM Plex Sans';color:#9aa5a1;margin-top:2px`)}>{r.sub}</div>
                  </div>
                  <div style={sx(`flex:.85;font:500 12px/1.2 'IBM Plex Sans';color:#6b7873`)}>{r.quota}</div>
                  <div style={sx('flex:1.5;min-width:160px')}>
                    <div style={sx('display:flex;align-items:center;gap:7px')}>
                      <button type="button" className="d2-link" onClick={r.compare} style={sx(`cursor:pointer;border:0;background:transparent;padding:0;font:700 12.5px/1.2 'IBM Plex Sans';color:#0d7a6f;text-decoration:underline`)}>{r.namesLabel}</button>
                      <span style={sx(`font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:4px 6px;border-radius:4px;background:${r.leadBg};color:${r.leadFg}`)}>{r.leadTag}</span>
                    </div>
                    <div style={sx(`font:400 11px/1.35 'IBM Plex Sans';color:#9aa5a1;margin-top:3px`)}>{r.leadName}</div>
                  </div>
                  <div style={sx('flex:1.15')}>
                    <span style={sx(`display:inline-block;font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;padding:5px 8px;border-radius:4px;background:${r.pillBg};color:${r.pillFg}`)}>{r.stage}</span>
                  </div>
                  {showMetric && (
                    <div style={sx(`flex:.95;text-align:right;font:600 12.5px/1.2 'IBM Plex Sans';color:${r.metricTone}`)}>{r.metric}</div>
                  )}
                  <div style={sx('flex:1.15;text-align:right')}>
                    <button type="button" onClick={r.go} style={sx(`cursor:pointer;white-space:nowrap;font:600 10px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:8px 11px;border-radius:6px;border:1px solid ${r.btnBorder};background:${r.btnBg};color:${r.btnFg}`)}>{r.btn}</button>
                  </div>
                </div>
              ))}
              {listEmpty && (
                <div style={sx('padding:44px 18px;text-align:center')}>
                  <div style={sx(`font:600 13.5px/1.3 'IBM Plex Sans';color:#6b7873`)}>Nothing waiting at this stage in AC · {dAc}</div>
                  <div style={sx(`margin-top:6px;font:400 12px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>Pick another stage in the chain above, or try another quota or assembly segment.</div>
                </div>
              )}
              <div style={sx(`padding:11px 18px;background:#fafbfb;font:400 11.5px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>{listFoot}</div>
            </div>
          </div>
        )}

        {hasCompare && (
          <div style={sx('position:fixed;inset:0;background:rgba(20,32,29,.42);z-index:50;display:flex;align-items:center;justify-content:center;padding:24px')}>
            <div style={sx('width:min(1220px,100%);max-height:90vh;display:flex;flex-direction:column;background:#fff;border-radius:12px;box-shadow:0 18px 50px rgba(20,32,29,.22);overflow:hidden')}>
              <div style={sx('display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:18px 22px;border-bottom:1px solid #e9edeb')}>
                <div>
                  <div style={sx(`font:600 10.5px/1 'IBM Plex Sans';letter-spacing:.13em;text-transform:uppercase;color:#8a9793`)}>{cmp.crumb}</div>
                  <div style={sx(`margin-top:8px;font:700 19px/1.2 'IBM Plex Sans'`)}>{cmp.title}</div>
                  <div style={sx(`margin-top:6px;font:400 12.5px/1.45 'IBM Plex Sans';color:#6b7873`)}>{cmp.help}</div>
                </div>
                <button type="button" className="d2-btn" onClick={closeCompare} style={sx(`cursor:pointer;flex:none;white-space:nowrap;font:600 11px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;padding:9px 12px;border-radius:6px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>Close</button>
              </div>

              <div style={sx('flex:1;overflow:auto;padding:16px 22px 20px')}>
                <div style={sx('display:flex;gap:12px;align-items:stretch;flex-wrap:wrap')}>
                  {cmp.cands.map((c, i) => (
                    <div key={i} onClick={c.pick} className="d2-card" style={sx(`flex:1;min-width:220px;cursor:pointer;border:1.5px solid ${c.border};border-radius:10px;padding:13px 14px;background:${c.bg}`)}>
                      <div style={sx('display:flex;align-items:flex-start;gap:10px')}>
                        <div style={sx(`width:17px;height:17px;flex:none;margin-top:2px;border-radius:50%;border:2px solid ${c.dotRing};background:${c.dotFill}`)} />
                        <div style={sx('flex:1;min-width:0')}>
                          <div style={sx(`font:700 14px/1.25 'IBM Plex Sans'`)}>{c.name}</div>
                          <div style={sx(`margin-top:4px;font:400 11px/1.3 'IBM Plex Sans';color:#9aa5a1`)}>{c.phone}</div>
                        </div>
                        <div style={sx('flex:none;text-align:center;border:1px solid #e9edeb;border-radius:7px;padding:6px 8px;background:#fff')}>
                          <div style={sx(`font:700 15px/1 'IBM Plex Sans';color:${c.scoreFg}`)}>{c.score}</div>
                          <div style={sx(`margin-top:3px;font:600 8px/1 'IBM Plex Sans';letter-spacing:.1em;color:#9aa5a1`)}>SCORE</div>
                        </div>
                      </div>
                      <div style={sx('margin-top:10px;display:flex;gap:6px;flex-wrap:wrap')}>
                        <span style={sx(`font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:5px 7px;border-radius:4px;background:${c.fitBg};color:${c.fitFg}`)}>{c.fit}</span>
                        <span style={sx(`font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:5px 7px;border-radius:4px;background:${c.stateBg};color:${c.stateFg}`)}>{c.state}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); c.remove() }} style={sx(`margin-left:auto;cursor:pointer;border:1px solid #e3d3d6;background:#fff;border-radius:4px;padding:4px 7px;font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;color:#b3123b`)}>{c.removeLabel}</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={sx('margin-top:14px;border:1px solid #eceff0;border-radius:10px;overflow:hidden')}>
                  {cmp.attrs.map((a, i) => (
                    <div key={i} style={sx(`display:flex;gap:12px;align-items:stretch;border-bottom:1px solid #f2f5f4;background:${a.rowBg};flex-wrap:wrap`)}>
                      <div style={sx(`flex:none;width:186px;padding:11px 14px;font:600 10.5px/1.3 'IBM Plex Sans';letter-spacing:.09em;text-transform:uppercase;color:#8a9793`)}>{a.label}</div>
                      {a.cells.map((v, vi) => (
                        <div key={vi} style={sx('flex:1;min-width:120px;padding:11px 14px;display:flex;align-items:center;gap:7px')}>
                          <div style={sx(`font:600 12.5px/1.3 'IBM Plex Sans';color:${v.tone}`)}>{v.v}</div>
                          <span style={sx(`font:700 8.5px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;color:#1c7a45`)}>{v.best}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div style={sx('display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 22px;border-top:1px solid #e9edeb;background:#fbfcfc;flex-wrap:wrap')}>
                <div style={sx(`font:400 12px/1.45 'IBM Plex Sans';color:#6b7873`)}>{cmp.foot}</div>
                <div style={sx('display:flex;gap:10px')}>
                  <button type="button" className="d2-btn" onClick={closeCompare} style={sx(`cursor:pointer;white-space:nowrap;font:600 11.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:13px 16px;border-radius:7px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>Cancel</button>
                  <button type="button" onClick={cmp.confirmGo} style={sx(`cursor:${cmp.btnCursor};white-space:nowrap;font:600 11.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:13px 20px;border-radius:7px;border:0;background:${cmp.btnBg};color:${cmp.btnFg}`)}>{cmp.btnLabel}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasDrawer && (
          <>
            <div onClick={closeDrawer} style={sx('position:fixed;inset:0;background:rgba(20,32,29,.34);z-index:40')} />
            <div style={sx('position:fixed;top:0;right:0;bottom:0;width:min(440px,100%);background:#fff;z-index:41;box-shadow:-8px 0 28px rgba(20,32,29,.14);display:flex;flex-direction:column')}>
              <div style={sx('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #e9edeb')}>
                <div style={sx(`font:600 11px/1.3 'IBM Plex Sans';letter-spacing:.14em;text-transform:uppercase;color:#8a9793`)}>{dw.loc}</div>
                <button type="button" className="d2-btn" onClick={closeDrawer} style={sx(`cursor:pointer;flex:none;white-space:nowrap;font:600 11px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;padding:9px 12px;border-radius:6px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>Close</button>
              </div>
              <div style={sx('flex:1;overflow:auto;padding:18px 20px 22px')}>
                <div style={sx('display:flex;align-items:flex-start;gap:13px')}>
                  <div style={sx(`width:56px;height:56px;flex:none;border-radius:9px;background:#eef1f0;border:1px solid #e2e7e5;display:flex;align-items:center;justify-content:center;font:600 9.5px/1.3 'IBM Plex Sans';color:#a6b1ad`)}>PHOTO</div>
                  <div style={sx('flex:1;min-width:0')}>
                    <div style={sx(`font:700 17px/1.2 'IBM Plex Sans'`)}>{dw.name}</div>
                    <div style={sx(`margin-top:5px;font:400 12px/1.35 'IBM Plex Sans';color:#8a9793`)}>{dw.role}</div>
                    <div style={sx('margin-top:9px;display:flex;gap:7px;flex-wrap:wrap')}>
                      <span style={sx(`font:600 10px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:5px 8px;border-radius:4px;background:${dw.pillBg};color:${dw.pillFg}`)}>{dw.stage}</span>
                      <span style={sx(`font:500 10.5px/1 'IBM Plex Sans';padding:5px 8px;border-radius:4px;background:#f1f4f3;color:#6b7873`)}>{dw.phone}</span>
                    </div>
                  </div>
                </div>

                <div style={sx('margin-top:14px')}>
                  <button type="button" className="d2-btn" onClick={dw.compareGo} style={sx(`width:100%;cursor:pointer;font:600 11px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;padding:11px;border-radius:7px;border:1px solid #dfe4e2;background:#fff;color:#0d7a6f`)}>{dw.compareLabel}</button>
                </div>

                <div style={sx(`margin-top:20px;font:600 10px/1 'IBM Plex Sans';letter-spacing:.14em;text-transform:uppercase;color:#8a9793`)}>Progress</div>
                <div style={sx('margin-top:12px')}>
                  {dw.timeline.map((t, i) => (
                    <div key={i} style={sx('display:flex;gap:12px')}>
                      <div style={sx('flex:none;display:flex;flex-direction:column;align-items:center;width:18px')}>
                        <div style={sx(`width:16px;height:16px;border-radius:50%;border:2px solid ${t.ring};background:${t.fill};color:#fff;font:700 8px/16px 'IBM Plex Sans';text-align:center`)}>{t.mark}</div>
                        <div style={sx(`width:2px;flex:1;min-height:14px;background:${t.line}`)} />
                      </div>
                      <div style={sx('padding-bottom:12px')}>
                        <div style={sx(`font:600 12.5px/1.2 'IBM Plex Sans';color:${t.fg}`)}>{t.label}</div>
                        <div style={sx(`margin-top:3px;font:400 11px/1.35 'IBM Plex Sans';color:#9aa5a1`)}>{t.note}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={sx('margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:9px')}>
                  {dw.facts.map((f, i) => (
                    <div key={i} style={sx('border:1px solid #eceff0;border-radius:7px;padding:9px 11px')}>
                      <div style={sx(`font:600 9.5px/1 'IBM Plex Sans';letter-spacing:.1em;text-transform:uppercase;color:#9aa5a1`)}>{f.k}</div>
                      <div style={sx(`margin-top:5px;font:600 12.5px/1.25 'IBM Plex Sans'`)}>{f.v}</div>
                    </div>
                  ))}
                </div>

                <div style={sx('margin-top:18px;padding:13px 15px;border-radius:9px;background:#fbfcfc;border:1px solid #e9edeb')}>
                  <div style={sx(`font:600 11px/1.3 'IBM Plex Sans';letter-spacing:.11em;text-transform:uppercase;color:#0d7a6f`)}>{dw.actionStep} · {dw.actionTitle}</div>
                  <div style={sx(`margin-top:7px;font:400 11.5px/1.45 'IBM Plex Sans';color:#8a9793`)}>{dw.actionHelp}</div>

                  {dw.isDocs && (
                    <div style={sx('margin-top:12px')}>
                      {docsList.map((doc, i) => (
                        <div key={i} onClick={doc.go} style={sx('display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f0f3f2;cursor:pointer')}>
                          <div style={sx(`width:18px;height:18px;flex:none;border-radius:50%;border:1.5px solid ${doc.tone};color:${doc.tone};font:700 10px/15px 'IBM Plex Sans';text-align:center`)}>{doc.mark}</div>
                          <div style={sx('flex:1;min-width:0')}>
                            <div style={sx(`font:600 12.5px/1.2 'IBM Plex Sans'`)}>{doc.name}</div>
                            <div style={sx(`margin-top:3px;font:400 11px/1.3 'IBM Plex Sans';color:#9aa5a1`)}>{doc.note}</div>
                          </div>
                          <div style={sx(`font:600 10px/1 'IBM Plex Sans';letter-spacing:.08em;text-transform:uppercase;color:${doc.tone}`)}>{doc.state}</div>
                        </div>
                      ))}
                      <div style={sx('margin-top:12px;border:1.5px dashed #cfd8d5;border-radius:9px;padding:16px;text-align:center;background:#fff')}>
                        <div style={sx(`font:600 12.5px/1.3 'IBM Plex Sans';color:#6b7873`)}>Drop scanned papers here</div>
                        <div style={sx(`margin-top:5px;font:400 11px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>PDF or JPG · up to 5 MB each</div>
                      </div>
                    </div>
                  )}

                  {dw.isD2d && (
                    <div style={sx('margin-top:12px')}>
                      <div style={sx('display:flex;align-items:baseline;justify-content:space-between')}>
                        <div style={sx(`font:700 24px/1 'IBM Plex Sans'`)}>{d2d.pct}%</div>
                        <div style={sx(`font:500 12px/1 'IBM Plex Sans';color:#8a9793`)}>{d2d.visited} of {d2d.houses} houses</div>
                      </div>
                      <div style={sx('margin-top:9px;height:8px;border-radius:4px;background:#eceff0;overflow:hidden')}><div style={sx(`height:8px;background:#0d7a6f;width:${d2d.barW}`)} /></div>
                      {d2d.workers.map((w, i) => (
                        <div key={i} style={sx('display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f0f3f2')}>
                          <div style={sx(`font:600 12.5px/1.2 'IBM Plex Sans';flex:1`)}>{w.name}</div>
                          <div style={sx(`font:500 11.5px/1 'IBM Plex Sans';color:#9aa5a1`)}>{w.last}</div>
                          <div style={sx(`font:700 12.5px/1 'IBM Plex Sans';color:#0d7a6f;width:52px;text-align:right`)}>{w.houses}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {dw.isResult && (
                    <div style={sx('margin-top:12px')}>
                      <div style={sx('display:flex;gap:9px')}>
                        <div onClick={resObj.wonGo} style={sx(`flex:1;border:${resObj.won.w} solid ${resObj.won.border};border-radius:8px;padding:12px;text-align:center;background:${resObj.won.bg};cursor:pointer`)}><div style={sx(`font:700 13px/1 'IBM Plex Sans';color:${resObj.won.fg}`)}>WON</div></div>
                        <div onClick={resObj.lostGo} style={sx(`flex:1;border:${resObj.lost.w} solid ${resObj.lost.border};border-radius:8px;padding:12px;text-align:center;background:${resObj.lost.bg};cursor:pointer`)}><div style={sx(`font:700 13px/1 'IBM Plex Sans';color:${resObj.lost.fg}`)}>LOST</div></div>
                      </div>
                      <div style={sx(`margin-top:9px;font:400 11px/1.4 'IBM Plex Sans';color:#9aa5a1`)}>{resObj.note}</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={sx('padding:14px 20px;border-top:1px solid #e9edeb;background:#fbfcfc;display:flex;gap:9px')}>
                <button type="button" onClick={dw.primaryGo} style={sx(`flex:1;cursor:pointer;white-space:nowrap;font:600 11.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:13px;border-radius:7px;border:0;background:${dw.primaryBg};color:${dw.primaryFg}`)}>{dw.primary}</button>
                <button type="button" className="d2-btn" onClick={closeDrawer} style={sx(`cursor:pointer;white-space:nowrap;font:600 11.5px/1 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase;padding:13px 15px;border-radius:7px;border:1px solid #dfe4e2;background:#fff;color:#6b7873`)}>Later</button>
              </div>
            </div>
          </>
        )}

        {!!st.toast && (
          <div style={sx('position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:11px;background:#12312b;color:#fff;border-radius:9px;padding:14px 20px;box-shadow:0 10px 30px rgba(18,49,43,.3)')}>
            <div style={sx(`width:18px;height:18px;border-radius:50%;background:#7fe0b0;color:#12312b;font:700 10px/18px 'IBM Plex Sans';text-align:center`)}>✓</div>
            <div style={sx(`font:500 13px/1.3 'IBM Plex Sans'`)}>{st.toast}</div>
          </div>
        )}

      </div>
    </div>
  )
}
