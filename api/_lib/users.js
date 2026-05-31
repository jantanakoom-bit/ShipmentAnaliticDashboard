import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getSheetsClient, requiredEnv } from "./googleSheets.js";

const USER_SHEET_NAME = process.env.USER_SHEET_NAME || "Users";
const CACHE_MS = 45 * 1000;
const HEADERS = [
  "id",
  "username",
  "password_hash",
  "role",
  "display_name",
  "status",
  "created_at",
  "updated_at",
  "last_login_at",
  "password_changed_at",
];

let cachedUsers = null;
let cachedAt = 0;

function getRange() {
  return `${USER_SHEET_NAME}!A:J`;
}

function normalizeUser(row, rowNumber) {
  const user = Object.fromEntries(HEADERS.map((header, index) => [header, `${row[index] ?? ""}`.trim()]));
  return {
    ...user,
    rowNumber,
    role: user.role || "user",
    status: user.status || "active",
  };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLoginAt: user.last_login_at,
    passwordChangedAt: user.password_changed_at,
  };
}

function invalidateCache() {
  cachedUsers = null;
  cachedAt = 0;
}

export function toPublicUser(user) {
  return publicUser(user);
}

export function toPublicUsers(users) {
  return users.map(publicUser);
}

export async function listUsers({ fresh = false } = {}) {
  if (!fresh && cachedUsers && Date.now() - cachedAt < CACHE_MS) {
    return cachedUsers;
  }

  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: requiredEnv("GOOGLE_SHEET_ID"),
    range: getRange(),
  });

  const rows = response.data.values || [];
  const users = rows.slice(1).map((row, index) => normalizeUser(row, index + 2)).filter((user) => user.id && user.username);
  cachedUsers = users;
  cachedAt = Date.now();
  return users;
}

export async function findUserByUsername(username, options) {
  const lower = `${username || ""}`.trim().toLowerCase();
  const users = await listUsers(options);
  return users.find((user) => user.username.toLowerCase() === lower) || null;
}

export async function findUserById(id, options) {
  const users = await listUsers(options);
  return users.find((user) => user.id === id) || null;
}

export async function verifyPassword(user, password) {
  if (!user?.password_hash || !password) {
    return false;
  }
  return bcrypt.compare(password, user.password_hash);
}

export async function hashPassword(password) {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return bcrypt.hash(password, 12);
}

export async function updateUserRow(user, patch) {
  const now = new Date().toISOString();
  const next = {
    ...user,
    ...patch,
    updated_at: now,
  };

  const row = HEADERS.map((header) => next[header] || "");
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: requiredEnv("GOOGLE_SHEET_ID"),
    range: `${USER_SHEET_NAME}!A${user.rowNumber}:J${user.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
  invalidateCache();
  return next;
}

export async function createUser({ username, password, role = "user", displayName = "", status = "active" }) {
  const normalizedUsername = `${username || ""}`.trim();
  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }
  if (!["admin", "user"].includes(role)) {
    throw new Error("Role must be admin or user.");
  }
  if (!["active", "disabled"].includes(status)) {
    throw new Error("Status must be active or disabled.");
  }

  const existing = await findUserByUsername(normalizedUsername, { fresh: true });
  if (existing) {
    const error = new Error("Username already exists.");
    error.status = 409;
    throw error;
  }

  const now = new Date().toISOString();
  const user = {
    id: randomUUID(),
    username: normalizedUsername,
    password_hash: await hashPassword(password),
    role,
    display_name: `${displayName || normalizedUsername}`.trim(),
    status,
    created_at: now,
    updated_at: now,
    last_login_at: "",
    password_changed_at: now,
  };

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: requiredEnv("GOOGLE_SHEET_ID"),
    range: getRange(),
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS.map((header) => user[header] || "")] },
  });
  invalidateCache();
  return user;
}

export async function updateUser(id, { password, role, displayName, status }) {
  const user = await findUserById(id, { fresh: true });
  if (!user) {
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }

  const patch = {};
  if (role !== undefined) {
    if (!["admin", "user"].includes(role)) throw new Error("Role must be admin or user.");
    patch.role = role;
  }
  if (status !== undefined) {
    if (!["active", "disabled"].includes(status)) throw new Error("Status must be active or disabled.");
    patch.status = status;
  }
  if (displayName !== undefined) {
    patch.display_name = `${displayName}`.trim() || user.username;
  }
  if (password) {
    patch.password_hash = await hashPassword(password);
    patch.password_changed_at = new Date().toISOString();
  }

  return updateUserRow(user, patch);
}

export async function recordLogin(user) {
  return updateUserRow(user, { last_login_at: new Date().toISOString() });
}
