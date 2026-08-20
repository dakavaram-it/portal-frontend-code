import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import Icon from '../Icon/Icon.jsx';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';
import './BlankTableModal.css';

export default function BlankTableModal({ title, rows, columns, onClose }) {
  const wired = Array.isArray(rows);
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

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
              {wired ? `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}` : 'Detail list — empty until this slice is wired'}
            </div>
          </div>
          <button className="icon-btn drill-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="x" sm />
          </button>
        </div>
        <div className="modal-body">
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
                  {wired && rows.map((r, i) => (
                    <tr key={i}>
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
