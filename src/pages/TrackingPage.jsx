import { useMemo, useState } from "react";
import DetailKpi from "../components/DetailKpi";
import { formatDate, formatNumber } from "../lib/utils";
import { buildTrackingViewModel, filterTrackingRows, getUniqueTrackingOptions } from "../lib/tracking";

const EXCEPTION_OPTIONS = [
  { value: "All", label: "All exceptions" },
  { value: "delayed", label: "Delayed" },
  { value: "stale", label: "Stale" },
  { value: "missing_data", label: "Missing data" },
  { value: "invalid_sequence", label: "Invalid sequence" },
];

const EXCEPTION_LABELS = {
  delayed: "Delayed",
  stale: "Stale",
  missing_data: "Missing data",
  invalid_sequence: "Invalid sequence",
};

export default function TrackingPage({ filteredRows, now }) {
  const [filters, setFilters] = useState({
    milestone: "All",
    exceptionType: "All",
    carrier: "All",
    trade: "All",
    sales: "All",
  });

  const model = useMemo(
    () => buildTrackingViewModel(filteredRows, now ? { now } : {}),
    [filteredRows, now],
  );
  const exceptionRows = useMemo(
    () => filterTrackingRows(model.exceptions, filters),
    [model.exceptions, filters],
  );

  const milestoneOptions = getUniqueTrackingOptions(model.rows, "currentMilestone");
  const carrierOptions = getUniqueTrackingOptions(model.rows, "carrier");
  const tradeOptions = getUniqueTrackingOptions(model.rows, "trade");
  const salesOptions = getUniqueTrackingOptions(model.rows, "saleName");

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="page-tracking">
      <div className="tracking-header">
        <div>
          <div className="section-title">Operational Tracking</div>
          <div className="section-sub">Read-only shipment milestones and exception queue</div>
        </div>
        <span className="active-badge">{formatNumber(exceptionRows.length)} active exceptions</span>
      </div>

      <div className="detail-kpi-strip">
        <DetailKpi label="Tracked Shipments" value={formatNumber(model.summary.totalShipments)} sub="In current filters" />
        <DetailKpi label="Delayed" value={formatNumber(model.summary.delayedShipments)} sub="ETA passed, no ATA" tone="#dc2626" />
        <DetailKpi label="Stale Updates" value={formatNumber(model.summary.staleShipments)} sub="No event in 7+ days" tone="#d97706" />
        <DetailKpi label="Missing Data" value={formatNumber(model.summary.missingDataShipments)} sub="Missing ETA or milestone" tone="#7c3aed" />
        <DetailKpi label="Invalid Dates" value={formatNumber(model.summary.invalidSequenceShipments)} sub="ATA/ETA sequence issue" tone="#be123c" />
        <DetailKpi label="Exceptions" value={formatNumber(model.summary.exceptionShipments)} sub="Needs review" tone="#0f766e" />
      </div>

      <div className="tracking-grid">
        <section className="tracking-panel">
          <div className="panel-title">Milestones</div>
          <div className="milestone-list">
            {model.milestoneSummary.map((item) => (
              <div className="milestone-item" key={item.name}>
                <span>{item.name}</span>
                <b>{formatNumber(item.count)}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="tracking-panel tracking-filters">
          <div className="panel-title">Exception Filters</div>
          <TrackingSelect
            label="Exception type"
            value={filters.exceptionType}
            options={EXCEPTION_OPTIONS}
            onChange={(value) => updateFilter("exceptionType", value)}
          />
          <TrackingSelect
            label="Milestone"
            value={filters.milestone}
            options={toOptions(milestoneOptions, "All milestones")}
            onChange={(value) => updateFilter("milestone", value)}
          />
          <TrackingSelect
            label="Carrier"
            value={filters.carrier}
            options={toOptions(carrierOptions, "All carriers")}
            onChange={(value) => updateFilter("carrier", value)}
          />
          <TrackingSelect
            label="Trade"
            value={filters.trade}
            options={toOptions(tradeOptions, "All trades")}
            onChange={(value) => updateFilter("trade", value)}
          />
          <TrackingSelect
            label="Sale"
            value={filters.sales}
            options={toOptions(salesOptions, "All sales")}
            onChange={(value) => updateFilter("sales", value)}
          />
        </section>
      </div>

      <section className="table-section tracking-table-section">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="table-title">Exception Queue</div>
            <div className="table-sub">{formatNumber(exceptionRows.length)} shipments need operational review</div>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Booking No</th>
                <th>Job No</th>
                <th>Milestone</th>
                <th>Exception</th>
                <th>ETA</th>
                <th>Last Event</th>
                <th>Carrier</th>
                <th>Trade</th>
                <th>Sale</th>
              </tr>
            </thead>
            <tbody>
              {exceptionRows.map((row) => (
                <tr key={row.shipmentId}>
                  <td>{row.bookingNo || "-"}</td>
                  <td>{row.jobNo || "-"}</td>
                  <td>{row.currentMilestone}</td>
                  <td>
                    <div className="exception-tags">
                      {row.exceptionTypes.map((type) => (
                        <span className={`exception-tag exception-${type}`} key={type}>
                          {EXCEPTION_LABELS[type]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{formatDate(row.eta)}</td>
                  <td>{formatDate(row.lastEventTime)}</td>
                  <td>{row.carrier}</td>
                  <td>{row.trade}</td>
                  <td>{row.saleName}</td>
                </tr>
              ))}
              {!exceptionRows.length ? (
                <tr>
                  <td colSpan={9}>No exceptions match current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TrackingSelect({ label, value, options, onChange }) {
  return (
    <label className="tracking-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toOptions(values, allLabel) {
  return [
    { value: "All", label: allLabel },
    ...values.map((value) => ({ value, label: value })),
  ];
}
