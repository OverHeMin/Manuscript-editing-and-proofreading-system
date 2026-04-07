import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("admin can submit a governed knowledge draft from learning review into knowledge review", async ({
  page,
  request,
}) => {
  const handoff = await prepareKnowledgeReviewHandoff(page, request, {
    label: "Phase 8AB",
  });

  await expect(page.getByRole("heading", { name: "Pending Review Queue" })).toBeVisible();
  await expect(page.locator(".knowledge-review-queue-pane")).toContainText(
    handoff.knowledgeTitle,
  );
  await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();
});

test("admin can approve a handed-off knowledge review item and remove it from the queue", async ({
  page,
  request,
}) => {
  const handoff = await prepareKnowledgeReviewHandoff(page, request, {
    label: "Phase 8AD Approve",
  });
  const reviewNote = "Approved in browser smoke.";

  await page.getByRole("textbox", { name: "Review note" }).fill(reviewNote);
  await page.getByRole("button", { name: "Approve", exact: true }).click();

  await expect(page.locator(".knowledge-review-action-panel")).toContainText(
    "Knowledge item approved.",
  );
  await expect(page.locator(".knowledge-review-queue-pane")).not.toContainText(
    handoff.knowledgeTitle,
  );

  const queue = await listKnowledgeReviewQueue(page, request);
  expect(queue.some((item) => item.id === handoff.knowledgeItemId)).toBeFalsy();

  const history = await listKnowledgeReviewActions(page, request, handoff.knowledgeItemId);
  expect(
    history.map((item) => ({
      action: item.action,
      review_note: item.review_note,
    })),
  ).toEqual([
    {
      action: "submitted_for_review",
      review_note: undefined,
    },
    {
      action: "approved",
      review_note: reviewNote,
    },
  ]);

  const knowledgeItems = await listKnowledgeItems(page, request);
  const approvedItem = knowledgeItems.find((item) => item.id === handoff.knowledgeItemId);
  expect(approvedItem?.status).toBe("approved");
});

test("admin can reject a handed-off knowledge review item and return it to draft", async ({
  page,
  request,
}) => {
  const handoff = await prepareKnowledgeReviewHandoff(page, request, {
    label: "Phase 8AD Reject",
  });
  const reviewNote = "Rejected in browser smoke.";

  await page.getByRole("textbox", { name: "Review note" }).fill(reviewNote);
  await page.getByRole("button", { name: "Reject", exact: true }).click();

  await expect(page.locator(".knowledge-review-action-panel")).toContainText(
    "Knowledge item rejected.",
  );
  await expect(page.locator(".knowledge-review-queue-pane")).not.toContainText(
    handoff.knowledgeTitle,
  );

  const queue = await listKnowledgeReviewQueue(page, request);
  expect(queue.some((item) => item.id === handoff.knowledgeItemId)).toBeFalsy();

  const history = await listKnowledgeReviewActions(page, request, handoff.knowledgeItemId);
  expect(
    history.map((item) => ({
      action: item.action,
      review_note: item.review_note,
    })),
  ).toEqual([
    {
      action: "submitted_for_review",
      review_note: undefined,
    },
    {
      action: "rejected",
      review_note: reviewNote,
    },
  ]);

  const knowledgeItems = await listKnowledgeItems(page, request);
  const rejectedItem = knowledgeItems.find((item) => item.id === handoff.knowledgeItemId);
  expect(rejectedItem?.status).toBe("draft");
});

interface PreparedKnowledgeReviewHandoff {
  knowledgeItemId: string;
  knowledgeTitle: string;
}

interface PrepareKnowledgeReviewHandoffInput {
  label: string;
}

interface KnowledgeReviewQueueItem {
  id: string;
  title: string;
  status: string;
}

interface KnowledgeReviewAction {
  action: "submitted_for_review" | "approved" | "rejected";
  review_note?: string;
}

interface KnowledgeItem {
  id: string;
  status: string;
}

