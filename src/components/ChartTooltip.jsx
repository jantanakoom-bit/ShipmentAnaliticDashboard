import { formatNumber } from "../lib/utils";

export default function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dde4e3",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "0 4px 12px rgba(23,32,31,0.08)",
        fontSize: 12,
        fontFamily: '"DM Sans", sans-serif',
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4, color: "#17201f" }}>
        {label}
      </div>
      <div
        style={{
          color: "#4d5d5a",
          fontFamily: '"IBM Plex Mono", "Cascadia Mono", monospace',
          fontSize: 11,
        }}
      >
        TEU: {formatNumber(payload[0].value)}
      </div>
    </div>
  );
}
