import { expect, test } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("admin can follow screening to proofreading handoffs with visible prefill loading state", async ({
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
      title: "Phase 8T Browser QA Manuscript",
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "phase8t-source.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: "uploads/phase8t/phase8t-source.docx",
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();

  const uploaded = (await uploadResponse.json()) as {
    manuscript: {
      id: string;
      current_template_family_id?: string;
    };
    asset: {
      id: string;
    };
  };
  const manuscriptId = uploaded.manuscript.id;
  expect(uploaded.manuscript.current_template_family_id).toBe("family-seeded-1");

  await page.route(`**/api/v1/manuscripts/${manuscriptId}`, async (route) => {
    await page.waitForTimeout(600);
    await route.continue();
  });
  await page.route(`**/api/v1/manuscripts/${manuscriptId}/assets`, async (route) => {
    await page.waitForTimeout(600);
    await route.continue();
  });

  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveTitle(/Medical Manuscript System - Web/i);
  await expect(page.locator("body")).toContainText("当前账号");
  await expect(page.locator("body")).toContainText("管理员");
  await expect(page.getByRole("heading", { name: "初筛工作台" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`正在加载稿件 ${manuscriptId}...`);
  await expect(page.locator("body")).toContainText(
    "正在拉取工作区资产与最新治理状态，完成后即可继续操作。",
  );
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`Auto-loaded manuscript ${manuscriptId}`);

  const runScreeningButton = page.getByRole("button", { name: "执行初筛" });
  await expect(runScreeningButton).toBeEnabled();
  await runScreeningButton.click();
  await expect(page.locator("body")).toContainText("Action Complete");
  await expect(page.locator("body")).toContainText("Created asset");
  const editingLink = page.locator(`a[href*="#editing?manuscriptId=${manuscriptId}"]`).first();
  await expect(editingLink).toBeVisible();

  await editingLink.click();
  await expect(page.getByRole("heading", { name: "编辑工作台" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`正在加载稿件 ${manuscriptId}...`);
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`Auto-loaded manuscript ${manuscriptId}`);

  const runEditingButton = page.getByRole("button", { name: "执行编辑" });
  await expect(runEditingButton).toBeEnabled();
  await runEditingButton.click();
  await expect(page.locator("body")).toContainText("Created asset");
  const proofreadingLink = page
    .locator(`a[href*="#proofreading?manuscriptId=${manuscriptId}"]`)
    .first();
  await expect(proofreadingLink).toBeVisible();

  await proofreadingLink.click();
  await expect(page.getByRole("heading", { name: "校对工作台" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`正在加载稿件 ${manuscriptId}...`);
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`Auto-loaded manuscript ${manuscriptId}`);

  const createDraftButton = page.getByRole("button", { name: "生成草稿" });
  await expect(createDraftButton).toBeEnabled();
  await createDraftButton.click();
  await expect(page.locator("body")).toContainText("proofreading_draft_report");
  await expect(page.locator("body")).toContainText(
    "生成校对终稿前仍需人工确认。",
  );
  await expect(page.getByRole("button", { name: "校对定稿" })).toBeEnabled();

  await page.getByRole("button", { name: "校对定稿" }).click();
  await expect(page.locator("body")).toContainText("Finalized asset");
  await expect(page.locator("body")).toContainText("当前校对终稿已激活，可继续下游交付。");

  await page.getByRole("button", { name: "发布人工终稿" }).click();
  await expect(page.locator("body")).toContainText("Published human-final asset");
  await expect(page.locator("body")).toContainText(
    "人工终稿已就绪，可进入学习快照治理流程。",
  );
  const learningReviewLink = page
    .locator(`a[href*="#learning-review?manuscriptId=${manuscriptId}"]`)
    .first();
  await expect(learningReviewLink).toBeVisible();

  await page.getByRole("button", { name: "导出当前资产" }).click();
  await expect(page.locator("body")).toContainText("Prepared export");
  await expect(page.locator("body")).toContainText("导出文件名");
  await expect(page.locator("body")).toContainText("human-final.docx");
  await expect(page.locator("body")).toContainText("下载 MIME 类型");
  await expect(page.locator("body")).toContainText(
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  await expect(page.locator("body")).toContainText(
    `runs/${manuscriptId}/proofreading/human-final`,
  );
  const downloadLink = page.locator('a[href*="/api/v1/document-assets/"]').last();
  await expect(downloadLink).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("human-final.docx");

  await learningReviewLink.click();
  await expect(page.getByRole("heading", { name: "规则中心" })).toBeVisible();
  await expect(page.locator("body")).toContainText(
    "This rule-learning desk was opened from manuscript handoff",
  );
  await expect(page.locator("body")).toContainText(manuscriptId);
  await expect(page.locator("body")).toContainText("Rule Candidate Review");
});
