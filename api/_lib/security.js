import { isProduction, sendJson } from "./http.js";

const MUTATING_METHODS = new Set(["POST", "PATCH", "DELETE"]);
const DEV_ALLOWED_ORIGINS = new Set([
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function securityHeadersMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const allowedOrigin = resolveAllowedOrigin(req);

  if (origin && allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigin) {
      sendJson(res, 403, { error: "Invalid request origin" });
      return;
    }
    res.sendStatus(204);
    return;
  }

  if (MUTATING_METHODS.has(req.method) && origin && !allowedOrigin) {
    sendJson(res, 403, { error: "Invalid request origin" });
    return;
  }

  next();
}

export function resolveAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return "";
  }

  const configuredOrigins = parseConfiguredOrigins(process.env.CORS_ORIGIN);
  if (configuredOrigins.length) {
    return configuredOrigins.includes(origin) ? origin : "";
  }

  if (!isProduction()) {
    return DEV_ALLOWED_ORIGINS.has(origin) ? origin : "";
  }

  return origin === getRequestOrigin(req) ? origin : "";
}

function parseConfiguredOrigins(value = "") {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getRequestOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) {
    return "";
  }

  const proto = req.headers["x-forwarded-proto"] || (isProduction() ? "https" : "http");
  return `${String(proto).split(",")[0]}://${String(host).split(",")[0]}`;
}
