import { describe, expect, test } from "vitest";
import { buildDashboardModel, buildFilterOptions, filterDetailData } from "./dashboard";

const rows = [
  {
    date: new Date(Date.UTC(2024, 0, 15)),
    monthLabel: "Jan 2024",
    year: 2024,
    quarter: "Q1",
    yearQuarter: "2024 Q1",
    monthNumber: 1,
    yearMonth: "2024-01",
    shipper: "Alpha",
    destination: "Tokyo",
    qty: 2,
    teu: 4,
    status: "Loaded",
    trade: "Asia",
    carrier: "Carrier A",
    route: "BKK -> Tokyo",
  },
  {
    date: new Date(Date.UTC(2024, 1, 20)),
    monthLabel: "Feb 2024",
    year: 2024,
    quarter: "Q1",
    yearQuarter: "2024 Q1",
    monthNumber: 2,
    yearMonth: "2024-02",
    shipper: "Beta",
    destination: "Osaka",
    qty: 1,
    teu: 1,
    status: "Pending",
    trade: "Asia",
    carrier: "Carrier B",
    route: "BKK -> Osaka",
  },
  {
    date: new Date(Date.UTC(2025, 3, 10)),
    monthLabel: "Apr 2025",
    year: 2025,
    quarter: "Q2",
    yearQuarter: "2025 Q2",
    monthNumber: 4,
    yearMonth: "2025-04",
    shipper: "Alpha",
    destination: "Hamburg",
    qty: 3,
    teu: 6,
    status: "Loaded",
    trade: "Europe",
    carrier: "Carrier A",
    route: "BKK -> Hamburg",
  },
];

describe("buildFilterOptions", () => {
  test("returns sorted years, quarters, and month labels from detail rows", () => {
    expect(buildFilterOptions(rows)).toEqual({
      years: [2024, 2025],
      quarters: ["Q1", "Q2"],
      months: ["Jan 2024", "Feb 2024", "Apr 2025"],
    });
  });
});

describe("filterDetailData", () => {
  test("filters rows by year, quarter, and month", () => {
    const filtered = filterDetailData(rows, {
      year: "2024",
      quarter: "Q1",
      month: "Feb 2024",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].shipper).toBe("Beta");
  });
});

describe("buildDashboardModel", () => {
  test("builds summary, time series, rankings, and newest detail rows", () => {
    const model = buildDashboardModel(rows, {
      year: "All",
      quarter: "All",
      month: "All",
      grain: "year",
    });

    expect(model.filteredCount).toBe(3);
    expect(model.summary).toMatchObject({
      shipments: 3,
      totalTeu: 11,
      totalQty: 6,
      uniqueShippers: 2,
      activeRoutes: 3,
      averageTeuPerShipment: 11 / 3,
      latestPeriodLabel: "2025",
      shipmentChangePct: -50,
      teuChangePct: 20,
    });
    expect(model.timeSeries).toEqual([
      { key: "2024", label: "2024", teu: 5, shipments: 2, qty: 3 },
      { key: "2025", label: "2025", teu: 6, shipments: 1, qty: 3 },
    ]);
    expect(model.topCarriers[0]).toEqual({ name: "Carrier A", value: 10 });
    expect(model.statusBreakdown).toEqual([
      { name: "Loaded", value: 2 },
      { name: "Pending", value: 1 },
    ]);
    expect(model.detailRows[0].route).toBe("BKK -> Hamburg");
  });
});