async function prepareKnowledgeReviewHandoff(
  page: Page,
  request: APIRequestContext,
  input: PrepareKnowledgeReviewHandoffInput,
): Promise<PreparedKnowledgeReviewHandoff> {
  await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username: "dev.user",
      password: "demo-password",
    },
  });

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: `${input.label} Knowledge Review Handoff Smoke`,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: `${slugify(input.label)}-source.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: `uploads/${slugify(input.label)}/${slugify(input.label)}-source.docx`,
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();

  const uploaded = (await uploadResponse.json()) as {
    manuscript: {
      id: string;
    };
  };
  const manuscriptId = uploaded.manuscript.id;
  const knowledgeTitle = `${input.label} knowledge draft ${manuscriptId}`;

  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Screening Workbench" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Run Screening" }).click();
  await expect(page.getByRole("link", { name: "Open Editing Workbench" })).toBeVisible();

  await page.getByRole("link", { name: "Open Editing Workbench" }).click();
  await expect(page.getByRole("heading", { name: "Editing Workbench" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Run Editing" }).click();
  await expect(page.getByRole("link", { name: "Open Proofreading Workbench" })).toBeVisible();

  await page.getByRole("link", { name: "Open Proofreading Workbench" }).click();
  await expect(page.getByRole("heading", { name: "Proofreading Workbench" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Create Draft" }).click();
  await page.getByRole("button", { name: "Finalize Proofreading" }).click();
  await page.getByRole("button", { name: "Publish Human Final" }).click();
  await expect(page.getByRole("link", { name: "Open Learning Review" })).toBeVisible();

  await page.getByRole("link", { name: "Open Learning Review" }).click();
  await expect(page.getByRole("heading", { name: "Governed learning review desk" })).toBeVisible();
  await page.getByRole("button", { name: "Create snapshot" }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(
    `${input.label} candidate ${manuscriptId}`,
  );
  await page.getByRole("button", { name: "Create governed candidate" }).click();
  await page.getByRole("button", { name: "Approve selected candidate" }).click();
  await page.getByRole("button", { name: "Create writeback" }).click();
  await page.getByRole("textbox", { name: "Knowledge Title", exact: true }).fill(
    knowledgeTitle,
  );
  await page.getByRole("button", { name: "Apply writeback" }).click();

  await expect(
    page.getByRole("button", { name: "Submit Knowledge Draft For Review" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Submit Knowledge Draft For Review" }).click();

  await expect(page.locator("body")).toContainText("Knowledge draft submitted for review:");
  const knowledgeReviewLink = page.getByRole("link", { name: "Open Knowledge Review" });
  await expect(knowledgeReviewLink).toBeVisible();
  const handoffHref = await knowledgeReviewLink.getAttribute("href");
  const knowledgeItemId = extractKnowledgeItemId(handoffHref);

  await knowledgeReviewLink.click();
  await expect(page.getByRole("heading", { name: "Pending Review Queue" })).toBeVisible();
  await expect(page.locator(".knowledge-review-queue-pane")).toContainText(knowledgeTitle);

  return {
    knowledgeItemId,
    knowledgeTitle,
  };
}

async function listKnowledgeReviewQueue(
  page: Page,
  request: APIRequestContext,
): Promise<KnowledgeReviewQueueItem[]> {
  const response = await request.get(`${apiBaseUrl}/api/v1/knowledge/review-queue`, {
    headers: await buildBrowserCookieHeader(page),
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as KnowledgeReviewQueueItem[];
}

async function listKnowledgeReviewActions(
  page: Page,
  request: APIRequestContext,
  knowledgeItemId: string,
): Promise<KnowledgeReviewAction[]> {
  const response = await request.get(
    `${apiBaseUrl}/api/v1/knowledge/${knowledgeItemId}/review-actions`,
    {
      headers: await buildBrowserCookieHeader(page),
    },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as KnowledgeReviewAction[];
}

async function listKnowledgeItems(
  page: Page,
  request: APIRequestContext,
): Promise<KnowledgeItem[]> {
  const response = await request.get(`${apiBaseUrl}/api/v1/knowledge`, {
    headers: await buildBrowserCookieHeader(page),
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as KnowledgeItem[];
}

async function buildBrowserCookieHeader(
  page: Page,
): Promise<Record<"Cookie", string>> {
  const cookies = await page.context().cookies(apiBaseUrl);
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

  expect(cookieHeader).toBeTruthy();

  return {
    Cookie: cookieHeader,
  };
}

function extractKnowledgeItemId(href: string | null): string {
  const resolved = new URL(href ?? "", "http://127.0.0.1:4173");
  const knowledgeItemId = resolved.hash.includes("?")
    ? new URLSearchParams(resolved.hash.split("?", 2)[1]).get("knowledgeItemId")
    : null;

  expect(knowledgeItemId).toBeTruthy();
  return knowledgeItemId ?? "";
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
