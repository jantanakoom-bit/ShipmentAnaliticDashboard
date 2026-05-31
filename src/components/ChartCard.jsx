export default function ChartCard({ title, sub, wide = false, children }) {
  return (
    <div className={`chart-card ${wide ? "chart-wide" : ""}`}>
      <div className="chart-title">{title}</div>
      <div className="chart-sub">{sub}</div>
      <div className="chart-wrap">{children}</div>
    </div>
  );
}
