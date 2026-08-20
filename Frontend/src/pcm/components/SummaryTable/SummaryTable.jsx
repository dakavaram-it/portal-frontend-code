import { useMemo, useState } from 'react';
import Icon from '../Icon/Icon.jsx';
import { LEVEL_LABEL } from '../../lib/format.js';
import './SummaryTable.css';

function Status({ held }) {
  return held
    ? <span className="pill pill-present"><i className="dot" />Conducted</span>
    : <span className="pill pill-absent"><i className="dot" />Not Conducted</span>;
}

// Key extractors for the sortable columns; status columns sort
// Not Conducted before Conducted ascending — the same "worst first" order
// the constituency rollup already uses to surface what's outstanding.
const SORT_KEYS = {
  parliament: (r) => (r.parliament || '').toLowerCase(),
  assembly: (r) => (r.assembly || '').toLowerCase(),
  location: (r) => (r.location || '').toLowerCase(),
  appConducted: (r) => (r.appConducted ? 1 : 0),
  pcConducted: (r) => (r.pcConducted ? 1 : 0)
};

function SortHead({ label, sortKey, active, dir, onSort }) {
  return (
    <th scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className="sort-th" type="button" onClick={() => onSort(sortKey)}>
        {label}
        <Icon
          name="chevron-down"
          sm
          className={'sort-icon' + (active ? ' is-active' : '') + (active && dir === 'asc' ? ' is-asc' : '')}
        />
      </button>
    </th>
  );
}

export default function SummaryTable({ level, rows, onUpdateRemarks }) {
  const loading = rows === null;
  const isAc = level === 'AC';
  const hasAssembly = level === 'Mandal' || level === 'Unit';
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const list = useMemo(() => {
    const base = rows || [];
    if (!sortKey) return base;
    const get = SORT_KEYS[sortKey];
    const sorted = [...base].sort((a, b) => {
      const av = get(a), bv = get(b);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sortKey, sortDir]);

  function onSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="summary-table">
      <div className="table-card">
        <div className="table-scroll">
          <table className="summary-grid">
            <caption className="sr-only">{LEVEL_LABEL[level] || level} App and PC summary</caption>
            <thead>
              <tr>
                {isAc && <SortHead label="Parliament" sortKey="parliament" active={sortKey === 'parliament'} dir={sortDir} onSort={onSort} />}
                {hasAssembly && <SortHead label="Assembly" sortKey="assembly" active={sortKey === 'assembly'} dir={sortDir} onSort={onSort} />}
                <SortHead label="Location" sortKey="location" active={sortKey === 'location'} dir={sortDir} onSort={onSort} />
                <SortHead label="App status" sortKey="appConducted" active={sortKey === 'appConducted'} dir={sortDir} onSort={onSort} />
                <SortHead label="PC Status" sortKey="pcConducted" active={sortKey === 'pcConducted'} dir={sortDir} onSort={onSort} />
                <th scope="col">View Remark</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  {isAc && <td>{r.parliament || '—'}</td>}
                  {hasAssembly && <td>{r.assembly || '—'}</td>}
                  <td>{r.location || '—'}</td>
                  <td><Status held={r.appConducted} /></td>
                  <td><Status held={r.pcConducted} /></td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      disabled={!r.conductedStatusId}
                      title={r.conductedStatusId ? undefined : 'No PC status recorded for this location yet'}
                      onClick={() => onUpdateRemarks(r)}
                    >
                      Update Remarks
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="empty" hidden={loading || list.length > 0}>
          <div className="empty-title">No rows for this level</div>
        </div>
        <div className="empty" hidden={!loading}>
          <div className="empty-title">Loading…</div>
        </div>
      </div>
    </div>
  );
}
