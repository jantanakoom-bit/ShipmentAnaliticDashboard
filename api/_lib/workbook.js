import { getSheetsClient, requiredEnv } from "./googleSheets.js";
import { getWriteCacheBuster } from "./shipmentWriteCache.js";

const DETAIL_SHEET = process.env.DATA_SHEET_NAME || "Detail Data";
const CACHE_MS = 45 * 1000;
const DEFAULT_MAX_ROWS = 10000;
const DEFAULT_MAX_COLUMNS = 128;

let dataCache = null;
let cachedAt = 0;
let cachedWriteCacheBuster = -1;

export function resolveWorkbookPath() {
  return `Google Sheets: ${DETAIL_SHEET}`;
}

export async function loadWorkbookData() {
  const currentWriteCacheBuster = getWriteCacheBuster();
  if (
    dataCache &&
    cachedWriteCacheBuster === currentWriteCacheBuster &&
    Date.now() - cachedAt < CACHE_MS
  ) {
    return dataCache;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = requiredEnv("GOOGLE_SHEET_ID");
  const range = buildBoundedSheetRange(DETAIL_SHEET);

  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = validateSheetBounds(response.data.values || []);

  if (rows.length < 2) {
    throw new Error(`Sheet "${DETAIL_SHEET}" is empty or has no data rows.`);
  }

  const headers = rows[0].map((h) => `${h}`.trim());
  const detailRows = rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );
  const detailData = detailRows.map(normalizeWorkbookRow);
  const columns = headers;

  dataCache = {
    detailData,
    metadata: {
      source: `Google Sheets: ${DETAIL_SHEET}`,
      sizeBytes: null,
      modifiedAt: new Date().toISOString(),
      sheets: [DETAIL_SHEET],
      columns,
      shipments: detailData.length,
      dateRange: getDateRange(detailData),
      filters: buildFilterOptions(detailData),
    },
  };
  cachedAt = Date.now();
  cachedWriteCacheBuster = currentWriteCacheBuster;

  return dataCache;
}

export function serializeWorkbookData(data) {
  return {
    ...data,
    detailData: data.detailData.map(serializeRow),
  };
}

export function buildWorkbookResponse(detailData, metadata = {}) {
  const rows = detailData.filter((row) => !row.isDeleted);
  return {
    detailData: rows,
    metadata: {
      ...metadata,
      shipments: rows.length,
      dateRange: getDateRange(rows),
      filters: buildFilterOptions(rows),
    },
  };
}

export function filterRows(rows, query) {
  return rows.filter((row) => {
    if (query.year && query.year !== "All" && `${row.year}` !== `${query.year}`) return false;
    if (query.quarter && query.quarter !== "All" && row.quarter !== query.quarter) return false;
    if (query.month && query.month !== "All" && row.monthLabel !== query.month) return false;
    if (query.trade && query.trade !== "All" && row.trade !== query.trade) return false;
    if (query.carrier && query.carrier !== "All" && row.carrier !== query.carrier) return false;
    if (query.shipper && query.shipper !== "All" && row.shipper !== query.shipper) return false;
    if (query.status && query.status !== "All" && row.status !== query.status) return false;
    if (query.sales && query.sales !== "All" && row.saleName !== query.sales) return false;
    return true;
  });
}

export function buildAnalytics(rows, grain) {
  const shipments = rows.length;
  const totalTeu = sumBy(rows, "teu");
  const totalQty = sumBy(rows, "qty");
  const timeSeries = buildTimeSeries(rows, grain);
  const latestPeriod = timeSeries.at(-1) || null;
  const previousPeriod = timeSeries.length > 1 ? timeSeries.at(-2) : null;

  return {
    filteredCount: rows.length,
    summary: {
      shipments,
      totalTeu,
      totalQty,
      uniqueShippers: new Set(rows.map((row) => row.shipper)).size,
      activeRoutes: new Set(rows.map((row) => row.route)).size,
      averageTeuPerShipment: shipments ? totalTeu / shipments : 0,
      latestPeriodLabel: latestPeriod?.label || "N/A",
      shipmentChangePct: calculateChange(latestPeriod, previousPeriod, "shipments"),
      teuChangePct: calculateChange(latestPeriod, previousPeriod, "teu"),
    },
    timeSeries,
    topTrades: aggregateBy(rows, "trade", "teu").slice(0, 6),
    topCarriers: aggregateBy(rows, "carrier", "teu").slice(0, 8),
    topDestinations: aggregateBy(rows, "destination", "teu").slice(0, 8),
    topShippers: aggregateBy(rows, "shipper", "teu").slice(0, 8),
    statusBreakdown: aggregateCount(rows, "status"),
    routeRanking: aggregateBy(rows, "route", "teu").slice(0, 8),
    detailRows: [...rows]
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, 20)
      .map(serializeRow),
  };
}

export function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(num)));
}

export function buildBoundedSheetRange(sheetName, { maxRows = getWorkbookMaxRows(), maxColumns = getWorkbookMaxColumns() } = {}) {
  return `${sheetName}!A1:${columnName(maxColumns + 1)}${maxRows + 2}`;
}

