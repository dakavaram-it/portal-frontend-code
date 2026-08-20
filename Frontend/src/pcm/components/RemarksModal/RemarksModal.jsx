import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Icon from '../Icon/Icon.jsx';
import { initials } from '../../lib/format.js';
import { prefersReduced } from '../../lib/motion.js';
import './RemarksModal.css';

export default function RemarksModal({ member, onClose, onSave }) {
  const [text, setText] = useState(member.remarks);
  const [editable, setEditable] = useState(!member.remarks); // nothing recorded yet -> open straight in add mode
  const openerRef = useRef(document.activeElement); // grabbed on render, before focus moves
  const backdropRef = useRef(null);
  const panelRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    // opacity, not autoAlpha: autoAlpha starts at visibility:hidden, which silently voids the focus below
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: .18 });
    gsap.from(panelRef.current, { y: 18, scale: .97, duration: .28, ease: 'power3.out' });
  }, []);

  // lock the page behind the dialog and hand focus back to whatever opened it
  useEffect(() => {
    const opener = openerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // declared after the lock effect so it wins the focus on mount
  useEffect(() => {
    if (editable) textRef.current.focus();
    else panelRef.current.focus();
  }, [editable]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      // keep Tab inside the dialog
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={panelRef}>
        <div className="modal-head">
          <div className="avatar" aria-hidden="true">{initials(member.name)}</div>
          <div>
            <h3 id="modal-title">{member.name}</h3>
            {/* a member's level is their own committee tier, not the meeting's */}
            <div className="who-sub">{member.designation + ' · ' + member.ac + ' · ' + member.levelName}</div>
          </div>
        </div>

        <div className="modal-body">
          <div className="meta-grid">
            <div><div className="m-key">MID</div><div className="m-val mono">{member.mid}</div></div>
            <div><div className="m-key">Mobile</div><div className="m-val mono">{member.mobile}</div></div>
            <div><div className="m-key">Committee</div><div className="m-val">{member.committee}</div></div>
            <div><div className="m-key">Feedback captured by</div><div className="m-val">{member.capturedBy || 'Not captured yet'}</div></div>
          </div>
          <div className="field">
            <label htmlFor="remarks-text">Remarks</label>
            <textarea
              id="remarks-text"
              ref={textRef}
              readOnly={!editable}
              placeholder="Type the feedback remark captured from this member…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && editable) onSave(text);
              }}
            />
            {editable && <div className="field-hint">{text.trim().length} characters · Ctrl + Enter saves</div>}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button className="btn" type="button" hidden={editable} onClick={() => setEditable(true)}>
            <Icon name="pencil" sm /> Edit
          </button>
          <button className="btn btn-primary" type="button" hidden={!editable} onClick={() => onSave(text)}>
            Save remarks
          </button>
        </div>
      </div>
    </div>
  );
}
