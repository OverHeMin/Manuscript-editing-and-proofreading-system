import { expect, test } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("admin can complete the governed learning review flow from manuscript handoff", async ({
  page,
  request,
}) => {
  await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username: "dev.user",
      password: "demo-password",
    },
  });

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: "Phase 8AA Learning Review Browser Smoke",
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "phase8aa-source.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: "uploads/phase8aa/phase8aa-source.docx",
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();

  const uploaded = (await uploadResponse.json()) as {
    manuscript: {
      id: string;
    };
    asset: {
      id: string;
    };
  };
  const manuscriptId = uploaded.manuscript.id;

  const candidateTitle = `Phase 8AA governed candidate ${manuscriptId}`;
  const knowledgeTitle = `Phase 8AA knowledge draft ${manuscriptId}`;

  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveTitle(/Medical Manuscript System - Web/i);
  await expect(page.getByRole("heading", { name: "初筛工作台" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`Auto-loaded manuscript ${manuscriptId}`);

  await page.getByRole("button", { name: "执行初筛" }).click();
  await expect(page.locator("body")).toContainText("Action Complete");
  const editingLink = page.locator(`a[href*="#editing?manuscriptId=${manuscriptId}"]`).first();
  await expect(editingLink).toBeVisible();

  await editingLink.click();
  await expect(page.getByRole("heading", { name: "编辑工作台" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "执行编辑" }).click();
  const proofreadingLink = page
    .locator(`a[href*="#proofreading?manuscriptId=${manuscriptId}"]`)
    .first();
  await expect(proofreadingLink).toBeVisible();

  await proofreadingLink.click();
  await expect(page.getByRole("heading", { name: "校对工作台" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "生成草稿" }).click();
  await expect(page.locator("body")).toContainText("proofreading_draft_report");

  await page.getByRole("button", { name: "校对定稿" }).click();
  await expect(page.locator("body")).toContainText("Finalized asset");

  await page.getByRole("button", { name: "发布人工终稿" }).click();
  await expect(page.locator("body")).toContainText("Published human-final asset");
  const learningReviewLink = page
    .locator(`a[href*="#learning-review?manuscriptId=${manuscriptId}"]`)
    .first();
  await expect(learningReviewLink).toBeVisible();

  await learningReviewLink.click();
  await expect(page.getByRole("heading", { name: "Knowledge Handoff Bridge" })).toBeVisible();
  await expect(page.locator("body")).toContainText(
    "This review desk was prefilled from the manuscript workbench handoff.",
  );
  await expect(page.locator(`input[value="${manuscriptId}"]`)).toBeVisible();

  await page.getByRole("button", { name: "Create snapshot" }).click();
  await expect(page.locator("body")).toContainText("Reviewed case snapshot created:");
  await expect(page.locator("body")).toContainText("Latest snapshot");

  await page.getByRole("textbox", { name: "Title", exact: true }).fill(candidateTitle);
  await page.getByRole("textbox", { name: "Proposal", exact: true }).fill(
    "Carry governed proofreading learning evidence into the review queue.",
  );
  await page.getByRole("button", { name: "Create governed candidate" }).click();

  await expect(page.locator("body")).toContainText("Governed learning candidate created:");
  await expect(page.locator("body")).toContainText(candidateTitle);
  await expect(page.getByRole("button", { name: "Approve selected candidate" })).toBeEnabled();

  await page.getByRole("button", { name: "Approve selected candidate" }).click();
  await expect(page.locator("body")).toContainText("Learning candidate approved:");
  await expect(page.locator("body")).toContainText("Latest approved handoff");
  await expect(page.locator("body")).toContainText("approved");

  await page.getByRole("button", { name: "Create writeback" }).click();
  await expect(page.locator("body")).toContainText("Draft writeback created:");
  await expect(page.locator("body")).toContainText("Active draft writeback");

  await page.getByRole("textbox", { name: "Knowledge Title", exact: true }).fill(
    knowledgeTitle,
  );
  await page.getByRole("textbox", { name: "Canonical Text", exact: true }).fill(
    "Governed proofreading evidence should remain reviewable before knowledge publication.",
  );
  await page.getByRole("button", { name: "Apply writeback" }).click();

  await expect(page.locator("body")).toContainText("Writeback applied into governed draft:");
  await expect(page.locator(".learning-review-writeback-list")).toContainText("applied");
  await expect(page.locator(".learning-review-writeback-list")).toContainText("knowledge_item");
});
