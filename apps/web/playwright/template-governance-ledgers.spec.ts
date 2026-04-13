import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("template governance ledgers open inline forms and search surfaces from toolbar actions", async ({
  page,
  request,
}) => {
  await loginBrowserSession(page, request, "dev.admin");

  await page.goto("/#template-governance?templateGovernanceView=medical-module-ledger", {
    waitUntil: "domcontentloaded",
  });

  await expect(
    page.getByRole("heading", { name: "医学专用模块台账", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "新增模块" }).click();
  await expect(page.getByRole("heading", { name: "新建医学专用模块" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await page.getByRole("button", { name: "编辑模块" }).click();
  await expect(page.getByRole("heading", { name: "编辑医学专用模块" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await page.getByLabel("搜索医学专用模块").fill("伦理");
  await page.getByRole("button", { name: "查找" }).click();
  await expect(page.getByRole("heading", { name: "医学专用模块查找结果" })).toBeVisible();

  await page.goto("/#template-governance?templateGovernanceView=template-ledger", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "模板台账", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "新增模板" }).click();
  await expect(page.getByRole("heading", { name: "新建模板" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await page.goto("/#template-governance?templateGovernanceView=extraction-ledger", {
    waitUntil: "domcontentloaded",
  });

  await expect(
    page.getByRole("heading", { name: "原稿/编辑稿提取台账", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新建提取任务" }).click();
  await expect(page.getByRole("heading", { name: "新建提取任务" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await page.getByRole("button", { name: "批量处理" }).click();
  await expect(page.getByRole("heading", { name: "AI 语义确认" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
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
