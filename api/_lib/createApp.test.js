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
    shipmentId: "SHP-001",
    containerNo: "CONT-001",
    eta: new Date("2024-01-20T00:00:00.000Z"),
    currentMilestone: "In Transit",
    lastEventTime: new Date("2024-01-10T00:00:00.000Z"),
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
    shipmentId: "SHP-002",
    eta: new Date("2026-07-10T00:00:00.000Z"),
    currentMilestone: "Booked",
    lastEventTime: new Date("2026-06-01T00:00:00.000Z"),
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

function buildTestApp(overrides = {}) {
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
    ...overrides,
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

  test("rejects protected tracking requests without a session", async () => {
    const response = await request(buildTestApp()).get("/api/tracking").expect(401);

    expect(response.body).toEqual({ error: "Authentication required" });
  });

  test("serves tracking summary and filtered exceptions to authenticated requests", async () => {
    const tracking = await request(buildTestApp())
      .get("/api/tracking?milestone=In%20Transit")
      .set("Authorization", "Bearer test-user")
      .expect(200);

    expect(tracking.body.summary.totalShipments).toBe(1);
    expect(tracking.body.rows[0]).toMatchObject({
      shipmentId: "SHP-001",
      bookingNo: "BK-001",
      currentMilestone: "In Transit",
      exceptionTypes: expect.arrayContaining(["delayed", "stale"]),
    });
    expect(tracking.body.rows[0].eta).toBe("2024-01-20T00:00:00.000Z");

    const exceptions = await request(buildTestApp())
      .get("/api/tracking/exceptions?exceptionType=delayed")
      .set("Authorization", "Bearer test-user")
      .expect(200);

    expect(exceptions.body.count).toBe(1);
    expect(exceptions.body.rows[0].shipmentId).toBe("SHP-001");
  });

  test("rejects unauthenticated AI chat requests", async () => {
    const response = await request(buildTestApp())
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "Top carriers?" }] })
      .expect(401);

    expect(response.body).toEqual({ error: "Authentication required" });
  });

  test("rejects unsupported AI chat methods", async () => {
    const response = await request(buildTestApp()).get("/api/chat").expect(405);

    expect(response.body).toEqual({ error: "Method not allowed" });
    expect(response.headers.allow).toBe("POST");
  });

  test("rejects empty AI chat messages", async () => {
    const response = await request(buildTestApp())
      .post("/api/chat")
      .set("Authorization", "Bearer test-user")
      .send({ messages: [{ role: "user", content: "   " }] })
      .expect(400);

    expect(response.body).toEqual({ error: "Message is required" });
  });

  test("returns AI chat configuration error without OpenAI client or key", async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const response = await request(buildTestApp())
        .post("/api/chat")
        .set("Authorization", "Bearer test-user")
        .send({ messages: [{ role: "user", content: "Top carriers?" }] })
        .expect(503);

      expect(response.body).toEqual({ error: "AI chat is not configured" });
    } finally {
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    }
  });

  test("answers AI chat using workbook tools through mocked OpenAI client", async () => {
    const calls = [];
    const openAIClient = {
      responses: {
        create: async (payload) => {
          calls.push(payload);
          if (calls.length === 1) {
            return {
              id: "resp_1",
              output: [
                {
                  type: "function_call",
                  name: "get_shipment_summary",
                  call_id: "call_1",
                  arguments: JSON.stringify({ grain: "quarter" }),
                },
              ],
            };
          }

          expect(payload.previous_response_id).toBe("resp_1");
          expect(payload.input[0]).toMatchObject({ type: "function_call_output", call_id: "call_1" });
          const toolResult = JSON.parse(payload.input[0].output);
          expect(toolResult.rowsMatched).toBe(1);
          expect(toolResult.analytics.summary.totalTeu).toBe(4);

          return {
            id: "resp_2",
            output_text: "Carrier A leads with 4 TEU across 1 shipment.",
            output: [],
          };
        },
      },
    };

    const response = await request(buildTestApp({ openAIClient }))
      .post("/api/chat")
      .set("Authorization", "Bearer test-user")
      .send({
        messages: [{ role: "user", content: "Summarize selected carrier TEU." }],
        filters: { trade: ["Asia"] },
        pageContext: { route: "/analytics", recordCount: 1 },
      })
      .expect(200);

    expect(response.body.answer).toBe("Carrier A leads with 4 TEU across 1 shipment.");
    expect(response.body.dataUsed).toMatchObject({
      filters: { trade: ["Asia"] },
      tools: ["get_shipment_summary"],
      rowsMatched: 1,
      rowLimitApplied: false,
    });
    expect(response.body.requestId).toEqual(expect.any(String));
  });
});
