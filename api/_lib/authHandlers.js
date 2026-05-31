import { clearSessionCookie, createSessionToken, readSession, setSessionCookie } from "./session.js";
import { findUserById, findUserByUsername, recordLogin, toPublicUser, verifyPassword } from "./users.js";
import { getRequestBody, sendJson, sendMethodNotAllowed } from "./http.js";

export async function loginHandler(req, res) {
  if (req.method !== "POST") return sendMethodNotAllowed(res, ["POST"]);

  const { username, password } = getRequestBody(req);
  const user = await findUserByUsername(username, { fresh: true });
  const valid = user && user.status === "active" && (await verifyPassword(user, password));

  if (!valid) {
    return sendJson(res, 401, { error: "Invalid username or password" });
  }

  const token = await createSessionToken(user);
  setSessionCookie(res, token);
  await recordLogin(user);
  return sendJson(res, 200, { user: toPublicUser(user) });
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
  if (session.user.role !== "admin") {
    sendJson(res, 403, { error: "Admin access required" });
    return null;
  }
  return session;
}