export function validateSheetBounds(rows, { maxRows = getWorkbookMaxRows(), maxColumns = getWorkbookMaxColumns() } = {}) {
  if (rows.length > maxRows + 1) {
    throwWorkbookLimitError(`Workbook row limit exceeded. Maximum data rows: ${maxRows}.`);
  }

  if (rows.some((row) => row.length > maxColumns)) {
    throwWorkbookLimitError(`Workbook column limit exceeded. Maximum columns: ${maxColumns}.`);
  }

  return rows;
}

export function columnName(index) {
  let result = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function getWorkbookMaxRows() {
  return getEnvNumber("WORKBOOK_MAX_ROWS", DEFAULT_MAX_ROWS);
}

function getWorkbookMaxColumns() {
  return getEnvNumber("WORKBOOK_MAX_COLUMNS", DEFAULT_MAX_COLUMNS);
}

function getEnvNumber(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function throwWorkbookLimitError(message) {
  const error = new Error(message);
  error.status = 413;
  throw error;
}

export function normalizeWorkbookRow(row) {
  const date = toExcelDate(row.Date);
  const monthNumber = date ? date.getUTCMonth() + 1 : toNumber(row.MONTH);
  const year = date ? date.getUTCFullYear() : null;
  const quarter = getQuarter(monthNumber);
  const destination = text(row.Destination ?? row.PORT, "Unknown");
  const pol = text(row.POL, "Unknown");
  const status = text(row.Status, "Unspecified");

  return {
    date,
    monthLabel: formatMonth(date),
    year,
    quarter,
    yearQuarter: year ? `${year} ${quarter}` : "Unknown",
    monthNumber,
    monthName: date ? new Intl.DateTimeFormat("en", { month: "long" }).format(date) : "Unknown",
    yearMonth: date ? `${year}-${String(monthNumber).padStart(2, "0")}` : "Unknown",
    bookingNo: text(row["Booking No"]),
    jobNo: text(row["Job No"]),
    shipper: text(row.Shipper, "Unknown"),
    liner: text(row.Liner, "Unknown"),
    pol,
    pod: text(row.POD, "Unknown"),
    country: text(row.Country2 ?? row.COUNTRY, "Unknown"),
    port: text(row.PORT ?? row.Destination, "Unknown"),
    destination,
    qty: toNumber(row.Qty),
    unit: text(row.Unit, "Unknown"),
    teu: toNumber(row.TEU),
    status,
    saleName: text(row["Sale Name"], "Unknown"),
    trade: text(row.TRADE, "Unknown"),
    carrier: text(row.CARRIER, "Unknown"),
    route: `${pol} -> ${destination}`,
    shipmentId: text(firstValue(row, ["shipment_id", "Shipment ID", "Shipment Id", "shipmentId"])),
    containerNo: text(firstValue(row, ["container_no", "Container No", "Container No.", "containerNo"])),
    etd: toExcelDate(firstValue(row, ["ETD", "etd"])),
    eta: toExcelDate(firstValue(row, ["ETA", "eta"])),
    atd: toExcelDate(firstValue(row, ["ATD", "atd"])),
    ata: toExcelDate(firstValue(row, ["ATA", "ata"])),
    currentMilestone: text(firstValue(row, ["current_milestone", "Current Milestone", "currentMilestone"]), status),
    lastEventTime: toExcelDate(firstValue(row, ["last_event_time", "Last Event Time", "lastEventTime"])),
    delayDays: toNumber(firstValue(row, ["delay_days", "Delay Days", "delayDays"])),
    delayReason: text(firstValue(row, ["delay_reason", "Delay Reason", "delayReason"])),
    onTimeFlag: text(firstValue(row, ["on_time_flag", "On Time Flag", "onTimeFlag"])),
    exceptionStatus: text(firstValue(row, ["exception_status", "Exception Status", "exceptionStatus"])),
    exceptionPriority: text(firstValue(row, ["exception_priority", "Exception Priority", "exceptionPriority"])),
    exceptionOwnerUserId: text(firstValue(row, ["exception_owner_user_id", "Exception Owner User ID", "exceptionOwnerUserId"])),
    exceptionOwnerUsername: text(firstValue(row, ["exception_owner_username", "Exception Owner Username", "exceptionOwnerUsername"])),
    exceptionNextAction: text(firstValue(row, ["exception_next_action", "Exception Next Action", "exceptionNextAction"])),
    exceptionDueAt: text(firstValue(row, ["exception_due_at", "Exception Due At", "exceptionDueAt"])),
    exceptionNote: text(firstValue(row, ["exception_note", "Exception Note", "exceptionNote"])),
    exceptionUpdatedBy: text(firstValue(row, ["exception_updated_by", "Exception Updated By", "exceptionUpdatedBy"])),
    exceptionUpdatedAt: text(firstValue(row, ["exception_updated_at", "Exception Updated At", "exceptionUpdatedAt"])),
    exceptionResolvedBy: text(firstValue(row, ["exception_resolved_by", "Exception Resolved By", "exceptionResolvedBy"])),
    exceptionResolvedAt: text(firstValue(row, ["exception_resolved_at", "Exception Resolved At", "exceptionResolvedAt"])),
    recordId: text(firstValue(row, ["record_id", "Record ID", "recordId"])) || text(firstValue(row, ["shipment_id", "Shipment ID", "Shipment Id", "shipmentId"])),
    ownerUserId: text(firstValue(row, ["owner_user_id", "Owner User ID", "ownerUserId"])),
    ownerUsername: text(firstValue(row, ["owner_username", "Owner Username", "ownerUsername"])),
    createdBy: text(firstValue(row, ["created_by", "Created By", "createdBy"])),
    updatedBy: text(firstValue(row, ["updated_by", "Updated By", "updatedBy"])),
    createdAt: text(firstValue(row, ["created_at", "Created At", "createdAt"])),
    updatedAt: text(firstValue(row, ["updated_at", "Updated At", "updatedAt"])),
    isDeleted: toBoolean(firstValue(row, ["is_deleted", "Is Deleted", "isDeleted"])),
    deletedAt: text(firstValue(row, ["deleted_at", "Deleted At", "deletedAt"])),
    deletedBy: text(firstValue(row, ["deleted_by", "Deleted By", "deletedBy"])),
  };
}

function buildTimeSeries(rows, grain) {
  const map = new Map();

  for (const row of rows) {
    const key = grain === "year" ? `${row.year}` : grain === "quarter" ? row.yearQuarter : row.yearMonth;

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: formatPeriodLabel(row, grain),
        teu: 0,
        shipments: 0,
        qty: 0,
      });
    }

    const entry = map.get(key);
    entry.teu += row.teu;
    entry.shipments += 1;
    entry.qty += row.qty;
  }

  return [...map.values()].sort((a, b) => `${a.key}`.localeCompare(`${b.key}`));
}

