import { getRequestBody, sendJson, sendMethodNotAllowed } from "./http.js";
import { requireSession as defaultRequireSession } from "./authHandlers.js";
import { filterRows, loadWorkbookData as defaultLoadWorkbookData } from "./workbook.js";
import { buildTrackingModel, filterTrackingRows, serializeTrackingRow } from "./tracking.js";

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
  const baseRows = filterRows(detailData, query);
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
  const baseRows = filterRows(detailData, query);
  const trackingModel = buildTrackingModel(baseRows);
  const rows = filterTrackingRows(trackingModel.exceptions, query);

  return sendJson(res, 200, {
    count: rows.length,
    rows: rows.map(serializeTrackingRow),
    generatedAt: trackingModel.generatedAt,
  });
}

function getQuery(req) {
  if (req.query) {
    return req.query;
  }
  return getRequestBody(req);
}
