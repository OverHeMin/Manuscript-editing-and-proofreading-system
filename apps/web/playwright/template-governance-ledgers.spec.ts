import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const cancelLabel = "\u53d6\u6d88";
const searchSubmitLabel = "\u67e5\u627e";

const medicalPackageLedgerTitle = "\u533b\u5b66\u4e13\u7528\u5305\u53f0\u8d26";
const medicalPackageSearchLabel = "\u641c\u7d22\u533b\u5b66\u4e13\u7528\u5305\u53f0\u8d26";
const addMedicalPackageLabel = "\u65b0\u589e\u533b\u5b66\u5305";
const createMedicalPackageHeading = "\u65b0\u5efa\u533b\u5b66\u4e13\u7528\u5305";
const editRulePackageLabel = "\u7f16\u8f91\u89c4\u5219\u5305";
const medicalPackageSearchResultHeading = "\u533b\u5b66\u4e13\u7528\u5305\u67e5\u627e\u7ed3\u679c";

const largeTemplateLedgerTitle = "\u5927\u6a21\u677f\u53f0\u8d26";
const largeTemplateSearchLabel = "\u641c\u7d22\u5927\u6a21\u677f";
const addLargeTemplateLabel = "\u65b0\u589e\u5927\u6a21\u677f";
const createLargeTemplateHeading = "\u65b0\u5efa\u5927\u6a21\u677f";
const largeTemplateSearchResultHeading = "\u5927\u6a21\u677f\u67e5\u627e\u7ed3\u679c";

const extractionLedgerTitle = "\u539f\u7a3f/\u7f16\u8f91\u7a3f\u63d0\u53d6\u53f0\u8d26";
const extractionSearchLabel = "\u641c\u7d22\u4efb\u52a1\u6216\u5019\u9009";
const createExtractionTaskLabel = "\u65b0\u5efa\u63d0\u53d6\u4efb\u52a1";
const aiSemanticConfirmationHeading = "AI \u8bed\u4e49\u786e\u8ba4";
const extractionSearchResultHeading =
  "\u539f\u7a3f/\u7f16\u8f91\u7a3f\u63d0\u53d6\u67e5\u627e\u7ed3\u679c";
const batchProcessLabel = "\u6279\u91cf\u5904\u7406";

test("template governance ledgers open inline forms and search surfaces from toolbar actions", async ({
  page,
  request,
}) => {
  await loginBrowserSession(page, request, "dev.admin");

  await page.goto("/#template-governance?templateGovernanceView=medical-package-ledger", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: medicalPackageLedgerTitle, level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: addMedicalPackageLabel }).click();
  await expect(
    page.getByRole("heading", { name: createMedicalPackageHeading }),
  ).toBeVisible();
  await page.getByRole("button", { name: cancelLabel }).click();

  await page.getByRole("button", { name: editRulePackageLabel }).click();
  await expect(page.getByRole("heading", { name: editRulePackageLabel })).toBeVisible();
  await page.getByRole("button", { name: cancelLabel }).click();

  await page.getByLabel(medicalPackageSearchLabel).fill("\u4f26\u7406");
  await page.getByRole("button", { name: searchSubmitLabel }).click();
  await expect(
    page.getByRole("heading", { name: medicalPackageSearchResultHeading }),
  ).toBeVisible();

  await page.goto("/#template-governance?templateGovernanceView=large-template-ledger", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: largeTemplateLedgerTitle, level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: addLargeTemplateLabel }).click();
  await expect(page.getByRole("heading", { name: createLargeTemplateHeading })).toBeVisible();
  await page.getByRole("button", { name: cancelLabel }).click();

  await page.getByLabel(largeTemplateSearchLabel).fill("\u4e34\u5e8a");
  await page.getByRole("button", { name: searchSubmitLabel }).click();
  await expect(
    page.getByRole("heading", { name: largeTemplateSearchResultHeading }),
  ).toBeVisible();

  await page.goto("/#template-governance?templateGovernanceView=extraction-ledger", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: extractionLedgerTitle, level: 1 })).toBeVisible();

  await page.getByRole("button", { name: createExtractionTaskLabel }).click();
  await expect(page.getByRole("heading", { name: createExtractionTaskLabel })).toBeVisible();
  await page.getByRole("button", { name: cancelLabel }).click();

  await page.getByRole("button", { name: batchProcessLabel }).click();
  await expect(
    page.getByRole("heading", { name: aiSemanticConfirmationHeading }),
  ).toBeVisible();
  await page.getByRole("button", { name: cancelLabel }).click();

  await page.getByLabel(extractionSearchLabel).fill("\u63d0\u53d6");
  await page.getByRole("button", { name: searchSubmitLabel }).click();
  await expect(
    page.getByRole("heading", { name: extractionSearchResultHeading }),
  ).toBeVisible();
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