function buildFilterOptions(rows) {
  const monthMap = new Map();

  for (const row of rows) {
    if (row.yearMonth !== "Unknown" && row.monthLabel !== "Unknown") {
      monthMap.set(row.yearMonth, row.monthLabel);
    }
  }

  return {
    years: uniqueSorted(rows.map((row) => row.year)).filter((item) => item !== "null"),
    quarters: uniqueSorted(rows.map((row) => row.quarter)).filter((item) => item !== "Unknown"),
    months: [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((entry) => entry[1]),
    trades: uniqueSorted(rows.map((row) => row.trade)),
    carriers: uniqueSorted(rows.map((row) => row.carrier)),
    shippers: uniqueSorted(rows.map((row) => row.shipper)),
    statuses: uniqueSorted(rows.map((row) => row.status)),
  };
}

function aggregateBy(rows, key, valueKey) {
  const map = new Map();

  for (const row of rows) {
    const label = row[key] || "Unknown";
    map.set(label, (map.get(label) || 0) + (row[valueKey] || 0));
  }

  return sortByValue([...map.entries()].map(([name, value]) => ({ name, value })));
}

function aggregateCount(rows, key) {
  const map = new Map();

  for (const row of rows) {
    const label = row[key] || "Unknown";
    map.set(label, (map.get(label) || 0) + 1);
  }

  return sortByValue([...map.entries()].map(([name, value]) => ({ name, value })));
}

function getDateRange(rows) {
  const timestamps = rows
    .map((row) => row.date?.getTime())
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((a, b) => a - b);

  return {
    min: timestamps.length ? new Date(timestamps[0]).toISOString() : null,
    max: timestamps.length ? new Date(timestamps.at(-1)).toISOString() : null,
  };
}

export function serializeRow(row) {
  return {
    ...row,
    date: row.date ? row.date.toISOString() : null,
  };
}

function formatPeriodLabel(row, grain) {
  if (grain === "year") return `${row.year ?? "Unknown"}`;
  if (grain === "quarter") return row.year ? `${row.year} ${row.quarter}` : "Unknown";
  return row.monthLabel;
}

function calculateChange(current, previous, field) {
  if (!current || !previous || !previous[field]) return null;
  return ((current[field] - previous[field]) / previous[field]) * 100;
}

function uniqueSorted(items) {
  return [...new Set(items.filter((item) => item !== null && item !== undefined && item !== ""))]
    .map((item) => `${item}`)
    .sort((a, b) => a.localeCompare(b));
}

function sortByValue(items) {
  return items.sort((a, b) => b.value - a.value);
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + (row[key] || 0), 0);
}

function text(value, fallback = "") {
  return `${value ?? ""}`.trim() || fallback;
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && `${row[key]}`.trim() !== "") {
      return row[key];
    }
  }
  return "";
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toBoolean(value) {
  return ["true", "yes", "1"].includes(`${value ?? ""}`.trim().toLowerCase());
}

function toExcelDate(value) {
  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    return new Date(utcDays * 86400 * 1000);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function formatMonth(dateValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(dateValue);
}

function getQuarter(month) {
  if (!month || month < 1 || month > 12) return "Unknown";
  return `Q${Math.ceil(month / 3)}`;
}
