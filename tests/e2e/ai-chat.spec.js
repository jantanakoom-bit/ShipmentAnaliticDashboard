import { expect, test } from "@playwright/test";
import { login, mockDashboardApi } from "./helpers.js";

test("AI chat drawer sends dashboard context and renders the response", async ({ page }) => {
  await mockDashboardApi(page);

  let chatRequest = null;
  await page.route("**/api/chat", async (route) => {
    chatRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      json: {
        answer: "### Top Carrier\n\n| Carrier | TEU |\n| --- | ---: |\n| Carrier A | 10 |\n\n- Carrier A leads the selected data.",
        dataUsed: {
          tools: ["get_shipment_summary"],
          rowsMatched: 60,
          rowLimitApplied: false,
        },
        requestId: "req_e2e",
      },
    });
  });

  await login(page);
  await page.getByRole("button", { name: "AI" }).click();
  await page.getByPlaceholder("Ask about selected shipment data...").fill("Top carrier by TEU?");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("heading", { name: "Top Carrier" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Carrier A" })).toBeVisible();
  await expect(page.getByText("Carrier A leads the selected data.")).toBeVisible();
  await expect(page.getByText(/get_shipment_summary/)).toBeVisible();
  expect(chatRequest.messages.at(-1)).toMatchObject({ role: "user", content: "Top carrier by TEU?" });
  expect(chatRequest.filters.years).toContain("2024");
  expect(chatRequest.filters.carrier).toContain("Carrier A");
  expect(chatRequest.pageContext).toMatchObject({ route: "/", recordCount: 60 });
});
