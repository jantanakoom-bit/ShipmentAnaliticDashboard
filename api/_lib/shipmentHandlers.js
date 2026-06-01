import { getRequestBody, sendJson, sendMethodNotAllowed } from "./http.js";
import { requireSession as defaultRequireSession } from "./authHandlers.js";
import { buildAnalytics, buildWorkbookResponse, clampNumber, filterRows, loadWorkbookData as defaultLoadWorkbookData, serializeRow } from "./workbook.js";
import { requireSalesRowAccess, scopeRowsForUser } from "./rbac.js";
import * as defaultShipmentStore from "./shipmentStore.js";

export async function workbookHandler(req, res, deps = {}) {
  if (req.method !== "GET") return sendMethodNotAllowed(res, ["GET"]);
  const session = await getSession(req, res, deps);
  if (!session) return;

  const data = await loadScopedWorkbook(session.user, deps);
  return sendJson(res, 200, {
    ...data,
    detailData: data.detailData.map(serializeRow),
  });
}

export async function metadataHandler(req, res, deps = {}) {
  if (req.method !== "GET") return sendMethodNotAllowed(res, ["GET"]);
  const session = await getSession(req, res, deps);
  if (!session) return;

  const data = await loadScopedWorkbook(session.user, deps);
  return sendJson(res, 200, data.metadata);
}

export async function shipmentsCollectionHandler(req, res, deps = {}) {
  const session = await getSession(req, res, deps);
  if (!session) return;

  if (req.method === "GET") {
    const query = getQuery(req);
    const data = await loadScopedWorkbook(session.user, deps);
    const filtered = filterRows(data.detailData, query);
    const limit = clampNumber(query.limit, 1, 500, 100);
    return sendJson(res, 200, {
      count: filtered.length,
      rows: filtered.slice(0, limit).map(serializeRow),
    });
  }

  if (req.method === "POST") {
    const store = deps.shipmentStore || defaultShipmentStore;
    const row = await store.createShipment({ body: getRequestBody(req), session });
    requireSalesRowAccess(session.user, row);
    return sendJson(res, 201, { row: serializeRow(row) });
  }

  return sendMethodNotAllowed(res, ["GET", "POST"]);
}

export async function shipmentItemHandler(req, res, recordId, deps = {}) {
  const session = await getSession(req, res, deps);
  if (!session) return;

  const row = await findAccessibleRow(recordId, session.user, deps);

  if (req.method === "GET") {
    return sendJson(res, 200, { row: serializeRow(row) });
  }

  const store = deps.shipmentStore || defaultShipmentStore;
  if (req.method === "PATCH") {
    const patch = store.sanitizeShipmentPatch
      ? store.sanitizeShipmentPatch(getRequestBody(req))
      : stripRestrictedFields(getRequestBody(req));
    const updated = await store.updateShipment(recordId, patch, { session });
    requireSalesRowAccess(session.user, updated);
    return sendJson(res, 200, { row: serializeRow(updated) });
  }

  if (req.method === "DELETE") {
    const deleted = await store.softDeleteShipment(recordId, { session });
    return sendJson(res, 200, { row: serializeRow(deleted) });
  }

  return sendMethodNotAllowed(res, ["GET", "PATCH", "DELETE"]);
}

export async function analyticsHandler(req, res, deps = {}) {
  if (req.method !== "GET") return sendMethodNotAllowed(res, ["GET"]);
  const session = await getSession(req, res, deps);
  if (!session) return;

  const data = await loadScopedWorkbook(session.user, deps);
  const filtered = filterRows(data.detailData, getQuery(req));
  const grain = ["month", "quarter", "year"].includes(getQuery(req).grain)
    ? getQuery(req).grain
    : "month";
  return sendJson(res, 200, buildAnalytics(filtered, grain));
}

export async function loadScopedWorkbook(user, deps = {}) {
  const loadWorkbookData = deps.loadWorkbookData || defaultLoadWorkbookData;
  const data = await loadWorkbookData();
  const scopedRows = scopeRowsForUser(data.detailData, user);
  return buildWorkbookResponse(scopedRows, data.metadata);
}

export function scopeWorkbookDataForUser(data, user) {
  return buildWorkbookResponse(scopeRowsForUser(data.detailData, user), data.metadata);
}

async function findAccessibleRow(recordId, user, deps) {
  const data = await loadScopedWorkbook(user, deps);
  const row = data.detailData.find((item) => item.recordId === recordId);
  if (!row) {
    const fullData = await (deps.loadWorkbookData || defaultLoadWorkbookData)();
    const existing = fullData.detailData.find((item) => item.recordId === recordId);
    requireSalesRowAccess(user, existing);
  }
  return row;
}

async function getSession(req, res, deps) {
  const requireSession = deps.requireSession || defaultRequireSession;
  return requireSession(req, res);
}

function getQuery(req) {
  return req.query || getRequestBody(req);
}

function stripRestrictedFields(body = {}) {
  const restricted = new Set(["recordId", "ownerUserId", "ownerUsername", "createdBy", "updatedBy", "createdAt", "updatedAt", "isDeleted", "deletedAt", "deletedBy"]);
  return Object.fromEntries(Object.entries(body).filter(([key]) => !restricted.has(key)));
}
