import { describe, expect, test } from "vitest";
import { buildTrackingViewModel, filterTrackingRows } from "./tracking";

const NOW = new Date("2026-06-01T00:00:00.000Z");

const rows = [
  {
    bookingNo: "BK-001",
    jobNo: "JOB-001",
    carrier: "Carrier A",
    trade: "Asia",
    saleName: "Pan",
    status: "Loaded",
    currentMilestone: "In Transit",
    eta: new Date("2026-05-20T00:00:00.000Z"),
    lastEventTime: new Date("2026-05-29T00:00:00.000Z"),
  },
  {
    bookingNo: "BK-002",
    jobNo: "JOB-002",
    carrier: "Carrier B",
    trade: "Europe",
    saleName: "Mint",
    status: "Booked",
    currentMilestone: "Booked",
    eta: new Date("2026-06-10T00:00:00.000Z"),
    lastEventTime: new Date("2026-05-20T00:00:00.000Z"),
  },
];

describe("buildTrackingViewModel", () => {
  test("creates operational summary and exceptions for tracking rows", () => {
    const model = buildTrackingViewModel(rows, { now: NOW, staleDays: 7 });

    expect(model.summary).toMatchObject({
      totalShipments: 2,
      delayedShipments: 1,
      staleShipments: 1,
      exceptionShipments: 2,
      openActionShipments: 2,
      unassignedActionShipments: 2,
      overdueActionShipments: 0,
    });
    expect(model.exceptions.map((row) => row.bookingNo)).toEqual(["BK-001", "BK-002"]);
    expect(model.milestoneSummary).toEqual([
      { name: "Booked", count: 1 },
      { name: "In Transit", count: 1 },
    ]);
  });

  test("filters by milestone and exception type", () => {
    const model = buildTrackingViewModel(rows, { now: NOW, staleDays: 7 });
    const filtered = filterTrackingRows(model.rows, {
      milestone: "In Transit",
      exceptionType: "delayed",
      carrier: "Carrier A",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].bookingNo).toBe("BK-001");
  });

  test("summarizes and filters exception workflow fields", () => {
    const model = buildTrackingViewModel([
      {
        ...rows[0],
        bookingNo: "BK-OPEN",
        exceptionStatus: "open",
        exceptionPriority: "high",
        exceptionOwnerUsername: "tester",
        exceptionDueAt: "2026-05-31",
      },
      {
        ...rows[1],
        bookingNo: "BK-WAITING",
        exceptionStatus: "waiting",
        exceptionPriority: "normal",
        exceptionOwnerUsername: "mint",
        exceptionDueAt: "2026-06-03",
      },
    ], { now: NOW, staleDays: 7 });

    expect(model.summary).toMatchObject({
      exceptionShipments: 2,
      openActionShipments: 2,
      unassignedActionShipments: 0,
      overdueActionShipments: 1,
    });

    const filtered = filterTrackingRows(model.rows, {
      actionStatus: "open",
      priority: "high",
      actionOwner: "tester",
      dueState: "overdue",
    });
    expect(filtered.map((row) => row.bookingNo)).toEqual(["BK-OPEN"]);
  });
});
