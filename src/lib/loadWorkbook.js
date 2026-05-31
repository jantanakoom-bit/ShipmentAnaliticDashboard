import * as XLSX from "xlsx";
import { apiRequest } from "./api";

const WORKBOOK_PATH = "/data/Detail_Report_Format.xlsx";
const DETAIL_SHEET = "Detail Data";

function normalizeWorkbook(workbook, source = WORKBOOK_PATH) {
  const detailData = XLSX.utils.sheet_to_json(workbook.Sheets[DETAIL_SHEET], {
    raw: true,
  }).map(normalizeRow);

  const tradeLookup = workbook.Sheets.Trade
    ? XLSX.utils.sheet_to_json(workbook.Sheets.Trade, { raw: true })
    : [];

  const carrierLookup = workbook.Sheets.Carrier
    ? XLSX.utils.sheet_to_json(workbook.Sheets.Carrier, { raw: true })
    : [];

  return {
    detailData,
    tradeLookup,
    carrierLookup,
    metadata: {
      source,
      shipments: detailData.length,
    },
  };
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toExcelDate(value) {
  if (typeof value !== "number") {
    return null;
  }

  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function formatMonth(dateValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(dateValue);
}

function getQuarter(month) {
  if (!month || month < 1 || month > 12) {
    return "Unknown";
  }

  return `Q${Math.ceil(month / 3)}`;
}

function normalizeRow(row) {
  const shipmentDate = toExcelDate(row.Date);
  const teu = toNumber(row.TEU);
  const qty = toNumber(row.Qty);
  const status = `${row.Status ?? ""}`.trim() || "Unspecified";
  const monthNumber = shipmentDate ? shipmentDate.getUTCMonth() + 1 : toNumber(row.MONTH);
  const year = shipmentDate ? shipmentDate.getUTCFullYear() : null;
  const quarter = getQuarter(monthNumber);
  const route = `${`${row.POL ?? ""}`.trim() || "Unknown"} -> ${`${row.Destination ?? row.PORT ?? ""}`.trim() || "Unknown"}`;
  const port = `${row.PORT ?? row.Destination ?? ""}`.trim() || "Unknown";

  return {
    date: shipmentDate,
    monthLabel: formatMonth(shipmentDate),
    year,
    quarter,
    yearQuarter: year ? `${year} ${quarter}` : "Unknown",
    monthNumber,
    monthName: shipmentDate
      ? new Intl.DateTimeFormat("en", { month: "long" }).format(shipmentDate)
      : "Unknown",
    yearMonth: shipmentDate
      ? `${shipmentDate.getUTCFullYear()}-${String(shipmentDate.getUTCMonth() + 1).padStart(2, "0")}`
      : "Unknown",
    bookingNo: `${row["Booking No"] ?? ""}`.trim(),
    jobNo: `${row["Job No"] ?? ""}`.trim(),
    shipper: `${row.Shipper ?? ""}`.trim() || "Unknown",
    liner: `${row.Liner ?? ""}`.trim() || "Unknown",
    pol: `${row.POL ?? ""}`.trim() || "Unknown",
    pod: `${row.POD ?? ""}`.trim() || "Unknown",
    country: `${row.Country2 ?? row.COUNTRY ?? ""}`.trim() || "Unknown",
    port,
    destination: `${row.Destination ?? row.PORT ?? ""}`.trim() || "Unknown",
    qty,
    unit: `${row.Unit ?? ""}`.trim() || "Unknown",
    teu,
    status,
    saleName: `${row["Sale Name"] ?? ""}`.trim() || "Unknown",
    trade: `${row.TRADE ?? ""}`.trim() || "Unknown",
    carrier: `${row.CARRIER ?? ""}`.trim() || "Unknown",
    route,
  };
}

export async function loadWorkbookData() {
  const data = await apiRequest("/api/workbook");
  return {
    ...data,
    detailData: data.detailData.map((row) => ({
      ...row,
      date: row.date ? new Date(row.date) : null,
    })),
  };
}

export async function loadWorkbookFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return normalizeWorkbook(workbook, file.name);
}
