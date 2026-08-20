import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon/Icon.jsx';
import './Dropdown.css';

/* A custom listbox, not a native <select>: the browser decides a native
   select's open direction itself (and flips it upward near the bottom of the
   viewport), so there is no reliable way to force "always opens down, capped
   height, scrolls inside" through one. This owns its own open state and
   positions the panel below the trigger unconditionally. */
export default function Dropdown({ id, label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (!rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (v) => { onChange(v); setOpen(false); };

  return (
    <div className="dd" ref={rootRef}>
      <button
        id={id} className="dd-trigger" type="button"
        aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dd-trigger-label">{current ? current.label : label}</span>
        <Icon name="chevron-down" sm className="chev" />
      </button>
      {open && (
        <ul className="dd-panel" role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.value}>
              <button
                className="dd-option" type="button" role="option"
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
