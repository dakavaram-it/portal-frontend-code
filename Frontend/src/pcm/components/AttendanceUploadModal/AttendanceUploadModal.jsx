import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Icon from '../Icon/Icon.jsx';
import { initials } from '../../lib/format.js';
import { prefersReduced } from '../../lib/motion.js';
import '../RemarksModal/RemarksModal.css';

export default function AttendanceUploadModal({ member, mode = 'upload', file, onClose, onSave }) {
  const [picked, setPicked] = useState(null);
  const [localUrl, setLocalUrl] = useState(null);
  const openerRef = useRef(document.activeElement);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

  const previewUrl = mode === 'view' ? file?.url : localUrl;
  const previewName = mode === 'view' ? file?.name : picked?.name;
  const isPdf = Boolean(
    (previewName && /\.pdf$/i.test(previewName)) ||
    (file?.type || picked?.type || '').includes('pdf')
  );

  useLayoutEffect(() => {
    if (prefersReduced()) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: .18 });
    gsap.from(panelRef.current, { y: 18, scale: .97, duration: .28, ease: 'power3.out' });
  }, []);

  useEffect(() => {
    const opener = openerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  useEffect(() => () => {
    if (localUrl) URL.revokeObjectURL(localUrl);
  }, [localUrl]);

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

  const title = mode === 'view' ? 'Attended status' : 'Upload';

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-modal-title" tabIndex={-1} ref={panelRef}>
        <div className="modal-head">
          <div className="avatar" aria-hidden="true">{initials(member.name)}</div>
          <div>
            <h3 id="upload-modal-title">{title}</h3>
            <div className="who-sub">{member.name}</div>
          </div>
        </div>

        <div className="modal-body">
          {mode === 'view' ? (
            <div className="upload-preview">
              {isPdf ? (
                <iframe title={previewName || 'Attachment'} src={previewUrl} />
              ) : (
                <img src={previewUrl} alt={previewName || 'Attachment'} />
              )}
              {previewName && <div className="upload-file-name">{previewName}</div>}
            </div>
          ) : (
            <label className="upload-drop">
              <Icon name="upload" />
              <span className="upload-drop-label">{picked ? 'Replace file' : 'Choose a file to upload'}</span>
              {picked && <span className="upload-file-name">{picked.name}</span>}
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => {
                  const next = e.target.files?.[0] || null;
                  setPicked(next);
                  setLocalUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return next ? URL.createObjectURL(next) : null;
                  });
                }}
              />
            </label>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn" type="button" onClick={onClose}>
            {mode === 'view' ? 'Close' : 'Cancel'}
          </button>
          {mode === 'upload' && (
            <button
              className="btn btn-primary"
              type="button"
              disabled={!picked}
              onClick={() => {
                if (!picked) return;
                // Fresh URL for the parent — local preview URL stays owned here.
                onSave({ name: picked.name, type: picked.type, url: URL.createObjectURL(picked) });
              }}
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
