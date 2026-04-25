import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const submitLabel = "Submit To Review";
const staleMatchTitle = "Stale duplicate should never render";

test("knowledge library ignores stale immediate duplicate-check results after the draft changes", async ({
  page,
  request,
}) => {
  const seededDraft = await seedKnowledgeLibraryDraft(request, {
    label: `knowledge-duplicate-race-${Date.now()}`,
  });
  await loginBrowserSession(page, request, "dev.admin");

  const firstCanonicalText = `${seededDraft.baseCanonicalText} First stale payload.`;
  const secondCanonicalText = `${seededDraft.baseCanonicalText} Second stable payload.`;
  let staleDuplicateRequestCount = 0;
  let submitAttemptCount = 0;
  let releaseStaleDuplicateResponse: (() => void) | null = null;

  await page.route("**/api/v1/knowledge/duplicate-check", async (route) => {
    const body = route.request().postDataJSON() as {
      canonicalText?: string;
    };
    const canonicalText = body.canonicalText ?? "";
    if (canonicalText === firstCanonicalText) {
      staleDuplicateRequestCount += 1;
      await new Promise<void>((resolve) => {
        releaseStaleDuplicateResponse = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            severity: "high",
            score: 0.93,
            matched_asset_id: "knowledge-stale-1",
            matched_revision_id: "knowledge-stale-1-revision-3",
            matched_title: staleMatchTitle,
            matched_status: "approved",
            matched_summary: "This stale match should be ignored once the draft changes.",
            reasons: ["canonical_text_high_overlap"],
          },
        ]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/api/v1/knowledge/revisions/*/submit", async (route) => {
    submitAttemptCount += 1;
    await route.abort();
  });

  await page.goto(
    `/#knowledge-library?knowledgeView=classic&assetId=${seededDraft.assetId}&revisionId=${seededDraft.revisionId}`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  const statusRow = page.locator(".knowledge-library-duplicate-status-row");
  const duplicatePanel = page.locator(".knowledge-library-duplicate-panel");
  const duplicateConfirmation = page.locator(".knowledge-library-duplicate-confirmation");
  const canonicalTextInput = page
    .locator(".knowledge-library-editor .knowledge-library-form-grid textarea")
    .first();
  const submitButton = page.getByRole("button", { name: submitLabel, exact: true });

  await expect(page.locator(".knowledge-library-grid-toolbar")).toBeVisible();
  await expect(statusRow).toContainText("No strong duplicate signals");

  await canonicalTextInput.fill(firstCanonicalText);
  await submitButton.click();

  await expect.poll(() => staleDuplicateRequestCount).toBe(1);
  await expect(submitButton).toBeDisabled();
  await expect(statusRow).toContainText("Checking duplicates...");

  await canonicalTextInput.fill(secondCanonicalText);
  await expect(submitButton).toBeEnabled();

  releaseStaleDuplicateResponse?.();

  await expect(statusRow).toContainText("No strong duplicate signals");
  await expect(duplicatePanel).not.toContainText(staleMatchTitle);
  await expect(duplicateConfirmation).toHaveCount(0);
  expect(submitAttemptCount).toBe(0);
});

test("knowledge library ignores stale automatic duplicate-check responses after a newer submit refresh", async ({
  page,
  request,
}) => {
  const seededDraft = await seedKnowledgeLibraryDraft(request, {
    label: `knowledge-duplicate-auto-overlap-${Date.now()}`,
  });
  await loginBrowserSession(page, request, "dev.admin");

  const canonicalText = `${seededDraft.baseCanonicalText} Auto overlap payload.`;
  const staleAutoMatchTitle = "Older automatic duplicate response";
  let duplicateRequestCount = 0;
  let submitAttemptCount = 0;
  let releaseAutoDuplicateResponse: (() => void) | null = null;

  await page.route("**/api/v1/knowledge/duplicate-check", async (route) => {
    const body = route.request().postDataJSON() as {
      canonicalText?: string;
    };
    const requestedCanonicalText = body.canonicalText ?? "";
    if (requestedCanonicalText === canonicalText) {
      duplicateRequestCount += 1;
      if (duplicateRequestCount === 1) {
        await new Promise<void>((resolve) => {
          releaseAutoDuplicateResponse = resolve;
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              severity: "high",
              score: 0.91,
              matched_asset_id: "knowledge-auto-1",
              matched_revision_id: "knowledge-auto-1-revision-1",
              matched_title: staleAutoMatchTitle,
              matched_status: "approved",
              matched_summary: "Older automatic check result should not overwrite the submit-time refresh.",
              reasons: ["canonical_text_high_overlap"],
            },
          ]),
        });
        return;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/api/v1/knowledge/revisions/*/submit", async (route) => {
    submitAttemptCount += 1;
    await route.abort();
  });

  await page.goto(
    `/#knowledge-library?knowledgeView=classic&assetId=${seededDraft.assetId}&revisionId=${seededDraft.revisionId}`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  const statusRow = page.locator(".knowledge-library-duplicate-status-row");
  const duplicatePanel = page.locator(".knowledge-library-duplicate-panel");
  const duplicateConfirmation = page.locator(".knowledge-library-duplicate-confirmation");
  const canonicalTextInput = page
    .locator(".knowledge-library-editor .knowledge-library-form-grid textarea")
    .first();
  const submitButton = page.getByRole("button", { name: submitLabel, exact: true });

  await expect(page.locator(".knowledge-library-grid-toolbar")).toBeVisible();
  await expect(statusRow).toContainText("No strong duplicate signals");

  await canonicalTextInput.fill(canonicalText);
  await expect.poll(() => duplicateRequestCount).toBe(1);
  await expect(statusRow).toContainText("Checking duplicates...");

  await submitButton.click();

  await expect.poll(() => duplicateRequestCount).toBe(2);
  await expect.poll(() => submitAttemptCount).toBe(1);

  releaseAutoDuplicateResponse?.();

  await expect(duplicateConfirmation).toHaveCount(0);
  await expect(statusRow).toContainText("No strong duplicate signals");
  await expect(duplicatePanel).not.toContainText(staleAutoMatchTitle);
});

test("knowledge library blocks continue-anyway when the draft changed after the warning opened", async ({
  page,
  request,
}) => {
  const seededDraft = await seedKnowledgeLibraryDraft(request, {
    label: `knowledge-duplicate-confirmation-${Date.now()}`,
  });
  await loginBrowserSession(page, request, "dev.admin");

  const firstCanonicalText = `${seededDraft.baseCanonicalText} Strong warning payload.`;
  const secondCanonicalText = `${seededDraft.baseCanonicalText} Changed after warning.`;
  let submitAttemptCount = 0;

  await page.route("**/api/v1/knowledge/duplicate-check", async (route) => {
    const body = route.request().postDataJSON() as {
      canonicalText?: string;
    };
    const canonicalText = body.canonicalText ?? "";
    if (canonicalText === firstCanonicalText) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            severity: "exact",
            score: 1,
            matched_asset_id: "knowledge-warning-1",
            matched_revision_id: "knowledge-warning-1-revision-1",
            matched_title: "Existing duplicate to review first",
            matched_status: "approved",
            matched_summary: "This warning should become stale after the draft changes.",
            reasons: ["canonical_text_exact_match"],
          },
        ]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/api/v1/knowledge/revisions/*/submit", async (route) => {
    submitAttemptCount += 1;
    await route.abort();
  });

  await page.goto(
    `/#knowledge-library?knowledgeView=classic&assetId=${seededDraft.assetId}&revisionId=${seededDraft.revisionId}`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  const statusRow = page.locator(".knowledge-library-duplicate-status-row");
  const duplicatePanel = page.locator(".knowledge-library-duplicate-panel");
  const duplicateConfirmation = page.locator(".knowledge-library-duplicate-confirmation");
  const canonicalTextInput = page
    .locator(".knowledge-library-editor .knowledge-library-form-grid textarea")
    .first();
  const continueButton = page.getByRole("button", { name: "Continue Anyway" });
  const submitButton = page.getByRole("button", { name: submitLabel, exact: true });

  await expect(page.locator(".knowledge-library-grid-toolbar")).toBeVisible();
  await expect(statusRow).toContainText("No strong duplicate signals");

  await canonicalTextInput.fill(firstCanonicalText);
  await submitButton.click();

  await expect(duplicateConfirmation).toBeVisible();
  await expect(duplicatePanel).toContainText("Existing duplicate to review first");

  await page.evaluate(
    ({ nextCanonicalText, continueLabel }) => {
      const canonicalTextArea = document.querySelector(
        ".knowledge-library-editor .knowledge-library-form-grid textarea",
      );
      if (!(canonicalTextArea instanceof HTMLTextAreaElement)) {
        throw new Error("Canonical Text textarea not found");
      }

      const continueButton = Array.from(document.querySelectorAll("button")).find(
        (element) => element.textContent?.trim() === continueLabel,
      );
      if (!(continueButton instanceof HTMLButtonElement)) {
        throw new Error("Continue Anyway button not found");
      }

      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (!valueSetter) {
        throw new Error("Canonical Text textarea value setter not found");
      }

      valueSetter.call(canonicalTextArea, nextCanonicalText);
      canonicalTextArea.dispatchEvent(new Event("input", { bubbles: true }));
      continueButton.click();
    },
    {
      nextCanonicalText: secondCanonicalText,
      continueLabel: "Continue Anyway",
    },
  );

  await expect(duplicateConfirmation).toHaveCount(0);
  await expect(statusRow).toContainText("No strong duplicate signals");
  expect(submitAttemptCount).toBe(0);
});

test("knowledge library blocks classic submit on saved evidence gate issues before duplicate-check", async ({
  page,
  request,
}) => {
  const seededDraft = await seedKnowledgeLibraryDraft(request, {
    label: `knowledge-evidence-gate-${Date.now()}`,
  });
  const adminCookie = await loginApiSession(request, "dev.admin");
  const replaceResponse = await request.post(
    `${apiBaseUrl}/api/v1/knowledge/revisions/${seededDraft.revisionId}/content-blocks/replace`,
    {
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      data: {
        blocks: [
          {
            blockType: "table_block",
            orderNo: 0,
            contentPayload: {
              capture_mode: "word_html_exact",
              exact_capture_failure_codes: ["run_style_incomplete"],
            },
            tableSemantics: {
              capture_mode: "word_html_exact",
              exact_capture_authoritative: false,
              exact_capture_failure_codes: ["run_style_incomplete"],
            },
          },
        ],
      },
    },
  );
  expect(replaceResponse.ok()).toBeTruthy();
  await loginBrowserSession(page, request, "dev.admin");

  let duplicateCheckRequestCount = 0;
  let submitAttemptCount = 0;

  await page.route("**/api/v1/knowledge/duplicate-check", async (route) => {
    duplicateCheckRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/api/v1/knowledge/revisions/*/submit", async (route) => {
    submitAttemptCount += 1;
    await route.abort();
  });

  await page.goto(
    `/#knowledge-library?knowledgeView=classic&assetId=${seededDraft.assetId}&revisionId=${seededDraft.revisionId}`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  const statusRow = page.locator(".knowledge-library-duplicate-status-row");
  const evidenceGate = page.locator('[data-entry-evidence-gate="knowledge"]');
  const errorBanner = page.locator(".knowledge-library-banner-error");
  const submitButton = page.getByRole("button", { name: submitLabel, exact: true });

  await expect(page.locator(".knowledge-library-grid-toolbar")).toBeVisible();
  await expect(statusRow).toContainText("No strong duplicate signals");
  await expect(evidenceGate).toContainText("高精度证据预检");
  await expect(evidenceGate).toContainText("表格块 #1");
  await expect(evidenceGate).toContainText("阻断提交审核");
  await expect(evidenceGate).toContainText("字形强调信息不完整");

  const duplicateCheckCountBeforeClick = duplicateCheckRequestCount;

  await submitButton.click();

  await expect(errorBanner).toContainText("表格块 #1未满足提交审核条件");
  await expect(errorBanner).toContainText("字形强调信息不完整");
  await expect.poll(() => duplicateCheckRequestCount).toBe(duplicateCheckCountBeforeClick);
  await expect.poll(() => submitAttemptCount).toBe(0);
});

async function seedKnowledgeLibraryDraft(
  request: APIRequestContext,
  input: { label: string },
): Promise<{
  assetId: string;
  revisionId: string;
  baseCanonicalText: string;
}> {
  const adminCookie = await loginApiSession(request, "dev.admin");
  const baseCanonicalText =
    "Clinical studies must define the primary endpoint before review sign-off.";
  const response = await request.post(`${apiBaseUrl}/api/v1/knowledge/assets/drafts`, {
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json",
    },
    data: {
      title: `${input.label} draft`,
      canonicalText: baseCanonicalText,
      summary: `${input.label} summary`,
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
    baseCanonicalText,
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
