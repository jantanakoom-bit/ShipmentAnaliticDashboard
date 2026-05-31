import { expect, test } from "@playwright/test";
import { buildRows, login, mockDashboardApi } from "./helpers";

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

test("dashboard KPI values match workbook totals and active filters", async ({ page }) => {
  const rows = buildRows();
  await mockDashboardApi(page, { rows });
  await login(page);

  await expectDashboardKpis(page, summarizeRows(rows));

  const quarterFilter = page.locator(".filter-section").filter({ hasText: "Quarter" });
  await quarterFilter.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("button", { name: "Q2" }).click();

  const q2Rows = rows.filter((row) => row.quarter === "Q2");
  await expectDashboardKpis(page, summarizeRows(q2Rows));
});

function summarizeRows(rows) {
  return {
    totalTeu: rows.reduce((sum, row) => sum + row.teu, 0),
    uniqueBookings: new Set(rows.map((row) => row.bookingNo).filter(Boolean)).size,
    activeCarriers: new Set(rows.map((row) => row.carrier).filter(Boolean)).size,
    totalQty: rows.reduce((sum, row) => sum + row.qty, 0),
  };
}

async function expectDashboardKpis(page, summary) {
  await expectKpi(page, "Total TEU", summary.totalTeu);
  await expectKpi(page, "Bookings", summary.uniqueBookings);
  await expectKpi(page, "Active Carriers", summary.activeCarriers);
  await expectKpi(page, "Containers", summary.totalQty);
}

async function expectKpi(page, label, value) {
  const card = page.locator(".kpi-card").filter({ hasText: label });
  await expect(card.locator(".kpi-value")).toHaveText(formatNumber(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}
