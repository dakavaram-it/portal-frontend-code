import { useEffect, useMemo, useState } from 'react';
import Dropdown from '../Dropdown/Dropdown.jsx';
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

function hasPlace(v) {
  const s = (v || '').trim();
  return s && s !== '-' && s !== '—';
}

export default function SummaryTable({ level, rows, onUpdateRemarks }) {
  const loading = rows === null;
  const hasAssembly = level === 'Mandal' || level === 'Unit';
  const hasParliamentCol = level === 'AC' || level === 'Mandal' || level === 'Unit';
  // PC alone gets a Parliament filter (rows are parliaments). Everyone else
  // keeps Assembly — for AC, location *is* the assembly.
  const showParliamentFilter = level === 'PC';
  const showAssemblyFilter = level === 'Unit' || level === 'Mandal' || level === 'AC';

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selectedParliament, setSelectedParliament] = useState(null);
  const [selectedAssembly, setSelectedAssembly] = useState(null);
  // The eye icon only ever reveals the remark text in place — no modal, no
  // edit path — so this is plain local expand/collapse state, not a callback
  // into the parent the way Status Update is.
  const [openRemarks, setOpenRemarks] = useState(() => new Set());
  const toggleRemark = (id) => setOpenRemarks((cur) => {
    const next = new Set(cur);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // PC: location is the parliament name. AC: location is the assembly.
  const parliamentOf = (r) => (level === 'PC' ? r.location : r.parliament) || '';
  const assemblyOf = (r) => (level === 'AC' ? r.location : r.assembly) || '';

  const parliamentOptions = useMemo(() => {
    if (!showParliamentFilter || !rows) return [];
    return [...new Set(rows.map(parliamentOf).filter(hasPlace))].sort((a, b) => a.localeCompare(b));
  }, [rows, level, showParliamentFilter]);

  const assemblyOptions = useMemo(() => {
    if (!showAssemblyFilter || !rows) return [];
    return [...new Set(rows.map(assemblyOf).filter(hasPlace))].sort((a, b) => a.localeCompare(b));
  }, [rows, level, showAssemblyFilter]);

  useEffect(() => {
    setSelectedParliament(null);
    setSelectedAssembly(null);
    setOpenRemarks(new Set());
  }, [level]);

  // New fetch cycle (expand / switch meeting) clears filters; in-place remark
  // patches keep the current selection.
  useEffect(() => {
    if (rows === null) {
      setSelectedParliament(null);
      setSelectedAssembly(null);
      setOpenRemarks(new Set());
    }
  }, [rows]);

  useEffect(() => {
    if (selectedParliament && !parliamentOptions.includes(selectedParliament)) {
      setSelectedParliament(null);
    }
  }, [selectedParliament, parliamentOptions]);

  useEffect(() => {
    if (selectedAssembly && !assemblyOptions.includes(selectedAssembly)) {
      setSelectedAssembly(null);
    }
  }, [selectedAssembly, assemblyOptions]);

  const list = useMemo(() => {
    let base = rows || [];
    if (selectedParliament) {
      base = base.filter((r) => parliamentOf(r) === selectedParliament);
    }
    if (selectedAssembly) {
      base = base.filter((r) => assemblyOf(r) === selectedAssembly);
    }
    if (!sortKey) return base;
    const get = SORT_KEYS[sortKey];
    const sorted = [...base].sort((a, b) => {
      const av = get(a), bv = get(b);
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sortKey, sortDir, selectedParliament, selectedAssembly, level]);

  function onSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="summary-table">
      {(showParliamentFilter || showAssemblyFilter) && (
        <div className="summary-filters">
          {showParliamentFilter && (
            <div className="summary-filter">
              <span className="summary-filter-label">Parliament</span>
              <Dropdown
                id="summary-parliament"
                label="Filter by parliament"
                value={selectedParliament ?? 'all'}
                onChange={(v) => setSelectedParliament(v === 'all' ? null : v)}
                options={[
                  { value: 'all', label: 'All parliaments' },
                  ...parliamentOptions.map((p) => ({ value: p, label: p }))
                ]}
              />
            </div>
          )}
          {showAssemblyFilter && (
            <div className="summary-filter">
              <span className="summary-filter-label">Assembly</span>
              <Dropdown
                id="summary-assembly"
                label="Filter by assembly"
                value={selectedAssembly ?? 'all'}
                onChange={(v) => setSelectedAssembly(v === 'all' ? null : v)}
                options={[
                  { value: 'all', label: 'All assemblies' },
                  ...assemblyOptions.map((a) => ({ value: a, label: a }))
                ]}
              />
            </div>
          )}
        </div>
      )}

      <div className="table-card">
        <div className="table-scroll">
          <table className="summary-grid">
            <caption className="sr-only">{LEVEL_LABEL[level] || level} App and PC summary</caption>
            <thead>
              <tr>
                {hasParliamentCol && <SortHead label="Parliament" sortKey="parliament" active={sortKey === 'parliament'} dir={sortDir} onSort={onSort} />}
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
                  {hasParliamentCol && <td>{r.parliament || '—'}</td>}
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
          <div className="empty-title">No rows for this level</div>
        </div>
        <div className="empty" hidden={!loading}>
          <div className="empty-title">Loading…</div>
        </div>
      </div>
    </div>
  );
}
