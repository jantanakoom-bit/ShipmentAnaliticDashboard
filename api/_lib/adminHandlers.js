import { createUser, listUsers, toPublicUser, toPublicUsers, updateUser } from "./users.js";
import { getRequestBody, sendJson, sendMethodNotAllowed } from "./http.js";
import { requireAdmin } from "./authHandlers.js";

export async function usersCollectionHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === "GET") {
    const users = await listUsers({ fresh: true });
    return sendJson(res, 200, { users: toPublicUsers(users) });
  }

  if (req.method === "POST") {
    const user = await createUser(getRequestBody(req));
    return sendJson(res, 201, { user: toPublicUser(user) });
  }

  return sendMethodNotAllowed(res, ["GET", "POST"]);
}

export async function userItemHandler(req, res, id) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method !== "PATCH") {
    return sendMethodNotAllowed(res, ["PATCH"]);
  }

  const user = await updateUser(id, getRequestBody(req));
  return sendJson(res, 200, { user: toPublicUser(user) });
}
