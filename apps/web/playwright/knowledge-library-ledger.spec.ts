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

  await expect(page.getByRole("heading", { name: "Knowledge Ledger" })).toBeVisible();
  await page.getByRole("button", { name: "New Record" }).click();

  await page.getByLabel("Title").fill(title);
  await page
    .getByLabel("Canonical Text")
    .fill(
      "Ledger smoke guidance: flag the interim endpoint wording before routing to specialist review.",
    );
  await page.getByRole("button", { name: "Save Draft" }).click();

  await expect(page.getByText("Draft saved.")).toBeVisible();

  await page
    .getByLabel("Workspace Tabs")
    .getByRole("button", { name: "Content Blocks" })
    .click();
  await page.getByRole("button", { name: "Add Text Block" }).click();
  await page
    .locator(".knowledge-library-rich-block")
    .last()
    .getByLabel("Text Content")
    .fill("Ledger smoke rich content block for interim endpoint handling.");
  await page.getByRole("button", { name: "Save Rich Content" }).click();

  await expect(page.getByText("Rich content saved.")).toBeVisible();

  await page
    .getByLabel("Workspace Tabs")
    .getByRole("button", { name: "Semantic" })
    .click();
  await page
    .getByLabel("Semantic instruction")
    .fill("Expand recall terms for interim endpoint review without changing title ownership.");
  await page.getByRole("button", { name: "Suggest Semantic Patch" }).click();
  await expect(page.getByText("Suggested semantic patch")).toBeVisible();
  await page.getByRole("button", { name: "Apply Suggestion" }).click();
  await page.getByRole("button", { name: "Confirm Semantic Layer" }).click();

  await expect(page.getByText("AI semantic layer confirmed.")).toBeVisible();
  await page.getByRole("button", { name: "Submit To Review" }).click();

  await expect(page.getByText("Draft submitted to knowledge review.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Update Draft" })).toBeVisible();
  await expect(
    page.getByRole("row", {
      name: new RegExp(`${escapeRegExp(title)}.*confirmed`, "i"),
    }),
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
