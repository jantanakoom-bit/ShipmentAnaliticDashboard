import { clearSessionCookie, createSessionToken, readSession, setSessionCookie } from "./session.js";
import { findUserById, findUserByUsername, recordLogin, toPublicUser, verifyPassword } from "./users.js";
import { getRequestBody, sendJson, sendMethodNotAllowed } from "./http.js";
import { canManageUsers } from "./rbac.js";
import * as defaultLoginThrottle from "./loginThrottle.js";

export async function loginHandler(req, res, deps = {}) {
  if (req.method !== "POST") return sendMethodNotAllowed(res, ["POST"]);

  const throttle = deps.loginThrottle || defaultLoginThrottle;
  const { username, password } = getRequestBody(req);
  const ip = throttle.getClientIp ? throttle.getClientIp(req) : defaultLoginThrottle.getClientIp(req);
  const loginAllowed = throttle.checkLoginAllowed({ username, ip });
  if (!loginAllowed.allowed) {
    return sendJson(
      res,
      429,
      { error: "Too many login attempts. Please try again later." },
      { "Retry-After": String(loginAllowed.retryAfter) },
    );
  }

  const findUsername = deps.findUserByUsername || findUserByUsername;
  const verifyUserPassword = deps.verifyPassword || verifyPassword;
  const user = await findUsername(username, { fresh: true });
  const valid = user && user.status === "active" && (await verifyUserPassword(user, password));

  if (!valid) {
    throttle.recordLoginFailure({ username, ip });
    return sendJson(res, 401, { error: "Invalid username or password" });
  }

  throttle.recordLoginSuccess({ username, ip });
  const createToken = deps.createSessionToken || createSessionToken;
  const setCookie = deps.setSessionCookie || setSessionCookie;
  const recordUserLogin = deps.recordLogin || recordLogin;
  const toPublic = deps.toPublicUser || toPublicUser;
  const token = await createToken(user);
  setCookie(res, token);
  await recordUserLogin(user);
  return sendJson(res, 200, { user: toPublic(user) });
}

export async function logoutHandler(req, res) {
  if (req.method !== "POST") return sendMethodNotAllowed(res, ["POST"]);
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
}

export async function sessionHandler(req, res) {
  if (req.method !== "GET") return sendMethodNotAllowed(res, ["GET"]);
  const session = await requireSession(req, res);
  if (!session) return;
  return sendJson(res, 200, { user: toPublicUser(session.user) });
}

export async function requireSession(req, res) {
  const tokenUser = await readSession(req);
  if (!tokenUser?.id) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }

  const user = await findUserById(tokenUser.id);
  if (!user || user.status !== "active") {
    clearSessionCookie(res);
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }

  return { user };
}

export async function requireAdmin(req, res) {
  const session = await requireSession(req, res);
  if (!session) return null;
  if (!canManageUsers(session.user)) {
    sendJson(res, 403, { error: "Admin access required" });
    return null;
  }
  return session;
}
