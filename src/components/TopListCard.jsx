import { formatNumber } from "../lib/utils";

export default function TopListCard({ title, items, color }) {
  const max = items[0]?.value || 1;
  return (
    <div className="top-card">
      <div className="top-title">{title}</div>
      {items.map((item, index) => (
        <div className="top-row" key={item.name}>
          <div className={`top-rank ${index < 3 ? `r${index + 1}` : ""}`}>{index + 1}</div>
          <span className="top-name">{item.name}</span>
          <div className="top-bar-wrap">
            <div className="top-bar" style={{ width: `${(item.value / max) * 100}%`, background: color }} />
          </div>
          <span className="top-val">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}
