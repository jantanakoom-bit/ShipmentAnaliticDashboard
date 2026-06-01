import { expect, test } from "@playwright/test";
import { login, mockDashboardApi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockDashboardApi(page);
});

test("tracking page shows operational exceptions and filters delayed shipments", async ({ page }) => {
  await login(page);
  await page.locator(".nav-sidebar").getByRole("link", { name: /Tracking/ }).click();

  await expect(page.getByText("Operational Tracking")).toBeVisible();
  await expect(page.getByText("Exception Queue")).toBeVisible();
  await expect(page.getByText("BK-001")).toBeVisible();

  await page.getByLabel("Exception type").selectOption("delayed");
  await expect(page.getByText("BK-001")).toBeVisible();
  await expect(page.getByText("BK-002")).toHaveCount(0);
});

test("tracking page updates exception action workflow", async ({ page }) => {
  await login(page);
  await page.locator(".nav-sidebar").getByRole("link", { name: /Tracking/ }).click();

  await page.getByRole("button", { name: /Update action for BK-001/ }).click();
  const dialog = page.getByRole("dialog", { name: /Exception action for BK-001/ });
  await dialog.getByLabel("Action status").selectOption("in_progress");
  await dialog.getByLabel("Priority").selectOption("high");
  await dialog.getByLabel("Owner username").fill("tester");
  await dialog.getByLabel("Due date").fill("2026-06-03");
  await dialog.getByLabel("Next action").fill("Call carrier");
  await dialog.getByLabel("Note").fill("Waiting for reply");
  await dialog.getByRole("button", { name: "Save Action" }).click();

  await expect(dialog).toHaveCount(0);
  const row = page.getByRole("row", { name: /BK-001/ });
  await expect(row.locator(".priority-chip")).toHaveText("high");
  await expect(row.locator(".owner-chip")).toHaveText("tester");
});
