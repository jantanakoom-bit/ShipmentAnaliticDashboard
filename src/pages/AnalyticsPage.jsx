import { useState } from "react";
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
import DetailKpi from "../components/DetailKpi";
import ChartCard from "../components/ChartCard";
import ChartTooltip from "../components/ChartTooltip";
import TabPanel from "../components/TabPanel";
import { formatNumber } from "../lib/utils";
import { CHART_COLORS, DIMENSION_PALETTES } from "../lib/constants";

const TICK_STYLE = { fontSize: 10, fontFamily: '"IBM Plex Mono", "Cascadia Mono", monospace', fill: "#76827f" };
const GRID_STROKE = "#f1f5f9";
const VERTICAL_AXIS_HEIGHT = 96;

function formatAxisLabel(value, maxLength = 12) {
  const label = String(value || "");
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function VerticalXAxisTick({ x, y, payload, maxLength = 12 }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        fill={TICK_STYLE.fill}
        fontFamily={TICK_STYLE.fontFamily}
        fontSize={TICK_STYLE.fontSize}
        textAnchor="end"
        transform="rotate(-90)"
      >
        {formatAxisLabel(payload?.value, maxLength)}
      </text>
    </g>
  );
}

export default function AnalyticsPage({
  filteredRows,
  totalQty,
  totalTeu,
  detailUnit,
  filteredMonthly,
  topCarrier,
  topCountry,
  topTrade,
  topPort,
  topSales,
  saleCards,
  dateFilters,
  selected,
  counts,
  onSetAllDate,
  onSetSelected,
}) {
  const [activeTab, setActiveTab] = useState("ports");

  const uniqueBookings = new Set(filteredRows.map((row) => row.bookingNo).filter(Boolean)).size;
  const uniqueJobs = new Set(filteredRows.map((row) => row.jobNo).filter(Boolean)).size;

  const yearLabel = dateFilters?.years?.length ? dateFilters.years.join(", ") : null;
  const quarterLabel = dateFilters?.quarters?.length ? dateFilters.quarters.join(", ") : null;

  const dimensionChips = [];
  if (selected) {
    if (selected.port?.length) dimensionChips.push({ label: `${selected.port.length} Ports`, key: "port" });
    if (selected.carrier?.length) dimensionChips.push({ label: `${selected.carrier.length} Carriers`, key: "carrier" });
    if (selected.country?.length) dimensionChips.push({ label: `${selected.country.length} Countries`, key: "country" });
    if (selected.trade?.length) dimensionChips.push({ label: `${selected.trade.length} Routes`, key: "trade" });
    if (selected.sales?.length) dimensionChips.push({ label: `${selected.sales.length} Sales`, key: "sales" });
  }

  const tabs = [
    { key: "ports", label: "Ports" },
    { key: "carriers", label: "Carriers" },
    { key: "countries", label: "Countries" },
    { key: "routes", label: "Trade Routes" },
    { key: "sales", label: "Sales" },
  ];

  const rankColors = { ports: "#2563eb", carriers: "#7c3aed", countries: "#059669", routes: "#d97706" };

  function renderRankList(items, color) {
    const max = items[0]?.value || 1;
    return (
      <ul className="rank-list">
        {items.map((item, index) => (
          <li className="rank-item" key={item.name}>
            <span className={`rank-num ${index < 3 ? `r${index + 1}` : "rank-def"}`}>
              {index + 1}
            </span>
            <span className="rank-name">{item.name}</span>
            <div className="rank-bar-wrap">
              <div
                className="rank-bar"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  background: index < 3 ? color : "#94a3b8",
                }}
              />
            </div>
            <span className="rank-val">{formatNumber(item.value)}</span>
          </li>
        ))}
      </ul>
    );
  }

  function renderSaleCards() {
    return (
      <div className="sale-grid">
        {saleCards.map((item) => (
          <div className="sale-card" key={item.name}>
            <div className="sale-head">
              <span className="sale-name">{item.name}</span>
              <span className="sale-rank">#{item.rank}</span>
            </div>
            <div className="sale-row">
              <span className="sale-label" style={{ color: "#7c3aed" }}>TEU</span>
              <span className="sale-val">{formatNumber(item.teu)}</span>
            </div>
            <div className="sale-row">
              <span className="sale-label" style={{ color: "#2563eb" }}>Containers</span>
              <span className="sale-val">{formatNumber(item.totalUnits)}</span>
            </div>
            <div className="sale-row">
              <span className="sale-label" style={{ color: "#059669" }}>Bookings</span>
              <span className="sale-val">{formatNumber(item.bookings)}</span>
            </div>
            <div className="sale-row">
              <span className="sale-label" style={{ color: "#d97706" }}>Shippers</span>
              <span className="sale-val">{formatNumber(item.shippers)}</span>
            </div>
            <div className="sale-progress">
              <div className="sale-bar" style={{ width: `${item.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hasTrendData = filteredMonthly?.series?.length > 0 && filteredMonthly?.years?.length > 0;

  return (
    <div className="page-analytics">
      {/* Filter Summary Bar */}
      <div className="filter-summary">
        <span className="filter-summary-label">Active:</span>
        {yearLabel && (
          <span className="filter-chip">
            {yearLabel}
            <span
              aria-label="Clear year filter"
              className="x"
              role="button"
              tabIndex={0}
              onClick={() => onSetAllDate("years", [])}
            >&times;</span>
          </span>
        )}
        {quarterLabel && (
          <span className="filter-chip">
            {quarterLabel}
            <span
              aria-label="Clear quarter filter"
              className="x"
              role="button"
              tabIndex={0}
              onClick={() => onSetAllDate("quarters", [])}
            >&times;</span>
          </span>
        )}
        {dimensionChips.map((chip) => (
          <span className="filter-chip" key={chip.key}>
            {chip.label}
            <span
              className="x"
              role="button"
              tabIndex={0}
              aria-label={`Clear ${chip.key} filter`}
              onClick={() => onSetSelected((current) => ({ ...current, [chip.key]: [] }))}
            >&times;</span>
          </span>
        ))}
        <span className="filter-chip filter-chip-teu">
          <b>{formatNumber(totalTeu)} TEU</b>
        </span>
      </div>

      {/* 6 Detail KPIs Strip */}
      <div className="detail-kpi-strip">
        <DetailKpi label="Containers" value={formatNumber(totalQty)} sub="Total Qty" />
        <DetailKpi label="20' Units" value={formatNumber(detailUnit.unit20)} sub="TEU Factor x1" tone="#2563eb" />
        <DetailKpi label="40' Units" value={formatNumber(detailUnit.unit40)} sub="TEU Factor x2" tone="#059669" />
        <DetailKpi label="TEU" value={formatNumber(totalTeu)} sub="Total TEU" tone="#0f766e" />
        <DetailKpi label="Bookings" value={formatNumber(uniqueBookings)} sub="Unique Booking No" />
        <DetailKpi label="Jobs" value={formatNumber(uniqueJobs)} sub="Unique Job No" />
      </div>

      {/* Monthly TEU Trend — full width */}
      {hasTrendData && (
        <div className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Monthly TEU Trend</div>
              <div className="section-sub">Year-over-year comparison filtered by your selection</div>
            </div>
          </div>
          <ChartCard wide>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={filteredMonthly.series}>
                <CartesianGrid stroke={GRID_STROKE} />
                <XAxis dataKey="month" tick={TICK_STYLE} />
                <YAxis tick={TICK_STYLE} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: '"IBM Plex Mono", monospace', paddingTop: 8 }} />
                {filteredMonthly.years.map((year, index) => (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={String(year)}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 1 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* 2x2 Chart Grid */}
      <div className="charts-grid-2x2">
        <ChartCard title="TEU by Carrier" sub="Top carriers by TEU volume" empty={topCarrier.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topCarrier} layout="vertical">
              <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
              <XAxis type="number" tick={TICK_STYLE} />
              <YAxis type="category" dataKey="name" width={95} tick={TICK_STYLE} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15,118,110,0.04)" }} />
              <Bar dataKey="value" fill={DIMENSION_PALETTES.carrier.base} radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="TEU by Country" sub="Top destination countries" empty={topCountry.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topCountry} layout="vertical">
              <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
              <XAxis type="number" tick={TICK_STYLE} />
              <YAxis type="category" dataKey="name" width={95} tick={TICK_STYLE} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15,118,110,0.04)" }} />
              <Bar dataKey="value" fill={DIMENSION_PALETTES.country.base} radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="TEU by Trade Route" sub="Top trade routes by volume" empty={topTrade.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topTrade} margin={{ top: 8, right: 12, left: 0, bottom: 32 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="name"
                tick={<VerticalXAxisTick />}
                height={VERTICAL_AXIS_HEIGHT}
                interval={0}
                tickMargin={8}
              />
              <YAxis tick={TICK_STYLE} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15,118,110,0.04)" }} />
              <Bar dataKey="value" fill={DIMENSION_PALETTES.trade.base} radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume by Sale Name" sub="TEU contribution per salesperson" empty={topSales.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topSales} margin={{ top: 8, right: 12, left: 0, bottom: 32 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="name"
                tick={<VerticalXAxisTick />}
                height={VERTICAL_AXIS_HEIGHT}
                interval={0}
                tickMargin={8}
              />
              <YAxis tick={TICK_STYLE} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15,118,110,0.04)" }} />
              <Bar dataKey="value" fill={DIMENSION_PALETTES.sales.base} radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tabbed Rankings */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Top 10 Rankings</div>
            <div className="section-sub">Select category to view</div>
          </div>
        </div>

        <TabPanel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === "ports" && renderRankList(topPort, rankColors.ports)}
          {activeTab === "carriers" && renderRankList(topCarrier, rankColors.carriers)}
          {activeTab === "countries" && renderRankList(topCountry, rankColors.countries)}
          {activeTab === "routes" && renderRankList(topTrade.slice(0, 10), rankColors.routes)}
          {activeTab === "sales" && renderSaleCards()}
        </TabPanel>
      </div>
    </div>
  );
}
