import { useMemo, useRef } from 'react';
import gsap from 'gsap';
import './Calendar.css';
import Icon from '../components/Icon/Icon.jsx';
import Select from '../components/Select/Select.jsx';
import { LEVEL_LABEL, plural } from '../lib/format.js';
import { buildCells, isoDay, latestDay, meetingDays, parseDay } from '../lib/calendar.js';
import { useAnim } from '../lib/motion.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Calendar({ meetings, mode, onMode, anchor, onAnchor, level, onLevel, onOpen }) {
  const ref = useRef(null);

  const byDate = useMemo(() => {
    const map = {};
    meetings.forEach((m) => {
      if (level !== 'all' && m.level !== level) return;
      // a multi-day meeting gets a chip on every day it runs
      meetingDays(m).forEach((key, i) => (map[key] = map[key] || []).push({ meeting: m, day: i + 1 }));
    });
    return map;
  }, [meetings, level]);

  const { cells, shown, title } = useMemo(
    () => buildCells({ mode, anchor, byDate, todayKey: isoDay(new Date()) }),
    [mode, anchor, byDate]
  );

  useAnim(ref, () => {
    gsap.from('.chip', { y: 8, autoAlpha: 0, duration: .3, stagger: .02, ease: 'power2.out' });
  }, [cells]);

  const shift = (delta) => onAnchor(mode === 'week'
    ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + delta * 7)
    : new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));

  const openWeek = (dayIso) => { onAnchor(parseDay(dayIso)); onMode('week'); };

  return (
    <section className="view" aria-label="Meetings calendar" ref={ref}>
      <div className="toolbar">
        <button className="btn" type="button" aria-label="Previous month" onClick={() => shift(-1)}>
          <Icon name="arrow-left" sm />
        </button>
        <button className="btn" type="button" aria-label="Next month" onClick={() => shift(1)}>
          <Icon name="arrow-left" sm style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div className="cal-title">{title}</div>
        <button className="btn btn-sm" type="button" onClick={() => onAnchor(latestDay(meetings))}>Jump to latest</button>

        <div className="seg" role="group" aria-label="Calendar range">
          <button className="btn btn-sm" type="button" aria-pressed={mode === 'month'} onClick={() => onMode('month')}>Month</button>
          <button className="btn btn-sm" type="button" aria-pressed={mode === 'week'} onClick={() => onMode('week')}>Week</button>
        </div>

        <Select id="cal-level" label="Filter calendar by level" value={level} onChange={onLevel}>
          <option value="all">All levels</option>
          {Object.entries(LEVEL_LABEL).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </Select>

        <div className="toolbar-spacer" />
        <div className="cal-legend">
          {Object.entries(LEVEL_LABEL).map(([code, label]) => (
            <span key={code}><i className={'swatch sw-' + code.toLowerCase()} />{label}</span>
          ))}
          <span>{plural(shown, 'meeting')} this {mode === 'week' ? 'week' : 'month'}</span>
        </div>
      </div>

      <div className="cal">
        <div className="cal-scroll">
          <div className="cal-dow" aria-hidden="true">
            {DOW.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className={'cal-grid' + (mode === 'week' ? ' week' : '')}>
            {cells.map((cell) => (
              <div key={cell.key} className={'cal-cell' + (cell.out ? ' out' : '') + (cell.today ? ' today' : '')}>
                <button
                  className="cal-date"
                  type="button"
                  title={`Open the week of ${cell.key}`}
                  onClick={() => openWeek(cell.key)}
                >
                  {cell.day}
                </button>
                {cell.list.map(({ meeting: m, day }) => (
                  <button
                    key={m.id}
                    className={`chip chip-${m.level.toLowerCase()}`}
                    type="button"
                    title={`${m.title} — ${LEVEL_LABEL[m.level] || m.levelName}` +
                      (m.completion === null ? ', member list not pulled yet' : `, ${m.completion}% captured`) +
                      (m.days > 1 ? ` (day ${day} of ${m.days})` : '')}
                    onClick={() => onOpen(m.id)}
                  >
                    <strong>{m.title}</strong>
                    <span className="chip-foot">
                      <span>{m.days > 1 ? `Day ${day}/${m.days}` : LEVEL_LABEL[m.level] || m.levelName}</span>
                      <span className="num">{m.completion === null ? '—' : m.completion + '%'}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
