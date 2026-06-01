import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { userItemHandler, usersCollectionHandler } from "./adminHandlers.js";
import { aiChatHandler } from "./aiChatHandler.js";
import { loginHandler, logoutHandler, requireSession as defaultRequireSession, sessionHandler } from "./authHandlers.js";
import { analyticsHandler, metadataHandler, shipmentItemHandler, shipmentsCollectionHandler, workbookHandler } from "./shipmentHandlers.js";
import { trackingCollectionHandler, trackingExceptionItemHandler, trackingExceptionsHandler } from "./trackingHandlers.js";
import {
  loadWorkbookData as defaultLoadWorkbookData,
  resolveWorkbookPath as defaultResolveWorkbookPath,
} from "./workbook.js";
import { securityHeadersMiddleware } from "./security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");

export function createApp({
  rootDir = ROOT_DIR,
  loadWorkbookData = defaultLoadWorkbookData,
  resolveWorkbookPath = defaultResolveWorkbookPath,
  requireSession = defaultRequireSession,
  shipmentStore,
  trackingStore,
  openAIClient,
  authDeps,
} = {}) {
  const app = express();

  app.use(express.json());
  app.use(securityHeadersMiddleware);

  app.post("/api/auth/login", asyncHandler((req, res) => loginHandler(req, res, authDeps)));
  app.post("/api/auth/logout", asyncHandler(logoutHandler));
  app.get("/api/auth/session", asyncHandler(sessionHandler));
  app.get("/api/admin/users", asyncHandler(usersCollectionHandler));
  app.post("/api/admin/users", asyncHandler(usersCollectionHandler));
  app.patch("/api/admin/users/:id", asyncHandler((req, res) => userItemHandler(req, res, req.params.id)));
  app.all("/api/chat", asyncHandler((req, res) => aiChatHandler(req, res, { requireSession, loadWorkbookData, openAIClient })));

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

  const shipmentDeps = { requireSession: localSessionFromRequest, loadWorkbookData, shipmentStore };
  app.get("/api/workbook", asyncHandler((req, res) => workbookHandler(req, res, shipmentDeps)));
  app.get("/api/metadata", asyncHandler((req, res) => metadataHandler(req, res, shipmentDeps)));
  app.get("/api/shipments", asyncHandler((req, res) => shipmentsCollectionHandler(req, res, shipmentDeps)));
  app.post("/api/shipments", asyncHandler((req, res) => shipmentsCollectionHandler(req, res, shipmentDeps)));
  app.get("/api/shipments/:id", asyncHandler((req, res) => shipmentItemHandler(req, res, req.params.id, shipmentDeps)));
  app.patch("/api/shipments/:id", asyncHandler((req, res) => shipmentItemHandler(req, res, req.params.id, shipmentDeps)));
  app.delete("/api/shipments/:id", asyncHandler((req, res) => shipmentItemHandler(req, res, req.params.id, shipmentDeps)));
  app.get("/api/analytics", asyncHandler((req, res) => analyticsHandler(req, res, shipmentDeps)));

  app.get("/api/tracking", asyncHandler((req, res) =>
    trackingCollectionHandler(req, res, { requireSession: localSessionFromRequest, loadWorkbookData })
  ));

  app.get("/api/tracking/exceptions", asyncHandler((req, res) =>
    trackingExceptionsHandler(req, res, { requireSession: localSessionFromRequest, loadWorkbookData })
  ));
  app.patch("/api/tracking/exceptions/:id", asyncHandler((req, res) =>
    trackingExceptionItemHandler(req, res, req.params.id, { requireSession: localSessionFromRequest, loadWorkbookData, trackingStore })
  ));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(error.status || 500).json({ error: error.message || "Internal server error" });
  });

  return app;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function localSessionFromRequest(req) {
  return req.user ? { user: req.user } : null;
}
