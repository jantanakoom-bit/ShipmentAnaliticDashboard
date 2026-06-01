import { afterEach, describe, expect, test, vi } from "vitest";

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

const ORIGINAL_ENV = {
  WORKBOOK_MAX_ROWS: process.env.WORKBOOK_MAX_ROWS,
  WORKBOOK_MAX_COLUMNS: process.env.WORKBOOK_MAX_COLUMNS,
};

afterEach(() => {
  restoreEnv("WORKBOOK_MAX_ROWS");
  restoreEnv("WORKBOOK_MAX_COLUMNS");
});

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

  test("uses a bounded Google Sheets range with overflow sentinels", async () => {
    process.env.WORKBOOK_MAX_ROWS = "10";
    process.env.WORKBOOK_MAX_COLUMNS = "3";
    invalidateShipmentWriteCache();
    mocks.values.get.mockReset().mockResolvedValueOnce({
      data: {
        values: [
          ["Date", "Booking No", "Status"],
          ["2026-06-01", "BK-100", "Loaded"],
        ],
      },
    });

    await loadWorkbookData();

    expect(mocks.values.get).toHaveBeenCalledWith(expect.objectContaining({
      range: "Detail Data!A1:D12",
    }));
  });

  test("throws a controlled 413 when workbook row or column limits are exceeded", async () => {
    process.env.WORKBOOK_MAX_ROWS = "1";
    process.env.WORKBOOK_MAX_COLUMNS = "2";
    invalidateShipmentWriteCache();
    mocks.values.get.mockReset().mockResolvedValueOnce({
      data: {
        values: [
          ["Date", "Booking No"],
          ["2026-06-01", "BK-100"],
          ["2026-06-02", "BK-101"],
        ],
      },
    });

    await expect(loadWorkbookData()).rejects.toMatchObject({
      status: 413,
      message: "Workbook row limit exceeded. Maximum data rows: 1.",
    });

    invalidateShipmentWriteCache();
    mocks.values.get.mockReset().mockResolvedValueOnce({
      data: {
        values: [
          ["Date", "Booking No", "Status"],
          ["2026-06-01", "BK-100", "Loaded"],
        ],
      },
    });

    await expect(loadWorkbookData()).rejects.toMatchObject({
      status: 413,
      message: "Workbook column limit exceeded. Maximum columns: 2.",
    });
  });
});

function restoreEnv(key) {
  if (ORIGINAL_ENV[key] === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = ORIGINAL_ENV[key];
  }
}
