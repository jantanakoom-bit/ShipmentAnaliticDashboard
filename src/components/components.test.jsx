import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminUsers from "./AdminUsers";
import AiChatDrawer from "./AiChatDrawer";
import ChartCard from "./ChartCard";
import ChipMultiSelect from "./ChipMultiSelect";
import DetailKpi from "./DetailKpi";
import HeroPanel from "./HeroPanel";
import InsightTile from "./InsightTile";
import KpiCard from "./KpiCard";
import MarkdownMessage from "./MarkdownMessage";
import NavSidebar from "./NavSidebar";
import OverviewKpis from "./OverviewKpis";
import SearchableMultiSelect from "./SearchableMultiSelect";
import ShipmentTable from "./ShipmentTable";
import Sidebar from "./Sidebar";
import TabPanel from "./TabPanel";
import TopListCard from "./TopListCard";
import TopRankings from "./TopRankings";
import { apiRequest } from "../lib/api";
import { sendAiChatMessage } from "../lib/aiChat";
import { buildMonthlySeries } from "../lib/utils";
import { adminUser, shipmentRows } from "../test/fixtures";
import { renderWithRouter } from "../test/test-utils";

vi.mock("../lib/api", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../lib/aiChat", () => ({
  sendAiChatMessage: vi.fn(),
}));

const countItems = [
  { value: "Tokyo", count: 2 },
  { value: "Hamburg", count: 1 },
  { value: "Singapore", count: 1 },
];

function sidebarProps(overrides = {}) {
  return {
    currentUser: adminUser,
    onLogout: vi.fn(),
    dateFilters: { years: ["2024"], quarters: ["Q1"], months: ["1"] },
    quarterOptions: [{ label: "Q1", value: "Q1" }, { label: "Q2", value: "Q2" }],
    monthOptions: [{ label: "Jan", value: "1" }, { label: "Apr", value: "4" }],
    yearOptions: [{ label: "2024", value: "2024" }, { label: "2025", value: "2025" }],
    onToggleDateFilter: vi.fn(),
    onSetAllDate: vi.fn(),
    counts: {
      port: countItems,
      country: [{ value: "Japan", count: 1 }],
      trade: [{ value: "Asia", count: 2 }],
      carrier: [{ value: "Carrier A", count: 2 }],
      sales: [{ value: "Pan", count: 2 }],
    },
    selected: {
      port: ["Tokyo"],
      country: ["Japan"],
      trade: ["Asia"],
      carrier: ["Carrier A"],
      sales: ["Pan"],
    },
    availableValues: {
      port: new Set(["Tokyo", "Singapore"]),
      country: new Set(["Japan"]),
      trade: new Set(["Asia"]),
      carrier: new Set(["Carrier A"]),
      sales: new Set(["Pan"]),
    },
    searches: { port: "", country: "", trade: "", carrier: "", sales: "" },
    onToggleSelect: vi.fn(),
    onSetSelected: vi.fn(),
    onSetSearches: vi.fn(),
    onSelectAll: vi.fn(),
    filterMode: "full",
    recordCount: 3,
    ...overrides,
  };
}

beforeEach(() => {
  apiRequest.mockReset();
  sendAiChatMessage.mockReset();
});

