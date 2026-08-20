export const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const parseDay = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const latestDay = (meetings) => parseDay(meetings.reduce((a, m) => (m.date > a ? m.date : a), meetings[0].date));
export const startOfWeek = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));

// every ISO day a meeting covers; single-day meetings return one entry
export function meetingDays(m) {
  const end = m.endDate && m.endDate > m.date ? m.endDate : m.date;
  const out = [];
  for (let d = parseDay(m.date); isoDay(d) <= end; d.setDate(d.getDate() + 1)) out.push(isoDay(d));
  return out;
}

// Monday-first cells for the anchored week or month, each carrying that day's meetings
export function buildCells({ mode, anchor, byDate, todayKey }) {
  const cells = [];
  const seen = new Set(); // a multi-day meeting sits in several cells but counts once
  let title;

  if (mode === 'week') {
    const start = startOfWeek(anchor);
    for (let i = 0; i < 7; i++) {
      const cell = makeCell(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), false, byDate, todayKey);
      cells.push(cell);
      cell.list.forEach((e) => seen.add(e.meeting.id));
    }
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    title = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' – ' +
      end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } else {
    const y = anchor.getFullYear();
    const mo = anchor.getMonth();
    const firstDow = (new Date(y, mo, 1).getDay() + 6) % 7;
    const cellCount = Math.ceil((firstDow + new Date(y, mo + 1, 0).getDate()) / 7) * 7;
    for (let i = 0; i < cellCount; i++) {
      const d = new Date(y, mo, 1 - firstDow + i);
      const out = d.getMonth() !== mo;
      const cell = makeCell(d, out, byDate, todayKey);
      cells.push(cell);
      if (!out) cell.list.forEach((e) => seen.add(e.meeting.id));
    }
    title = anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  return { cells, shown: seen.size, title };
}

function makeCell(d, out, byDate, todayKey) {
  const key = isoDay(d);
  return { key, day: d.getDate(), out, today: key === todayKey, list: byDate[key] || [] };
}
