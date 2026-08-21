import { useEffect, useMemo, useState } from 'react';
import Icon from '../Icon/Icon.jsx';
import Select from '../Select/Select.jsx';
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
  const hasAssembly = level === 'Mandal' || level === 'Unit';
  const hasParliament = level === 'AC' || level === 'Mandal' || level === 'Unit';
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [assemblyFilter, setAssemblyFilter] = useState('');
  // The eye icon only ever reveals the remark text in place — no modal, no
  // edit path — so this is plain local expand/collapse state, not a callback
  // into the parent the way Status Update is.
  const [openRemarks, setOpenRemarks] = useState(() => new Set());
  const toggleRemark = (id) => setOpenRemarks((cur) => {
    const next = new Set(cur);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Options come off the rows themselves, not a separate picklist call —
  // there is no endpoint for "assemblies this meeting's rows touch", and
  // the rows already carry the answer.
  const assemblies = useMemo(() => {
    if (!hasAssembly || !rows) return [];
    return [...new Set(rows.map((r) => r.assembly).filter(Boolean))].sort();
  }, [rows, hasAssembly]);

  // A filter picked for one meeting's assembly list may not exist in the
  // next meeting's — drop it rather than silently filtering to nothing.
  useEffect(() => {
    if (assemblyFilter && !assemblies.includes(assemblyFilter)) setAssemblyFilter('');
  }, [assemblies, assemblyFilter]);

  const list = useMemo(() => {
    const base = assemblyFilter ? (rows || []).filter((r) => r.assembly === assemblyFilter) : (rows || []);
    if (!sortKey) return base;
    const get = SORT_KEYS[sortKey];
    const sorted = [...base].sort((a, b) => {
      const av = get(a), bv = get(b);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sortKey, sortDir, assemblyFilter]);

  function onSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="summary-table">
      {hasAssembly && assemblies.length > 0 && (
        <div className="summary-table-tools">
          <Select id="summary-assembly-filter" label="Filter by assembly" value={assemblyFilter} onChange={setAssemblyFilter}>
            <option value="">All Assemblies</option>
            {assemblies.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
      )}
      <div className="table-card">
        <div className="table-scroll">
          <table className="summary-grid">
            <caption className="sr-only">{LEVEL_LABEL[level] || level} App and PC summary</caption>
            <thead>
              <tr>
                {hasParliament && <SortHead label="Parliament" sortKey="parliament" active={sortKey === 'parliament'} dir={sortDir} onSort={onSort} />}
                {hasAssembly && <SortHead label="Assembly" sortKey="assembly" active={sortKey === 'assembly'} dir={sortDir} onSort={onSort} />}
                <SortHead label="Location" sortKey="location" active={sortKey === 'location'} dir={sortDir} onSort={onSort} />
                <SortHead label="App status" sortKey="appConducted" active={sortKey === 'appConducted'} dir={sortDir} onSort={onSort} />
                <SortHead label="PC Status" sortKey="pcConducted" active={sortKey === 'pcConducted'} dir={sortDir} onSort={onSort} />
                <th scope="col">Status Update</th>
                <th scope="col">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  {hasParliament && <td>{r.parliament || '—'}</td>}
                  {hasAssembly && <td>{r.assembly || '—'}</td>}
                  <td className="location-cell">{r.location || '—'}</td>
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
                      Status Update
                    </button>
                  </td>
                  <td>
                    <button
                      className="remark-eye"
                      type="button"
                      disabled={!r.conductedStatusId}
                      aria-expanded={openRemarks.has(r.id)}
                      aria-label={(openRemarks.has(r.id) ? 'Hide' : 'View') + ' remark'}
                      title={r.conductedStatusId ? undefined : 'No PC status recorded for this location yet'}
                      onClick={() => toggleRemark(r.id)}
                    >
                      <Icon name="eye" sm />
                    </button>
                    {openRemarks.has(r.id) && (
                      <div className={'remark-preview' + (r.remarks ? '' : ' is-empty')}>
                        {r.remarks || 'No remark yet'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="empty" hidden={loading || list.length > 0}>
          <div className="empty-title">
            {assemblyFilter ? `No rows for ${assemblyFilter}` : 'No rows for this level'}
          </div>
        </div>
        <div className="empty" hidden={!loading}>
          <div className="empty-title">Loading…</div>
        </div>
      </div>
    </div>
  );
}
