import { SignJWT, jwtVerify } from "jose";
import { TextEncoder } from "node:util";
import { readCookie, isProduction } from "./http.js";

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "shipment_session";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function getCookieParts(value = "", maxAge = SESSION_MAX_AGE_SECONDS) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (isProduction()) {
    parts.push("Secure");
  }

  return parts;
}

export async function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(getSecret());
}

export async function verifySessionToken(token) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function readSession(req) {
  return verifySessionToken(readCookie(req, SESSION_COOKIE_NAME));
}

export function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", getCookieParts(token).join("; "));
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", getCookieParts("", 0).join("; "));
}
