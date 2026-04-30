import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("knowledge library and rule center expose DOCX upload entry points before draft save", async ({
  page,
  request,
}) => {
  await loginBrowserSession(page, request, "dev.admin");

  await page.goto("/#knowledge-library?knowledgeView=ledger", {
    waitUntil: "domcontentloaded",
  });
  await page.locator('[data-toolbar-action="create"]').click();
  await page.locator('[data-board-tab="materials"]').click();
  await assertDocxTableEvidenceEntryPoint(page);

  await page.goto("/#template-governance?templateGovernanceView=rule-ledger", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: "新建规则" }).click();
  await assertDocxTableEvidenceEntryPoint(page);
});

async function assertDocxTableEvidenceEntryPoint(page: Page): Promise<void> {
  const tableEvidencePanel = page.locator(
    '.knowledge-library-rich-content-editor__table-evidence[data-table-evidence-client-state="available"]',
  );

  await expect(tableEvidencePanel).toBeVisible();
  await expect(tableEvidencePanel).toContainText("Word 表格证据上传预览区");
  await expect(tableEvidencePanel).toContainText("选择 .docx 或拖拽 Word 表格文档到这里");
  await expect(
    tableEvidencePanel.locator('[data-table-evidence-upload-input="true"]'),
  ).toBeAttached();
  await expect(
    tableEvidencePanel.locator('[data-table-evidence-preview-placeholder="true"]'),
  ).toBeVisible();
}

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
