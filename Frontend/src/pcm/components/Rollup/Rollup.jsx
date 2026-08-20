import { useState } from 'react';
import Icon from '../Icon/Icon.jsx';
import { num, tone } from '../../lib/format.js';
import './Rollup.css';

/* Counted by the service in SQL over the meeting's whole invitee list. The
   table underneath shows a page of that list; this shows the state. Rows come
   back worst first, which is the only order a coordinator wants them in. */
export default function Rollup({ rollup, ac, onPick }) {
  const [mode, setMode] = useState('pc');
  const [open, setOpen] = useState(null);

  const rows = mode === 'pc' ? rollup.byPc : rollup.byAc;
  const worst = rows.find((r) => r.pending > 0);

  // a zero has no members behind it, so it stays plain text
  const pickable = (n, p, what) => (n ? (
    <button className="cell-pick" type="button" title={`List these ${num(n)} ${what}`} onClick={() => onPick(p)}>
      {num(n)}
    </button>
  ) : num(n));

  const cells = (r) => {
    // a byAc row carries both keys; a byPc row is the whole constituency
    const s = r.ac ? { ac: r.ac } : { pc: r.pc };
    return (
    <>
      <td className="n num">{num(r.invited)}</td>
      <td className="n num">{pickable(r.attended, { ...s, att: 'present' }, 'attendees')}</td>
      <td className="n num">{pickable(r.absent, { ...s, att: 'absent' }, 'absentees')}</td>
      <td className="n num">{num(r.captured)}</td>
      <td className="n num" style={{ color: r.pending ? 'var(--bad)' : 'var(--text-3)' }}>
        {pickable(r.pending, { ...s, fb: 'no' }, 'members still owed')}
      </td>
      <td className="w">
        <span className="progress-block">
          <span className="bar"><i style={{ width: r.completion + '%', background: tone(r.completion) }} /></span>
          <span className="pct num" style={{ color: tone(r.completion) }}>{r.completion}%</span>
        </span>
      </td>
    </>
    );
  };

  return (
    <section className="rollup" aria-label="Constituency posture">
      <header className="rollup-head">
        <div>
          <p className="eyebrow">Constituency posture</p>
          <p className="rollup-sub">
            Counted over all <b className="num">{num(rollup.totals.invited)}</b> invitees ·{' '}
            {worst
              ? <>worst is <b>{worst.ac || worst.pc}</b> with <b className="num">{num(worst.pending)}</b> still owed</>
              : <>every absentee accounted for</>}
          </p>
        </div>

        <div className="seg" role="group" aria-label="Group constituencies by">
          <button className="btn btn-sm" type="button" aria-pressed={mode === 'pc'} onClick={() => setMode('pc')}>
            By PC <span className="count">{rollup.byPc.length}</span>
          </button>
          <button className="btn btn-sm" type="button" aria-pressed={mode === 'ac'} onClick={() => setMode('ac')}>
            By AC <span className="count">{rollup.byAc.length}</span>
          </button>
        </div>
      </header>

      <div className="rollup-scroll">
        <table className="rollup-table">
          <caption className="sr-only">Attendance and feedback capture per constituency, worst first</caption>
          <thead>
            <tr>
              <th scope="col">{mode === 'pc' ? 'Parliamentary constituency' : 'Assembly constituency'}</th>
              <th scope="col" className="n">Invited</th>
              <th scope="col" className="n">Attended</th>
              <th scope="col" className="n">Absent</th>
              <th scope="col" className="n">Captured</th>
              <th scope="col" className="n">Owed</th>
              <th scope="col" className="w">Capture rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expanded = mode === 'pc' && open === r.pc;
              const kids = expanded ? rollup.byAc.filter((a) => a.pc === r.pc) : [];

              return [
                <tr key={r.pc + '/' + (r.ac || '')} className={r.ac && r.ac === ac ? 'is-picked' : undefined}>
                  <th scope="row">
                    {mode === 'pc' ? (
                      <button
                        className="rollup-name"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setOpen(expanded ? null : r.pc)}
                      >
                        <Icon name="chevron-right" sm className={expanded ? 'twist' : undefined} />
                        {r.pc || 'Unassigned'}
                      </button>
                    ) : (
                      <button
                        className="rollup-name"
                        type="button"
                        title={`List every member in ${r.ac}`}
                        onClick={() => onPick(ac === r.ac ? undefined : { ac: r.ac })}
                      >
                        {r.ac || 'Unassigned'}
                        <span className="rollup-pc">{r.pc}</span>
                      </button>
                    )}
                  </th>
                  {cells(r)}
                </tr>,
                ...kids.map((k) => (
                  <tr key={k.pc + '/' + k.ac} className={'is-child' + (ac === k.ac ? ' is-picked' : '')}>
                    <th scope="row">
                      <button
                        className="rollup-name"
                        type="button"
                        title={`List every member in ${k.ac}`}
                        onClick={() => onPick(ac === k.ac ? undefined : { ac: k.ac })}
                      >
                        {k.ac || 'Unassigned'}
                      </button>
                    </th>
                    {cells(k)}
                  </tr>
                ))
              ];
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
