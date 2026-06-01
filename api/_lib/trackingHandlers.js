import { getRequestBody, sendJson, sendMethodNotAllowed } from "./http.js";
import { requireSession as defaultRequireSession } from "./authHandlers.js";
import { filterRows, loadWorkbookData as defaultLoadWorkbookData } from "./workbook.js";
import { buildTrackingModel, filterTrackingRows, serializeTrackingRow } from "./tracking.js";
import { scopeRowsForUser } from "./rbac.js";
import * as defaultTrackingStore from "./trackingStore.js";

export async function trackingCollectionHandler(req, res, deps = {}) {
  const {
    loadWorkbookData = defaultLoadWorkbookData,
    requireSession = defaultRequireSession,
  } = deps;

  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, ["GET"]);
  }

  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  const query = getQuery(req);
  const { detailData } = await loadWorkbookData();
  const baseRows = filterRows(scopeRowsForUser(detailData, session.user), query);
  const trackingRows = filterTrackingRows(buildTrackingModel(baseRows).rows, query);
  const trackingModel = buildTrackingModel(trackingRows);

  return sendJson(res, 200, {
    ...trackingModel,
    rows: trackingModel.rows.map(serializeTrackingRow),
    exceptions: trackingModel.exceptions.map(serializeTrackingRow),
  });
}

export async function trackingExceptionsHandler(req, res, deps = {}) {
  const {
    loadWorkbookData = defaultLoadWorkbookData,
    requireSession = defaultRequireSession,
  } = deps;

  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, ["GET"]);
  }

  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  const query = getQuery(req);
  const { detailData } = await loadWorkbookData();
  const baseRows = filterRows(scopeRowsForUser(detailData, session.user), query);
  const trackingModel = buildTrackingModel(baseRows);
  const rows = filterTrackingRows(trackingModel.exceptions, query);

  return sendJson(res, 200, {
    count: rows.length,
    rows: rows.map(serializeTrackingRow),
    generatedAt: trackingModel.generatedAt,
  });
}

export async function trackingExceptionItemHandler(req, res, recordId, deps = {}) {
  const {
    loadWorkbookData = defaultLoadWorkbookData,
    requireSession = defaultRequireSession,
    trackingStore = defaultTrackingStore,
  } = deps;

  if (req.method !== "PATCH") {
    return sendMethodNotAllowed(res, ["PATCH"]);
  }

  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  const { detailData } = await loadWorkbookData();
  const accessibleRow = scopeRowsForUser(detailData, session.user).find((row) => row.recordId === recordId);
  if (!accessibleRow) {
    const existing = detailData.find((row) => row.recordId === recordId);
    if (existing) {
      return sendJson(res, 403, { error: "Shipment access denied." });
    }
    return sendJson(res, 404, { error: "Shipment not found." });
  }

  const patch = (trackingStore.sanitizeExceptionWorkflowPatch || defaultTrackingStore.sanitizeExceptionWorkflowPatch)(getRequestBody(req));
  const updated = await trackingStore.updateExceptionWorkflow(recordId, patch, { session });

  return sendJson(res, 200, {
    row: serializeTrackingRow(updated),
  });
}

function getQuery(req) {
  if (req.query) {
    return req.query;
  }
  return getRequestBody(req);
}
