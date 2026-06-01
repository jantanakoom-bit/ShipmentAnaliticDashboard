import { beforeEach, describe, expect, test, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "../lib/api";
import { buildMonthlySeries, buildSaleCards, getUnitBreakdown, topGroup } from "../lib/utils";
import { adminUser, normalUser, shipmentRows } from "../test/fixtures";
import { renderWithRouter } from "../test/test-utils";
import AdminPage from "./AdminPage";
import AnalyticsPage from "./AnalyticsPage";
import DashboardPage from "./DashboardPage";
import ShipmentsPage from "./ShipmentsPage";
import TrackingPage from "./TrackingPage";

vi.mock("../lib/api", () => ({
  apiRequest: vi.fn(),
}));

function analyticsProps(overrides = {}) {
  const detailUnit = getUnitBreakdown(shipmentRows);
  return {
    filteredRows: shipmentRows,
    totalQty: 6,
    totalTeu: 11,
    detailUnit,
    filteredMonthly: buildMonthlySeries(shipmentRows),
    topCarrier: topGroup(shipmentRows, "carrier", 10),
    topCountry: topGroup(shipmentRows, "country", 10),
    topTrade: topGroup(shipmentRows, "trade", 12),
    topPort: topGroup(shipmentRows, "port", 10),
    topSales: topGroup(shipmentRows, "saleName", 15),
    saleCards: buildSaleCards(shipmentRows),
    dateFilters: { years: ["2024", "2025"], quarters: ["Q1"], months: ["1", "2", "4"] },
    selected: {
      port: ["Tokyo", "Hamburg", "Singapore"],
      carrier: ["Carrier A", "Carrier B"],
      country: ["Japan", "Germany", "Singapore"],
      trade: ["Asia", "Europe"],
      sales: ["Pan", "Mint"],
    },
    counts: {},
    onSetAllDate: vi.fn(),
    onSetSelected: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  apiRequest.mockReset();
});

describe("DashboardPage", () => {
  test("renders KPIs, chart shell, insight links, and navigation cards", async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <DashboardPage
        totalTeu={11}
        uniqueBookings={3}
        activeCarriers={2}
        totalQty={6}
        overviewMonthly={buildMonthlySeries(shipmentRows)}
        topCarrier={topGroup(shipmentRows, "carrier", 10)}
        topCountry={topGroup(shipmentRows, "country", 10)}
        topSales={topGroup(shipmentRows, "saleName", 10)}
      />,
    );

    expect(screen.getByText("Total TEU")).toBeInTheDocument();
    expect(screen.getByText("Monthly TEU Trend")).toBeInTheDocument();
    expect(screen.getByText("Quick Insights")).toBeInTheDocument();
    await user.click(screen.getByText("Analytics Deep Dive"));
    expect(window.location.pathname).toBe("/");
  });
});

describe("AnalyticsPage", () => {
  test("clears filter chips and switches ranking tabs", async () => {
    const user = userEvent.setup();
    const props = analyticsProps();

    renderWithRouter(<AnalyticsPage {...props} />);

    await user.click(screen.getByRole("button", { name: "Clear year filter" }));
    await user.click(screen.getByRole("button", { name: "Clear quarter filter" }));
    await user.click(screen.getByRole("button", { name: "Clear port filter" }));
    await user.click(screen.getByRole("button", { name: "Carriers" }));
    expect(screen.getByText("Carrier A")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sales" }));
    expect(screen.getByText("Pan")).toBeInTheDocument();

    expect(props.onSetAllDate).toHaveBeenCalledWith("years", []);
    expect(props.onSetAllDate).toHaveBeenCalledWith("quarters", []);
    expect(props.onSetSelected).toHaveBeenCalled();
  });
});

describe("ShipmentsPage", () => {
  test("searches, sorts, changes visible columns, paginates, and exports CSV", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:shipments");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWithRouter(<ShipmentsPage filteredRows={shipmentRows} />);

    await user.type(screen.getByPlaceholderText("Search booking, job, shipper, port..."), "Beta");
    expect(screen.getByText((_, element) => element?.textContent === "1 records — sortable, searchable, exportable")).toBeInTheDocument();
    expect(screen.getByText("Beta Trading")).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText("Search booking, job, shipper, port..."));
    await user.click(screen.getByText("Booking No"));
    await user.click(screen.getByRole("button", { name: "Columns ▾" }));
    await user.click(screen.getByRole("checkbox", { name: "Country" }));
    expect(within(screen.getByRole("table")).queryByText("Country")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), "25");
    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:shipments");
  });
});

describe("TrackingPage", () => {
  test("renders operational KPIs, milestones, and filters exception rows", async () => {
    const user = userEvent.setup();
    const rows = [
      {
        ...shipmentRows[0],
        shipmentId: "SHP-001",
        eta: new Date("2026-05-20T00:00:00.000Z"),
        currentMilestone: "In Transit",
        lastEventTime: new Date("2026-05-29T00:00:00.000Z"),
      },
      {
        ...shipmentRows[1],
        shipmentId: "SHP-002",
        eta: new Date("2026-06-10T00:00:00.000Z"),
        currentMilestone: "Booked",
        lastEventTime: new Date("2026-05-20T00:00:00.000Z"),
      },
    ];

    renderWithRouter(<TrackingPage filteredRows={rows} now={new Date("2026-06-01T00:00:00.000Z")} />);

    expect(screen.getByText("Operational Tracking")).toBeInTheDocument();
    expect(screen.getByText("2 active exceptions")).toBeInTheDocument();
    expect(screen.getByText("Tracked Shipments")).toBeInTheDocument();
    expect(screen.getAllByText("Delayed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In Transit").length).toBeGreaterThan(0);
    expect(screen.getByText("BK-001")).toBeInTheDocument();
    expect(screen.getByText("BK-002")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Exception type"), "delayed");
    expect(screen.getByText("BK-001")).toBeInTheDocument();
    expect(screen.queryByText("BK-002")).not.toBeInTheDocument();
  });
});

describe("AdminPage", () => {
  test("blocks non-admin users", () => {
    renderWithRouter(<AdminPage currentUser={normalUser} />);
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  test("loads users, creates user, patches role/status, and resets password", async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === "/api/admin/users" && !options.method) {
        return { users: [adminUser] };
      }
      if (path === "/api/admin/users" && options.method === "POST") {
        return { user: { ...adminUser, id: "new-user" } };
      }
      if (path.startsWith("/api/admin/users/") && options.method === "PATCH") {
        return { user: adminUser };
      }
      throw new Error(`Unhandled request: ${path}`);
    });
    vi.spyOn(window, "prompt").mockReturnValue("reset-secret");

    renderWithRouter(<AdminPage currentUser={adminUser} />);

    expect(await screen.findByText("tester")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("e.g. john.doe"), "new.user");
    await user.type(screen.getByPlaceholderText("e.g. John Doe"), "New User");
    await user.type(screen.getByPlaceholderText("Initial password"), "secret");
    await user.selectOptions(screen.getByRole("combobox"), "admin");
    await user.click(screen.getByRole("button", { name: "Add User" }));
    expect(await screen.findByText("User created successfully")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Role" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Disable" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/admin/users/user-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ password: "reset-secret" }) }));
      expect(apiRequest).toHaveBeenCalledWith("/api/admin/users/user-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "disabled" }) }));
    });
  });
});
