export const adminUser = {
  id: "user-1",
  username: "tester",
  role: "admin",
  displayName: "Test User",
  status: "active",
};

export const normalUser = {
  ...adminUser,
  id: "user-2",
  username: "viewer",
  role: "user",
  displayName: "View User",
};

export const moderatorUser = {
  ...adminUser,
  id: "user-4",
  username: "moderator",
  role: "moderator",
  displayName: "Moderator User",
};

const ports = [
  { port: "Tokyo", country: "Japan", trade: "Asia", carrier: "Carrier A", saleName: "Pan", unit: "40HC", teu: 4, qty: 2 },
  { port: "Hamburg", country: "Germany", trade: "Europe", carrier: "Carrier B", saleName: "Mint", unit: "20DC", teu: 1, qty: 1 },
  { port: "Singapore", country: "Singapore", trade: "Asia", carrier: "Carrier A", saleName: "Pan", unit: "40HC", teu: 6, qty: 3 },
];

export function buildRows(count = 60) {
  return Array.from({ length: count }, (_, index) => {
    const template = ports[index % ports.length];
    const monthNumber = (index % 12) + 1;
    const year = index < count / 2 ? 2024 : 2025;
    const date = new Date(Date.UTC(year, monthNumber - 1, Math.min(28, (index % 27) + 1)));
    return {
      date: date.toISOString(),
      monthLabel: date.toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" }),
      year,
      quarter: `Q${Math.ceil(monthNumber / 3)}`,
      yearQuarter: `${year} Q${Math.ceil(monthNumber / 3)}`,
      monthNumber,
      monthName: date.toLocaleString("en", { month: "long", timeZone: "UTC" }),
      yearMonth: `${year}-${String(monthNumber).padStart(2, "0")}`,
      bookingNo: `BK-${String(index + 1).padStart(3, "0")}`,
      jobNo: `JOB-${String(index + 1).padStart(3, "0")}`,
      shipper: index % 2 === 0 ? "Alpha Logistics" : "Beta Trading",
      liner: `Liner ${index % 3}`,
      pol: "BKK",
      pod: template.port.slice(0, 3).toUpperCase(),
      country: template.country,
      port: template.port,
      destination: template.port,
      qty: template.qty,
      unit: template.unit,
      teu: template.teu,
      status: index % 2 === 0 ? "Loaded" : "Pending",
      saleName: template.saleName,
      trade: template.trade,
      carrier: template.carrier,
      route: `BKK -> ${template.port}`,
      shipmentId: `SHP-${String(index + 1).padStart(3, "0")}`,
      recordId: `rec-${String(index + 1).padStart(3, "0")}`,
      ownerUserId: template.saleName === "Mint" ? "user-3" : "user-2",
      ownerUsername: template.saleName === "Mint" ? "mint" : "viewer",
      containerNo: `CONT-${String(index + 1).padStart(3, "0")}`,
      eta: index % 3 === 0 ? "2024-02-01T00:00:00.000Z" : "2027-02-01T00:00:00.000Z",
      ata: null,
      currentMilestone: index % 3 === 0 ? "In Transit" : "Booked",
      lastEventTime: index % 3 === 0 ? "2024-01-10T00:00:00.000Z" : "2027-01-10T00:00:00.000Z",
      delayDays: index % 3 === 0 ? 5 : 0,
      delayReason: index % 3 === 0 ? "Carrier delay" : "",
      onTimeFlag: index % 3 === 0 ? "No" : "Yes",
    };
  });
}

export async function mockDashboardApi(
  page,
  { user = adminUser, sessionStartsAuthenticated = false, workbookFails = false, rows = buildRows() } = {},
) {
  let authenticated = sessionStartsAuthenticated;
  let workbookRows = [...rows];
  let users = [
    adminUser,
    { id: "user-3", username: "disabled", role: "user", displayName: "Disabled User", status: "disabled" },
  ];

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: authenticated ? 200 : 401,
      json: authenticated ? { user } : { error: "Authentication required" },
    });
  });

  await page.route("**/api/auth/login", async (route) => {
    authenticated = true;
    await route.fulfill({ status: 200, json: { user } });
  });

  await page.route("**/api/auth/logout", async (route) => {
    authenticated = false;
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  await page.route("**/api/workbook", async (route) => {
    if (workbookFails) {
      await route.fulfill({ status: 500, json: { error: "Workbook unavailable" } });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        metadata: { source: "e2e-fixture.xlsx", shipments: rows.length },
        detailData: workbookRows.filter((row) => !row.isDeleted),
      },
    });
  });

  await page.route("**/api/shipments/*", async (route) => {
    const request = route.request();
    const id = decodeURIComponent(new URL(request.url()).pathname.split("/").pop());
    const index = workbookRows.findIndex((row) => row.recordId === id);
    if (index === -1) {
      await route.fulfill({ status: 404, json: { error: "Shipment not found." } });
      return;
    }
    if (request.method() === "PATCH") {
      workbookRows[index] = { ...workbookRows[index], ...request.postDataJSON(), updatedBy: user.id };
      await route.fulfill({ status: 200, json: { row: workbookRows[index] } });
      return;
    }
    if (request.method() === "DELETE") {
      workbookRows[index] = { ...workbookRows[index], isDeleted: true, deletedBy: user.id };
      await route.fulfill({ status: 200, json: { row: workbookRows[index] } });
      return;
    }
    await route.fulfill({ status: 200, json: { row: workbookRows[index] } });
  });

  await page.route("**/api/shipments", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      const createdDate = body.date ? new Date(`${body.date}T00:00:00.000Z`) : new Date();
      const monthNumber = createdDate.getUTCMonth() + 1;
      const year = createdDate.getUTCFullYear();
      const row = {
        ...body,
        date: createdDate.toISOString(),
        monthLabel: createdDate.toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" }),
        year,
        quarter: `Q${Math.ceil(monthNumber / 3)}`,
        yearQuarter: `${year} Q${Math.ceil(monthNumber / 3)}`,
        monthNumber,
        monthName: createdDate.toLocaleString("en", { month: "long", timeZone: "UTC" }),
        yearMonth: `${year}-${String(monthNumber).padStart(2, "0")}`,
        route: `BKK -> ${body.port || body.destination || "Unknown"}`,
        recordId: `rec-${String(workbookRows.length + 1).padStart(3, "0")}`,
        ownerUserId: user.id,
        ownerUsername: user.username,
        createdBy: user.id,
        updatedBy: user.id,
        isDeleted: false,
      };
      workbookRows = [row, ...workbookRows];
      await route.fulfill({ status: 201, json: { row } });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/admin/users/*", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    const id = decodeURIComponent(new URL(request.url()).pathname.split("/").pop());
    users = users.map((item) => (item.id === id ? { ...item, ...body } : item));
    await route.fulfill({ status: 200, json: { user: users.find((item) => item.id === id) } });
  });

  await page.route("**/api/admin/users", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      users = [
        ...users,
        {
          id: `user-${users.length + 1}`,
          username: body.username,
          displayName: body.displayName,
          role: body.role,
          status: "active",
        },
      ];
      await route.fulfill({ status: 201, json: { user: users[users.length - 1] } });
      return;
    }
    await route.fulfill({ status: 200, json: { users } });
  });
}

export async function login(page) {
  await page.goto("/");
  await page.getByLabel("Username").fill("tester");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Monthly TEU Trend").waitFor();
}
