export default function InsightTile({ label, value, sub }) {
  return (
    <div className="insight-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}
