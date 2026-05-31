import { expect, test } from "@playwright/test";
import { login, mockDashboardApi, normalUser } from "./helpers";

test("admin can create users and patch role, password, and status", async ({ page }) => {
  await mockDashboardApi(page);
  await login(page);
  await page.locator(".nav-sidebar").getByRole("link", { name: /Admin/ }).click();

  await expect(page.locator(".admin-title")).toHaveText("User Management");
  await page.getByPlaceholder("e.g. john.doe").fill("new.user");
  await page.getByPlaceholder("e.g. John Doe").fill("New User");
  await page.getByPlaceholder("Initial password").fill("secret");
  await page.getByRole("combobox").selectOption("admin");
  await page.getByRole("button", { name: "Add User" }).click();
  await expect(page.getByText("new.user")).toBeVisible();

  await page.getByRole("button", { name: "Role" }).first().click();
  await expect(page.getByText("User updated successfully")).toBeVisible();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("New password for tester");
    await dialog.accept("reset-secret");
  });
  await page.getByRole("button", { name: "Reset" }).first().click();
  await expect(page.getByText("User updated successfully")).toBeVisible();
  await page.getByRole("button", { name: "Disable" }).first().click();
  await expect(page.getByText("Disabled").first()).toBeVisible();
});

test("non-admin sees access denied", async ({ page }) => {
  await mockDashboardApi(page, { user: normalUser });
  await login(page);
  await page.locator(".nav-sidebar").getByRole("link", { name: /Admin/ }).click();
  await expect(page.getByText("Access Denied")).toBeVisible();
});