describe("presentational components", () => {
  test("renders cards, charts, lists, and summary components", () => {
    renderWithRouter(
      <>
        <ChartCard title="Trend" sub="Monthly"><div>chart body</div></ChartCard>
        <DetailKpi label="TEU" value="11" sub="Total" tone="#2563eb" />
        <KpiCard label="Bookings" value="3" sub="Unique" color="#059669" change="+1" />
        <InsightTile label="Top carrier" value="Carrier A" sub="10 TEU" />
        <HeroPanel topCarrier={[{ name: "Carrier A", value: 10 }]} topCountry={[{ name: "Japan", value: 4 }]} uniqueBookings={3} activeCarriers={2} />
        <OverviewKpis overviewRows={shipmentRows} overviewUnit={{ unit20: 1, unit40: 5 }} overviewMonthly={buildMonthlySeries(shipmentRows)} />
        <TopListCard title="Top Ports" items={[{ name: "Tokyo", value: 4 }]} color="#2563eb" />
        <TopRankings
          topPort={[{ name: "Tokyo", value: 4 }]}
          topCarrier={[{ name: "Carrier A", value: 10 }]}
          topCountry={[{ name: "Japan", value: 4 }]}
          topTrade={[{ name: "Asia", value: 10 }]}
          saleCards={[{ name: "Pan", rank: 1, teu: 10, unit20: 0, unit40: 5, totalUnits: 5, bookings: 2, shippers: 2, pct: 100 }]}
        />
      </>,
    );

    expect(screen.getByText("Trend")).toBeInTheDocument();
    expect(screen.getAllByText("TEU").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Top carrier").length).toBeGreaterThan(0);
    expect(screen.getByText("Top 10 Rankings")).toBeInTheDocument();
  });
});

describe("shared controls", () => {
  test("ChipMultiSelect fires all, clear, and toggle callbacks", async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    const onClearAll = vi.fn();
    const onToggle = vi.fn();

    renderWithRouter(
      <ChipMultiSelect
        options={[{ label: "2024", value: "2024" }]}
        selected={[]}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
      />,
    );

    await user.click(screen.getByRole("button", { name: "All" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "2024" }));

    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("2024");
  });

  test("SearchableMultiSelect searches, toggles, selects all, and clears", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const onToggle = vi.fn();
    const onSelectAll = vi.fn();
    const onClearAll = vi.fn();

    renderWithRouter(
      <SearchableMultiSelect
        label="Port"
        items={countItems}
        available={new Set(["Tokyo"])}
        selected={["Tokyo"]}
        search=""
        onSearch={onSearch}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
      />,
    );

    await user.type(screen.getByPlaceholderText("Search port..."), "Ham");
    await user.click(screen.getByRole("button", { name: "All" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("checkbox", { name: /Tokyo/ }));

    expect(onSearch).toHaveBeenLastCalledWith("m");
    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("Tokyo", false);
  });

  test("TabPanel switches tabs through callback", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    renderWithRouter(
      <TabPanel tabs={[{ key: "ports", label: "Ports" }, { key: "sales", label: "Sales" }]} activeTab="ports" onTabChange={onTabChange}>
        Active content
      </TabPanel>,
    );

    await user.click(screen.getByRole("button", { name: "Sales" }));
    expect(onTabChange).toHaveBeenCalledWith("sales");
  });
});

describe("navigation and sidebar controls", () => {
  test("NavSidebar collapses, navigates, filters, resets, and logs out", async () => {
    const user = userEvent.setup();
    const props = sidebarProps();

    renderWithRouter(<NavSidebar {...props} />);

    await user.click(screen.getByTitle("Collapse sidebar"));
    expect(screen.getByTitle("Expand sidebar")).toBeInTheDocument();
    await user.click(screen.getByTitle("Expand sidebar"));
    await user.click(screen.getByRole("link", { name: /Analytics/ }));
    await user.click(screen.getByRole("button", { name: "Q2" }));
    await user.click(screen.getByPlaceholderText("Search port..."));
    await user.keyboard("Tok");
    await user.click(screen.getByRole("checkbox", { name: /Tokyo/ }));
    await user.click(screen.getByRole("button", { name: "Select All" }));
    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(props.onToggleDateFilter).toHaveBeenCalledWith("quarters", "Q2");
    expect(props.onSetSearches).toHaveBeenCalled();
    expect(props.onToggleSelect).toHaveBeenCalledWith("port", "Tokyo", false);
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });

  test("legacy Sidebar exposes filters, users, and logout actions", async () => {
    const user = userEvent.setup();
    const props = sidebarProps({
      metadata: { shipments: 3 },
      filteredRows: shipmentRows,
      totalTeu: 11,
      onShowAdmin: vi.fn(),
    });

    renderWithRouter(<Sidebar {...props} />);

    await user.click(screen.getByRole("button", { name: "Users" }));
    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(screen.getByText("3 shipment records")).toBeInTheDocument();
    expect(props.onShowAdmin).toHaveBeenCalledTimes(1);
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });
});

