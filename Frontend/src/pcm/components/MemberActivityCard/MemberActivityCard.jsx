import { useMemo, useState } from 'react';
import Icon from '../Icon/Icon.jsx';
import SortHead from '../SortHead/SortHead.jsx';

// A permanent third card, not a click-to-reveal one: it always shows the
// current row (the first match by default, or whichever one was clicked),
// the same way the two summary cards above it always show their own data.
// `members` is `null` while its fetch is in flight — kept distinct from `[]`
// ("loaded, no leaders in this role") the same way the summary cards above
// distinguish loading from a genuinely empty result.
//
// Variants:
// - `calendar` / `log` — Update-only (entries modals); no Upload / Attended / View
// - `default` — Upload / Attended / Update remarks / View remarks
const blank = (v) => {
  if (v == null) return '';
  const s = String(v).trim();
  return s === '' || s === '-' || s === '—' ? '' : s;
};

// `null` sortKey leaves rows in server order, matching the two summary
// cards above this one on the Programmes view.
const SORT_KEYS = {
  parliament: (r) => blank(r.parliament).toLowerCase(),
  assembly: (r) => blank(r.assembly).toLowerCase(),
  name: (r) => (r.name || '').toLowerCase(),
  role: (r) => blank(r.role).toLowerCase(),
  mobile: (r) => blank(r.mobile),
  cadreId: (r) => blank(r.cadreId),
  participated: (r) => r.participated || 0,
  completed: (r) => r.completed || 0
};

export default function MemberActivityCard({
  title,
  members,
  variant = 'default',
  uploadsByMid = {},
  onChangeParticipated,
  onChangeCompleted,
  onUpdate,
  onUpdateRemarks,
  onViewRemarks,
  onUpload,
  onViewAttendance
}) {
  const loading = members === null;
  const rows = members || [];
  const entriesOnly = variant === 'calendar' || variant === 'log';
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const get = SORT_KEYS[sortKey];
    const sorted = [...rows].sort((a, b) => {
      const av = get(a), bv = get(b);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir]);

  return (
    <div className="member-detail-card table-card">
      <div className="card-head">
        <h2>{title}</h2>
        <span className="sub">{loading ? '…' : rows.length + ' ' + (rows.length === 1 ? 'leader' : 'leaders') + ' shown'}</span>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">{title} — leader activity detail</caption>
          <thead>
            <tr>
              <SortHead label="Parliament" sortKey="parliament" active={sortKey === 'parliament'} dir={sortDir} onSort={onSort} />
              <SortHead label="Assembly" sortKey="assembly" active={sortKey === 'assembly'} dir={sortDir} onSort={onSort} />
              <SortHead label="Leader" sortKey="name" active={sortKey === 'name'} dir={sortDir} onSort={onSort} />
              <SortHead label="Role" sortKey="role" active={sortKey === 'role'} dir={sortDir} onSort={onSort} />
              <SortHead label="Mobile" sortKey="mobile" active={sortKey === 'mobile'} dir={sortDir} onSort={onSort} />
              <SortHead label="Cadre ID" sortKey="cadreId" active={sortKey === 'cadreId'} dir={sortDir} onSort={onSort} />
              <SortHead label="Activities participated" sortKey="participated" active={sortKey === 'participated'} dir={sortDir} onSort={onSort} className="n" />
              <SortHead label="Completed" sortKey="completed" active={sortKey === 'completed'} dir={sortDir} onSort={onSort} className="n" />
              {!entriesOnly && <th scope="col" className="action-cell">Upload</th>}
              {!entriesOnly && <th scope="col" className="action-cell">Attended status</th>}
              <th scope="col" className="action-cell">Update</th>
              {!entriesOnly && <th scope="col" className="action-cell">View</th>}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((m) => {
              const given = Boolean(m.remarks);
              const uploaded = Boolean(uploadsByMid[m.mid]);
              return (
                <tr key={m.mid}>
                  <td>{blank(m.parliament)}</td>
                  <td>{blank(m.assembly)}</td>
                  <td>{m.name}</td>
                  <td>{blank(m.role)}</td>
                  <td>{blank(m.mobile)}</td>
                  <td>{blank(m.cadreId)}</td>
                  <td className="n">
                    <input
                      type="number" min="0" step="1" inputMode="numeric"
                      className="count-input"
                      value={m.participated || 0}
                      onChange={(e) => onChangeParticipated(m.mid, e.target.value)}
                      aria-label={'Activities participated for ' + m.name}
                    />
                  </td>
                  <td className="n">
                    <input
                      type="number" min="0" step="1" inputMode="numeric"
                      className="count-input count-input-ok"
                      value={m.completed || 0}
                      onChange={(e) => onChangeCompleted(m.mid, e.target.value)}
                      aria-label={'Completed for ' + m.name}
                    />
                  </td>
                  {!entriesOnly && (
                    <td className="action-cell">
                      <button
                        className="icon-btn"
                        type="button"
                        title="Upload"
                        aria-label="Upload"
                        onClick={() => onUpload(m.mid)}
                      >
                        <Icon name="upload" sm />
                      </button>
                    </td>
                  )}
                  {!entriesOnly && (
                    <td className="action-cell">
                      <button
                        className="icon-btn"
                        type="button"
                        disabled={!uploaded}
                        title={uploaded ? 'View attended status' : 'No file uploaded yet'}
                        aria-label="View attended status"
                        onClick={() => onViewAttendance(m.mid)}
                      >
                        <Icon name="eye" sm />
                      </button>
                    </td>
                  )}
                  <td className="action-cell">
                    <button
                      className="icon-btn"
                      type="button"
                      title={entriesOnly ? 'Update' : 'Update remarks'}
                      aria-label={entriesOnly ? 'Update' : 'Update remarks'}
                      onClick={() => (entriesOnly ? onUpdate(m.mid) : onUpdateRemarks(m.mid))}
                    >
                      <Icon name="notes" sm />
                    </button>
                  </td>
                  {!entriesOnly && (
                    <td className="action-cell">
                      <button
                        className="icon-btn"
                        type="button"
                        disabled={!given}
                        title={given ? 'View remarks' : 'No remarks recorded yet'}
                        aria-label="View remarks"
                        onClick={() => onViewRemarks(m.mid)}
                      >
                        <Icon name="eye" sm />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="empty" hidden={!loading}>
        <div className="empty-title">Loading…</div>
      </div>
      <div className="empty" hidden={loading || rows.length > 0}>
        <Icon name="inbox" />
        <div className="empty-title">No leaders in this role</div>
      </div>
    </div>
  );
}
