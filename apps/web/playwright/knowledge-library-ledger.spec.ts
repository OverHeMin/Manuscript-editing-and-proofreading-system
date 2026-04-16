import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("knowledge library ledger flow supports draft authoring, AI semantic assist, and review handoff", async ({
  page,
  request,
}) => {
  const title = `knowledge-ledger-${Date.now()} draft`;
  await loginBrowserSession(page, request, "dev.admin");

  await page.goto("/#knowledge-library?knowledgeView=ledger", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "多维知识台账" })).toBeVisible();
  await page.locator('[data-toolbar-action="create"]').click();

  await page.getByLabel("标题").fill(title);
  await page
    .getByLabel("简要说明或标准答案")
    .fill(
      "Ledger smoke guidance: flag the interim endpoint wording before routing to specialist review.",
    );
  await page.locator('[data-board-action="confirm-entry"]').click();

  await expect(page.getByText("知识已录入台账。")).toBeVisible();

  await page.locator('[data-row-action="edit"]').first().click();
  await page.locator('[data-board-tab="materials"]').click();
  await page.locator('[data-block-action="add-text"]').click();
  await page
    .locator(".knowledge-library-rich-content-editor__item textarea")
    .last()
    .fill("Ledger smoke rich content block for interim endpoint handling.");
  await page.locator('[data-board-action="save-draft"]').click();

  await expect(page.getByText("草稿已保存。")).toBeVisible();

  await page.locator('[data-board-tab="semantic"]').click();
  await page.locator('[data-semantic-action="generate"]').click();
  await expect(
    page.getByText("AI 语义建议已生成，请核对后点击“应用建议”。"),
  ).toBeVisible();
  await page.locator('[data-semantic-action="apply"]').click();

  await expect(page.getByText("AI 语义已确认，可录入台账。")).toBeVisible();
  await page.locator('[data-board-action="submit-review"]').click();

  await expect(page.getByText("知识已提交审核。")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText("待审核")).toBeVisible();
});

async function loginApiSession(
  request: APIRequestContext,
  username: string,
): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username,
      password: "demo-password",
    },
  });
  expect(response.ok()).toBeTruthy();

  const setCookie =
    response.headersArray().find((header) => header.name.toLowerCase() === "set-cookie")
      ?.value ?? response.headers()["set-cookie"];
  expect(setCookie).toBeTruthy();

  return ((setCookie ?? "").split(";", 1)[0] ?? "").trim();
}

async function loginBrowserSession(
  page: Page,
  request: APIRequestContext,
  username: string,
): Promise<void> {
  const cookiePair = await loginApiSession(request, username);
  const separatorIndex = cookiePair.indexOf("=");
  expect(separatorIndex).toBeGreaterThan(0);

  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: cookiePair.slice(0, separatorIndex),
      value: cookiePair.slice(separatorIndex + 1),
      url: `${apiBaseUrl}/`,
    },
  ]);
}
