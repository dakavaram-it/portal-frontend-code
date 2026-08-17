// Shared by KssPanel and CubsPanel — the same icon-chip/value/label/sub layout the
// Dashboard's own StatTile uses (leap-stat-tile and friends), so a committee tile reads
// like every other stat tile in the app rather than inventing its own look.
export default function CommitteeStatTile({ icon, accent, label, value, sub, onClick, loading }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`leap-stat-tile${onClick ? ' leap-stat-tile-clickable' : ''}`}
      onClick={onClick}
      aria-label={onClick ? `${label}: view details` : undefined}
    >
      <span className="leap-stat-icon" style={{ background: `${accent}1a`, color: accent }}>{icon}</span>
      <div className="leap-stat-body">
        <div className="leap-stat-value">{loading ? '…' : (value ?? 0)}</div>
        <div className="leap-stat-label">{label}</div>
        {sub && <div className="leap-stat-sub">{sub}</div>}
      </div>
    </Tag>
  )
}
