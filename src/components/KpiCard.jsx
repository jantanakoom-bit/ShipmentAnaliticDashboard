export default function KpiCard({ label, value, sub, color, change, changeTone = "up" }) {
  return (
    <div className="kpi-card" style={{ "--kpi-color": color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
      {change ? <div className={`kpi-change kpi-${changeTone}`}>{change}</div> : null}
    </div>
  );
}
