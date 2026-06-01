import { describe, expect, test } from "vitest";
import { normalizeWorkbookRow } from "./workbook.js";

describe("normalizeWorkbookRow", () => {
  test("maps optional operational tracking columns from Google Sheets", () => {
    const row = normalizeWorkbookRow({
      Date: "2026-05-01",
      "Booking No": "BK-001",
      "Job No": "JOB-001",
      Shipper: "Alpha Logistics",
      POL: "BKK",
      Destination: "Tokyo",
      Qty: "2",
      Unit: "40HC",
      TEU: "4",
      Status: "Loaded",
      "Sale Name": "Pan",
      TRADE: "Asia",
      CARRIER: "Carrier A",
      shipment_id: "SHP-001",
      container_no: "CONT-001",
      ETD: "2026-05-10",
      ETA: "2026-05-20",
      ATD: "2026-05-11",
      ATA: "2026-05-21",
      current_milestone: "Arrived",
      last_event_time: "2026-05-21T09:00:00.000Z",
      delay_days: "1",
      delay_reason: "Port congestion",
      on_time_flag: "No",
    });

    expect(row).toMatchObject({
      shipmentId: "SHP-001",
      containerNo: "CONT-001",
      currentMilestone: "Arrived",
      delayDays: 1,
      delayReason: "Port congestion",
      onTimeFlag: "No",
    });
    expect(row.etd.toISOString()).toBe("2026-05-10T00:00:00.000Z");
    expect(row.eta.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    expect(row.atd.toISOString()).toBe("2026-05-11T00:00:00.000Z");
    expect(row.ata.toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(row.lastEventTime.toISOString()).toBe("2026-05-21T09:00:00.000Z");
  });
});
