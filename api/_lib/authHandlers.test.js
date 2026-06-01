import { afterEach, describe, expect, test } from "vitest";
import request from "supertest";
import { createApp } from "./createApp.js";
import { resetLoginThrottle } from "./loginThrottle.js";

const ORIGINAL_ENV = {
  LOGIN_THROTTLE_MAX_FAILURES: process.env.LOGIN_THROTTLE_MAX_FAILURES,
  LOGIN_THROTTLE_WINDOW_MS: process.env.LOGIN_THROTTLE_WINDOW_MS,
  LOGIN_LOCKOUT_MS: process.env.LOGIN_LOCKOUT_MS,
};

afterEach(() => {
  resetLoginThrottle();
  for (const key of Object.keys(ORIGINAL_ENV)) {
    if (ORIGINAL_ENV[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ENV[key];
    }
  }
});

describe("login throttling", () => {
  test("locks out after repeated invalid logins without revealing whether the user exists", async () => {
    process.env.LOGIN_THROTTLE_MAX_FAILURES = "5";
    process.env.LOGIN_THROTTLE_WINDOW_MS = "900000";
    process.env.LOGIN_LOCKOUT_MS = "900000";

    const app = buildAuthTestApp();

    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Origin", "http://localhost:5173")
        .set("X-Forwarded-For", "203.0.113.10")
        .send({ username: "missing-user", password: "bad-password" })
        .expect(401);
      expect(response.body).toEqual({ error: "Invalid username or password" });
    }

    const locked = await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("X-Forwarded-For", "203.0.113.10")
      .send({ username: "missing-user", password: "bad-password" })
      .expect(429);

    expect(locked.body).toEqual({ error: "Too many login attempts. Please try again later." });
    expect(locked.headers["retry-after"]).toBe("900");
  });

  test("successful login clears previous failure counters", async () => {
    process.env.LOGIN_THROTTLE_MAX_FAILURES = "5";
    process.env.LOGIN_LOCKOUT_MS = "900000";

    const app = buildAuthTestApp();

    for (let i = 0; i < 4; i++) {
      await request(app)
        .post("/api/auth/login")
        .set("Origin", "http://localhost:5173")
        .set("X-Forwarded-For", "203.0.113.11")
        .send({ username: "tester", password: "bad-password" })
        .expect(401);
    }

    await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("X-Forwarded-For", "203.0.113.11")
      .send({ username: "tester", password: "correct-password" })
      .expect(200);

    for (let i = 0; i < 4; i++) {
      await request(app)
        .post("/api/auth/login")
        .set("Origin", "http://localhost:5173")
        .set("X-Forwarded-For", "203.0.113.11")
        .send({ username: "tester", password: "bad-password" })
        .expect(401);
    }
  });
});

function buildAuthTestApp() {
  const user = {
    id: "user-1",
    username: "tester",
    role: "admin",
    status: "active",
    display_name: "Test User",
  };

  return createApp({
    authDeps: {
      findUserByUsername: async (username) => (username === "tester" ? user : null),
      verifyPassword: async (_user, password) => password === "correct-password",
      createSessionToken: async () => "test-session-token",
      setSessionCookie: (res, token) => res.setHeader("Set-Cookie", `shipment_session=${token}; HttpOnly`),
      recordLogin: async () => {},
      toPublicUser: (item) => ({ id: item.id, username: item.username, role: item.role }),
    },
  });
}
