import { randomUUID } from "node:crypto";
import { getSheetsClient, requiredEnv } from "./googleSheets.js";
import { canViewAllSalesData } from "./rbac.js";
import { getWriteCacheBuster, invalidateShipmentWriteCache } from "./shipmentWriteCache.js";
import { normalizeWorkbookRow } from "./workbook.js";

const DETAIL_SHEET = process.env.DATA_SHEET_NAME || "Detail Data";

export const CRUD_HEADERS = [
  "record_id",
  "owner_user_id",
  "owner_username",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
  "is_deleted",
  "deleted_at",
  "deleted_by",
];

const FIELD_TO_COLUMN = {
  date: "Date",
  bookingNo: "Booking No",
  jobNo: "Job No",
  shipper: "Shipper",
  liner: "Liner",
  pol: "POL",
  pod: "POD",
  port: "PORT",
  destination: "Destination",
  country: "Country2",
  qty: "Qty",
  unit: "Unit",
  teu: "TEU",
  status: "Status",
  saleName: "Sale Name",
  trade: "TRADE",
  carrier: "CARRIER",
  shipmentId: "shipment_id",
  containerNo: "container_no",
  etd: "ETD",
  eta: "ETA",
  atd: "ATD",
  ata: "ATA",
  currentMilestone: "current_milestone",
  lastEventTime: "last_event_time",
  delayDays: "delay_days",
  delayReason: "delay_reason",
  onTimeFlag: "on_time_flag",
};

const RBAC_FIELDS = new Set([
  "recordId",
  "ownerUserId",
  "ownerUsername",
  "createdBy",
  "updatedBy",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
  "deletedBy",
]);

export { getWriteCacheBuster, invalidateShipmentWriteCache };

export async function ensureDetailDataSchema(requiredHeaders = CRUD_HEADERS) {
  const sheets = getSheetsClient();
  const spreadsheetId = requiredEnv("GOOGLE_SHEET_ID");
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${DETAIL_SHEET}!1:1`,
  });
  const headers = (current.data.values?.[0] || []).map((value) => `${value ?? ""}`.trim()).filter(Boolean);
  const missing = requiredHeaders.filter((header) => !headers.includes(header));

  if (!missing.length) {
    return { headers, missing: [], updated: false };
  }

  const nextHeaders = [...headers, ...missing];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${DETAIL_SHEET}!A1:${columnName(nextHeaders.length)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [nextHeaders] },
  });

  return { headers: nextHeaders, missing, updated: true };
}

export async function createShipment({ body, session }) {
  const { headers } = await ensureDetailDataSchema();
  const now = new Date().toISOString();
  const owner = resolveOwner(body, session.user);
  const raw = {
    ...toSheetRow(body),
    record_id: randomUUID(),
    owner_user_id: owner.ownerUserId,
    owner_username: owner.ownerUsername,
    created_by: session.user.id,
    updated_by: session.user.id,
    created_at: now,
    updated_at: now,
    is_deleted: "false",
    deleted_at: "",
    deleted_by: "",
  };
  const values = headers.map((header) => raw[header] ?? "");
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: requiredEnv("GOOGLE_SHEET_ID"),
    range: `${DETAIL_SHEET}!A:${columnName(headers.length)}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
  invalidateShipmentWriteCache();
  return normalizeWorkbookRow(raw);
}

export async function updateShipment(recordId, patch, { session }) {
  const sheet = await readDetailSheet();
  const match = findRow(sheet, recordId);
  const now = new Date().toISOString();
  const nextRaw = {
    ...match.raw,
    ...toSheetRow(removeRestrictedFields(patch)),
    updated_by: session.user.id,
    updated_at: now,
  };
  await updateSheetRow(sheet.headers, match.rowNumber, nextRaw);
  invalidateShipmentWriteCache();
  return normalizeWorkbookRow(nextRaw);
}

