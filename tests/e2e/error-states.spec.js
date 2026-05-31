import { expect, test } from "@playwright/test";
import { adminUser, mockDashboardApi } from "./helpers";

test("workbook errors render a controlled error state", async ({ page }) => {
  await mockDashboardApi(page, { user: adminUser, sessionStartsAuthenticated: true, workbookFails: true });
  await page.goto("/");
  await expect(page.getByText("Workbook unavailable")).toBeVisible();
});
