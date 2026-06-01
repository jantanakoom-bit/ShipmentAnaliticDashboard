import { describe, expect, test } from "vitest";
import { buildTrackingModel, filterTrackingRows, normalizeTrackingFields } from "./tracking.js";

const NOW = new Date("2026-06-01T00:00:00.000Z");

function baseRow(overrides = {}) {
  return {
    date: new Date("2026-05-01T00:00:00.000Z"),
    bookingNo: "BK-001",
    jobNo: "JOB-001",
    shipper: "Alpha Logistics",
    pol: "BKK",
    destination: "Tokyo",
    route: "BKK -> Tokyo",
    trade: "Asia",
    carrier: "Carrier A",
    saleName: "Pan",
    status: "Loaded",
    qty: 2,
    teu: 4,
    ...overrides,
  };
}

describe("normalizeTrackingFields", () => {
  test("adds safe tracking defaults when optional fields are missing", () => {
    const row = normalizeTrackingFields(baseRow());

    expect(row).toMatchObject({
      shipmentId: "BK-001-JOB-001-2026-05-01",
      containerNo: "",
      currentMilestone: "Loaded",
      exceptionStatus: "open",
      exceptionPriority: "normal",
      exceptionOwnerUserId: "",
      exceptionOwnerUsername: "",
      exceptionNextAction: "",
      exceptionDueAt: "",
      exceptionNote: "",
      delayDays: 0,
      delayReason: "",
      onTimeFlag: "",
    });
    expect(row.eta).toBeNull();
    expect(row.ata).toBeNull();
  });

  test("keeps explicit tracking fields and parses operational dates", () => {
    const row = normalizeTrackingFields(baseRow({
      shipmentId: "SHP-001",
      containerNo: "CONT-001",
      etd: "2026-05-10",
      eta: "2026-05-20",
      atd: "2026-05-11",
      ata: "2026-05-21",
      currentMilestone: "Arrived",
      lastEventTime: "2026-05-21T09:00:00.000Z",
      delayDays: "1",
      delayReason: "Port congestion",
      onTimeFlag: "No",
      exceptionStatus: "waiting",
      exceptionPriority: "high",
      exceptionOwnerUserId: "user-1",
      exceptionOwnerUsername: "tester",
      exceptionNextAction: "Call carrier",
      exceptionDueAt: "2026-06-03",
      exceptionNote: "Waiting for reply",
    }));

    expect(row.shipmentId).toBe("SHP-001");
    expect(row.containerNo).toBe("CONT-001");
    expect(row.eta.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    expect(row.ata.toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(row.lastEventTime.toISOString()).toBe("2026-05-21T09:00:00.000Z");
    expect(row.delayDays).toBe(1);
    expect(row.delayReason).toBe("Port congestion");
    expect(row.onTimeFlag).toBe("No");
    expect(row.exceptionStatus).toBe("waiting");
    expect(row.exceptionPriority).toBe("high");
    expect(row.exceptionOwnerUsername).toBe("tester");
    expect(row.exceptionNextAction).toBe("Call carrier");
  });
});

describe("buildTrackingModel", () => {
  test("classifies delayed, stale, missing-data, and invalid-sequence exceptions", () => {
    const rows = [
      baseRow({
        bookingNo: "BK-DELAY",
        eta: "2026-05-20",
        currentMilestone: "In Transit",
        lastEventTime: "2026-05-29T00:00:00.000Z",
      }),
      baseRow({
        bookingNo: "BK-STALE",
        eta: "2026-06-10",
        currentMilestone: "Loaded",
        lastEventTime: "2026-05-20T00:00:00.000Z",
      }),
      baseRow({
        bookingNo: "BK-MISSING",
        currentMilestone: "Booked",
      }),
      baseRow({
        bookingNo: "BK-INVALID",
        etd: "2026-05-12",
        eta: "2026-05-10",
        atd: "2026-05-13",
        ata: "2026-05-09",
        currentMilestone: "Arrived",
      }),
      baseRow({
        bookingNo: "BK-ONTIME",
        eta: "2026-06-08",
        currentMilestone: "In Transit",
        lastEventTime: "2026-05-31T00:00:00.000Z",
      }),
    ];

    const model = buildTrackingModel(rows, { now: NOW, staleDays: 7 });

    expect(model.summary).toMatchObject({
      totalShipments: 5,
      delayedShipments: 1,
      staleShipments: 1,
      missingDataShipments: 1,
      invalidSequenceShipments: 1,
      exceptionShipments: 4,
      openActionShipments: 4,
      unassignedActionShipments: 4,
      overdueActionShipments: 0,
    });
    expect(model.exceptions.map((row) => row.bookingNo)).toEqual([
      "BK-DELAY",
      "BK-STALE",
      "BK-MISSING",
      "BK-INVALID",
    ]);
    expect(model.exceptions.find((row) => row.bookingNo === "BK-DELAY").exceptionTypes).toContain("delayed");
    expect(model.exceptions.find((row) => row.bookingNo === "BK-STALE").exceptionTypes).toContain("stale");
    expect(model.exceptions.find((row) => row.bookingNo === "BK-MISSING").exceptionTypes).toContain("missing_data");
    expect(model.exceptions.find((row) => row.bookingNo === "BK-INVALID").exceptionTypes).toContain("invalid_sequence");
  });

  test("summarizes open, unassigned, and overdue exception action workflow", () => {
    const model = buildTrackingModel([
      baseRow({
        bookingNo: "BK-OPEN",
        eta: "2026-05-20",
        currentMilestone: "In Transit",
        exceptionStatus: "open",
        exceptionDueAt: "2026-05-31",
      }),
      baseRow({
        bookingNo: "BK-ASSIGNED",
        eta: "2026-05-21",
        currentMilestone: "In Transit",
        exceptionStatus: "in_progress",
        exceptionOwnerUserId: "user-1",
        exceptionDueAt: "2026-06-03",
      }),
      baseRow({
        bookingNo: "BK-RESOLVED",
        eta: "2026-05-22",
        currentMilestone: "In Transit",
        exceptionStatus: "resolved",
        exceptionOwnerUserId: "user-1",
        exceptionDueAt: "2026-05-30",
      }),
    ], { now: NOW });

    expect(model.summary).toMatchObject({
      exceptionShipments: 3,
      openActionShipments: 2,
      unassignedActionShipments: 1,
      overdueActionShipments: 1,
    });
    expect(model.exceptions.find((row) => row.bookingNo === "BK-OPEN")).toMatchObject({
      exceptionStatus: "open",
      isExceptionActionOpen: true,
      isExceptionActionAssigned: false,
      isExceptionActionOverdue: true,
    });
  });

  test("filters tracking rows by milestone, exception type, carrier, trade, and sales", () => {
    const model = buildTrackingModel([
      baseRow({
        bookingNo: "BK-001",
        eta: "2026-05-20",
        currentMilestone: "In Transit",
        carrier: "Carrier A",
        trade: "Asia",
        saleName: "Pan",
      }),
      baseRow({
        bookingNo: "BK-002",
        eta: "2026-06-10",
        currentMilestone: "Booked",
        carrier: "Carrier B",
        trade: "Europe",
        saleName: "Mint",
      }),
    ], { now: NOW });

    const rows = filterTrackingRows(model.rows, {
      milestone: "In Transit",
      exceptionType: "delayed",
      carrier: "Carrier A",
      trade: "Asia",
      sales: "Pan",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].bookingNo).toBe("BK-001");
  });

  test("filters tracking rows by exception workflow status, priority, owner, and due state", () => {
    const model = buildTrackingModel([
      baseRow({
        bookingNo: "BK-001",
        eta: "2026-05-20",
        currentMilestone: "In Transit",
        exceptionStatus: "open",
        exceptionPriority: "high",
        exceptionOwnerUsername: "tester",
        exceptionDueAt: "2026-05-31",
      }),
      baseRow({
        bookingNo: "BK-002",
        eta: "2026-05-20",
        currentMilestone: "In Transit",
        exceptionStatus: "waiting",
        exceptionPriority: "normal",
        exceptionOwnerUsername: "mint",
        exceptionDueAt: "2026-06-03",
      }),
    ], { now: NOW });

    const rows = filterTrackingRows(model.rows, {
      actionStatus: "open",
      priority: "high",
      actionOwner: "tester",
      dueState: "overdue",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].bookingNo).toBe("BK-001");
  });
});
