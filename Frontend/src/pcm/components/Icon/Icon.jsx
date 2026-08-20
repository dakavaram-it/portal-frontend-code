import './Icon.css';

export default function Icon({ name, sm = false, className = '', ...rest }) {
  const cls = ['icon', sm ? 'icon-sm' : '', className].filter(Boolean).join(' ');
  return (
    <svg className={cls} aria-hidden="true" focusable="false" {...rest}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
