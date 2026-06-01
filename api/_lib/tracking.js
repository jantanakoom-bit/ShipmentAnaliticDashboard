const DEFAULT_STALE_DAYS = 7;
const ACTION_STATUSES = new Set(["open", "in_progress", "waiting", "resolved"]);
const ACTION_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

export function normalizeTrackingFields(row = {}) {
  const eta = toDate(row.eta);
  const ata = toDate(row.ata);
  const etd = toDate(row.etd);
  const atd = toDate(row.atd);
  const lastEventTime = toDate(row.lastEventTime);
  const shipmentId = text(row.shipmentId) || buildFallbackShipmentId(row);

  return {
    ...row,
    shipmentId,
    containerNo: text(row.containerNo),
    etd,
    eta,
    atd,
    ata,
    currentMilestone: text(row.currentMilestone) || text(row.status) || "Unspecified",
    lastEventTime,
    delayDays: toNumber(row.delayDays),
    delayReason: text(row.delayReason),
    onTimeFlag: text(row.onTimeFlag),
    exceptionStatus: normalizeActionStatus(row.exceptionStatus),
    exceptionPriority: normalizeActionPriority(row.exceptionPriority),
    exceptionOwnerUserId: text(row.exceptionOwnerUserId),
    exceptionOwnerUsername: text(row.exceptionOwnerUsername),
    exceptionNextAction: text(row.exceptionNextAction),
    exceptionDueAt: text(row.exceptionDueAt),
    exceptionNote: text(row.exceptionNote),
    exceptionUpdatedBy: text(row.exceptionUpdatedBy),
    exceptionUpdatedAt: text(row.exceptionUpdatedAt),
    exceptionResolvedBy: text(row.exceptionResolvedBy),
    exceptionResolvedAt: text(row.exceptionResolvedAt),
  };
}

export function buildTrackingModel(rows = [], { now = new Date(), staleDays = DEFAULT_STALE_DAYS } = {}) {
  const normalizedRows = rows.map((row) => enrichTrackingRow(normalizeTrackingFields(row), { now, staleDays }));
  const exceptions = normalizedRows.filter((row) => row.exceptionTypes.length > 0);
  const milestoneSummary = countBy(normalizedRows, "currentMilestone");
  const exceptionSummary = countExceptions(exceptions);
  const openActionRows = exceptions.filter((row) => row.isExceptionActionOpen);

  return {
    summary: {
      totalShipments: normalizedRows.length,
      delayedShipments: exceptionSummary.delayed || 0,
      staleShipments: exceptionSummary.stale || 0,
      missingDataShipments: exceptionSummary.missing_data || 0,
      invalidSequenceShipments: exceptionSummary.invalid_sequence || 0,
      exceptionShipments: exceptions.length,
      openActionShipments: openActionRows.length,
      unassignedActionShipments: openActionRows.filter((row) => !row.isExceptionActionAssigned).length,
      overdueActionShipments: openActionRows.filter((row) => row.isExceptionActionOverdue).length,
    },
    milestoneSummary,
    exceptionSummary,
    rows: normalizedRows,
    exceptions,
    generatedAt: now.toISOString(),
  };
}

export function filterTrackingRows(rows = [], query = {}) {
  return rows.filter((row) => {
    if (!matchesValue(row.currentMilestone, query.milestone)) return false;
    if (!matchesValue(row.carrier, query.carrier)) return false;
    if (!matchesValue(row.trade, query.trade)) return false;
    if (!matchesValue(row.saleName, query.sales || query.saleName)) return false;
    if (!matchesValue(row.status, query.status)) return false;
    if (!matchesValue(row.exceptionStatus, query.actionStatus)) return false;
    if (!matchesValue(row.exceptionPriority, query.priority)) return false;
    if (!matchesValue(row.exceptionOwnerUsername || row.exceptionOwnerUserId, query.actionOwner)) return false;
    if (!matchesDueState(row, query.dueState)) return false;
    if (!matchesException(row, query.exceptionType)) return false;
    return true;
  });
}

