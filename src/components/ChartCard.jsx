export default function ChartCard({ title, sub, wide = false, children }) {
  return (
    <div className={`chart-card ${wide ? "chart-wide" : ""}`}>
      {title ? <div className="chart-title">{title}</div> : null}
      {sub ? <div className="chart-sub">{sub}</div> : null}
      <div className="chart-wrap">{children}</div>
    </div>
  );
}
