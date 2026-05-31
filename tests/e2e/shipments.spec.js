import { expect, test } from "@playwright/test";
import { login, mockDashboardApi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockDashboardApi(page);
});

test("shipments search, sort, columns, rows-per-page, pagination, and CSV export work", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: /Shipments/ }).click();

  await expect(page.locator("#record-count")).toContainText("60 records");
  await page.getByPlaceholder("Search booking, job, shipper, port...").fill("BK-060");
  await expect(page.getByText("1 records").first()).toBeVisible();
  await expect(page.getByText("BK-060")).toBeVisible();
  await page.getByPlaceholder("Search booking, job, shipper, port...").clear();

  await page.getByText("Booking No").click();
  await page.getByRole("button", { name: "Columns ▾" }).click();
  await page.getByRole("checkbox", { name: "Country" }).uncheck();
  await expect(page.locator("thead").getByText("Country")).toHaveCount(0);

  await page.getByRole("combobox").selectOption("25");
  await expect(page.getByText(/Showing 1.*25 of 60 records/)).toBeVisible();
  await page.getByRole("button", { name: "›" }).click();
  await expect(page.getByText(/Showing 26.*50 of 60 records/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("shipments.csv");
});
