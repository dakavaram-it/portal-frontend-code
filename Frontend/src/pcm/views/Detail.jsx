import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import './Detail.css';
import Donut, { DONUT_C } from '../components/Donut/Donut.jsx';
import Icon from '../components/Icon/Icon.jsx';
import Rollup from '../components/Rollup/Rollup.jsx';
import Select from '../components/Select/Select.jsx';
import { meetingDays } from '../lib/calendar.js';
import { LEVEL_LABEL, badgeClass, dayMonth, fmtSpan, initials, num, tone } from '../lib/format.js';
import { useAnim } from '../lib/motion.js';

export default function Detail({
  meeting: m, rows, allRows, acOptions, rollup,
  query, onQuery, fb, onFb, att, onAtt, ac, onAc, pc, onPc, onPick, day, onDay,
  onBack, onRemark
}) {
  const ref = useRef(null);
  const backRef = useRef(null);

  // attendance is the only per-day figure; feedback stays one record per absent member per meeting
  const dayList = m.days > 1 ? meetingDays(m) : [];

  useLayoutEffect(() => { backRef.current.focus(); }, [m.id]);

  useAnim(ref, () => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from('.detail-head', { y: 16, autoAlpha: 0, duration: .35 })
      .from('.dstat', { y: 10, autoAlpha: 0, duration: .3, stagger: .04 }, .12)
      .fromTo('.detail-head .donut .arc',
        { strokeDashoffset: DONUT_C },
        { strokeDashoffset: DONUT_C * (1 - m.completion / 100), duration: .9, ease: 'power3.out' }, .1);
  }, [m.id]);

  useAnim(ref, () => {
    gsap.from('tbody tr:nth-child(-n+24)', { y: 8, autoAlpha: 0, duration: .3, stagger: .012, ease: 'power1.out' });
  }, [rows]);

  /* Counted by the service over the whole invitee list, not over `allRows` —
     the table holds one page of it. */
  const stats = [
    ['Invitees', num(m.invitees), 'users', 'var(--primary)'],
    ['Attended', num(m.attendees), 'user-check', 'var(--ok)', { att: 'present' }],
    ['Absent', num(m.absent), 'user-x', 'var(--bad)', { att: 'absent' }],
    ['Captured', num(m.feedbackTaken), 'msg-check', 'var(--ok)'],
    ['Still owed', num(m.feedbackPending), 'clock', 'var(--accent)', { fb: 'no' }],
    ['Capture rate', m.completion + '%', 'gauge', tone(m.completion)]
  ];

  /* The member list is a slice the operator asked for, never a default view —
     so the filters are also what says whether there is a slice to show. */
  const picked = att !== 'all' || fb !== 'all' || ac !== 'all' || pc !== 'all';
  const isPick = (p) =>
    att === (p.att || 'all') && fb === (p.fb || 'all') && ac === 'all' && pc === 'all';

  const heading = fb === 'no' ? 'Members still owed'
    : att === 'absent' ? 'Absent members'
      : att === 'present' ? 'Members who attended'
        : 'Invited members';
  const scope = ac !== 'all' ? (ac || 'Unassigned') : pc !== 'all' ? (pc || 'Unassigned') : null;

  // every filter the operator has applied, so they can see and undo them without hunting the controls
  const active = [
    query && { key: 'q', label: `“${query}”`, clear: () => onQuery('') },
    fb !== 'all' && { key: 'fb', label: fb === 'yes' ? 'Feedback: Yes' : 'Feedback: No', clear: () => onFb('all') },
    att !== 'all' && { key: 'att', label: att === 'present' ? 'Attended' : 'Absent', clear: () => onAtt('all') },
    ac !== 'all' && { key: 'ac', label: 'AC: ' + ac, clear: () => onAc('all') },
    pc !== 'all' && { key: 'pc', label: 'PC: ' + (pc || 'Unassigned'), clear: () => onPc('all') },
    day !== 'all' && { key: 'day', label: 'Day ' + (day + 1) + ' · ' + dayMonth(dayList[day]), clear: () => onDay('all') }
  ].filter(Boolean);

  const clearAll = () => { onQuery(''); onPick(); onDay('all'); };

  return (
    <section className="view" aria-label="Meeting member list" ref={ref}>
      <button className="btn btn-ghost back-link" type="button" ref={backRef} onClick={onBack}>
        <Icon name="arrow-left" sm /> All meetings
      </button>

      <div className="detail-head">
        <div className="detail-top">
          <div className="detail-id">
            <div className="detail-tags">
              <span className={`badge ${badgeClass(m.level)}`}>{LEVEL_LABEL[m.level]}</span>
              <span className="mc-id mono">{m.id}</span>
            </div>
            <h2>{m.title}</h2>
            <div className="detail-meta">
              {m.date && <span><Icon name="calendar" sm />{fmtSpan(m)}</span>}
              <span><Icon name="building" sm />{m.meetingType}</span>
              <span><Icon name="pin" sm />{m.units.completed} of {m.units.total} units completed</span>
              <span><Icon name="layers" sm />{m.resolutions} resolutions</span>
            </div>

            {dayList.length > 0 && (
              <div className="seg day-seg" role="group" aria-label="Attendance day">
                <button className="btn btn-sm" type="button" aria-pressed={day === 'all'} onClick={() => onDay('all')}>
                  All days
                </button>
                {dayList.map((iso, i) => (
                  <button key={iso} className="btn btn-sm" type="button" aria-pressed={day === i} onClick={() => onDay(i)}>
                    Day {i + 1} · {dayMonth(iso)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Donut value={m.completion} caption="captured" color={tone(m.completion)} size={112} />
        </div>

        <div className="detail-stats">
          {stats.map(([k, v, icon, tint, pick]) => {
            const body = (
              <>
                <div className="d-icon"><Icon name={icon} sm /></div>
                <div>
                  <div className="d-val num">{v}</div>
                  <div className="d-key">{k}</div>
                </div>
              </>
            );
            return pick ? (
              <button
                className="dstat dstat-pick"
                type="button"
                key={k}
                style={{ '--tint': tint }}
                aria-pressed={isPick(pick)}
                onClick={() => onPick(isPick(pick) ? undefined : pick)}
              >
                {body}
              </button>
            ) : (
              <div className="dstat" key={k} style={{ '--tint': tint }}>{body}</div>
            );
          })}
        </div>
      </div>

      {rollup && <Rollup rollup={rollup} ac={ac} onPick={onPick} />}

      {!picked && (
        <p className="pick-hint">
          <Icon name="users" sm />
          Pick <b>Attended</b>, <b>Absent</b> or <b>Still owed</b> above — or a figure in the constituency posture — to list those members.
        </p>
      )}

      {picked && <>
      <div className="section-head" id="member-section">
        <h2>{heading}{scope && <span className="sub-scope"> · {scope}</span>}</h2>
        <span className="sub">Capture or edit the feedback remark recorded against each absent member</span>
      </div>

      <div className="toolbar">

        <label className="search">
          <Icon name="search" sm />
          <span className="sr-only" id="mem-search-label">Search members</span>
          <input
            id="member-search"
            type="search"
            placeholder="Name, MID or mobile…"
            aria-labelledby="mem-search-label"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>

        <Select id="fb-filter" label="Filter by feedback status" value={fb} onChange={onFb}>
          <option value="all">All feedback</option>
          <option value="yes">Feedback: Yes</option>
          <option value="no">Feedback: No</option>
        </Select>

        <Select id="att-filter" label="Filter by attendance" value={att} onChange={onAtt}>
          <option value="all">All attendance</option>
          <option value="present">Attended</option>
          <option value="absent">Absent</option>
        </Select>

        <Select id="ac-filter" label="Filter by assembly constituency" value={ac} onChange={onAc}>
          <option value="all">All ACs</option>
          {acOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>

        <div className="toolbar-spacer" />
        <span className="result-count">{num(rows.length)} of {num(allRows.length)} rows in this page</span>
      </div>

      {active.length > 0 && (
        <div className="filter-chips">
          <span className="fc-label">Filtered by</span>
          {active.map((f) => (
            <button className="fchip" type="button" key={f.key} onClick={f.clear} aria-label={`Remove filter ${f.label}`}>
              {f.label} <Icon name="x" sm />
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" type="button" onClick={clearAll}>Clear all</button>
        </div>
      )}

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Invited members with attendance, feedback status and remarks</caption>
            <thead>
              <tr>
                <th scope="col" className="col-name">Member</th>
                <th scope="col">Mobile</th>
                <th scope="col">PC</th>
                <th scope="col">AC</th>
                <th scope="col">Level</th>
                <th scope="col">Committee</th>
                <th scope="col">Designation</th>
                <th scope="col">Attendance</th>
                <th scope="col">Feedback</th>
                <th scope="col">Remarks</th>
                <th scope="col">Captured By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.mid}>
                  <td className="name">
                    <span className="member-cell">
                      <i className="avatar avatar-sm" aria-hidden="true">{initials(r.name)}</i>
                      <span>
                        {r.name}
                        <span className="sub mono">{r.mid}</span>
                      </span>
                    </span>
                  </td>
                  <td className="mono">{r.mobile}</td>
                  <td>{r.pc}</td>
                  <td>{r.ac}</td>
                  <td>{r.levelName}</td>
                  <td className="truncate" title={r.committee}>{r.committee}</td>
                  <td>{r.designation}</td>
                  <td>
                    {(day === 'all' ? r.present : r.presentOn[day])
                      ? <span className="pill pill-present"><i className="dot" />Attended</span>
                      : <span className="pill pill-absent"><i className="dot" />Absent</span>}
                    {day === 'all' && m.days > 1 && r.present && (
                      <span className="sub">{r.presentOn.filter(Boolean).length} of {m.days} days</span>
                    )}
                  </td>
                  <td>
                    {r.present
                      ? <span className="muted">N/A</span>
                      : r.feedback
                        ? <span className="pill pill-yes"><i className="dot" />Yes</span>
                        : <span className="pill pill-no"><i className="dot" />No</span>}
                  </td>
                  <td>
                    {r.present ? (
                      <span className="muted">—</span>
                    ) : r.remarks ? (
                      <>
                        <div className="truncate" title={r.remarks}>{r.remarks}</div>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onRemark(r.mid)}>
                          <Icon name="eye" sm /> View / Edit
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-sm" type="button" onClick={() => onRemark(r.mid)}>
                        <Icon name="plus" sm /> Add Remarks
                      </button>
                    )}
                  </td>
                  <td>{r.capturedBy ? <span className="mono">{r.capturedBy}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="empty" hidden={rows.length > 0}>
          <Icon name="inbox" />
          <div className="empty-title">No members match these filters</div>
          <div className="empty-hint">Clear the search box or set the filters back to “All”.</div>
        </div>
        <div className="table-foot">
          <span>Showing {num(rows.length)} of the {num(allRows.length)} rows held in this page</span>
          {/* the figures above are counted over the whole list; the table is not */}
          {ac === 'all' && m.invitees > allRows.length && (
            <span className="foot-warn">
              <Icon name="shield" sm />
              This meeting has {num(m.invitees)} invitees. Every figure above covers all of them — this table
              does not. Pick a constituency above to narrow it.
            </span>
          )}
        </div>
      </div>
      </>}
    </section>
  );
}
