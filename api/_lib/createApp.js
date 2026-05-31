import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { userItemHandler, usersCollectionHandler } from "./adminHandlers.js";
import { loginHandler, logoutHandler, requireSession as defaultRequireSession, sessionHandler } from "./authHandlers.js";
import {
  buildAnalytics,
  clampNumber,
  filterRows,
  loadWorkbookData as defaultLoadWorkbookData,
  resolveWorkbookPath as defaultResolveWorkbookPath,
  serializeRow,
  serializeWorkbookData,
} from "./workbook.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");

export function createApp({
  rootDir = ROOT_DIR,
  loadWorkbookData = defaultLoadWorkbookData,
  resolveWorkbookPath = defaultResolveWorkbookPath,
  requireSession = defaultRequireSession,
} = {}) {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    const origin = process.env.CORS_ORIGIN || req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.post("/api/auth/login", asyncHandler(loginHandler));
  app.post("/api/auth/logout", asyncHandler(logoutHandler));
  app.get("/api/auth/session", asyncHandler(sessionHandler));
  app.get("/api/admin/users", asyncHandler(usersCollectionHandler));
  app.post("/api/admin/users", asyncHandler(usersCollectionHandler));
  app.patch("/api/admin/users/:id", asyncHandler((req, res) => userItemHandler(req, res, req.params.id)));

  app.get("/api/health", (req, res) => {
    try {
      const source = resolveWorkbookPath();
      res.json({
        ok: true,
        service: "shipment-analytic-dashboard-api",
        workbookFound: Boolean(source),
        workbookSource: source ? path.relative(rootDir, source) : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.use("/api", asyncHandler(async (req, res, next) => {
    const session = await requireSession(req, res);
    if (session) {
      req.user = session.user;
      next();
    }
  }));

  app.get("/api/workbook", asyncHandler(async (req, res) => {
    const data = await loadWorkbookData();
    res.json(serializeWorkbookData(data));
  }));

  app.get("/api/metadata", asyncHandler(async (req, res) => {
    const data = await loadWorkbookData();
    res.json(data.metadata);
  }));

  app.get("/api/shipments", asyncHandler(async (req, res) => {
    const { detailData } = await loadWorkbookData();
    const filtered = filterRows(detailData, req.query);
    const limit = clampNumber(req.query.limit, 1, 500, 100);

    res.json({
      count: filtered.length,
      rows: filtered.slice(0, limit).map(serializeRow),
    });
  }));

  app.get("/api/analytics", asyncHandler(async (req, res) => {
    const { detailData } = await loadWorkbookData();
    const filtered = filterRows(detailData, req.query);
    const grain = ["month", "quarter", "year"].includes(req.query.grain)
      ? req.query.grain
      : "month";

    res.json(buildAnalytics(filtered, grain));
  }));

  return app;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
