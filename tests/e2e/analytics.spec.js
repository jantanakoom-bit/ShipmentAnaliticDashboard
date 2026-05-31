import { expect, test } from "@playwright/test";
import { login, mockDashboardApi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockDashboardApi(page);
});

test("analytics clear chips and ranking tabs change visible state", async ({ page }) => {
  await login(page);
  await page.locator(".nav-sidebar").getByRole("link", { name: /Analytics/ }).click();

  await page.getByRole("button", { name: "Clear carrier filter" }).click();
  await expect(page.getByText("0 TEU")).toBeVisible();
  await page.getByRole("button", { name: "Select All" }).click();

  await page.getByRole("button", { name: "Carriers", exact: true }).click();
  await expect(page.getByText("Carrier A").first()).toBeVisible();
  await page.getByRole("button", { name: "Countries", exact: true }).click();
  await expect(page.getByText("Japan").first()).toBeVisible();
  await page.getByRole("button", { name: "Trade Routes", exact: true }).click();
  await expect(page.getByText("Asia").first()).toBeVisible();
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await expect(page.getByText("Pan").first()).toBeVisible();
});
