import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const queueHeading = "\u5f85\u5ba1\u6838\u961f\u5217";
const reviewNoteLabel = "\u5ba1\u6838\u5907\u6ce8";
const approveLabel = "\u901a\u8fc7";
const rejectLabel = "\u9a73\u56de";
const approvedMessage = "\u77e5\u8bc6\u6761\u76ee\u5df2\u901a\u8fc7\u5ba1\u6838\u3002";
const rejectedMessage = "\u77e5\u8bc6\u6761\u76ee\u5df2\u9a73\u56de\u3002";
const seededReviewedCaseSnapshotId = "reviewed-case-snapshot-demo-1";
const seededHumanFinalAssetId = "human-final-demo-1";

test("knowledge reviewer can see a governed knowledge draft in the review queue", async ({
  page,
  request,
  browser,
}) => {
  const handoff = await prepareKnowledgeReviewHandoff(page, request, browser, {
    label: "Phase 8AB",
  });

  await expect(handoff.page.getByRole("heading", { name: queueHeading })).toBeVisible();
  await expect(handoff.page.locator(".knowledge-review-queue-pane")).toContainText(
    handoff.knowledgeTitle,
  );
  await expect(
    handoff.page.getByRole("button", { name: approveLabel, exact: true }),
  ).toBeEnabled();

  await handoff.context.close();
});

test("knowledge reviewer can approve a handed-off knowledge review item and remove it from the queue", async ({
  page,
  request,
  browser,
}) => {
  const handoff = await prepareKnowledgeReviewHandoff(page, request, browser, {
    label: "Phase 8AD Approve",
  });
  const reviewNote = "Approved in browser smoke.";

  await handoff.page.getByRole("textbox", { name: reviewNoteLabel }).fill(reviewNote);
  await handoff.page.getByRole("button", { name: approveLabel, exact: true }).click();

  await expect(handoff.page.locator(".knowledge-review-action-panel")).toContainText(
    approvedMessage,
  );
  await expect(handoff.page.locator(".knowledge-review-queue-pane")).not.toContainText(
    handoff.knowledgeTitle,
  );

  const queue = await listKnowledgeReviewQueue(handoff.page, request);
  expect(queue.some((item) => item.id === handoff.knowledgeItemId)).toBeFalsy();

  const history = await listKnowledgeReviewActions(
    handoff.page,
    request,
    handoff.knowledgeItemId,
  );
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

  const knowledgeItems = await listKnowledgeItems(handoff.page, request);
  const approvedItem = knowledgeItems.find((item) => item.id === handoff.knowledgeItemId);
  expect(approvedItem?.status).toBe("approved");

  await handoff.context.close();
});

test("knowledge reviewer can reject a handed-off knowledge review item and return it to draft", async ({
  page,
  request,
  browser,
}) => {
  const handoff = await prepareKnowledgeReviewHandoff(page, request, browser, {
    label: "Phase 8AD Reject",
  });
  const reviewNote = "Rejected in browser smoke.";

  await handoff.page.getByRole("textbox", { name: reviewNoteLabel }).fill(reviewNote);
  await handoff.page.getByRole("button", { name: rejectLabel, exact: true }).click();

  await expect(handoff.page.locator(".knowledge-review-action-panel")).toContainText(
    rejectedMessage,
  );
  await expect(handoff.page.locator(".knowledge-review-queue-pane")).not.toContainText(
    handoff.knowledgeTitle,
  );

  const queue = await listKnowledgeReviewQueue(handoff.page, request);
  expect(queue.some((item) => item.id === handoff.knowledgeItemId)).toBeFalsy();

  const history = await listKnowledgeReviewActions(
    handoff.page,
    request,
    handoff.knowledgeItemId,
  );
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

  const knowledgeItems = await listKnowledgeItems(handoff.page, request);
  const rejectedItem = knowledgeItems.find((item) => item.id === handoff.knowledgeItemId);
  expect(rejectedItem?.status).toBe("draft");

  await handoff.context.close();
});

