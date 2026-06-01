const DEFAULT_STALE_DAYS = 7;

export function buildTrackingViewModel(rows = [], { now = new Date(), staleDays = DEFAULT_STALE_DAYS } = {}) {
  const enrichedRows = rows.map((row) => enrichRow(row, { now, staleDays }));
  const exceptions = enrichedRows.filter((row) => row.exceptionTypes.length > 0);

  return {
    summary: {
      totalShipments: enrichedRows.length,
      delayedShipments: exceptions.filter((row) => row.exceptionTypes.includes("delayed")).length,
      staleShipments: exceptions.filter((row) => row.exceptionTypes.includes("stale")).length,
      missingDataShipments: exceptions.filter((row) => row.exceptionTypes.includes("missing_data")).length,
      invalidSequenceShipments: exceptions.filter((row) => row.exceptionTypes.includes("invalid_sequence")).length,
      exceptionShipments: exceptions.length,
    },
    milestoneSummary: countBy(enrichedRows, "currentMilestone"),
    rows: enrichedRows,
    exceptions,
  };
}

export function filterTrackingRows(rows = [], filters = {}) {
  return rows.filter((row) => {
    if (!matchesValue(row.currentMilestone, filters.milestone)) return false;
    if (!matchesValue(row.carrier, filters.carrier)) return false;
    if (!matchesValue(row.trade, filters.trade)) return false;
    if (!matchesValue(row.saleName, filters.sales || filters.saleName)) return false;
    if (!matchesValue(row.status, filters.status)) return false;
    if (!matchesException(row, filters.exceptionType)) return false;
    return true;
  });
}

export function getUniqueTrackingOptions(rows = [], key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => `${a}`.localeCompare(`${b}`));
}

function enrichRow(row, { now, staleDays }) {
  const normalized = {
    ...row,
    shipmentId: row.shipmentId || buildFallbackShipmentId(row),
    currentMilestone: row.currentMilestone || row.status || "Unspecified",
    eta: toDate(row.eta),
    ata: toDate(row.ata),
    etd: toDate(row.etd),
    atd: toDate(row.atd),
    lastEventTime: toDate(row.lastEventTime),
    delayDays: toNumber(row.delayDays),
  };
  const exceptionTypes = getExceptionTypes(normalized, { now, staleDays });
  return {
    ...normalized,
    exceptionTypes,
    hasException: exceptionTypes.length > 0,
  };
}

function getExceptionTypes(row, { now, staleDays }) {
  const types = [];
  if (row.eta && !row.ata && row.eta.getTime() < now.getTime()) {
    types.push("delayed");
  }
  if (row.lastEventTime && !row.ata) {
    const staleMs = staleDays * 24 * 60 * 60 * 1000;
    if (now.getTime() - row.lastEventTime.getTime() > staleMs) {
      types.push("stale");
    }
  }
  if (!row.eta || !row.currentMilestone || row.currentMilestone === "Unspecified") {
    types.push("missing_data");
  }
  if ((row.etd && row.eta && row.eta < row.etd) || (row.atd && row.ata && row.ata < row.atd)) {
    types.push("invalid_sequence");
  }
  return types;
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

function buildFallbackShipmentId(row) {
  return [
    row.bookingNo || "no-booking",
    row.jobNo || "no-job",
    formatDateKey(row.date) || "no-date",
  ].join("-");
}

function formatDateKey(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
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

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeComparable(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}