describe("AI chat drawer", () => {
  test("opens, submits current filters, and renders answer metadata", async () => {
    const user = userEvent.setup();
    sendAiChatMessage.mockResolvedValue({
      answer: "### Top Carrier\n\n| Carrier | TEU |\n| --- | ---: |\n| Carrier A | 4 |\n\n- Strongest selected carrier",
      dataUsed: {
        tools: ["get_shipment_summary"],
        rowsMatched: 1,
        rowLimitApplied: false,
      },
    });

    renderWithRouter(
      <AiChatDrawer
        filters={{ years: ["2024"], trade: ["Asia"] }}
        pageContext={{ route: "/analytics", recordCount: 1 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "AI" }));
    await user.type(screen.getByPlaceholderText("Ask about selected shipment data..."), "Top carrier?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendAiChatMessage).toHaveBeenCalledTimes(1));
    expect(sendAiChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      filters: { years: ["2024"], trade: ["Asia"] },
      pageContext: { route: "/analytics", recordCount: 1 },
    }));
    expect(await screen.findByRole("heading", { name: "Top Carrier" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Strongest selected carrier")).toBeInTheDocument();
    expect(screen.getByText(/get_shipment_summary/)).toBeInTheDocument();
    expect(screen.getByText(/1 rows/)).toBeInTheDocument();
  });

  test("renders AI chat errors", async () => {
    const user = userEvent.setup();
    sendAiChatMessage.mockRejectedValue(new Error("AI chat is not configured"));

    renderWithRouter(<AiChatDrawer filters={{}} pageContext={{ route: "/", recordCount: 0 }} />);

    await user.click(screen.getByRole("button", { name: "AI" }));
    await user.type(screen.getByPlaceholderText("Ask about selected shipment data..."), "Help");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("AI chat is not configured")).toBeInTheDocument();
  });
});

describe("MarkdownMessage", () => {
  test("renders GitHub Flavored Markdown elements", () => {
    renderWithRouter(
      <MarkdownMessage
        content={"### Q1 Summary\n\n| Metric | Value |\n| --- | ---: |\n| Total TEU | 10,722 |\n\n- Carrier A leads\n- Route volume increased\n\n[Open report](https://example.com)"}
      />,
    );

    expect(screen.getByRole("heading", { name: "Q1 Summary" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Total TEU")).toBeInTheDocument();
    expect(screen.getByText("Carrier A leads")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open report" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Open report" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("does not render raw HTML from markdown content", () => {
    const { container } = renderWithRouter(
      <MarkdownMessage content={"<script>alert('xss')</script>\n\n<strong>Raw strong</strong>\n\n**Safe strong**"} />,
    );

    expect(screen.queryByText("alert('xss')")).not.toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("strong")).toHaveTextContent("Safe strong");
    expect(screen.getByText("Safe strong")).toBeInTheDocument();
  });
});

describe("stateful legacy components", () => {
  test("ShipmentTable searches and sorts rows", async () => {
    const user = userEvent.setup();
    renderWithRouter(<ShipmentTable filteredRows={shipmentRows} />);

    expect(screen.getByText("3 rows")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Search booking, job, shipper, port..."), "Beta");
    expect(screen.getByText("1 rows")).toBeInTheDocument();
    expect(screen.getByText("Beta Trading")).toBeInTheDocument();
    await user.click(screen.getByText(/Booking No/));
    expect(screen.getByText("BK-002")).toBeInTheDocument();
  });

  test("AdminUsers loads, creates, patches, resets password, and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
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
    vi.spyOn(window, "prompt").mockReturnValue("new-password");

    renderWithRouter(<AdminUsers onClose={onClose} />);

    expect(await screen.findByText("tester")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Username"), "new.user");
    await user.type(screen.getByPlaceholderText("Display name"), "New User");
    await user.type(screen.getByPlaceholderText("Password"), "secret");
    await user.selectOptions(screen.getByRole("combobox"), "admin");
    await user.click(screen.getByRole("button", { name: "Add user" }));
    await user.click(await screen.findByRole("button", { name: "Role" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Disable" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(apiRequest).toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({ method: "POST", body: expect.stringContaining("new.user") }));
    expect(apiRequest).toHaveBeenCalledWith("/api/admin/users/user-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ password: "new-password" }) }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
