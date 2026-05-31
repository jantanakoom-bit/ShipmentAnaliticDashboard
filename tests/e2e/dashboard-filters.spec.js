import { expect, test } from "@playwright/test";
import { login, mockDashboardApi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockDashboardApi(page);
});

test("dashboard and sidebar filters update shipment counts", async ({ page }) => {
  await login(page);

  const quarterFilter = page.locator(".filter-section").filter({ hasText: "Quarter" });
  await quarterFilter.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("button", { name: "Q2" }).click();
  await page.locator(".nav-sidebar").getByRole("link", { name: /Shipments/ }).click();
  await expect(page.locator("#record-count")).toContainText("15 records");

  await page.getByPlaceholder("Search port...").fill("Tokyo");
  await page.locator("label").filter({ hasText: "Tokyo" }).getByRole("checkbox").uncheck();
  await expect(page.locator("#record-count")).toContainText("10 records");

  await page.getByRole("button", { name: "Select All" }).click();
  await expect(page.locator("#record-count")).toContainText("60 records");
});
