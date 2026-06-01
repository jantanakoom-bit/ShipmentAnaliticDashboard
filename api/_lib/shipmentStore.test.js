import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  values: {
    get: vi.fn(),
    update: vi.fn(),
    batchUpdate: vi.fn(),
    append: vi.fn(),
  },
}));

vi.mock("./googleSheets.js", () => ({
  getSheetsClient: vi.fn(() => ({ spreadsheets: { values: mocks.values } })),
  requiredEnv: vi.fn(() => "sheet-1"),
}));

const {
  backfillMissingRecordIds,
  createShipment,
  ensureDetailDataSchema,
  updateShipment,
} = await import("./shipmentStore.js");

describe("shipmentStore", () => {
  beforeEach(() => {
    mocks.values.get.mockReset();
    mocks.values.update.mockReset().mockResolvedValue({});
    mocks.values.batchUpdate.mockReset().mockResolvedValue({});
    mocks.values.append.mockReset().mockResolvedValue({});
  });

  test("adds missing RBAC columns without removing existing headers", async () => {
    mocks.values.get.mockResolvedValueOnce({
      data: { values: [["Date", "Booking No", "Extra"]] },
    });

    const result = await ensureDetailDataSchema(["record_id", "owner_user_id"]);

    expect(result).toMatchObject({
      missing: ["record_id", "owner_user_id"],
      updated: true,
    });
    expect(mocks.values.update).toHaveBeenCalledWith(expect.objectContaining({
      range: "Detail Data!A1:E1",
      requestBody: { values: [["Date", "Booking No", "Extra", "record_id", "owner_user_id"]] },
    }));
  });

  test("creates shipment rows with session-owned audit fields", async () => {
    mocks.values.get.mockResolvedValueOnce({
      data: { values: [["Date", "Booking No", "owner_user_id", "owner_username", "record_id", "created_by", "updated_by", "created_at", "updated_at", "is_deleted", "deleted_at", "deleted_by"]] },
    });

    const row = await createShipment({
      body: { date: "2026-06-01", bookingNo: "BK-100", ownerUserId: "other-user" },
      session: { user: { id: "user-1", username: "tester", role: "user" } },
    });

    expect(row).toMatchObject({
      bookingNo: "BK-100",
      ownerUserId: "user-1",
      ownerUsername: "tester",
      createdBy: "user-1",
      updatedBy: "user-1",
      isDeleted: false,
    });
    const appendCall = mocks.values.append.mock.calls[0][0];
    expect(appendCall.requestBody.values[0][2]).toBe("user-1");
    expect(appendCall.requestBody.values[0][3]).toBe("tester");
  });

  test("updates shipment rows while preserving unknown sheet columns", async () => {
    mocks.values.get
      .mockResolvedValueOnce({
        data: { values: [["Date", "Booking No", "Status", "record_id", "owner_user_id", "owner_username", "updated_by", "updated_at", "Extra"]] },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ["Date", "Booking No", "Status", "record_id", "owner_user_id", "owner_username", "updated_by", "updated_at", "Extra"],
            ["2026-06-01", "BK-100", "Booked", "rec-100", "user-1", "tester", "", "", "keep-me"],
          ],
        },
      });

    const row = await updateShipment("rec-100", { status: "Completed", ownerUserId: "other-user" }, {
      session: { user: { id: "user-1", username: "tester", role: "user" } },
    });

    expect(row).toMatchObject({
      recordId: "rec-100",
      status: "Completed",
      ownerUserId: "user-1",
      updatedBy: "user-1",
    });
    const updateCall = mocks.values.update.mock.calls.at(-1)[0];
    expect(updateCall.requestBody.values[0]).toEqual(expect.arrayContaining(["keep-me"]));
    expect(updateCall.requestBody.values[0][4]).toBe("user-1");
  });

  test("dry-runs missing record id backfill without writing rows", async () => {
    mocks.values.get.mockResolvedValueOnce({
      data: {
        values: [
          ["Date", "Booking No", "record_id"],
          ["2026-06-01", "BK-100", ""],
          ["2026-06-02", "BK-101", "rec-existing"],
          ["2026-06-03", "BK-102", ""],
        ],
      },
    });

    const result = await backfillMissingRecordIds();

    expect(result).toMatchObject({
      dryRun: true,
      totalRows: 3,
      missingRecordIds: 2,
      updatedRows: 0,
    });
    expect(mocks.values.update).not.toHaveBeenCalled();
  });

  test("dry-runs missing record id column without mutating the sheet", async () => {
    mocks.values.get.mockResolvedValueOnce({
      data: {
        values: [
          ["Date", "Booking No"],
          ["2026-06-01", "BK-100"],
          ["2026-06-02", "BK-101"],
        ],
      },
    });

    const result = await backfillMissingRecordIds();

    expect(result).toMatchObject({
      dryRun: true,
      totalRows: 2,
      missingRecordIds: 2,
      updatedRows: 0,
      recordIdColumnMissing: true,
    });
    expect(mocks.values.get).toHaveBeenCalledWith(expect.objectContaining({
      range: "Detail Data!A1:DY10002",
    }));
    expect(mocks.values.update).not.toHaveBeenCalled();
  });

  test("applies record id header before backfilling blank ids", async () => {
    mocks.values.get
      .mockResolvedValueOnce({
        data: { values: [["Date", "Booking No"]] },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ["Date", "Booking No", "record_id"],
            ["2026-06-01", "BK-100", ""],
          ],
        },
      });

    const result = await backfillMissingRecordIds({ dryRun: false });

    expect(result).toMatchObject({
      dryRun: false,
      totalRows: 1,
      missingRecordIds: 1,
      updatedRows: 1,
    });
    expect(mocks.values.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      range: "Detail Data!A1:C1",
      requestBody: { values: [["Date", "Booking No", "record_id"]] },
    }));
    expect(mocks.values.batchUpdate).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: "Detail Data!C2:C2",
            values: [[expect.any(String)]],
          },
        ],
      },
    }));
  });

  test("applies missing record id backfill only to blank record_id cells", async () => {
    mocks.values.get
      .mockResolvedValueOnce({
        data: { values: [["Date", "Booking No", "record_id"]] },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ["Date", "Booking No", "record_id"],
            ["2026-06-01", "BK-100", ""],
            ["2026-06-02", "BK-101", "rec-existing"],
            ["2026-06-03", "BK-102", ""],
          ],
        },
      });

    const result = await backfillMissingRecordIds({ dryRun: false });

    expect(result).toMatchObject({
      dryRun: false,
      totalRows: 3,
      missingRecordIds: 2,
      updatedRows: 2,
    });
    expect(mocks.values.update).not.toHaveBeenCalled();
    expect(mocks.values.batchUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.values.batchUpdate).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: "Detail Data!C2:C2",
            values: [[expect.any(String)]],
          },
          {
            range: "Detail Data!C4:C4",
            values: [[expect.any(String)]],
          },
        ],
      },
    }));
  });

  test("does not write when all shipment rows already have record ids", async () => {
    mocks.values.get
      .mockResolvedValueOnce({
        data: { values: [["Date", "Booking No", "record_id"]] },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ["Date", "Booking No", "record_id"],
            ["2026-06-01", "BK-100", "rec-100"],
            ["2026-06-02", "BK-101", "rec-101"],
          ],
        },
      });

    const result = await backfillMissingRecordIds({ dryRun: false });

    expect(result).toMatchObject({
      dryRun: false,
      totalRows: 2,
      missingRecordIds: 0,
      updatedRows: 0,
    });
    expect(mocks.values.update).not.toHaveBeenCalled();
  });
});
