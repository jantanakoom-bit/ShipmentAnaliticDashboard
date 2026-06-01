import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  values: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("./googleSheets.js", () => ({
  getSheetsClient: vi.fn(() => ({ spreadsheets: { values: mocks.values } })),
  requiredEnv: vi.fn(() => "sheet-1"),
}));

const { sanitizeExceptionWorkflowPatch, updateExceptionWorkflow } = await import("./trackingStore.js");

describe("trackingStore", () => {
  beforeEach(() => {
    mocks.values.get.mockReset();
    mocks.values.update.mockReset().mockResolvedValue({});
  });

  test("sanitizes action workflow patches and rejects invalid values", () => {
    expect(sanitizeExceptionWorkflowPatch({
      actionStatus: "IN_PROGRESS",
      priority: "HIGH",
      ownerUsername: " tester ",
      nextAction: "Call carrier",
      dueAt: "2026-06-03",
      note: "Waiting",
      exceptionUpdatedBy: "attacker",
    })).toEqual({
      exceptionStatus: "in_progress",
      exceptionPriority: "high",
      exceptionOwnerUsername: "tester",
      exceptionNextAction: "Call carrier",
      exceptionDueAt: "2026-06-03",
      exceptionNote: "Waiting",
    });

    expect(() => sanitizeExceptionWorkflowPatch({ actionStatus: "done" })).toThrow("Invalid exception action status.");
    expect(() => sanitizeExceptionWorkflowPatch({ priority: "critical" })).toThrow("Invalid exception priority.");
  });

  test("updates workflow columns with server-owned audit fields", async () => {
    mocks.values.get
      .mockResolvedValueOnce({
        data: { values: [["Date", "Booking No", "record_id"]] },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            [
              "Date",
              "Booking No",
              "record_id",
              "exception_status",
              "exception_priority",
              "exception_owner_user_id",
              "exception_owner_username",
              "exception_next_action",
              "exception_due_at",
              "exception_note",
              "exception_updated_by",
              "exception_updated_at",
              "exception_resolved_by",
              "exception_resolved_at",
            ],
            ["2026-06-01", "BK-100", "rec-100", "open", "normal", "", "", "", "", "", "", "", "", ""],
          ],
        },
      });

    const row = await updateExceptionWorkflow("rec-100", {
      exceptionStatus: "resolved",
      exceptionPriority: "high",
      exceptionOwnerUsername: "tester",
      exceptionNextAction: "Close loop",
      exceptionDueAt: "2026-06-03",
      exceptionNote: "Done",
    }, {
      session: { user: { id: "user-1", username: "tester", role: "user" } },
    });

    expect(row).toMatchObject({
      recordId: "rec-100",
      bookingNo: "BK-100",
      exceptionStatus: "resolved",
      exceptionPriority: "high",
      exceptionOwnerUsername: "tester",
      exceptionResolvedBy: "user-1",
    });
    expect(mocks.values.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      range: "Detail Data!A1:N1",
    }));
    const rowUpdate = mocks.values.update.mock.calls.at(-1)[0];
    expect(rowUpdate.range).toBe("Detail Data!A2:N2");
    expect(rowUpdate.requestBody.values[0]).toEqual(expect.arrayContaining([
      "resolved",
      "high",
      "tester",
      "Close loop",
      "2026-06-03",
      "Done",
      "user-1",
    ]));
  });
});
