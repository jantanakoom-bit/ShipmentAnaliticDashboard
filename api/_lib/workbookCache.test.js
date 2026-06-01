import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  values: {
    get: vi.fn(),
  },
}));

vi.mock("./googleSheets.js", () => ({
  getSheetsClient: vi.fn(() => ({ spreadsheets: { values: mocks.values } })),
  requiredEnv: vi.fn(() => "sheet-1"),
}));

const { loadWorkbookData } = await import("./workbook.js");
const { invalidateShipmentWriteCache } = await import("./shipmentWriteCache.js");

describe("workbook cache invalidation", () => {
  test("reloads Google Sheets data after a shipment write invalidates the cache", async () => {
    mocks.values.get.mockReset();
    mocks.values.get
      .mockResolvedValueOnce({
        data: {
          values: [
            ["Date", "Booking No", "Status", "record_id"],
            ["2026-06-01", "BK-100", "Loaded", "rec-100"],
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ["Date", "Booking No", "Status", "record_id"],
            ["2026-06-01", "BK-100", "Completed", "rec-100"],
          ],
        },
      });

    const cached = await loadWorkbookData();
    expect(cached.detailData[0]).toMatchObject({ recordId: "rec-100", status: "Loaded" });

    const stillCached = await loadWorkbookData();
    expect(stillCached.detailData[0]).toMatchObject({ recordId: "rec-100", status: "Loaded" });

    invalidateShipmentWriteCache();

    const refreshed = await loadWorkbookData();
    expect(refreshed.detailData[0]).toMatchObject({ recordId: "rec-100", status: "Completed" });
    expect(mocks.values.get).toHaveBeenCalledTimes(2);
  });
});
