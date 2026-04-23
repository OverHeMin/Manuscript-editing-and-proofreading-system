import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const semanticFixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1S8AAAAASUVORK5CYII=",
  "base64",
);
const pendingReviewLabel = "\u5f85\u5ba1\u6838";
const titleFieldLabel = "\u6807\u9898";
const canonicalTextFieldLabel =
  "\u7b80\u8981\u8bf4\u660e\u6216\u6807\u51c6\u7b54\u6848";

test("knowledge library ledger flow supports draft authoring, AI semantic assist, and review handoff", async ({
  page,
  request,
}) => {
  const title = `knowledge-ledger-${Date.now()} draft`;
  await loginBrowserSession(page, request, "dev.admin");
  await page.route("**/api/v1/knowledge/duplicate-check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  await page.goto("/#knowledge-library?knowledgeView=ledger", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator(".knowledge-library-ledger-page h1")).toBeVisible();
  await page.locator('[data-toolbar-action="create"]').click();

  await page.getByRole("textbox", { name: titleFieldLabel }).fill(title);
  await page
    .getByRole("textbox", { name: canonicalTextFieldLabel })
    .fill(
      `Ledger smoke guidance for ${title}: flag the interim endpoint wording before routing to specialist review.`,
    );

  await page.locator('[data-board-tab="materials"]').click();
  await page.locator('[data-block-action="add-text"]').click();
  await page
    .locator(".knowledge-library-rich-content-editor__item textarea")
    .last()
    .fill("Ledger smoke rich content block for interim endpoint handling.");
  await page.locator('[data-board-action="save-draft"]').click();

  const ledgerRow = page.getByRole("row", {
    name: new RegExp(escapeRegExp(title)),
  });
  await expect(ledgerRow).toBeVisible();

  await page.locator('[data-board-tab="semantic"]').click();
  await page.locator('[data-semantic-action="generate"]').click();
  await expect(
    page.locator('[data-semantic-field="page-summary"] textarea'),
  ).toHaveValue(/.+/);
  await page.locator('[data-semantic-action="apply"]').click();
  await page.locator('[data-board-action="submit-review"]').click();

  await expect(ledgerRow).toContainText(pendingReviewLabel);
});

test("knowledge library ledger semantic assist uploads image blocks and surfaces analyzed materials", async ({
  page,
  request,
}) => {
  const title = `knowledge-ledger-semantic-${Date.now()}`;
  let sawAiIntake = false;
  let sawSemanticAssist = false;

  page.on("request", (browserRequest) => {
    if (browserRequest.url().includes("/api/v1/knowledge/library/ai-intake")) {
      sawAiIntake = true;
    }
    if (browserRequest.url().includes("/semantic-layer/assist")) {
      sawSemanticAssist = true;
    }
  });

  await loginBrowserSession(page, request, "dev.admin");
  await page.goto("/#knowledge-library?knowledgeView=ledger", {
    waitUntil: "domcontentloaded",
  });

  await page.locator('[data-toolbar-action="create"]').click();
  await page
    .locator('.knowledge-library-entry-form [data-board-panel="basic"] label >> input')
    .first()
    .fill(title);
  await page
    .locator('.knowledge-library-entry-form [data-board-panel="basic"] textarea')
    .nth(1)
    .fill(
      "Semantic attachment coverage should include both the structured table and the uploaded chart image.",
    );

  await page.locator('[data-board-tab="materials"]').click();
  await page.locator('[data-block-action="add-table"]').click();
  await page
    .locator('[data-block-type="table_block"] textarea')
    .fill(
      "| field | content |\n| --- | --- |\n| checkpoint | table attached |\n| outcome | analyze the table with the image |",
    );

  await page.locator('[data-block-action="add-image"]').click();
  const imageBlock = page.locator('[data-block-type="image_block"]').last();
  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/knowledge/uploads") &&
      response.request().method() === "POST" &&
      response.status() === 201,
  );
  await imageBlock.locator('input[type="file"]').setInputFiles({
    name: "semantic-fixture.png",
    mimeType: "image/png",
    buffer: semanticFixturePng,
  });
  await uploadResponsePromise;

  await expect(imageBlock.locator(".knowledge-library-block-image-meta strong")).toHaveText(
    "semantic-fixture.png",
  );
  await imageBlock
    .locator('input:not([type]), input[type="text"]')
    .first()
    .fill("Chart image for semantic analysis verification");

  await page.locator('[data-board-tab="semantic"]').click();
  await page.locator('[data-semantic-action="generate"]').click();

  await expect(
    page.locator('[data-semantic-field="page-summary"] textarea'),
  ).toHaveValue(/.+/);
  await expect(page.locator(".knowledge-library-semantic-section__notes")).toContainText(
    "\u0031\u4e2a\u8868\u683c\u5757\u3001\u0031\u5f20\u56fe\u7247",
  );
  await expect(page.locator(".knowledge-library-semantic-section__notes")).toContainText(
    "semantic-fixture.png",
  );
  await expect(page.locator(".knowledge-library-semantic-section__notes")).toContainText(
    "\u7cfb\u7edf\u5df2\u5148\u4fdd\u5b58\u5f53\u524d\u8349\u7a3f",
  );
  expect(sawSemanticAssist).toBeTruthy();
  expect(sawAiIntake).toBeFalsy();
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
