import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KpiCard from "./KpiCard";
import ChartCard from "./ChartCard";
import { formatNumber } from "../lib/utils";
import { CHART_COLORS } from "../lib/constants";

export default function OverviewKpis({ overviewRows, overviewUnit, overviewMonthly }) {
  return (
    <>
      <div className="section-title">
        Overview KPIs <span className="section-title-note">(full year - based on year filter only)</span>
      </div>
      <div className="kpi-grid">
        <KpiCard label="Total Containers" value={formatNumber(overviewRows.reduce((sum, row) => sum + row.qty, 0))} sub="Full-year quantity" color="#0f766e" />
        <KpiCard label="20' Containers" value={formatNumber(overviewUnit.unit20)} sub="20DC, 20RF, 20FR..." color="#2563eb" />
        <KpiCard label="40' Containers" value={formatNumber(overviewUnit.unit40)} sub="40HC, 40DC, 40RF..." color="#059669" />
        <KpiCard label="Total TEU" value={formatNumber(overviewRows.reduce((sum, row) => sum + row.teu, 0))} sub="Twenty-Foot Equivalent Units" color="#334155" />
      </div>

      <ChartCard title="Monthly TEU Trend" sub="Jan - Dec (fixed axis)" wide>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={overviewMonthly.series}>
            <CartesianGrid stroke="#e2e6f0" />
            <Legend />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            {overviewMonthly.years.map((year, index) => (
              <Line
                key={year}
                type="monotone"
                dataKey={String(year)}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}
