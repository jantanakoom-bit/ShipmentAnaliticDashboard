import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DETAIL_SHEET = "Detail Data";
const WORKBOOK_CANDIDATES = [
  path.join(ROOT_DIR, "public", "data", "Detail_Report_Format.xlsx"),
  path.join(ROOT_DIR, "Detail_Report_Format.xlsx"),
];

let workbookCache = null;

export function resolveWorkbookPath() {
  return WORKBOOK_CANDIDATES.find((candidate) => fs.existsSync(candidate));
}

export function loadWorkbookData() {
  const source = resolveWorkbookPath();

  if (!source) {
    throw new Error("Workbook not found. Expected public/data/Detail_Report_Format.xlsx or Detail_Report_Format.xlsx.");
  }

  const stats = fs.statSync(source);
  if (workbookCache?.source === source && workbookCache?.mtimeMs === stats.mtimeMs) {
    return workbookCache.data;
  }

  const workbook = XLSX.read(fs.readFileSync(source), { type: "buffer" });
  if (!workbook.Sheets[DETAIL_SHEET]) {
    throw new Error(`Workbook is missing required sheet: ${DETAIL_SHEET}`);
  }

  const detailSheet = workbook.Sheets[DETAIL_SHEET];
  const headerRows = XLSX.utils.sheet_to_json(detailSheet, { raw: true, header: 1 });
  const detailRows = XLSX.utils.sheet_to_json(detailSheet, { raw: true });
  const detailData = detailRows.map(normalizeRow);
  const columns = (headerRows[0] || []).map((column) => `${column}`);

  const data = {
    detailData,
    metadata: {
      source: path.relative(ROOT_DIR, source),
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      sheets: workbook.SheetNames,
      columns,
      shipments: detailData.length,
      dateRange: getDateRange(detailData),
      filters: buildFilterOptions(detailData),
    },
  };

  workbookCache = {
    source,
    mtimeMs: stats.mtimeMs,
    data,
  };

  return data;
}

export function serializeWorkbookData(data) {
  return {
    ...data,
    detailData: data.detailData.map(serializeRow),
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

function normalizeRow(row) {
  const date = toExcelDate(row.Date);
  const monthNumber = date ? date.getUTCMonth() + 1 : toNumber(row.MONTH);
  const year = date ? date.getUTCFullYear() : null;
  const quarter = getQuarter(monthNumber);
  const destination = text(row.Destination ?? row.PORT, "Unknown");
  const pol = text(row.POL, "Unknown");

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
    status: text(row.Status, "Unspecified"),
    saleName: text(row["Sale Name"], "Unknown"),
    trade: text(row.TRADE, "Unknown"),
    carrier: text(row.CARRIER, "Unknown"),
    route: `${pol} -> ${destination}`,
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

function serializeRow(row) {
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

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toExcelDate(value) {
  if (typeof value !== "number") return null;
  const utcDays = Math.floor(value - 25569);
  return new Date(utcDays * 86400 * 1000);
}

function formatMonth(dateValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(dateValue);
}

function getQuarter(month) {
  if (!month || month < 1 || month > 12) return "Unknown";
  return `Q${Math.ceil(month / 3)}`;
}
