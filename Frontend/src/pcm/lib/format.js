// the four tiers the meeting service reports
export const LEVEL_LABEL = {
  Unit: 'Unit Level',
  Mandal: 'Mandal / Town / Division Level',
  AC: 'Assembly Level',
  PC: 'Parliament Level'
};

export const num = (n) => n.toLocaleString('en-IN');
// half-up, matching adapt.pct on the service — 62.5% has to read 63 in both
export const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
export const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const tone = (pct) => (pct >= 75 ? 'var(--ok)' : pct >= 45 ? 'var(--accent)' : 'var(--bad)');
// one class per tier: badge-unit / badge-mandal / badge-ac / badge-pc
export const badgeClass = (level) => 'badge-' + String(level || '').toLowerCase();
export const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

// the start day drops its year — the end day carries it for the whole range
export const dayMonth = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
export const fmtSpan = (m) => (m.endDate
  ? dayMonth(m.date) + ' – ' + fmtDate(m.endDate) + ' · ' + plural(m.days, 'day')
  : fmtDate(m.date));
