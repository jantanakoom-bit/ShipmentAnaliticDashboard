const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000;

const attempts = new Map();

export function checkLoginAllowed({ username, ip, now = Date.now() } = {}) {
  const keys = buildKeys(username, ip);
  for (const key of keys) {
    const entry = attempts.get(key);
    if (!entry) {
      continue;
    }

    if (entry.lockedUntil && entry.lockedUntil > now) {
      return {
        allowed: false,
        retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
      };
    }

    if (entry.lockedUntil && entry.lockedUntil <= now) {
      attempts.delete(key);
    }
  }

  return { allowed: true, retryAfter: 0 };
}

export function recordLoginFailure({ username, ip, now = Date.now() } = {}) {
  const keys = buildKeys(username, ip);
  for (const key of keys) {
    const entry = getCurrentEntry(key, now);
    entry.count += 1;
    if (entry.count >= getMaxFailures()) {
      entry.lockedUntil = now + getLockoutMs();
    }
    attempts.set(key, entry);
  }
}

export function recordLoginSuccess({ username, ip } = {}) {
  for (const key of buildKeys(username, ip)) {
    attempts.delete(key);
  }
}

export function resetLoginThrottle() {
  attempts.clear();
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function getCurrentEntry(key, now) {
  const current = attempts.get(key);
  if (!current || now - current.startedAt > getWindowMs()) {
    return { startedAt: now, count: 0, lockedUntil: 0 };
  }
  return current;
}

function buildKeys(username = "", ip = "") {
  const normalizedUsername = `${username || ""}`.trim().toLowerCase() || "unknown";
  const normalizedIp = `${ip || ""}`.trim() || "unknown";
  return [`user:${normalizedUsername}`, `ip:${normalizedIp}`];
}

function getMaxFailures() {
  return getEnvNumber("LOGIN_THROTTLE_MAX_FAILURES", DEFAULT_MAX_FAILURES);
}

function getWindowMs() {
  return getEnvNumber("LOGIN_THROTTLE_WINDOW_MS", DEFAULT_WINDOW_MS);
}

function getLockoutMs() {
  return getEnvNumber("LOGIN_LOCKOUT_MS", DEFAULT_LOCKOUT_MS);
}

function getEnvNumber(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}
