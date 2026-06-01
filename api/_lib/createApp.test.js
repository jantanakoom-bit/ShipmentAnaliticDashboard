import { afterEach, describe, expect, test } from "vitest";
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
    recordId: "rec-001",
    ownerUserId: "user-1",
    ownerUsername: "tester",
    isDeleted: false,
    exceptionStatus: "open",
    exceptionPriority: "normal",
    exceptionOwnerUserId: "",
    exceptionOwnerUsername: "",
    exceptionNextAction: "",
    exceptionDueAt: "",
    exceptionNote: "",
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
    recordId: "rec-002",
    ownerUserId: "user-2",
    ownerUsername: "mint",
    isDeleted: false,
    exceptionStatus: "open",
    exceptionPriority: "normal",
    exceptionOwnerUserId: "",
    exceptionOwnerUsername: "",
    exceptionNextAction: "",
    exceptionDueAt: "",
    exceptionNote: "",
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

const ORIGINAL_ENV = {
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
};

afterEach(() => {
  restoreEnv("CORS_ORIGIN");
  restoreEnv("NODE_ENV");
  restoreEnv("VERCEL");
});

function buildTestApp(overrides = {}) {
  const mutableRows = overrides.mutableRows || detailData.map((row) => ({ ...row }));
  const shipmentStore = overrides.shipmentStore || {
    createShipment: async ({ body, session }) => {
      const row = {
        ...body,
        date: new Date(`${body.date || "2026-06-01"}T00:00:00.000Z`),
        recordId: "rec-created",
        ownerUserId: session.user.id,
        ownerUsername: session.user.username,
        createdBy: session.user.id,
        updatedBy: session.user.id,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        isDeleted: false,
      };
      mutableRows.push(row);
      return row;
    },
    updateShipment: async (recordId, patch, { session }) => {
      const index = mutableRows.findIndex((row) => row.recordId === recordId);
      if (index === -1) {
        const error = new Error("Shipment not found.");
        error.status = 404;
        throw error;
      }
      mutableRows[index] = {
        ...mutableRows[index],
        ...patch,
        updatedBy: session.user.id,
        updatedAt: "2026-06-01T00:00:00.000Z",
      };
      return mutableRows[index];
    },
    softDeleteShipment: async (recordId, { session }) => {
      const index = mutableRows.findIndex((row) => row.recordId === recordId);
      if (index === -1) {
        const error = new Error("Shipment not found.");
        error.status = 404;
        throw error;
      }
      mutableRows[index] = {
        ...mutableRows[index],
        isDeleted: true,
        deletedBy: session.user.id,
        deletedAt: "2026-06-01T00:00:00.000Z",
        updatedBy: session.user.id,
        updatedAt: "2026-06-01T00:00:00.000Z",
      };
      return mutableRows[index];
    },
  };
  const trackingStore = overrides.trackingStore || {
    updateExceptionWorkflow: async (recordId, patch, { session }) => {
      const index = mutableRows.findIndex((row) => row.recordId === recordId);
      if (index === -1) {
        const error = new Error("Shipment not found.");
        error.status = 404;
        throw error;
      }
      mutableRows[index] = {
        ...mutableRows[index],
        ...patch,
        exceptionUpdatedBy: session.user.id,
        exceptionUpdatedAt: "2026-06-01T00:00:00.000Z",
        exceptionResolvedBy: patch.actionStatus === "resolved" ? session.user.id : "",
        exceptionResolvedAt: patch.actionStatus === "resolved" ? "2026-06-01T00:00:00.000Z" : "",
      };
      return mutableRows[index];
    },
  };

  return createApp({
    rootDir: "/tmp/shipment-test",
    resolveWorkbookPath: () => "/tmp/shipment-test/Detail_Report_Format.xlsx",
    loadWorkbookData: () => ({ ...workbookData, detailData: mutableRows }),
    shipmentStore,
    trackingStore,
    requireSession: async (req, res) => {
      if (req.headers.authorization === "Bearer test-user") {
        return { user: { id: "user-1", username: "tester", role: "user" } };
      }
      if (req.headers.authorization === "Bearer moderator") {
        return { user: { id: "mod-1", username: "moderator", role: "moderator" } };
      }
      if (req.headers.authorization === "Bearer admin") {
        return { user: { id: "admin-1", username: "admin", role: "admin" } };
      }

      res.status(401).json({ error: "Authentication required" });
      return null;
    },
    ...overrides,
  });
}

