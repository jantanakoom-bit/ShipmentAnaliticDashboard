import { describe, expect, test } from "vitest";
import {
  AI_CHAT_TOOL_DEFINITIONS,
  applyChatFilters,
  buildSuggestedAction,
  createChatToolRunner,
  projectShipmentRow,
  projectTrackingRow,
} from "./aiChatTools.js";

const rows = [
  {
    date: new Date(Date.UTC(2024, 0, 15)),
    monthLabel: "Jan 2024",
    year: 2024,
    quarter: "Q1",
    yearQuarter: "2024 Q1",
    monthNumber: 1,
    monthName: "January",
    yearMonth: "2024-01",
    bookingNo: "BK-001",
    jobNo: "JOB-001",
    shipper: "Alpha",
    liner: "Liner A",
    pol: "BKK",
    pod: "TYO",
    country: "Japan",
    port: "Tokyo",
    destination: "Tokyo",
    qty: 2,
    unit: "40HC",
    teu: 4,
    status: "Loaded",
    saleName: "Pan",
    trade: "Asia",
    carrier: "Carrier A",
    route: "BKK -> Tokyo",
    internalNote: "do not expose",
  },
  {
    date: new Date(Date.UTC(2024, 3, 10)),
    monthLabel: "Apr 2024",
    year: 2024,
    quarter: "Q2",
    yearQuarter: "2024 Q2",
    monthNumber: 4,
    monthName: "April",
    yearMonth: "2024-04",
    bookingNo: "BK-002",
    jobNo: "JOB-002",
    shipper: "Beta",
    liner: "Liner B",
    pol: "BKK",
    pod: "HAM",
    country: "Germany",
    port: "Hamburg",
    destination: "Hamburg",
    qty: 1,
    unit: "20DC",
    teu: 1,
    status: "Pending",
    saleName: "Mint",
    trade: "Europe",
    carrier: "Carrier B",
    route: "BKK -> Hamburg",
  },
];

const workbookData = {
  detailData: rows,
  metadata: {
    source: "test workbook",
    shipments: rows.length,
    filters: {
      years: ["2024"],
      trades: ["Asia", "Europe"],
    },
  },
};

const trackingRows = [
  {
    ...rows[0],
    recordId: "rec-delayed",
    shipmentId: "SHP-DELAYED",
    eta: new Date("2024-01-20T00:00:00.000Z"),
    ata: null,
    currentMilestone: "In Transit",
    lastEventTime: new Date("2024-01-10T00:00:00.000Z"),
    delayDays: 5,
    delayReason: "Carrier delay",
    exceptionStatus: "open",
    exceptionPriority: "high",
    exceptionOwnerUsername: "tester",
    exceptionNextAction: "Call carrier",
    exceptionDueAt: "2024-01-25",
    exceptionNote: "hidden note",
    exceptionUpdatedBy: "user-1",
  },
  {
    ...rows[1],
    recordId: "rec-missing",
    shipmentId: "SHP-MISSING",
    eta: "",
    ata: null,
    currentMilestone: "",
    lastEventTime: new Date("2024-04-01T00:00:00.000Z"),
    delayDays: 0,
    delayReason: "",
    exceptionStatus: "open",
    exceptionPriority: "normal",
    exceptionOwnerUsername: "",
    exceptionNextAction: "",
    exceptionDueAt: "",
    privateCost: 999,
  },
  {
    ...rows[1],
    recordId: "rec-invalid",
    shipmentId: "SHP-INVALID",
    etd: new Date("2024-05-10T00:00:00.000Z"),
    eta: new Date("2024-05-01T00:00:00.000Z"),
    ata: null,
    currentMilestone: "Booked",
    lastEventTime: new Date("2026-05-30T00:00:00.000Z"),
    exceptionStatus: "waiting",
    exceptionPriority: "urgent",
    exceptionOwnerUsername: "ops",
    exceptionDueAt: "2026-06-10",
  },
];

const trackingWorkbookData = {
  ...workbookData,
  detailData: trackingRows,
};

