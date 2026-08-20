import Icon from '../Icon/Icon.jsx';
import { num } from '../../lib/format.js';

// A permanent third card, not a click-to-reveal one: it always shows the
// current row (the first match by default, or whichever one was clicked),
// the same way the two summary cards above it always show their own data.
// `members` is `null` while its fetch is in flight — kept distinct from `[]`
// ("loaded, no leaders in this role") the same way the summary cards above
// distinguish loading from a genuinely empty result.
const blank = (v) => {
  if (v == null) return '';
  const s = String(v).trim();
  return s === '' || s === '-' || s === '—' ? '' : s;
};

export default function MemberActivityCard({
  title,
  members,
  uploadsByMid = {},
  onUpdateRemarks,
  onViewRemarks,
  onUpload,
  onViewAttendance
}) {
  const loading = members === null;
  const rows = members || [];
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
              <th scope="col">Parliament</th>
              <th scope="col">Assembly</th>
              <th scope="col">Leader</th>
              <th scope="col">MID</th>
              <th scope="col" className="n">Activities participated</th>
              <th scope="col" className="n">Completed</th>
              <th scope="col" className="action-cell">Upload</th>
              <th scope="col" className="action-cell">Attended status</th>
              <th scope="col" className="action-cell">Update</th>
              <th scope="col" className="action-cell">View</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const given = Boolean(m.remarks);
              const uploaded = Boolean(uploadsByMid[m.mid]);
              return (
                <tr key={m.mid}>
                  <td>{blank(m.parliament)}</td>
                  <td>{blank(m.assembly)}</td>
                  <td>{m.name}</td>
                  <td className="mid-cell">{m.mid}</td>
                  <td className="n num">{num(m.participated)}</td>
                  <td className="n num" style={{ color: 'var(--ok)' }}>{num(m.completed)}</td>
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
                  <td className="action-cell">
                    <button
                      className="icon-btn"
                      type="button"
                      title="Update remarks"
                      aria-label="Update remarks"
                      onClick={() => onUpdateRemarks(m.mid)}
                    >
                      <Icon name="notes" sm />
                    </button>
                  </td>
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
