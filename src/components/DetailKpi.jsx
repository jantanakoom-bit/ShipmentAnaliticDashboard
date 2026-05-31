export default function DetailKpi({ label, value, sub, tone }) {
  return (
    <div className="detail-kpi" style={tone ? { "--detail-kpi-color": tone } : undefined}>
      <div className="lbl">{label}</div>
      <div className="val" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="sub">{sub}</div>
    </div>
  );
}
