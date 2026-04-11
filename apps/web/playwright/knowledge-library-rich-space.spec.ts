import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("knowledge library rich-space flow supports block editing and semantic confirmation", async ({
  page,
  request,
}) => {
  const seededTitle = `knowledge-rich-space-${Date.now()} draft`;
  const seededDraft = await seedKnowledgeLibraryDraft(request, {
    title: seededTitle,
  });
  await loginBrowserSession(page, request, "dev.admin");

  await page.goto(
    `/#knowledge-library?assetId=${seededDraft.assetId}&revisionId=${seededDraft.revisionId}`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByRole("heading", { name: "Knowledge Library" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Knowledge Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Record Drawer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keyword Search" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Semantic Search" })).toBeVisible();

  await page.getByRole("button", { name: "Add Text Block" }).click();
  await page
    .locator(".knowledge-library-rich-block")
    .last()
    .getByLabel("Text Content")
    .fill(
    "Operator curated rich-space text block for endpoint screening guidance.",
  );
  await page.getByRole("button", { name: "Save Rich Content" }).click();

  await expect(page.getByRole("status")).toContainText("Rich content saved.");

  await page.getByRole("button", { name: "Regenerate Semantics" }).click();
  await expect(page.getByRole("status")).toContainText("AI semantic layer regenerated.");
  await expect(page.getByText("Pending Confirmation")).toBeVisible();

  await page
    .getByLabel("Page Summary")
    .fill("Operator confirmed semantic guidance for endpoint screening.");
  await page.getByLabel("Retrieval Terms").fill("endpoint, screening, rich space");
  await page
    .getByLabel("Retrieval Snippets")
    .fill("Prefer this record when endpoint requirements are ambiguous.");
  await page.getByRole("button", { name: "Confirm Semantic Layer" }).click();

  await expect(page.getByRole("status")).toContainText("AI semantic layer confirmed.");
  await expect(page.locator(".knowledge-library-semantic-status.is-confirmed")).toHaveText(
    "Confirmed",
  );
  await expect(
    page.getByRole("row", {
      name: new RegExp(`${escapeRegExp(seededTitle)}.*confirmed`, "i"),
    }),
  ).toBeVisible();
});

async function seedKnowledgeLibraryDraft(
  request: APIRequestContext,
  input: { title: string },
): Promise<{
  assetId: string;
  revisionId: string;
}> {
  const adminCookie = await loginApiSession(request, "dev.admin");
  const response = await request.post(`${apiBaseUrl}/api/v1/knowledge/assets/drafts`, {
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json",
    },
    data: {
      title: input.title,
      canonicalText: "Clinical studies must define the primary endpoint before review sign-off.",
      summary: `${input.title} summary`,
      knowledgeKind: "rule",
      moduleScope: "screening",
      manuscriptTypes: ["clinical_study"],
    },
  });
  expect(response.ok()).toBeTruthy();

  const created = (await response.json()) as {
    asset: { id: string };
    selected_revision: { id: string };
  };

  return {
    assetId: created.asset.id,
    revisionId: created.selected_revision.id,
  };
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
