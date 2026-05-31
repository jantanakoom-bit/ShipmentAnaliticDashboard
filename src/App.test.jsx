import { beforeEach, describe, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { apiRequest } from "./lib/api";
import { adminUser, apiWorkbookData } from "./test/fixtures";
import { renderWithRouter } from "./test/test-utils";

vi.mock("./lib/api", () => ({
  apiRequest: vi.fn(),
}));

function mockApi({ sessionUser = null, loginFails = false, workbookFails = false } = {}) {
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === "/api/auth/session") {
      if (!sessionUser) {
        throw new Error("Authentication required");
      }
      return { user: sessionUser };
    }
    if (path === "/api/auth/login") {
      if (loginFails) {
        throw new Error("Invalid username or password");
      }
      return { user: adminUser };
    }
    if (path === "/api/auth/logout") {
      return { ok: true };
    }
    if (path === "/api/workbook") {
      if (workbookFails) {
        throw new Error("Workbook unavailable");
      }
      return apiWorkbookData;
    }
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
}

beforeEach(() => {
  apiRequest.mockReset();
});

describe("App state management", () => {
  test("renders login after missing session and shows login errors", async () => {
    const user = userEvent.setup();
    mockApi({ loginFails: true });

    renderWithRouter(<App />);

    expect(await screen.findByRole("heading", { name: "Access dashboard" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "tester");
    await user.type(screen.getByLabelText("Password"), "bad-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
  });

  test("logs in, loads workbook, filters rows, navigates routes, and logs out", async () => {
    const user = userEvent.setup();
    mockApi();

    renderWithRouter(<App />);

    expect(await screen.findByRole("heading", { name: "Access dashboard" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "tester");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Monthly TEU Trend")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Shipments/ }));
    expect(await screen.findByText("Shipment Detail")).toBeInTheDocument();
    expect(screen.getByText("3 records")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Search booking, job, shipper, port..."), "Beta");
    expect(screen.getByText((_, element) => element?.textContent === "1 records — sortable, searchable, exportable")).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText("Search booking, job, shipper, port..."));

    await user.click(screen.getByRole("link", { name: /Analytics/ }));
    expect(await screen.findByText("Top 10 Rankings")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear carrier filter" }));
    await user.click(screen.getByRole("link", { name: /Shipments/ }));
    await waitFor(() => expect(screen.getByText("0 records")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Select All" }));
    await waitFor(() => expect(screen.getByText("3 records")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("heading", { name: "Access dashboard" })).toBeInTheDocument();
  });

  test("shows controlled workbook load error for authenticated users", async () => {
    mockApi({ sessionUser: adminUser, workbookFails: true });

    renderWithRouter(<App />);

    expect(await screen.findByText("Workbook unavailable")).toBeInTheDocument();
  });
});
