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
  await expect(page.getByText("4000 chars")).toBeVisible();
  await expectChatLayout(page, { expectedWidth: 640 });
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

test("AI chat drawer composer stays anchored and usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await mockDashboardApi(page);

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        answer: "Mobile composer works.",
        dataUsed: { tools: [], rowsMatched: 0, rowLimitApplied: false },
        requestId: "req_mobile_e2e",
      },
    });
  });

  await login(page);
  await page.getByRole("button", { name: "AI" }).click();
  await expect(page.getByText("4000 chars")).toBeVisible();
  await expectChatLayout(page, { expectedWidth: 358 });

  await page.getByPlaceholder("Ask about selected shipment data...").fill("Mobile check");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Mobile composer works.")).toBeVisible();
});

test("AI chat drawer sends tracking page context and renders tracking tool usage", async ({ page }) => {
  await mockDashboardApi(page);

  let chatRequest = null;
  await page.route("**/api/chat", async (route) => {
    chatRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      json: {
        answer: "### Overdue Exceptions\n\n- **BK-001**: suggestion only, follow up with carrier.",
        dataUsed: {
          tools: ["get_tracking_exceptions"],
          rowsMatched: 1,
          rowLimitApplied: false,
        },
        requestId: "req_tracking_e2e",
      },
    });
  });

  await login(page);
  await page.goto("/tracking");
  await expect(page.getByText("Operational Tracking")).toBeVisible();

  await page.getByRole("button", { name: "AI" }).click();
  await page.getByPlaceholder("Ask about selected shipment data...").fill("สรุป exception ที่ overdue");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("heading", { name: "Overdue Exceptions" })).toBeVisible();
  await expect(page.getByLabel("AI shipment assistant").getByText("BK-001")).toBeVisible();
  await expect(page.getByText(/get_tracking_exceptions/)).toBeVisible();
  expect(chatRequest.messages.at(-1)).toMatchObject({ role: "user", content: "สรุป exception ที่ overdue" });
  expect(chatRequest.pageContext).toMatchObject({ route: "/tracking" });
});

async function expectChatLayout(page, { expectedWidth }) {
  const drawer = page.locator(".ai-chat-drawer");
  const launcher = page.locator(".ai-chat-launcher");
  const composer = page.locator(".ai-chat-composer");
  const actions = page.locator(".ai-chat-composer-actions");
  const textarea = page.getByPlaceholder("Ask about selected shipment data...");
  const send = page.getByRole("button", { name: "Send" });

  await expect(drawer).toBeVisible();
  await expect(composer).toBeVisible();
  await expect(actions).toBeVisible();
  await expect(textarea).toBeVisible();
  await expect(send).toBeVisible();

  const [drawerBox, launcherBox, composerBox, actionsBox, textareaBox, viewport] = await Promise.all([
    drawer.boundingBox(),
    launcher.boundingBox(),
    composer.boundingBox(),
    actions.boundingBox(),
    textarea.boundingBox(),
    page.viewportSize(),
  ]);

  expect(drawerBox).not.toBeNull();
  expect(launcherBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(textareaBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  expect(Math.abs(drawerBox.width - expectedWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs((drawerBox.x + drawerBox.width) - (launcherBox.x + launcherBox.width))).toBeLessThanOrEqual(2);
  expect(Math.abs((drawerBox.y + drawerBox.height) - (launcherBox.y + launcherBox.height))).toBeLessThanOrEqual(2);
  expect(drawerBox.x).toBeGreaterThanOrEqual(0);
  expect(drawerBox.y).toBeGreaterThanOrEqual(0);
  expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(viewport.width);
  expect(drawerBox.y + drawerBox.height).toBeLessThanOrEqual(viewport.height);
  expect(textareaBox.y).toBeGreaterThanOrEqual(composerBox.y);
  expect(actionsBox.y).toBeGreaterThanOrEqual(composerBox.y);
  expect(actionsBox.x).toBeGreaterThan(textareaBox.x + textareaBox.width);
}
