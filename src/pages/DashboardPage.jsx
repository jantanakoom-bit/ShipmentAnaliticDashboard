import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import KpiCard from "../components/KpiCard";
import ChartCard from "../components/ChartCard";
import { formatNumber } from "../lib/utils";
import { CHART_COLORS } from "../lib/constants";

function InsightCard({ icon, iconBg, iconColor, label, items, barColor, linkTo, linkLabel }) {
  const maxTeu = items[0]?.value || 1;
  return (
    <div className="insight-card">
      <div className="insight-head">
        <div className="insight-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <div className="insight-label">{label}</div>
      </div>
      <ul className="insight-list">
        {items.slice(0, 3).map((item) => (
          <li key={item.name}>
            <span className="name">{item.name}</span>
            <span className="val">{formatNumber(item.value)}</span>
          </li>
        ))}
      </ul>
      <div className="insight-bar">
        <div
          className="insight-bar-fill"
          style={{ width: `${((items[0]?.value || 0) / maxTeu) * 100}%`, background: barColor }}
        />
      </div>
      <div style={{ marginTop: "10px" }}>
        <Link
          to={linkTo}
          style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}
        >
          {linkLabel} →
        </Link>
      </div>
    </div>
  );
}

function NavCard({ title, description, to }) {
  return (
    <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
      <div className="nav-card">
        <div>
          <div className="nav-card-title">{title}</div>
          <div className="nav-card-desc">{description}</div>
        </div>
        <div className="nav-card-arrow">→</div>
      </div>
    </Link>
  );
}

export default function DashboardPage({
  totalTeu,
  uniqueBookings,
  activeCarriers,
  totalQty,
  overviewMonthly,
  topCarrier,
  topCountry,
  topSales,
}) {
  return (
    <>
      <div className="kpi-strip">
        <KpiCard
          label="Total TEU"
          value={formatNumber(totalTeu)}
          sub="Twenty-foot equivalent units"
          color="#0f766e"
          change="+12.3%"
        />
        <KpiCard
          label="Bookings"
          value={formatNumber(uniqueBookings)}
          sub="Unique booking numbers"
          color="#2563eb"
          change="+8.1%"
        />
        <KpiCard
          label="Active Carriers"
          value={formatNumber(activeCarriers)}
          sub="Carriers in selection"
          color="#059669"
          change="-2"
          changeTone="down"
        />
        <KpiCard
          label="Containers"
          value={formatNumber(totalQty)}
          sub="20' ×1 + 40' ×2 TEU"
          color="#b45309"
          change="+15.7%"
        />
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Monthly TEU Trend</div>
            <div className="section-sub">Year-over-year comparison · Jan–Dec</div>
          </div>
        </div>
        <ChartCard wide>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={overviewMonthly?.series || []}>
              <CartesianGrid stroke="#e2e6f0" />
              <Legend />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              {(overviewMonthly?.years || []).map((year, index) => (
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
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Quick Insights</div>
            <div className="section-sub">Top 3 performers by TEU volume</div>
          </div>
        </div>
        <div className="insights-grid">
          <InsightCard
            icon="🚢"
            iconBg="#dbeafe"
            iconColor="#1d4ed8"
            label="Top Carriers"
            items={topCarrier || []}
            barColor="#2563eb"
            linkTo="/analytics"
            linkLabel="View all carriers →"
          />
          <InsightCard
            icon="🌍"
            iconBg="#d1fae5"
            iconColor="#065f46"
            label="Top Countries"
            items={topCountry || []}
            barColor="#059669"
            linkTo="/analytics"
            linkLabel="View all countries →"
          />
          <InsightCard
            icon="👤"
            iconBg="#fef3c7"
            iconColor="#92400e"
            label="Top Sales"
            items={topSales || []}
            barColor="#b45309"
            linkTo="/analytics"
            linkLabel="View sales breakdown →"
          />
        </div>
      </div>

      <div className="section">
        <div className="nav-cards">
          <NavCard
            title="Analytics Deep Dive"
            description="Charts, breakdowns, and rankings by carrier, country, trade route"
            to="/analytics"
          />
          <NavCard
            title="Shipment Records"
            description="Search, sort, and export individual shipment detail rows"
            to="/shipments"
          />
        </div>
      </div>
    </>
  );
}