export async function softDeleteShipment(recordId, { session }) {
  const sheet = await readDetailSheet();
  const match = findRow(sheet, recordId);
  const now = new Date().toISOString();
  const nextRaw = {
    ...match.raw,
    is_deleted: "true",
    deleted_at: now,
    deleted_by: session.user.id,
    updated_by: session.user.id,
    updated_at: now,
  };
  await updateSheetRow(sheet.headers, match.rowNumber, nextRaw);
  invalidateShipmentWriteCache();
  return normalizeWorkbookRow(nextRaw);
}

export async function backfillMissingRecordIds({ dryRun = true } = {}) {
  const sheet = await readDetailSheet(["record_id"], { ensureSchema: !dryRun });
  const recordIdColumnIndex = sheet.headers.indexOf("record_id");
  if (recordIdColumnIndex === -1) {
    return {
      dryRun,
      totalRows: sheet.rows.length,
      missingRecordIds: sheet.rows.length,
      updatedRows: 0,
      recordIdColumnMissing: true,
    };
  }

  const missingRows = sheet.rows.filter(({ raw }) => !`${raw.record_id ?? ""}`.trim());
  if (!dryRun) {
    const sheets = getSheetsClient();
    const spreadsheetId = requiredEnv("GOOGLE_SHEET_ID");
    const column = columnName(recordIdColumnIndex + 1);
    if (missingRows.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: missingRows.map((row) => ({
            range: `${DETAIL_SHEET}!${column}${row.rowNumber}:${column}${row.rowNumber}`,
            values: [[randomUUID()]],
          })),
        },
      });
      invalidateShipmentWriteCache();
    }
  }

  return {
    dryRun,
    totalRows: sheet.rows.length,
    missingRecordIds: missingRows.length,
    updatedRows: dryRun ? 0 : missingRows.length,
  };
}

export function sanitizeShipmentPatch(body = {}) {
  return removeRestrictedFields(body);
}

async function readDetailSheet(requiredHeaders = CRUD_HEADERS, { ensureSchema = true } = {}) {
  const schema = ensureSchema
    ? await ensureDetailDataSchema(requiredHeaders)
    : { headers: [] };
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: requiredEnv("GOOGLE_SHEET_ID"),
    range: schema.headers.length
      ? `${DETAIL_SHEET}!A:${columnName(schema.headers.length)}`
      : `${DETAIL_SHEET}!A:ZZ`,
  });
  const rows = response.data.values || [];
  const headers = (rows[0] || schema.headers).map((header) => `${header ?? ""}`.trim());
  return {
    headers,
    rows: rows.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      raw: Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""])),
    })),
  };
}

function findRow(sheet, recordId) {
  const match = sheet.rows.find(({ raw }) => {
    const normalized = normalizeWorkbookRow(raw);
    return normalized.recordId === recordId;
  });
  if (!match) {
    const error = new Error("Shipment not found.");
    error.status = 404;
    throw error;
  }
  return match;
}

async function updateSheetRow(headers, rowNumber, raw) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: requiredEnv("GOOGLE_SHEET_ID"),
    range: `${DETAIL_SHEET}!A${rowNumber}:${columnName(headers.length)}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [headers.map((header) => raw[header] ?? "")] },
  });
}

function toSheetRow(body = {}) {
  const raw = {};
  for (const [field, column] of Object.entries(FIELD_TO_COLUMN)) {
    if (body[field] !== undefined) {
      raw[column] = formatSheetValue(body[field]);
    }
  }
  return raw;
}

function removeRestrictedFields(body = {}) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => !RBAC_FIELDS.has(key)));
}

function resolveOwner(body, user) {
  if (canViewAllSalesData(user) && (body.ownerUserId || body.ownerUsername)) {
    return {
      ownerUserId: `${body.ownerUserId || user.id}`.trim(),
      ownerUsername: `${body.ownerUsername || user.username}`.trim(),
    };
  }
  return {
    ownerUserId: user.id,
    ownerUsername: user.username,
  };
}

function formatSheetValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return value;
}

function columnName(index) {
  let result = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}
