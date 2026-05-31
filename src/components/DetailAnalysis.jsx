import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DetailKpi from "./DetailKpi";
import ChartCard from "./ChartCard";
import { formatNumber } from "../lib/utils";
import { CHART_COLORS } from "../lib/constants";

export default function DetailAnalysis({
  filteredRows,
  totalQty,
  totalTeu,
  detailUnit,
  filteredMonthly,
  topCarrier,
  topCountry,
  topTrade,
  topSales,
}) {
  const uniqueBookings = new Set(filteredRows.map((row) => row.bookingNo).filter(Boolean)).size;
  const uniqueJobs = new Set(filteredRows.map((row) => row.jobNo)).size;

  return (
    <>
      <div className="section-title">
        Detailed Analysis <span className="section-title-note">(all filters applied)</span>
      </div>
      <div className="detail-kpi-grid">
        <DetailKpi label="Containers" value={formatNumber(totalQty)} sub="Total Qty" />
        <DetailKpi label="20' Units" value={formatNumber(detailUnit.unit20)} sub="TEU Factor x1" tone="#2563eb" />
        <DetailKpi label="40' Units" value={formatNumber(detailUnit.unit40)} sub="TEU Factor x2" tone="#059669" />
        <DetailKpi label="TEU" value={formatNumber(totalTeu)} sub="Total TEU" tone="#0f766e" />
        <DetailKpi label="Bookings" value={formatNumber(uniqueBookings)} sub="Unique Booking No" />
        <DetailKpi label="Jobs" value={formatNumber(uniqueJobs)} sub="Unique Job No" />
      </div>

      <ChartCard title="Monthly TEU Trend (filtered)" sub="Jan - Dec - responds to all filters" wide>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={filteredMonthly.series}>
            <CartesianGrid stroke="#e2e6f0" />
            <Legend />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            {filteredMonthly.years.map((year, index) => (
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

      <div className="charts-grid">
        <ChartCard title="TEU by Carrier" sub="Top carriers by TEU">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topCarrier} layout="vertical">
              <CartesianGrid stroke="#e2e6f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value">
                {topCarrier.map((item, index) => (
                  <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="TEU by Country" sub="Top destination countries">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topCountry} layout="vertical">
              <CartesianGrid stroke="#e2e6f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value">
                {topCountry.map((item, index) => (
                  <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="TEU by Trade Route" sub="Top trade routes by volume">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topTrade}>
              <CartesianGrid stroke="#e2e6f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#d97706" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume by Sale Name" sub="TEU contribution per salesperson">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topSales}>
              <CartesianGrid stroke="#e2e6f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}
