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
