import './Donut.css';

const R = 52;
export const DONUT_C = 2 * Math.PI * R;

/* Keeps the .arc class so callers can tween strokeDashoffset from DONUT_C in their own timeline. */
export default function Donut({ value, caption, color = 'var(--primary)', size = 124 }) {
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 124 124" aria-hidden="true">
        <circle className="track" cx="62" cy="62" r={R} fill="none" strokeWidth="12" />
        <circle
          className="arc"
          cx="62" cy="62" r={R} fill="none" strokeWidth="12" style={{ stroke: color }}
          strokeDasharray={DONUT_C}
          strokeDashoffset={DONUT_C * (1 - value / 100)}
        />
      </svg>
      <div className="donut-center">
        <div className="d-num">{value}%</div>
        <div className="d-cap">{caption}</div>
      </div>
    </div>
  );
}
