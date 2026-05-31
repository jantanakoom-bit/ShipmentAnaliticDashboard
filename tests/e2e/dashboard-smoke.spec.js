import { expect, test } from "@playwright/test";

const testUser = {
  id: "user-1",
  username: "tester",
  role: "admin",
  displayName: "Test User",
  status: "active",
};

const workbook = {
  metadata: {
    source: "e2e-fixture.xlsx",
    shipments: 2,
  },
  detailData: [
    {
      date: "2024-01-15T00:00:00.000Z",
      monthLabel: "Jan 2024",
      year: 2024,
      quarter: "Q1",
      yearQuarter: "2024 Q1",
      monthNumber: 1,
      monthName: "January",
      yearMonth: "2024-01",
      bookingNo: "BK-001",
      jobNo: "JOB-001",
      shipper: "Alpha Logistics",
      liner: "Liner A",
      pol: "BKK",
      pod: "TYO",
      country: "Japan",
      port: "Tokyo",
      destination: "Tokyo",
      qty: 2,
      unit: "40HC",
      teu: 4,
      status: "Loaded",
      saleName: "Pan",
      trade: "Asia",
      carrier: "Carrier A",
      route: "BKK -> Tokyo",
    },
    {
      date: "2024-04-10T00:00:00.000Z",
      monthLabel: "Apr 2024",
      year: 2024,
      quarter: "Q2",
      yearQuarter: "2024 Q2",
      monthNumber: 4,
      monthName: "April",
      yearMonth: "2024-04",
      bookingNo: "BK-002",
      jobNo: "JOB-002",
      shipper: "Beta Trading",
      liner: "Liner B",
      pol: "BKK",
      pod: "HAM",
      country: "Germany",
      port: "Hamburg",
      destination: "Hamburg",
      qty: 1,
      unit: "20DC",
      teu: 1,
      status: "Pending",
      saleName: "Mint",
      trade: "Europe",
      carrier: "Carrier B",
      route: "BKK -> Hamburg",
    },
  ],
};

test.beforeEach(async ({ page }) => {
  let authenticated = false;

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: authenticated ? 200 : 401,
      json: authenticated ? { user: testUser } : { error: "Authentication required" },
    });
  });

  await page.route("**/api/auth/login", async (route) => {
    authenticated = true;
    await route.fulfill({ status: 200, json: { user: testUser } });
  });

  await page.route("**/api/auth/logout", async (route) => {
    authenticated = false;
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  await page.route("**/api/workbook", async (route) => {
    await route.fulfill({ status: 200, json: workbook });
  });

  await page.route("**/api/admin/users", async (route) => {
    await route.fulfill({ status: 200, json: { users: [testUser] } });
  });
});

test("logs in, renders dashboard data, filters the table, and logs out", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Access dashboard" })).toBeVisible();
  await page.getByLabel("Username").fill("tester");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Shipment Analytics Dashboard")).toBeVisible();
  await expect(page.locator("#record-count")).toContainText("2 records");
  await expect(page.getByText("Alpha Logistics")).toBeVisible();
  await expect(page.getByText("Beta Trading")).toBeVisible();

  await page.getByTitle("Carrier B").click();
  await expect(page.locator("#record-count")).toContainText("1 records");
  await expect(page.getByText("Alpha Logistics")).toBeVisible();
  await expect(page.getByText("Beta Trading")).not.toBeVisible();

  await page.getByPlaceholder("Search booking, job, shipper, port...").fill("missing-booking");
  await expect(page.getByText("0 rows")).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Access dashboard" })).toBeVisible();
});