describe("AI chat tools", () => {
  test("filters rows with frontend-style multi-select filters", () => {
    const result = applyChatFilters(rows, {
      years: ["2024"],
      quarters: ["Q1"],
      trade: ["Asia"],
      carrier: ["Carrier A"],
      sales: ["Pan"],
    });

    expect(result.map((row) => row.bookingNo)).toEqual(["BK-001"]);
  });

  test("projects only allowed shipment fields", () => {
    const projected = projectShipmentRow(rows[0]);

    expect(projected).toMatchObject({
      bookingNo: "BK-001",
      trade: "Asia",
      carrier: "Carrier A",
      date: "2024-01-15T00:00:00.000Z",
    });
    expect(projected.internalNote).toBeUndefined();
    expect(projected.liner).toBeUndefined();
  });

  test("caps shipment search results and reports row limit", async () => {
    const runTool = createChatToolRunner({
      loadWorkbookData: async () => workbookData,
      baseFilters: { years: ["2024"] },
      maxRows: 1,
    });

    const result = await runTool("search_shipments", { limit: 99 });

    expect(result.rowsMatched).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rowLimitApplied).toBe(true);
    expect(result.limit).toBe(1);
  });

  test("returns dashboard metric explanations", async () => {
    const runTool = createChatToolRunner({
      loadWorkbookData: async () => workbookData,
      maxRows: 10,
    });

    const result = await runTool("explain_metric", { metric: "Total TEU" });

    expect(result.explanation).toContain("sum");
    expect(result.supportedMetrics).toContain("totalTeu");
  });

  test("defines read-only tracking tools", () => {
    const toolNames = AI_CHAT_TOOL_DEFINITIONS.map((tool) => tool.name);

    expect(toolNames).toEqual(expect.arrayContaining([
      "get_tracking_summary",
      "get_tracking_exceptions",
      "suggest_exception_actions",
    ]));
    expect(toolNames).not.toContain("update_tracking_exception");
  });

  test("returns tracking summary counts and active filters", async () => {
    const runTool = createChatToolRunner({
      loadWorkbookData: async () => trackingWorkbookData,
      baseFilters: { years: ["2024"] },
      maxRows: 10,
    });

    const result = await runTool("get_tracking_summary", {
      filters: { actionStatus: "open", priority: "high" },
    });

    expect(result.filters).toEqual({
      years: ["2024"],
      actionStatus: "open",
      priority: "high",
    });
    expect(result.summary).toMatchObject({
      totalShipments: 1,
      delayedShipments: 1,
      exceptionShipments: 1,
      openActionShipments: 1,
      overdueActionShipments: 1,
    });
    expect(result.exceptionSummary).toMatchObject({ delayed: 1, stale: 1 });
    expect(result.workflowSummary.priority).toContainEqual({ name: "high", count: 1 });
    expect(result.workflowSummary.ownerWorkload).toContainEqual({ name: "tester", count: 1 });
  });

  test("caps tracking exception rows and projects only safe fields", async () => {
    const runTool = createChatToolRunner({
      loadWorkbookData: async () => trackingWorkbookData,
      maxRows: 1,
    });

    const result = await runTool("get_tracking_exceptions", { limit: 99 });

    expect(result.rowsMatched).toBe(3);
    expect(result.rows).toHaveLength(1);
    expect(result.rowLimitApplied).toBe(true);
    expect(result.rows[0]).toMatchObject({
      recordId: "rec-delayed",
      shipmentId: "SHP-DELAYED",
      bookingNo: "BK-001",
      currentMilestone: "In Transit",
      eta: "2024-01-20T00:00:00.000Z",
      delayDays: 5,
      exceptionTypes: ["delayed", "stale"],
      exceptionStatus: "open",
      exceptionPriority: "high",
      exceptionOwnerUsername: "tester",
      isExceptionActionOverdue: true,
    });
    expect(result.rows[0].exceptionNote).toBeUndefined();
    expect(result.rows[0].exceptionUpdatedBy).toBeUndefined();
    expect(result.rows[0].privateCost).toBeUndefined();
  });

  test("projects tracking rows with the approved field allowlist", () => {
    const projected = projectTrackingRow({
      ...trackingRows[0],
      exceptionTypes: ["delayed"],
      isExceptionActionOverdue: true,
    });

    expect(Object.keys(projected)).toEqual([
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
    ]);
  });

  test("suggests deterministic exception actions", async () => {
    const runTool = createChatToolRunner({
      loadWorkbookData: async () => trackingWorkbookData,
      maxRows: 10,
    });

    const result = await runTool("suggest_exception_actions", { filters: { dueState: "unassigned" } });

    expect(result.rowsMatched).toBe(1);
    expect(result.rows[0]).toMatchObject({
      recordId: "rec-missing",
      suggestedAction: expect.stringContaining("Assign an owner"),
    });
    expect(buildSuggestedAction({
      exceptionTypes: ["invalid_sequence"],
      exceptionStatus: "open",
      exceptionPriority: "urgent",
      isExceptionActionOverdue: false,
      exceptionOwnerUsername: "ops",
    })).toContain("Verify milestone dates");
    expect(buildSuggestedAction({
      exceptionTypes: ["delayed", "stale"],
      exceptionStatus: "open",
      exceptionPriority: "high",
      isExceptionActionOverdue: true,
      exceptionOwnerUsername: "tester",
      delayReason: "Carrier delay",
    })).toContain("Escalate overdue action");
  });
});
