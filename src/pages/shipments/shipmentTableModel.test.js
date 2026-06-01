import { describe, expect, test } from "vitest";
import { shipmentRows } from "../../test/fixtures";
import {
  buildShipmentCsv,
  buildShipmentTableModel,
  normalizeShipmentPayload,
  rowToShipmentForm,
  SHIPMENT_COLUMNS,
} from "./shipmentTableModel";

const visibleColumns = new Set(SHIPMENT_COLUMNS.map((col) => col.key));

describe("shipmentTableModel", () => {
  test("filters by owner, searches rows, sorts, paginates, and totals searched rows", () => {
    const rows = shipmentRows.map((row, index) => ({
      ...row,
      ownerUsername: index === 1 ? "mint" : "pan",
    }));

    const model = buildShipmentTableModel({
      rows,
      canViewAll: true,
      ownerFilter: "pan",
      tableSearch: "asia",
      sortState: { key: "bookingNo", direction: "desc" },
      currentPage: 2,
      rowsPerPage: 1,
      visibleColumns,
    });

    expect(model.ownerOptions).toEqual(["mint", "pan"]);
    expect(model.searchedRows.map((row) => row.bookingNo)).toEqual(["BK-001", "BK-003"]);
    expect(model.sortedRows.map((row) => row.bookingNo)).toEqual(["BK-003", "BK-001"]);
    expect(model.pageRows.map((row) => row.bookingNo)).toEqual(["BK-001"]);
    expect(model.safePage).toBe(2);
    expect(model.pageStart).toBe(1);
    expect(model.pageEnd).toBe(2);
    expect(model.totals).toEqual({ qty: 5, teu: 10 });
  });

  test("ignores owner filter for users without all-sales visibility", () => {
    const rows = shipmentRows.map((row, index) => ({
      ...row,
      ownerUsername: index === 1 ? "mint" : "pan",
    }));

    const model = buildShipmentTableModel({
      rows,
      canViewAll: false,
      ownerFilter: "mint",
      tableSearch: "",
      sortState: { key: "date", direction: "asc" },
      currentPage: 9,
      rowsPerPage: 50,
      visibleColumns,
    });

    expect(model.sortedRows).toHaveLength(3);
    expect(model.safePage).toBe(1);
  });

  test("builds csv with visible columns and escapes special characters", () => {
    const csv = buildShipmentCsv(
      [
        {
          ...shipmentRows[0],
          bookingNo: "BK,001",
          shipper: 'Alpha "Quoted"\nLogistics',
        },
      ],
      new Set(["date", "bookingNo", "shipper"]),
    );

    expect(csv).toBe('Date,Booking No,Shipper\n2024-01-15,"BK,001","Alpha ""Quoted""\nLogistics"');
  });

  test("maps rows to form values and normalizes role-aware payloads", () => {
    const form = rowToShipmentForm({
      ...shipmentRows[0],
      recordId: "rec-001",
      ownerUserId: "user-2",
      ownerUsername: "viewer",
    });

    expect(form).toMatchObject({
      date: "2024-01-15",
      bookingNo: "BK-001",
      qty: 2,
      teu: 4,
      status: "Loaded",
      ownerUserId: "user-2",
      ownerUsername: "viewer",
    });

    expect(normalizeShipmentPayload({ ...form, qty: "3", teu: "6" }, false)).toEqual({
      date: "2024-01-15",
      bookingNo: "BK-001",
      jobNo: "JOB-001",
      shipper: "Alpha Logistics",
      port: "Tokyo",
      country: "Japan",
      trade: "Asia",
      carrier: "Carrier A",
      saleName: "Pan",
      qty: 3,
      unit: "40HC",
      teu: 6,
      status: "Loaded",
    });
    expect(normalizeShipmentPayload(form, true)).toMatchObject({
      ownerUserId: "user-2",
      ownerUsername: "viewer",
    });
  });
});
