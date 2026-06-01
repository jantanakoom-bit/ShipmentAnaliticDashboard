import { METRIC_EXPLANATIONS } from "./aiChatPrompts.js";
import { buildTrackingModel, filterTrackingRows, serializeTrackingRow } from "./tracking.js";
import { buildAnalytics, filterRows, serializeRow } from "./workbook.js";

export const DEFAULT_AI_CHAT_MAX_ROWS = 50;

export const AI_CHAT_TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "get_metadata",
    description: "Get workbook metadata, available filters, shipment count, and date range.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_shipment_summary",
    description: "Get aggregate shipment analytics for the selected or requested filters.",
    parameters: {
      type: "object",
      properties: {
        grain: {
          type: "string",
          enum: ["month", "quarter", "year"],
          description: "Time grain for trend data.",
        },
        filters: {
          type: "object",
          description: "Optional filter overrides such as year, quarter, month, trade, carrier, shipper, status, port, country, or sales.",
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "search_shipments",
    description: "Return a capped list of shipment rows matching selected filters and optional search text.",
    parameters: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Optional filter overrides such as year, quarter, month, trade, carrier, shipper, status, port, country, or sales.",
          additionalProperties: true,
        },
        query: {
          type: "string",
          description: "Search text for booking, job, shipper, route, country, port, destination, trade, carrier, status, or sales.",
        },
        limit: {
          type: "number",
          description: "Maximum rows to return. The backend applies its own cap.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "explain_metric",
    description: "Explain how a dashboard metric is calculated.",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "Metric key or metric name to explain.",
        },
      },
      required: ["metric"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_tracking_summary",
    description: "Get read-only tracking KPIs, exception summary, workflow summary, and milestone summary for selected filters.",
    parameters: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Optional tracking filters such as exceptionType, actionStatus, priority, actionOwner, dueState, milestone, trade, carrier, sales, or status.",
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_tracking_exceptions",
    description: "Return a capped, read-only list of tracking exception rows matching selected filters.",
    parameters: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Optional tracking filters such as exceptionType, actionStatus, priority, actionOwner, dueState, milestone, trade, carrier, sales, or status.",
          additionalProperties: true,
        },
        limit: {
          type: "number",
          description: "Maximum exception rows to return. The backend applies its own cap.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "suggest_exception_actions",
    description: "Return deterministic suggestion-only next actions for capped tracking exception rows. This tool never writes to Google Sheets.",
    parameters: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Optional tracking filters such as exceptionType, actionStatus, priority, actionOwner, dueState, milestone, trade, carrier, sales, or status.",
          additionalProperties: true,
        },
        limit: {
          type: "number",
          description: "Maximum exception rows to return. The backend applies its own cap.",
        },
      },
      additionalProperties: false,
    },
  },
];

const ALLOWED_ROW_FIELDS = [
  "date",
  "bookingNo",
  "jobNo",
  "shipper",
  "pol",
  "pod",
  "country",
  "port",
  "destination",
  "qty",
  "unit",
  "teu",
  "status",
  "saleName",
  "trade",
  "carrier",
  "route",
];

const ALLOWED_TRACKING_ROW_FIELDS = [
  "recordId",
  "shipmentId",
  "bookingNo",
  "jobNo",
  "carrier",
  "trade",
  "saleName",
  "currentMilestone",
  "eta",
  "ata",
  "lastEventTime",
  "delayDays",
  "delayReason",
  "exceptionTypes",
  "exceptionStatus",
  "exceptionPriority",
  "exceptionOwnerUsername",
  "exceptionNextAction",
  "exceptionDueAt",
  "isExceptionActionOverdue",
];

const ARRAY_FILTERS = {
  years: "year",
  quarters: "quarter",
  months: "monthNumber",
  port: "port",
  country: "country",
  trade: "trade",
  carrier: "carrier",
  sales: "saleName",
  saleName: "saleName",
  shipper: "shipper",
  status: "status",
};

