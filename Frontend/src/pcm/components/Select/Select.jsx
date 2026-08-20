import Icon from '../Icon/Icon.jsx';
import './Select.css';

export default function Select({ id, label, value, onChange, disabled, children }) {
  return (
    <div className="select-wrap">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <select className="control" id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <Icon name="chevron-down" sm className="chev" />
    </div>
  );
}
