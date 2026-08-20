import Icon from '../Icon/Icon.jsx';
import './Topbar.css';

export default function Topbar({ crumb, title }) {
  return (
    <header className="topbar">
      <div className="topbar-start" />

      <div className="topbar-title">
        {crumb && (
          <div className="crumb">
            {crumb.split(' / ').map((part, i) => (
              <span key={part} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {i > 0 && <Icon name="chevron-right" />}
                {part}
              </span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions" />
    </header>
  );
}