interface PreparedKnowledgeReviewHandoff {
  knowledgeItemId: string;
  knowledgeTitle: string;
  page: Page;
  context: BrowserContext;
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
  browser: Browser,
  input: PrepareKnowledgeReviewHandoffInput,
): Promise<PreparedKnowledgeReviewHandoff> {
  const adminCookie = await loginApiSession(request, "dev.admin");
  const knowledgeTitle = `${input.label} knowledge draft ${Date.now()}`;
  const candidateKey = slugify(input.label);

  const createCandidateResponse = await request.post(
    `${apiBaseUrl}/api/v1/learning/candidates/governed`,
    {
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      data: {
        snapshotId: seededReviewedCaseSnapshotId,
        type: "rule_candidate",
        title: `${input.label} candidate`,
        proposalText:
          "Route governed learning writebacks into the knowledge review queue.",
        deidentificationPassed: true,
        governedSource: {
          sourceKind: "evaluation_experiment",
          reviewedCaseSnapshotId: seededReviewedCaseSnapshotId,
          evaluationRunId: `${candidateKey}-eval`,
          evidencePackId: `${candidateKey}-evidence`,
          sourceAssetId: seededHumanFinalAssetId,
        },
      },
    },
  );
  expect(createCandidateResponse.ok()).toBeTruthy();
  const createdCandidate = (await createCandidateResponse.json()) as {
    id: string;
    status: string;
  };
  expect(createdCandidate.status).toBe("pending_review");

  const approveCandidateResponse = await request.post(
    `${apiBaseUrl}/api/v1/learning/candidates/${createdCandidate.id}/approve`,
    {
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(approveCandidateResponse.ok()).toBeTruthy();

  const createWritebackResponse = await request.post(
    `${apiBaseUrl}/api/v1/learning-governance/writebacks`,
    {
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      data: {
        actorRole: "admin",
        input: {
          learningCandidateId: createdCandidate.id,
          targetType: "knowledge_item",
          createdBy: "ignored-by-server",
        },
      },
    },
  );
  expect(createWritebackResponse.ok()).toBeTruthy();
  const writeback = (await createWritebackResponse.json()) as {
    id: string;
    status: string;
  };
  expect(writeback.status).toBe("draft");

  const applyWritebackResponse = await request.post(
    `${apiBaseUrl}/api/v1/learning-governance/writebacks/${writeback.id}/apply`,
    {
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      data: {
        actorRole: "admin",
        input: {
          targetType: "knowledge_item",
          appliedBy: "ignored-by-server",
          title: knowledgeTitle,
          canonicalText:
            "Governed learning writebacks must reach the knowledge review queue before publication.",
          knowledgeKind: "rule",
          moduleScope: "editing",
          manuscriptTypes: ["clinical_study"],
          summary: `${input.label} governed writeback summary`,
        },
      },
    },
  );
  expect(applyWritebackResponse.ok()).toBeTruthy();
  const appliedWriteback = (await applyWritebackResponse.json()) as {
    status: string;
    created_draft_asset_id?: string;
  };
  expect(appliedWriteback.status).toBe("applied");
  expect(appliedWriteback.created_draft_asset_id).toBeTruthy();

  const submitResponse = await request.post(
    `${apiBaseUrl}/api/v1/knowledge/${appliedWriteback.created_draft_asset_id}/submit`,
    {
      headers: {
        Cookie: adminCookie,
      },
    },
  );
  expect(submitResponse.ok()).toBeTruthy();
  const submittedKnowledgeItem = (await submitResponse.json()) as {
    id: string;
    status: string;
  };
  expect(submittedKnowledgeItem.status).toBe("pending_review");

  const reviewerContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  await loginBrowserSession(reviewerPage, request, "dev.knowledge-reviewer");
  await reviewerPage.goto(
    `/#knowledge-review?knowledgeItemId=${submittedKnowledgeItem.id}`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(
    reviewerPage.getByRole("heading", { name: queueHeading }),
  ).toBeVisible();
  await expect(reviewerPage.locator(".knowledge-review-queue-pane")).toContainText(
    knowledgeTitle,
  );

  return {
    knowledgeItemId: submittedKnowledgeItem.id,
    knowledgeTitle,
    page: reviewerPage,
    context: reviewerContext,
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

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
