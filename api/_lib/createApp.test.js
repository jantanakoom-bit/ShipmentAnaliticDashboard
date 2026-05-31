import { describe, expect, test } from "vitest";
import request from "supertest";
import { createApp } from "./createApp.js";

const detailData = [
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
  detailData,
  metadata: {
    source: "tests/fixtures/workbook/Detail_Report_Format.xlsx",
    shipments: detailData.length,
    sheets: ["Detail Data"],
    filters: {
      years: ["2024"],
      quarters: ["Q1", "Q2"],
      months: ["Jan 2024", "Apr 2024"],
      trades: ["Asia", "Europe"],
      carriers: ["Carrier A", "Carrier B"],
      shippers: ["Alpha", "Beta"],
      statuses: ["Loaded", "Pending"],
    },
  },
};

function buildTestApp() {
  return createApp({
    rootDir: "/tmp/shipment-test",
    resolveWorkbookPath: () => "/tmp/shipment-test/Detail_Report_Format.xlsx",
    loadWorkbookData: () => workbookData,
    requireSession: async (req, res) => {
      if (req.headers.authorization === "Bearer test-user") {
        return { user: { id: "user-1", username: "tester", role: "user" } };
      }

      res.status(401).json({ error: "Authentication required" });
      return null;
    },
  });
}

describe("createApp", () => {
  test("returns API health without requiring authentication", async () => {
    const response = await request(buildTestApp()).get("/api/health").expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      service: "shipment-analytic-dashboard-api",
      workbookFound: true,
      workbookSource: "Detail_Report_Format.xlsx",
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  test("rejects protected workbook requests without a session", async () => {
    const response = await request(buildTestApp()).get("/api/workbook").expect(401);

    expect(response.body).toEqual({ error: "Authentication required" });
  });

  test("serves workbook data to authenticated requests", async () => {
    const response = await request(buildTestApp())
      .get("/api/workbook")
      .set("Authorization", "Bearer test-user")
      .expect(200);

    expect(response.body.metadata.shipments).toBe(2);
    expect(response.body.detailData[0].date).toBe("2024-01-15T00:00:00.000Z");
  });

  test("filters shipments and clamps the response limit", async () => {
    const response = await request(buildTestApp())
      .get("/api/shipments?trade=Asia&limit=999")
      .set("Authorization", "Bearer test-user")
      .expect(200);

    expect(response.body.count).toBe(1);
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0]).toMatchObject({
      bookingNo: "BK-001",
      trade: "Asia",
      date: "2024-01-15T00:00:00.000Z",
    });
  });

  test("builds analytics and falls back invalid grain to month", async () => {
    const response = await request(buildTestApp())
      .get("/api/analytics?grain=invalid")
      .set("Authorization", "Bearer test-user")
      .expect(200);

    expect(response.body.summary).toMatchObject({
      shipments: 2,
      totalTeu: 5,
      totalQty: 3,
      uniqueShippers: 2,
      activeRoutes: 2,
    });
    expect(response.body.timeSeries.map((item) => item.key)).toEqual(["2024-01", "2024-04"]);
  });
});
