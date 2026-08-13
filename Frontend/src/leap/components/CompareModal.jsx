import { useEffect, useRef, useState } from 'react'
import { getCadreScores } from '../api.js'

// Section colours, matching the membership-analytics compare table this screen mirrors.
const C_BLUE = '#2563eb'
const C_VIOLET = '#7c3aed'
const C_AMBER = '#d97706'
const C_CYAN = '#0891b2'
const C_GREEN = '#059669'

// Only the scored half is tabulated: the profile fields are on the column header and on
// the member card, and repeating them as rows pushed the first weighted section off the
// screen. Grouped the way the ratings report weights it. Each row names the
// report's own column, spaces and all — getCadreScores returns the row unrenamed rather than
// renaming forty columns on the way through. `pts` rows render as pills and are the
// ones the best-of highlight applies to.
const PERFORMANCE_SECTIONS = [
  { label: 'PEDALA SEVALO', pct: '15%', color: C_BLUE, rows: [
    ['Pedala Sevalo', 'PEDALA SEVALO'],
    ['Points', 'POINTS (Pedala Sevalo)', { pts: true }],
  ] },
  { label: '1ST MEMBERSHIP', pct: '5%', color: C_BLUE, rows: [
    ['First Year', 'YEAR'],
    ['Points', 'POINTS (1st Membership)', { pts: true }],
  ] },
  { label: 'NO OF RENEWALS', pct: '5%', color: C_BLUE, rows: [
    ['Renewal Times', 'NO OF TIME'],
    ['Points', 'POINTS (No of Times)', { pts: true }],
  ] },
  { label: 'REFERRAL REGISTRATIONS', pct: '10%', color: C_BLUE, rows: [
    ['Referrals', 'REGS'],
    ['Points', 'POINTS (Referrals)', { pts: true }],
  ] },
  { label: '2024 NDA VOTE SHARE', pct: '15%', color: C_VIOLET, rows: [
    ['Mandal Vote %', 'MANDAL/TOWN 7.5%', { suffix: '%' }],
    ['Mandal Points', 'POINTS (Mandal Vote Share)', { pts: true }],
    ['Booth Vote %', 'BOOTH 7.5%', { suffix: '%' }],
    ['Booth Points', 'POINTS (Booth Vote Share)', { pts: true }],
  ] },
  { label: 'MEMBERSHIP', pct: '10%', color: C_VIOLET, rows: [
    ['Mandal Actual', 'MANDAL/TOWN ACTUAL'],
    ['Mandal Ach', 'ACH (Mandal Membership)'],
    ['Mandal Ach %', 'ACH % (Mandal Membership)', { suffix: '%' }],
    ['Mandal Points', 'MANDAL/TOWN 5% POINTS', { pts: true }],
    ['Booth Actual', 'BOOTH ACTUAL'],
    ['Booth Ach', 'ACH (Booth Membership)'],
    ['Booth Ach %', 'ACH % (Booth Membership)', { suffix: '%' }],
    ['Booth Points', 'BOOTH 5% POINTS', { pts: true }],
  ] },
  { label: 'D2D CAMPAIGN', pct: '30%', color: C_AMBER, rows: [
    ['Mandal Actual', 'MANDAL/TOWN ACT'],
    ['Mandal Ach', 'ACH (Mandal D2D)'],
    ['Mandal Ach %', 'ACH % (Mandal D2D)', { suffix: '%' }],
    ['Mandal Points', 'MANDAL/TOWN 15%', { pts: true }],
    ['Booth Actual', 'BOOTH ACT'],
    ['Booth Ach', 'ACH (Booth D2D)'],
    ['Booth Ach %', 'ACH % (Booth D2D)', { suffix: '%' }],
    ['Booth Points', 'BOOTH 15%', { pts: true }],
  ] },
  { label: 'PREVIOUS POSITIONS', pct: '10%', color: C_AMBER, rows: [
    ['2018 - 2020', '2018 - 2020'],
    ['2016 - 2018', '2016 - 2018'],
    ['2014 - 2016', '2014 - 2016'],
    ['Points', 'POINTS (Positions)', { pts: true }],
  ] },
]

const show = (value) => (value === null || value === undefined || value === '' ? null : value)

// One decimal is as much as the halved point totals ever need.
const round = (value) =>
  value === null || value === undefined ? null : Math.round(Number(value) * 10) / 10

