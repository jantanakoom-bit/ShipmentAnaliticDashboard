import { expect, test } from "@playwright/test";
import { login, mockDashboardApi, moderatorUser } from "./helpers";

test("shipments search, sort, columns, rows-per-page, pagination, and CSV export work", async ({ page }) => {
  await mockDashboardApi(page);
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

  await page.locator(".rows-select").last().selectOption("25");
  await expect(page.getByText(/Showing 1.*25 of 60 records/)).toBeVisible();
  await page.getByRole("button", { name: "›" }).click();
  await expect(page.getByText(/Showing 26.*50 of 60 records/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("shipments.csv");
});

test("shipment CRUD controls create, update, and soft-delete records", async ({ page }) => {
  await mockDashboardApi(page);
  await login(page);
  await page.getByRole("link", { name: /Shipments/ }).click();

  await page.getByRole("button", { name: "Add Shipment" }).click();
  await page.getByLabel("Date").fill("2026-06-01");
  await page.getByLabel("Booking No").fill("BK-NEW");
  await page.getByLabel("Job No").fill("JOB-NEW");
  await page.getByLabel("Shipper").fill("Created Co");
  await page.getByLabel("Port").fill("Tokyo");
  await page.getByLabel("Country").fill("Japan");
  await page.getByLabel("Trade").fill("Asia");
  await page.getByLabel("Carrier", { exact: true }).fill("Carrier A");
  await page.getByLabel("Sale Name", { exact: true }).fill("Pan");
  await page.getByLabel("Qty").fill("2");
  await page.getByLabel("Unit").fill("40HC");
  await page.getByLabel("TEU").fill("4");
  await page.getByRole("button", { name: "Create Shipment" }).click();
  await expect(page.getByText("Shipment created successfully")).toBeVisible();
  await page.getByPlaceholder("Search booking, job, shipper, port...").fill("BK-NEW");
  await expect(page.getByText("BK-NEW")).toBeVisible();

  await page.getByRole("button", { name: "View BK-NEW" }).click();
  const detailDialog = page.getByRole("dialog", { name: "Shipment Detail: BK-NEW" });
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog.getByText("Shipment Detail: BK-NEW")).toBeVisible();
  await detailDialog.getByLabel("Status").selectOption("Completed");
  await detailDialog.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Shipment updated successfully")).toBeVisible();
  await detailDialog.getByRole("button", { name: "Delete Shipment" }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Delete shipment BK-NEW?" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmDialog).toHaveCount(0);
  await expect(detailDialog).toBeVisible();
  await detailDialog.getByRole("button", { name: "Delete Shipment" }).click();
  await page.getByRole("dialog", { name: "Delete shipment BK-NEW?" }).getByRole("button", { name: "Confirm Delete" }).click();
  await expect(page.getByText("Shipment deleted successfully")).toBeVisible();
});

test("moderator can filter shipment table by sales person", async ({ page }) => {
  await mockDashboardApi(page, { user: moderatorUser });
  await login(page);
  await page.getByRole("link", { name: /Shipments/ }).click();

  await expect(page.getByLabel("Sales Person")).toBeVisible();
  await page.getByLabel("Sales Person").selectOption("mint");
  const table = page.locator(".table-scroll table");
  await expect(table.getByText("Mint").first()).toBeVisible();
  await expect(table.getByText("Pan")).toHaveCount(0);
});
