export default function ChartCard({ title, sub, wide = false, empty = false, emptyMessage = "No data for current filters", children }) {
  return (
    <div className={`chart-card ${wide ? "chart-wide" : ""}`}>
      {title ? <div className="chart-title">{title}</div> : null}
      {sub ? <div className="chart-sub">{sub}</div> : null}
      {empty ? (
        <div className="chart-empty">{emptyMessage}</div>
      ) : (
        <div className="chart-wrap">{children}</div>
      )}
    </div>
  );
}
