import { getSheetsClient, requiredEnv } from "./googleSheets.js";
import { invalidateShipmentWriteCache } from "./shipmentWriteCache.js";
import { columnName, normalizeWorkbookRow, validateSheetBounds } from "./workbook.js";

const DETAIL_SHEET = process.env.DATA_SHEET_NAME || "Detail Data";

export const EXCEPTION_WORKFLOW_HEADERS = [
  "exception_status",
  "exception_priority",
  "exception_owner_user_id",
  "exception_owner_username",
  "exception_next_action",
  "exception_due_at",
  "exception_note",
  "exception_updated_by",
  "exception_updated_at",
  "exception_resolved_by",
  "exception_resolved_at",
];

const FIELD_TO_COLUMN = {
  exceptionStatus: "exception_status",
  exceptionPriority: "exception_priority",
  exceptionOwnerUserId: "exception_owner_user_id",
  exceptionOwnerUsername: "exception_owner_username",
  exceptionNextAction: "exception_next_action",
  exceptionDueAt: "exception_due_at",
  exceptionNote: "exception_note",
  exceptionUpdatedBy: "exception_updated_by",
  exceptionUpdatedAt: "exception_updated_at",
  exceptionResolvedBy: "exception_resolved_by",
  exceptionResolvedAt: "exception_resolved_at",
};

const ACTION_STATUSES = new Set(["open", "in_progress", "waiting", "resolved"]);
const ACTION_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

export async function updateExceptionWorkflow(recordId, patch, { session }) {
  const sheet = await readDetailSheet(EXCEPTION_WORKFLOW_HEADERS);
  const match = findRow(sheet, recordId);
  const now = new Date().toISOString();
  const nextPatch = sanitizeExceptionWorkflowPatch(patch);
  const nextRaw = {
    ...match.raw,
    ...toSheetRow(nextPatch),
    exception_updated_by: session.user.id,
    exception_updated_at: now,
  };

  if (nextPatch.exceptionStatus === "resolved") {
    nextRaw.exception_resolved_by = session.user.id;
    nextRaw.exception_resolved_at = now;
  } else if (nextPatch.exceptionStatus && nextPatch.exceptionStatus !== "resolved") {
    nextRaw.exception_resolved_by = "";
    nextRaw.exception_resolved_at = "";
  }

  await updateSheetRow(sheet.headers, match.rowNumber, nextRaw);
  invalidateShipmentWriteCache();
  return normalizeWorkbookRow(nextRaw);
}

export function sanitizeExceptionWorkflowPatch(body = {}) {
  const patch = {};
  const status = text(body.actionStatus ?? body.exceptionStatus);
  const priority = text(body.priority ?? body.exceptionPriority);

  if (status) {
    const normalized = status.toLowerCase();
    if (!ACTION_STATUSES.has(normalized)) {
      throwBadRequest("Invalid exception action status.");
    }
    patch.exceptionStatus = normalized;
  }

  if (priority) {
    const normalized = priority.toLowerCase();
    if (!ACTION_PRIORITIES.has(normalized)) {
      throwBadRequest("Invalid exception priority.");
    }
    patch.exceptionPriority = normalized;
  }

  if (body.ownerUserId !== undefined || body.exceptionOwnerUserId !== undefined) {
    patch.exceptionOwnerUserId = text(body.ownerUserId ?? body.exceptionOwnerUserId);
  }
  if (body.ownerUsername !== undefined || body.exceptionOwnerUsername !== undefined) {
    patch.exceptionOwnerUsername = text(body.ownerUsername ?? body.exceptionOwnerUsername);
  }
  if (body.nextAction !== undefined || body.exceptionNextAction !== undefined) {
    patch.exceptionNextAction = text(body.nextAction ?? body.exceptionNextAction);
  }
  if (body.dueAt !== undefined || body.exceptionDueAt !== undefined) {
    patch.exceptionDueAt = text(body.dueAt ?? body.exceptionDueAt);
  }
  if (body.note !== undefined || body.exceptionNote !== undefined) {
    patch.exceptionNote = text(body.note ?? body.exceptionNote);
  }

  return patch;
}

async function readDetailSheet(requiredHeaders) {
  const schema = await ensureDetailDataSchema(requiredHeaders);
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: requiredEnv("GOOGLE_SHEET_ID"),
    range: `${DETAIL_SHEET}!A:${columnName(schema.headers.length)}`,
  });
  const rows = validateSheetBounds(response.data.values || []);
  const headers = (rows[0] || schema.headers).map((header) => `${header ?? ""}`.trim());
  return {
    headers,
    rows: rows.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      raw: Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""])),
    })),
  };
}

async function ensureDetailDataSchema(requiredHeaders) {
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

function findRow(sheet, recordId) {
  const match = sheet.rows.find(({ raw }) => normalizeWorkbookRow(raw).recordId === recordId);
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

function toSheetRow(patch) {
  return Object.fromEntries(
    Object.entries(patch).map(([field, value]) => [FIELD_TO_COLUMN[field], value]),
  );
}

function throwBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function text(value) {
  return `${value ?? ""}`.trim();
}
