import { useMemo, useState } from "react";
import DetailKpi from "../components/DetailKpi";
import { apiRequest } from "../lib/api";
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

const ACTION_STATUS_OPTIONS = [
  { value: "All", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
];

const PRIORITY_OPTIONS = [
  { value: "All", label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const DUE_STATE_OPTIONS = [
  { value: "All", label: "All due states" },
  { value: "overdue", label: "Overdue" },
  { value: "unassigned", label: "Unassigned" },
  { value: "assigned", label: "Assigned" },
];

export default function TrackingPage({ filteredRows, now, onDataRefresh }) {
  const [filters, setFilters] = useState({
    milestone: "All",
    exceptionType: "All",
    carrier: "All",
    trade: "All",
    sales: "All",
    actionStatus: "All",
    priority: "All",
    actionOwner: "All",
    dueState: "All",
  });
  const [actionRow, setActionRow] = useState(null);
  const [actionForm, setActionForm] = useState(emptyActionForm());
  const [actionOverrides, setActionOverrides] = useState({});
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState("");

  const workflowRows = useMemo(
    () => filteredRows.map((row) => (row.recordId && actionOverrides[row.recordId] ? { ...row, ...actionOverrides[row.recordId] } : row)),
    [filteredRows, actionOverrides],
  );

  const model = useMemo(
    () => buildTrackingViewModel(workflowRows, now ? { now } : {}),
    [workflowRows, now],
  );
  const exceptionRows = useMemo(
    () => filterTrackingRows(model.exceptions, filters),
    [model.exceptions, filters],
  );

  const milestoneOptions = getUniqueTrackingOptions(model.rows, "currentMilestone");
  const carrierOptions = getUniqueTrackingOptions(model.rows, "carrier");
  const tradeOptions = getUniqueTrackingOptions(model.rows, "trade");
  const salesOptions = getUniqueTrackingOptions(model.rows, "saleName");
  const ownerOptions = getUniqueTrackingOptions(model.rows, "exceptionOwnerUsername");

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openAction(row) {
    setActionRow(row);
    setActionForm({
      actionStatus: row.exceptionStatus || "open",
      priority: row.exceptionPriority || "normal",
      ownerUserId: row.exceptionOwnerUserId || "",
      ownerUsername: row.exceptionOwnerUsername || "",
      nextAction: row.exceptionNextAction || "",
      dueAt: row.exceptionDueAt || "",
      note: row.exceptionNote || "",
    });
    setActionError("");
  }

  async function saveAction(event) {
    event.preventDefault();
    if (!actionRow?.recordId) return;
    setSavingAction(true);
    setActionError("");
    try {
      const response = await apiRequest(`/api/tracking/exceptions/${encodeURIComponent(actionRow.recordId)}`, {
        method: "PATCH",
        body: JSON.stringify(actionForm),
      });
      if (response?.row?.recordId) {
        setActionOverrides((current) => ({ ...current, [response.row.recordId]: response.row }));
      }
      setActionRow(null);
      onDataRefresh?.();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setSavingAction(false);
    }
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
        <DetailKpi label="Open Actions" value={formatNumber(model.summary.openActionShipments)} sub="Not resolved" tone="#2563eb" />
        <DetailKpi label="Unassigned" value={formatNumber(model.summary.unassignedActionShipments)} sub="No owner" tone="#9333ea" />
        <DetailKpi label="Overdue" value={formatNumber(model.summary.overdueActionShipments)} sub="Due date passed" tone="#b91c1c" />
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
          <TrackingSelect
            label="Action status"
            value={filters.actionStatus}
            options={ACTION_STATUS_OPTIONS}
            onChange={(value) => updateFilter("actionStatus", value)}
          />
          <TrackingSelect
            label="Priority"
            value={filters.priority}
            options={PRIORITY_OPTIONS}
            onChange={(value) => updateFilter("priority", value)}
          />
          <TrackingSelect
            label="Action owner"
            value={filters.actionOwner}
            options={toOptions(ownerOptions, "All owners")}
            onChange={(value) => updateFilter("actionOwner", value)}
          />
          <TrackingSelect
            label="Due state"
            value={filters.dueState}
            options={DUE_STATE_OPTIONS}
            onChange={(value) => updateFilter("dueState", value)}
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
                <th>Action</th>
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
                  <td>
                    <div className="tracking-action-cell">
                      <span className={`action-status action-${row.exceptionStatus}`}>
                        {formatActionLabel(row.exceptionStatus)}
                      </span>
                      {row.exceptionPriority ? <span className={`priority-chip priority-${row.exceptionPriority}`}>{row.exceptionPriority}</span> : null}
                      {row.exceptionOwnerUsername ? <span className="owner-chip">{row.exceptionOwnerUsername}</span> : <span className="owner-chip muted">Unassigned</span>}
                      <button
                        type="button"
                        className="btn-sm"
                        disabled={!row.recordId}
                        onClick={() => openAction(row)}
                        aria-label={`Update action for ${row.bookingNo || row.recordId || "shipment"}`}
                      >
                        Action
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!exceptionRows.length ? (
                <tr>
                  <td colSpan={10}>No exceptions match current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {actionRow ? (
        <div className="modal-backdrop" role="presentation">
          <section className="shipment-dialog action-dialog" role="dialog" aria-modal="true" aria-label={`Exception action for ${actionRow.bookingNo || actionRow.recordId}`}>
            <form onSubmit={saveAction}>
              <div className="modal-head">
                <div>
                  <div className="top-title">Exception Action</div>
                  <div className="admin-sub">{actionRow.bookingNo || actionRow.recordId}</div>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setActionRow(null)}>Close</button>
              </div>

              <div className="shipment-form-grid">
                <label>
                  <span>Action status</span>
                  <select
                    value={actionForm.actionStatus}
                    onChange={(event) => setActionForm((current) => ({ ...current, actionStatus: event.target.value }))}
                    aria-label="Action status"
                  >
                    {ACTION_STATUS_OPTIONS.filter((option) => option.value !== "All").map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select
                    value={actionForm.priority}
                    onChange={(event) => setActionForm((current) => ({ ...current, priority: event.target.value }))}
                    aria-label="Priority"
                  >
                    {PRIORITY_OPTIONS.filter((option) => option.value !== "All").map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Owner username</span>
                  <input
                    value={actionForm.ownerUsername}
                    onChange={(event) => setActionForm((current) => ({ ...current, ownerUsername: event.target.value }))}
                    aria-label="Owner username"
                  />
                </label>
                <label>
                  <span>Owner user ID</span>
                  <input
                    value={actionForm.ownerUserId}
                    onChange={(event) => setActionForm((current) => ({ ...current, ownerUserId: event.target.value }))}
                    aria-label="Owner user ID"
                  />
                </label>
                <label>
                  <span>Due date</span>
                  <input
                    type="date"
                    value={actionForm.dueAt}
                    onChange={(event) => setActionForm((current) => ({ ...current, dueAt: event.target.value }))}
                    aria-label="Due date"
                  />
                </label>
                <label>
                  <span>Next action</span>
                  <input
                    value={actionForm.nextAction}
                    onChange={(event) => setActionForm((current) => ({ ...current, nextAction: event.target.value }))}
                    aria-label="Next action"
                  />
                </label>
                <label className="full-span">
                  <span>Note</span>
                  <textarea
                    value={actionForm.note}
                    onChange={(event) => setActionForm((current) => ({ ...current, note: event.target.value }))}
                    aria-label="Note"
                    rows={3}
                  />
                </label>
              </div>

              {actionError ? <div className="form-error">{actionError}</div> : null}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setActionRow(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingAction || !actionRow.recordId}>
                  {savingAction ? "Saving..." : "Save Action"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
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

function emptyActionForm() {
  return {
    actionStatus: "open",
    priority: "normal",
    ownerUserId: "",
    ownerUsername: "",
    nextAction: "",
    dueAt: "",
    note: "",
  };
}

function formatActionLabel(value) {
  return `${value || "open"}`.replace("_", " ");
}
