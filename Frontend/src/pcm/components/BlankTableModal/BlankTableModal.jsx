import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import Dropdown from '../Dropdown/Dropdown.jsx';
import Icon from '../Icon/Icon.jsx';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import './BlankTableModal.css';

const PAINT_CHUNK = 200;

function hasPlace(v) {
  const s = (v || '').trim();
  return s && s !== '-' && s !== '—';
}

// Same place-filter rules as App & PC Summary: PC → Parliament (location is
// the PC), Unit/Mandal → Assembly, AC → Assembly via location.
function placeOf(row, level, kind) {
  if (kind === 'parliament') {
    return (level === 'PC' ? row.location : row.parliament) || '';
  }
  return (level === 'AC' ? row.location : row.assembly) || '';
}

export default function BlankTableModal({ title, rows, columns, level, placeFilter = true, loading = false, total = null, onClose }) {
  const wired = Array.isArray(rows);
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

  const showParliamentFilter = placeFilter && level === 'PC';
  const showAssemblyFilter = placeFilter && (level === 'Unit' || level === 'Mandal' || level === 'AC');
  const [selectedParliament, setSelectedParliament] = useState(null);
  const [selectedAssembly, setSelectedAssembly] = useState(null);
  // Paint in chunks so Unit-scale lists (~thousands of rows) do not freeze
  // the tab while building the full tbody.
  const [painted, setPainted] = useState(PAINT_CHUNK);

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: .18 });
    gsap.from(panelRef.current, { y: 18, scale: .97, duration: .28, ease: 'power3.out' });
  }, []);

  useEffect(() => {
    const opener = openerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current.focus();
    return () => {
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const stops = [...panelRef.current.querySelectorAll('button, textarea, input, select, a[href]')]
        .filter((el) => !el.hidden && !el.disabled);
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parliamentOptions = useMemo(() => {
    if (!showParliamentFilter || !wired) return [];
    return [...new Set(rows.map((r) => placeOf(r, level, 'parliament')).filter(hasPlace))]
      .sort((a, b) => a.localeCompare(b));
  }, [rows, wired, level, showParliamentFilter]);

  const assemblyOptions = useMemo(() => {
    if (!showAssemblyFilter || !wired) return [];
    return [...new Set(rows.map((r) => placeOf(r, level, 'assembly')).filter(hasPlace))]
      .sort((a, b) => a.localeCompare(b));
  }, [rows, wired, level, showAssemblyFilter]);

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

  const visible = useMemo(() => {
    if (!wired) return [];
    let list = rows;
    if (selectedParliament) {
      list = list.filter((r) => placeOf(r, level, 'parliament') === selectedParliament);
    }
    if (selectedAssembly) {
      list = list.filter((r) => placeOf(r, level, 'assembly') === selectedAssembly);
    }
    return list;
  }, [rows, wired, level, selectedParliament, selectedAssembly]);

  useEffect(() => {
    setPainted(PAINT_CHUNK);
  }, [title, selectedParliament, selectedAssembly]);

  useEffect(() => {
    if (painted >= visible.length) return;
    const id = requestAnimationFrame(() => {
      setPainted((n) => Math.min(n + PAINT_CHUNK, visible.length));
    });
    return () => cancelAnimationFrame(id);
  }, [painted, visible.length]);

  const shown = visible.slice(0, painted);
  const showFilters = wired && (showParliamentFilter || showAssemblyFilter);

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="modal drill-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drill-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="modal-head">
          <div>
            <h3 id="drill-title">{title}</h3>
            <div className="who-sub">
              {wired
                ? `${visible.length}${total != null && visible.length !== total ? ` of ${total}` : visible.length !== rows.length ? ` of ${rows.length}` : ''} ${visible.length === 1 ? 'row' : 'rows'}${
                    loading ? ' · loading…' : painted < visible.length ? ` · showing ${painted}` : ''
                  }`
                : 'Detail list — empty until this slice is wired'}
            </div>
          </div>
          <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" sm />
          </button>
        </div>
        <div className="modal-body">
          {showFilters && (
            <div className="drill-filters">
              {showParliamentFilter && (
                <div className="drill-filter">
                  <span className="drill-filter-label">Parliament</span>
                  <Dropdown
                    id="drill-parliament"
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
                <div className="drill-filter">
                  <span className="drill-filter-label">Assembly</span>
                  <Dropdown
                    id="drill-assembly"
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
            <div className="table-scroll drill-scroll">
              <table>
                <caption className="sr-only">{title}</caption>
                <thead>
                  <tr>
                    {wired ? columns.map((c) => <th key={c.key} scope="col">{c.label}</th>) : <th scope="col" />}
                  </tr>
                </thead>
                <tbody>
                  {wired && shown.map((r, i) => (
                    <tr key={r.id ?? i}>
                      {columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