export function serializeTrackingRow(row) {
  return {
    ...row,
    date: serializeDate(row.date),
    etd: serializeDate(row.etd),
    eta: serializeDate(row.eta),
    atd: serializeDate(row.atd),
    ata: serializeDate(row.ata),
    lastEventTime: serializeDate(row.lastEventTime),
  };
}

function enrichTrackingRow(row, { now, staleDays }) {
  const exceptionTypes = getExceptionTypes(row, { now, staleDays });
  const isExceptionActionOpen = exceptionTypes.length > 0 && row.exceptionStatus !== "resolved";
  const isExceptionActionAssigned = Boolean(row.exceptionOwnerUserId || row.exceptionOwnerUsername);
  const isExceptionActionOverdue = isExceptionActionOpen && isPastDue(row.exceptionDueAt, now);
  return {
    ...row,
    exceptionTypes,
    hasException: exceptionTypes.length > 0,
    isExceptionActionOpen,
    isExceptionActionAssigned,
    isExceptionActionOverdue,
  };
}

function getExceptionTypes(row, { now, staleDays }) {
  const types = [];

  if (isDelayed(row, now)) {
    types.push("delayed");
  }
  if (isStale(row, now, staleDays)) {
    types.push("stale");
  }
  if (isMissingOperationalData(row)) {
    types.push("missing_data");
  }
  if (hasInvalidDateSequence(row)) {
    types.push("invalid_sequence");
  }

  return types;
}

function isDelayed(row, now) {
  if (row.ata || !row.eta) {
    return false;
  }
  return row.eta.getTime() < now.getTime();
}

function isStale(row, now, staleDays) {
  if (!row.lastEventTime || row.ata) {
    return false;
  }
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  return now.getTime() - row.lastEventTime.getTime() > staleMs;
}

function isMissingOperationalData(row) {
  return !row.eta || !row.currentMilestone || row.currentMilestone === "Unspecified";
}

function hasInvalidDateSequence(row) {
  if (row.etd && row.eta && row.eta.getTime() < row.etd.getTime()) {
    return true;
  }
  if (row.atd && row.ata && row.ata.getTime() < row.atd.getTime()) {
    return true;
  }
  return false;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] || "Unspecified";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function countExceptions(rows) {
  return rows.reduce((acc, row) => {
    for (const type of row.exceptionTypes) {
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {});
}

function matchesValue(actual, expected) {
  if (!expected || expected === "All") {
    return true;
  }
  return normalizeComparable(actual) === normalizeComparable(expected);
}

function matchesException(row, expected) {
  if (!expected || expected === "All") {
    return true;
  }
  return row.exceptionTypes.includes(expected);
}

function matchesDueState(row, expected) {
  if (!expected || expected === "All") {
    return true;
  }
  if (expected === "overdue") {
    return row.isExceptionActionOverdue;
  }
  if (expected === "unassigned") {
    return row.isExceptionActionOpen && !row.isExceptionActionAssigned;
  }
  if (expected === "assigned") {
    return row.isExceptionActionAssigned;
  }
  return true;
}

function buildFallbackShipmentId(row) {
  const parts = [
    text(row.bookingNo) || "no-booking",
    text(row.jobNo) || "no-job",
    formatDateKey(row.date) || "no-date",
  ];
  return parts.join("-");
}

function formatDateKey(value) {
  const date = toDate(value);
  if (!date) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function toDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function isPastDue(value, now) {
  const dueAt = toDate(value);
  if (!dueAt) {
    return false;
  }
  return dueAt.getTime() < startOfDay(now).getTime();
}

function startOfDay(value) {
  const date = toDate(value) || new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function serializeDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function text(value) {
  return `${value ?? ""}`.trim();
}

function normalizeActionStatus(value) {
  const normalized = text(value).toLowerCase();
  return ACTION_STATUSES.has(normalized) ? normalized : "open";
}

function normalizeActionPriority(value) {
  const normalized = text(value).toLowerCase();
  return ACTION_PRIORITIES.has(normalized) ? normalized : "normal";
}

function normalizeComparable(value) {
  return text(value).toLowerCase();
}
