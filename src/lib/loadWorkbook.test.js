import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { loadWorkbookFile } from "./loadWorkbook";

function excelSerial(year, monthIndex, day) {
  return Date.UTC(year, monthIndex, day) / 86400000 + 25569;
}

function buildWorkbookFile(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Detail Data");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Code: "Asia" }]), "Trade");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Code: "Carrier A" }]), "Carrier");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  return {
    name: "fixture.xlsx",
    arrayBuffer: async () => buffer,
  };
}

describe("loadWorkbookFile", () => {
  test("parses and normalizes a workbook file", async () => {
    const file = buildWorkbookFile([
      {
        Date: excelSerial(2024, 0, 15),
        "Booking No": " BK-001 ",
        "Job No": "JOB-001",
        Shipper: "Alpha",
        POL: "BKK",
        POD: "TYO",
        Destination: "Tokyo",
        Country2: "Japan",
        Qty: "2",
        Unit: "40HC",
        TEU: "4",
        Status: "",
        "Sale Name": "Pan",
        TRADE: "Asia",
        CARRIER: "Carrier A",
      },
    ]);

    const data = await loadWorkbookFile(file);

    expect(data.metadata).toEqual({ source: "fixture.xlsx", shipments: 1 });
    expect(data.tradeLookup).toEqual([{ Code: "Asia" }]);
    expect(data.carrierLookup).toEqual([{ Code: "Carrier A" }]);
    expect(data.detailData[0]).toMatchObject({
      monthLabel: "Jan 2024",
      year: 2024,
      quarter: "Q1",
      yearQuarter: "2024 Q1",
      monthNumber: 1,
      monthName: "January",
      yearMonth: "2024-01",
      bookingNo: "BK-001",
      jobNo: "JOB-001",
      shipper: "Alpha",
      pol: "BKK",
      pod: "TYO",
      country: "Japan",
      port: "Tokyo",
      destination: "Tokyo",
      qty: 2,
      unit: "40HC",
      teu: 4,
      status: "Unspecified",
      saleName: "Pan",
      trade: "Asia",
      carrier: "Carrier A",
      route: "BKK -> Tokyo",
    });
    expect(data.detailData[0].date.toISOString()).toBe("2024-01-15T00:00:00.000Z");
  });
});
