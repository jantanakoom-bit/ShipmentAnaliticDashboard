import { expect, test } from "@playwright/test";
import { login, mockDashboardApi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockDashboardApi(page);
});

test("logs in, navigates all routes, redirects unknown routes, and logs out", async ({ page }) => {
  await login(page);

  await expect(page.getByText("Quick Insights")).toBeVisible();
  await page.locator(".nav-sidebar").getByRole("link", { name: /Analytics/ }).click();
  await expect(page.getByText("Top 10 Rankings")).toBeVisible();
  await page.locator(".nav-sidebar").getByRole("link", { name: /Shipments/ }).click();
  await expect(page.getByText("Shipment Detail")).toBeVisible();
  await page.locator(".nav-sidebar").getByRole("link", { name: /Tracking/ }).click();
  await expect(page.getByText("Operational Tracking")).toBeVisible();
  await page.locator(".nav-sidebar").getByRole("link", { name: /Admin/ }).click();
  await expect(page.locator(".admin-title")).toHaveText("User Management");

  await page.goto("/missing-route");
  await expect(page.getByText("Monthly TEU Trend")).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Access dashboard" })).toBeVisible();
});