export function createChatToolRunner({ loadWorkbookData, baseFilters = {}, maxRows = DEFAULT_AI_CHAT_MAX_ROWS }) {
  return async function runChatTool(toolName, args = {}) {
    const data = await loadWorkbookData();
    const filters = mergeFilters(baseFilters, args.filters);

    if (toolName === "get_metadata") {
      return {
        metadata: {
          ...data.metadata,
          source: data.metadata?.source || "Workbook",
        },
        activeFilters: normalizeFilterSnapshot(filters),
      };
    }

    if (toolName === "get_shipment_summary") {
      const rows = applyChatFilters(data.detailData, filters);
      const grain = ["month", "quarter", "year"].includes(args.grain) ? args.grain : "month";
      return {
        filters: normalizeFilterSnapshot(filters),
        rowsMatched: rows.length,
        analytics: buildAnalytics(rows, grain),
      };
    }

    if (toolName === "search_shipments") {
      const rows = applySearch(applyChatFilters(data.detailData, filters), args.query);
      const requestedLimit = Number(args.limit);
      const limit = Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 10;
      const safeLimit = Math.max(1, Math.min(maxRows, limit));

      return {
        filters: normalizeFilterSnapshot(filters),
        rowsMatched: rows.length,
        rowLimitApplied: rows.length > safeLimit,
        limit: safeLimit,
        rows: rows.slice(0, safeLimit).map(projectShipmentRow),
      };
    }

    if (toolName === "explain_metric") {
      return explainMetric(args.metric);
    }

    if (toolName === "get_tracking_summary") {
      const rows = applyTrackingFilters(data.detailData, filters);
      const trackingModel = buildTrackingModel(rows);
      return {
        filters: normalizeFilterSnapshot(filters),
        rowsMatched: trackingModel.rows.length,
        summary: trackingModel.summary,
        exceptionSummary: trackingModel.exceptionSummary,
        workflowSummary: buildWorkflowSummary(trackingModel.exceptions),
        milestoneSummary: trackingModel.milestoneSummary,
        generatedAt: trackingModel.generatedAt,
        suggestionOnly: true,
      };
    }

    if (toolName === "get_tracking_exceptions") {
      const rows = applyTrackingFilters(data.detailData, filters, { exceptionsOnly: true });
      const safeLimit = getSafeLimit(args.limit, maxRows, 10);

      return {
        filters: normalizeFilterSnapshot(filters),
        rowsMatched: rows.length,
        rowLimitApplied: rows.length > safeLimit,
        limit: safeLimit,
        rows: rows.slice(0, safeLimit).map(projectTrackingRow),
        suggestionOnly: true,
      };
    }

    if (toolName === "suggest_exception_actions") {
      const rows = applyTrackingFilters(data.detailData, filters, { exceptionsOnly: true });
      const safeLimit = getSafeLimit(args.limit, maxRows, 10);

      return {
        filters: normalizeFilterSnapshot(filters),
        rowsMatched: rows.length,
        rowLimitApplied: rows.length > safeLimit,
        limit: safeLimit,
        rows: rows.slice(0, safeLimit).map((row) => ({
          ...projectTrackingRow(row),
          suggestedAction: buildSuggestedAction(row),
        })),
        suggestionOnly: true,
      };
    }

    throw new Error(`Unsupported AI chat tool: ${toolName}`);
  };
}

export function applyChatFilters(rows, filters = {}) {
  const simpleQuery = normalizeSimpleQuery(filters);
  const queryFiltered = Object.keys(simpleQuery).length ? filterRows(rows, simpleQuery) : rows;
  const arrayFilters = Object.entries(ARRAY_FILTERS)
    .map(([inputKey, rowKey]) => [rowKey, normalizeArray(filters[inputKey])])
    .filter(([, values]) => values.length);

  if (!arrayFilters.length) {
    return queryFiltered;
  }

  return queryFiltered.filter((row) =>
    arrayFilters.every(([rowKey, values]) => values.includes(normalizeComparable(row[rowKey]))),
  );
}

export function projectShipmentRow(row) {
  const serialized = serializeRow(row);
  return Object.fromEntries(ALLOWED_ROW_FIELDS.map((field) => [field, serialized[field] ?? ""]));
}

export function applyTrackingFilters(rows, filters = {}, { exceptionsOnly = false } = {}) {
  const dashboardFiltered = applyChatFilters(rows, filters);
  const trackingModel = buildTrackingModel(dashboardFiltered);
  const sourceRows = exceptionsOnly ? trackingModel.exceptions : trackingModel.rows;
  return filterTrackingRows(sourceRows, normalizeTrackingFilterQuery(filters));
}

export function projectTrackingRow(row) {
  const serialized = serializeTrackingRow(row);
  return Object.fromEntries(
    ALLOWED_TRACKING_ROW_FIELDS.map((field) => {
      const value = serialized[field];
      if (field === "exceptionTypes") {
        return [field, Array.isArray(value) ? value : []];
      }
      if (field === "isExceptionActionOverdue") {
        return [field, Boolean(value)];
      }
      return [field, value ?? ""];
    }),
  );
}

