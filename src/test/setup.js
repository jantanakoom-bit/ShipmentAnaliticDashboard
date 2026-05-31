import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("recharts", async () => await import("./rechartsMock.jsx"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