describe("createApp", () => {
  test("does not reflect arbitrary credentialed origins when CORS_ORIGIN is unset", async () => {
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "production";

    const response = await request(buildTestApp())
      .get("/api/health")
      .set("Origin", "https://evil.example")
      .set("Host", "dashboard.example")
      .set("X-Forwarded-Proto", "https")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  test("allows production same-origin mutating requests through the origin gate", async () => {
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "production";

    const response = await request(buildTestApp())
      .post("/api/shipments")
      .set("Authorization", "Bearer test-user")
      .set("Origin", "https://dashboard.example")
      .set("Host", "dashboard.example")
      .set("X-Forwarded-Proto", "https")
      .send({ bookingNo: "BK-NEW", shipper: "Created Co" })
      .expect(201);

    expect(response.headers["access-control-allow-origin"]).toBe("https://dashboard.example");
    expect(response.body.row.recordId).toBe("rec-created");
  });

  test("blocks disallowed cross-origin cookie session mutations", async () => {
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "production";

    const response = await request(buildTestApp())
      .post("/api/auth/logout")
      .set("Origin", "https://evil.example")
      .set("Host", "dashboard.example")
      .set("X-Forwarded-Proto", "https")
      .expect(403);

    expect(response.body).toEqual({ error: "Invalid request origin" });
  });

  test("allows local dev preflight from the Vite origin and blocks unknown preflight origins", async () => {
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "development";

    const allowed = await request(buildTestApp())
      .options("/api/shipments")
      .set("Origin", "http://localhost:5173")
      .expect(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    const blocked = await request(buildTestApp())
      .options("/api/shipments")
      .set("Origin", "https://evil.example")
      .expect(403);
    expect(blocked.body).toEqual({ error: "Invalid request origin" });
  });

  test("keeps authentication checks after a valid origin passes", async () => {
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "development";

    const response = await request(buildTestApp())
      .post("/api/shipments")
      .set("Origin", "http://localhost:5173")
      .send({ bookingNo: "BK-NEW" })
      .expect(401);

    expect(response.body).toEqual({ error: "Authentication required" });
  });

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
      .set("Authorization", "Bearer admin")
      .expect(200);

    expect(response.body.metadata.shipments).toBe(2);
    expect(response.body.detailData[0].date).toBe("2024-01-15T00:00:00.000Z");
  });

  test("returns controlled workbook limit errors from protected API routes", async () => {
    const limitError = new Error("Workbook row limit exceeded. Maximum data rows: 10000.");
    limitError.status = 413;

    const response = await request(buildTestApp({
      loadWorkbookData: async () => {
        throw limitError;
      },
    }))
      .get("/api/workbook")
      .set("Authorization", "Bearer admin")
      .expect(413);

    expect(response.body).toEqual({ error: "Workbook row limit exceeded. Maximum data rows: 10000." });
  });

  test("scopes workbook rows to the authenticated sales user", async () => {
    const response = await request(buildTestApp())
      .get("/api/workbook")
      .set("Authorization", "Bearer test-user")
      .expect(200);

    expect(response.body.metadata.shipments).toBe(1);
    expect(response.body.detailData.map((row) => row.recordId)).toEqual(["rec-001"]);
    expect(response.body.metadata.filters.trades).toEqual(["Asia"]);
  });

  test("allows moderator to view all non-deleted sales records", async () => {
    const response = await request(buildTestApp())
      .get("/api/shipments?limit=10")
      .set("Authorization", "Bearer moderator")
      .expect(200);

    expect(response.body.count).toBe(2);
    expect(response.body.rows.map((row) => row.recordId)).toEqual(["rec-001", "rec-002"]);
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

  test("blocks direct access to another user's shipment record", async () => {
    await request(buildTestApp())
      .get("/api/shipments/rec-002")
      .set("Authorization", "Bearer test-user")
      .expect(403);
  });

  test("creates shipments under the authenticated user instead of submitted owner", async () => {
    const response = await request(buildTestApp())
      .post("/api/shipments")
      .set("Authorization", "Bearer test-user")
      .send({
        bookingNo: "BK-NEW",
        jobNo: "JOB-NEW",
        shipper: "Created Co",
        trade: "Asia",
        carrier: "Carrier A",
        saleName: "Tester",
        ownerUserId: "user-2",
      })
      .expect(201);

    expect(response.body.row).toMatchObject({
      recordId: "rec-created",
      ownerUserId: "user-1",
      ownerUsername: "tester",
      bookingNo: "BK-NEW",
    });
  });

  test("allows user to update own shipment and prevents owner escalation", async () => {
    const response = await request(buildTestApp())
      .patch("/api/shipments/rec-001")
      .set("Authorization", "Bearer test-user")
      .send({ status: "Completed", ownerUserId: "user-2" })
      .expect(200);

    expect(response.body.row).toMatchObject({
      recordId: "rec-001",
      status: "Completed",
      ownerUserId: "user-1",
      updatedBy: "user-1",
    });
  });

  test("soft-deletes owned shipment records", async () => {
    const rows = detailData.map((row) => ({ ...row }));
    await request(buildTestApp({ mutableRows: rows }))
      .delete("/api/shipments/rec-001")
      .set("Authorization", "Bearer test-user")
      .expect(200);

    const response = await request(buildTestApp({ mutableRows: rows }))
      .get("/api/workbook")
      .set("Authorization", "Bearer admin")
      .expect(200);

    expect(response.body.detailData.map((row) => row.recordId)).toEqual(["rec-002"]);
  });

  test("builds analytics and falls back invalid grain to month", async () => {
    const response = await request(buildTestApp())
      .get("/api/analytics?grain=invalid")
      .set("Authorization", "Bearer admin")
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

  test("updates exception workflow for an accessible tracking row", async () => {
    const response = await request(buildTestApp())
      .patch("/api/tracking/exceptions/rec-001")
      .set("Authorization", "Bearer test-user")
      .send({
        actionStatus: "in_progress",
        priority: "high",
        ownerUserId: "user-1",
        ownerUsername: "tester",
        nextAction: "Call carrier",
        dueAt: "2026-06-03",
        note: "Waiting for ETA confirmation",
        exceptionUpdatedBy: "attacker",
      })
      .expect(200);

    expect(response.body.row).toMatchObject({
      recordId: "rec-001",
      exceptionStatus: "in_progress",
      exceptionPriority: "high",
      exceptionOwnerUserId: "user-1",
      exceptionOwnerUsername: "tester",
      exceptionNextAction: "Call carrier",
      exceptionDueAt: "2026-06-03",
      exceptionNote: "Waiting for ETA confirmation",
      exceptionUpdatedBy: "user-1",
      exceptionUpdatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(response.body.row.exceptionUpdatedBy).not.toBe("attacker");
  });

  test("blocks exception workflow updates for inaccessible sales rows", async () => {
    await request(buildTestApp())
      .patch("/api/tracking/exceptions/rec-002")
      .set("Authorization", "Bearer test-user")
      .send({ actionStatus: "in_progress" })
      .expect(403);
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

function restoreEnv(key) {
  if (ORIGINAL_ENV[key] === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = ORIGINAL_ENV[key];
  }
}