export function buildSuggestedAction(row = {}) {
  const actions = [];
  const types = Array.isArray(row.exceptionTypes) ? row.exceptionTypes : [];

  if (row.isExceptionActionOverdue) {
    actions.push("Escalate overdue action and refresh the due date after owner confirmation.");
  }
  if (!row.exceptionOwnerUsername && !row.exceptionOwnerUserId) {
    actions.push("Assign an owner before the next follow-up.");
  }
  if (types.includes("delayed")) {
    const reason = row.delayReason ? ` Reason on file: ${row.delayReason}.` : "";
    actions.push(`Ask the carrier for revised ETA and recovery plan.${reason}`);
  }
  if (types.includes("stale")) {
    actions.push("Request a tracking update because the last event is stale.");
  }
  if (types.includes("missing_data")) {
    actions.push("Complete missing ETA or milestone fields before customer reporting.");
  }
  if (types.includes("invalid_sequence")) {
    actions.push("Verify milestone dates and correct the sequence source data.");
  }
  if (["high", "urgent"].includes(row.exceptionPriority)) {
    actions.push("Keep this in the same-day follow-up queue due to priority.");
  }
  if (!actions.length && row.exceptionStatus === "resolved") {
    return "No follow-up suggested; this exception is already resolved.";
  }
  if (!actions.length) {
    return "Review the row and confirm the next operational follow-up.";
  }
  return actions.join(" ");
}

export function normalizeFilterSnapshot(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== null && value !== "" && value !== "All";
      })
      .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value)]),
  );
}

function mergeFilters(baseFilters = {}, overrideFilters = {}) {
  return {
    ...(baseFilters || {}),
    ...(overrideFilters || {}),
  };
}

function getSafeLimit(requested, maxRows, fallback) {
  const requestedLimit = Number(requested);
  const limit = Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : fallback;
  return Math.max(1, Math.min(maxRows, limit));
}

function normalizeTrackingFilterQuery(filters = {}) {
  const query = { ...filters };
  const scalarKeys = ["milestone", "trade", "carrier", "sales", "saleName", "status", "actionStatus", "priority", "actionOwner", "dueState", "exceptionType"];
  for (const key of scalarKeys) {
    if (Array.isArray(query[key])) {
      query[key] = query[key][0];
    }
  }
  return query;
}

function buildWorkflowSummary(rows = []) {
  const openRows = rows.filter((row) => row.isExceptionActionOpen);
  return {
    status: countByName(rows, "exceptionStatus"),
    priority: countByName(openRows, "exceptionPriority"),
    ownerWorkload: countByOwner(openRows),
    overdueActions: openRows.filter((row) => row.isExceptionActionOverdue).length,
    unassignedActions: openRows.filter((row) => !row.isExceptionActionAssigned).length,
  };
}

function countByName(rows, key) {
  return [...rows.reduce((counts, row) => {
    const value = row[key] || "Unspecified";
    counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map()).entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function countByOwner(rows) {
  return [...rows.reduce((counts, row) => {
    const owner = row.exceptionOwnerUsername || row.exceptionOwnerUserId || "Unassigned";
    counts.set(owner, (counts.get(owner) || 0) + 1);
    return counts;
  }, new Map()).entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function normalizeSimpleQuery(filters) {
  const query = {};
  const mappings = [
    ["year", "year"],
    ["quarter", "quarter"],
    ["month", "month"],
    ["trade", "trade"],
    ["carrier", "carrier"],
    ["shipper", "shipper"],
    ["status", "status"],
  ];

  for (const [inputKey, queryKey] of mappings) {
    const value = filters[inputKey];
    if (isSingleValue(value)) {
      query[queryKey] = `${value}`;
    }
  }

  return query;
}

function isSingleValue(value) {
  return value !== undefined && value !== null && value !== "" && value !== "All" && !Array.isArray(value);
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => item !== undefined && item !== null && `${item}` !== "" && `${item}` !== "All")
    .map(normalizeComparable);
}

function normalizeComparable(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function applySearch(rows, query) {
  const needle = normalizeComparable(query);
  if (!needle) {
    return rows;
  }

  const keys = ["bookingNo", "jobNo", "shipper", "route", "country", "port", "destination", "trade", "carrier", "status", "saleName"];
  return rows.filter((row) => keys.some((key) => normalizeComparable(row[key]).includes(needle)));
}

function explainMetric(metric = "") {
  const key = normalizeMetricKey(metric);
  return {
    metric,
    explanation: METRIC_EXPLANATIONS[key] || "This metric is not defined in the dashboard metric glossary.",
    supportedMetrics: Object.keys(METRIC_EXPLANATIONS),
  };
}

function normalizeMetricKey(metric) {
  const normalized = `${metric}`.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return Object.keys(METRIC_EXPLANATIONS).find((key) => key.toLowerCase() === normalized) || normalized;
}
