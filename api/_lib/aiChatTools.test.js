import { describe, expect, test } from "vitest";
import { applyChatFilters, createChatToolRunner, projectShipmentRow } from "./aiChatTools.js";

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
});
