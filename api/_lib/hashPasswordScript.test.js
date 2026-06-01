import { spawn } from "node:child_process";
import path from "node:path";
import bcrypt from "bcryptjs";
import { describe, expect, test } from "vitest";

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts/hash-password.js");

describe("hash-password script", () => {
  test("hashes a stdin password", async () => {
    const result = await runHashPassword(["--stdin"], "correct-password\n");

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(await bcrypt.compare("correct-password", result.stdout.trim())).toBe(true);
  });

  test("rejects plaintext argv passwords", async () => {
    const result = await runHashPassword(["correct-password"], "");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("npm run hash-password -- --stdin");
  });

  test("rejects short stdin passwords", async () => {
    const result = await runHashPassword(["--stdin"], "short\n");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Password must be at least 8 characters.");
  });
});

function runHashPassword(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
    child.stdin.end(input);
  });
}