function initials(name) {
  return (name || '')
    .replace(/^[A-Z]\.\s*/, '')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// A cadre with no ratings row scores null rather than 0, so 'none' is its own tier —
// unrated must not read as the worst candidate on the list.
export function scoreTier(score) {
  if (score === null || score === undefined) return 'none'
  if (score >= 70) return 'high'
  if (score >= 40) return 'mid'
  return 'low'
}

const TIER_COLOR = { none: '#9ca3af', high: '#059669', mid: '#d97706', low: '#dc2626' }

/**
 * Side-by-side comparison of cadre, one column each, over the ratings data behind their
 * score. `candidates` are cadre rows in the backend's own shape (searchCadre or getProposalCandidates); only the
 * score half is fetched.
 *
 * Columns can be dragged to reorder and dismissed individually. Both are view-only —
 * nothing here changes what is proposed.
 */
export default function CompareModal({ candidates, title, onClose }) {
  const [cols, setCols] = useState(candidates)
  const [scores, setScores] = useState(null)
  const [questions, setQuestions] = useState([])
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(null)
  const scrollRef = useRef(null)
  const autoScroll = useRef(0)

  useEffect(() => {
    const mids = candidates.map((c) => c.membership_id).filter(Boolean)
    if (mids.length === 0) {
      setScores({})
      return
    }
    let cancelled = false
    getCadreScores(mids)
      .then((data) => {
        if (cancelled) return
        setConfigured(data.configured)
        setQuestions(data.questions)
        setScores(Object.fromEntries(data.candidates.map((c) => [String(c.membership_id), c])))
      })
      .catch((err) => { if (!cancelled) { setError(err.message); setScores({}) } })
    return () => { cancelled = true }
  }, [candidates])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Native HTML5 drag does not auto-scroll, so a column past the right edge could never
  // be dropped on the left one. While a drag is live, scroll when the pointer nears an edge.
  useEffect(() => {
    if (dragging === null) { autoScroll.current = 0; return }
    let raf
    const step = () => {
      if (scrollRef.current && autoScroll.current) scrollRef.current.scrollLeft += autoScroll.current
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [dragging])

  const onScrollDragOver = (e) => {
    e.preventDefault()
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const edge = 90
    if (e.clientX < rect.left + edge) autoScroll.current = -20
    else if (e.clientX > rect.right - edge) autoScroll.current = 20
    else autoScroll.current = 0
  }

  const scoreOf = (c) => scores?.[String(c.membership_id)]?.total_score ?? null
  const perfOf = (c) => scores?.[String(c.membership_id)]?.performance
  const feedbackOf = (c) => scores?.[String(c.membership_id)]?.feedback

  // Highlighted only when someone actually has a score — with the ratings database
  // unwired every column is null and there is no winner to point at.
  const best = cols.reduce(
    (leader, c) =>
      scoreOf(c) !== null && (leader === null || scoreOf(c) > scoreOf(leader)) ? c : leader,
    null
  )

  const drop = (target) => {
    setCols((prev) => {
      const from = prev.findIndex((c) => c.membership_id === dragging)
      const to = prev.findIndex((c) => c.membership_id === target)
      if (dragging === null || from === -1 || to === -1 || from === to) return prev
      const next = [...prev]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
    setDragging(null)
  }

  return (
    <div className="leap-cmp-overlay" onClick={onClose}>
      <div className="leap-cmp" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="leap-cmp-head">
          <div>
            <div className="leap-cmp-head-title">Candidate Comparison</div>
            <div className="leap-cmp-head-sub">
              {cols.length} candidate{cols.length === 1 ? '' : 's'} · {title} · drag a column to reorder
            </div>
          </div>
          <button type="button" className="leap-cmp-head-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {error && <div className="leap-cmp-state error">{error}</div>}
        {!configured && (
          <div className="leap-cmp-state">
            Scores are unavailable — the ratings database is not configured on this server.
            The profiles below still compare.
          </div>
        )}
        {scores === null && !error && <div className="leap-cmp-state">Loading comparison…</div>}
        {cols.length === 0 && <div className="leap-cmp-state">Every column was dismissed.</div>}

        {scores !== null && cols.length > 0 && (
          <div className="leap-cmp-scroll" ref={scrollRef} onDragOver={onScrollDragOver}>
            <table className="leap-cmp-table">
              <thead>
                <tr>
                  <th className="leap-cmp-metric">METRIC</th>
                  {cols.map((c) => (
                    <th
                      key={c.membership_id}
                      draggable
                      onDragStart={() => setDragging(c.membership_id)}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => drop(c.membership_id)}
                      className={
                        'leap-cmp-candhead' +
                        (best?.membership_id === c.membership_id ? ' winner' : '') +
                        (dragging === c.membership_id ? ' dragging' : '')
                      }
                    >
                      <CandHead
                        cadre={c}
                        score={scoreOf(c)}
                        isBest={best?.membership_id === c.membership_id}
                        onRemove={() => setCols((prev) => prev.filter((x) => x !== c))}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERFORMANCE_SECTIONS.map((section) => (
                  <PerformanceSection key={section.label} cols={cols} section={section} perfOf={perfOf} />
                ))}

                {questions.length > 0 && (
                  <>
                    <SectionRow cols={cols} label="FEEDBACK QUESTIONS" pct="10%" color={C_CYAN} />
                    {questions.map((q) => [
                      <Row
                        key={`q${q.question_id}`}
                        cols={cols}
                        color={C_CYAN}
                        label={q.question_name || `Question ${q.question_id}`}
                        fn={(c) => feedbackOf(c)?.answers[String(q.question_id)]?.option}
                      />,
                      <Row
                        key={`p${q.question_id}`}
                        cols={cols}
                        color={C_CYAN}
                        label="Points"
                        pts
                        fn={(c) => feedbackOf(c)?.answers[String(q.question_id)]?.points}
                      />,
                    ])}
                    <Row
                      cols={cols}
                      color={C_CYAN}
                      label="Feedback Score"
                      pts
                      fn={(c) => feedbackOf(c)?.score}
                    />
                  </>
                )}

                <SectionRow cols={cols} label="PERFORMANCE SCORE" color={C_GREEN} />
                <Row cols={cols} color={C_GREEN} label="Total Score" score fn={(c) => round(scoreOf(c))} />
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CandHead({ cadre, score, isBest, onRemove }) {
  const tier = scoreTier(score)
  const chips = [cadre.gender, cadre.age != null && `Age ${cadre.age}`, cadre.mobile_no].filter(Boolean)
  return (
    <div className="leap-cmp-cand">
      {isBest && <span className="leap-cmp-cand-top">★ TOP</span>}
      <button type="button" className="leap-cmp-dismiss" title="Remove from this comparison" onClick={onRemove}>
        ✕
      </button>
      {cadre.img_url ? (
        <img className="leap-cmp-photo" src={cadre.img_url} alt={cadre.member_name} />
      ) : (
        <span className="leap-cmp-photo initials">{initials(cadre.member_name)}</span>
      )}
      <div className="leap-cmp-cand-info">
        <span className="leap-cmp-name" title={cadre.member_name}>{cadre.member_name}</span>
        <span className="leap-cmp-mid">{cadre.membership_id || `Cadre #${cadre.tdp_cadre_id}`}</span>
        <span className={`leap-cmp-score tier-${tier}`} style={{ color: TIER_COLOR[tier] }}>
          {score === null ? 'No score' : <>{round(score)}<i>Score</i></>}
        </span>
        <span className="leap-cmp-chips">
          {chips.map((chip) => <span key={chip} className="leap-cmp-chip">{chip}</span>)}
        </span>
      </div>
    </div>
  )
}

function SectionRow({ cols, label, pct, color }) {
  return (
    <tr>
      <td
        className="leap-cmp-section"
        colSpan={cols.length + 1}
        style={{ borderLeft: `4px solid ${color}`, background: `${color}18` }}
      >
        <span style={{ color }}>{label}</span>
        {pct && <i style={{ background: `${color}22`, color }}>{pct}</i>}
      </td>
    </tr>
  )
}

// One metric across every column. `pts`/`score` rows render as pills and mark the single
// highest value — a tie has no winner to point at, so nothing is highlighted.
function Row({ cols, label, fn, suffix = '', pts, score, color }) {
  const values = cols.map((c) => {
    const v = fn(c)
    return v === null || v === undefined || v === '' ? null : Number(v)
  })
  const max = values.reduce((m, v) => (v !== null && !Number.isNaN(v) && v > m ? v : m), -Infinity)
  const uniqueBest = max > -Infinity && values.filter((v) => v === max).length === 1
  return (
    <tr className={`leap-cmp-row${pts ? ' pts' : ''}${score ? ' total' : ''}`}>
      <td className="leap-cmp-rowhead" style={{ borderLeft: `3px solid ${color}22` }}>{label}</td>
      {cols.map((c) => {
        const raw = show(fn(c))
        const isBest = uniqueBest && raw !== null && Number(raw) === max
        return (
          <td
            key={c.membership_id}
            className={`leap-cmp-val${raw === null ? ' empty' : ''}${isBest && (pts || score) ? ' best' : ''}`}
          >
            {(pts || score) && raw !== null ? (
              <span
                className={`leap-cmp-pill${isBest ? ' best' : ''}`}
                style={isBest ? undefined : { background: `${color}15`, color, border: `1px solid ${color}35` }}
              >
                {raw}{suffix}
              </span>
            ) : raw === null ? '—' : `${raw}${suffix}`}
          </td>
        )
      })}
    </tr>
  )
}

// A weighted section header plus its rows, read off the report row getCadreScores returned.
function PerformanceSection({ cols, section, perfOf }) {
  return (
    <>
      <SectionRow cols={cols} label={section.label} pct={section.pct} color={section.color} />
      {section.rows.map(([label, column, opts = {}]) => (
        <Row
          key={label + column}
          cols={cols}
          label={label}
          color={section.color}
          pts={opts.pts}
          suffix={opts.suffix}
          fn={(c) => perfOf(c)?.[column]}
        />
      ))}
    </>
  )
}
