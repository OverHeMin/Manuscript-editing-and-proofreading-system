import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import {
  semanticTableColumnKey,
  semanticTableDocxBase64,
  semanticTableReportTarget,
} from "../../../test-support/semantic-table-docx.ts";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const manuscriptTitle = "Phase 8T Browser QA Manuscript";

test("admin can follow screening to proofreading handoffs with visible prefill loading state", async ({
  page,
  request,
}) => {
  await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username: "dev.admin",
      password: "demo-password",
    },
  });

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: manuscriptTitle,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "phase8t-source.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: semanticTableDocxBase64,
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
  await expect(page.getByRole("heading", { name: /当前稿件初筛判断|初筛工作区/ })).toBeVisible();
  await expect(page.locator("body")).toContainText("正在加载稿件");
  await expect(page.locator("body")).toContainText(
    "正在拉取工作区资产与最新治理状态，完成后即可继续操作。",
  );
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText("已自动带入稿件");
  await expectLoadedManuscript(page, manuscriptTitle);

  const runScreeningButton = page.getByRole("button", { name: "执行初筛" });
  await expect(runScreeningButton).toBeEnabled();
  await runScreeningButton.click();
  await expect(page.locator("body")).toContainText("操作已完成");
  await expect(page.locator("body")).toContainText("已生成初筛报告");
  const screeningAsset = await waitForCurrentAsset(
    request,
    manuscriptId,
    "screening_report",
  );
  await navigateToScreeningSharedReview(page, manuscriptId, screeningAsset.id);
  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: /当前稿件初筛判断|初筛工作区/ })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expandResultDetails(page);
  const editingLink = page.getByRole("link", { name: "前往编辑工作台" });
  await expect(editingLink).toBeVisible();

  await navigateViaHashLink(page, editingLink);
  await expect(page.getByRole("heading", { name: /编辑工作区/ })).toBeVisible();
  await expect(page.locator("body")).toContainText("正在加载稿件");
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText("已自动带入稿件");
  await expectLoadedManuscript(page, manuscriptTitle);
  const journalTemplateSelect = page
    .locator(".manuscript-workbench-field")
    .filter({ hasText: "期刊模板（小期刊/场景）" })
    .locator("select");
  await expect(journalTemplateSelect).toBeVisible();
  await journalTemplateSelect.selectOption({ label: "Seeded Clinical Journal Overlay" });
  const saveTemplateContextButton = page.getByRole("button", { name: "保存模板上下文" });
  await expect(saveTemplateContextButton).toBeEnabled();
  await clickViaDom(saveTemplateContextButton);
  await expect(page.locator("body")).toContainText(`已保存 ${manuscriptId} 的人工模板修正`);

  const runEditingButton = page.getByRole("button", { name: "执行编辑" });
  await expect(runEditingButton).toBeEnabled();
  await runEditingButton.click();
  await expect(page.locator("body")).toContainText("已生成编辑稿件");
  const editedAsset = await waitForCurrentAsset(request, manuscriptId, "edited_docx");
  const editingJob = await waitForJob(
    request,
    editedAsset.source_job_id ?? "",
    (job) => (job.payload?.tableInspectionFindings?.length ?? 0) > 0,
  );
  expect(
    editingJob.payload?.tableInspectionFindings?.[0]?.semantic_hit?.column_key,
  ).toBe(semanticTableColumnKey);
  await navigateToEditingSharedReview(page, manuscriptId, editedAsset.id);
  await page.goto(`/#editing?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: /编辑工作区/ })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await page.goto(`/#proofreading?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: /校对工作区/ })).toBeVisible();
  await expect(page.locator("body")).toContainText("正在加载稿件");
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText("已自动带入稿件");
  await expectLoadedManuscript(page, manuscriptTitle);

  const createDraftButton = page.getByRole("button", { name: "生成校对草稿" });
  await expect(createDraftButton).toBeEnabled();
  await createDraftButton.click();
  await expect(page.locator("body")).toContainText("已生成校对草稿报告");
  const proofreadingDraftAsset = await waitForCurrentAsset(
    request,
    manuscriptId,
    "proofreading_draft_report",
  );
  const proofreadingJob = await waitForJob(
    request,
    proofreadingDraftAsset.source_job_id ?? "",
    (job) => (job.payload?.proofreadingFindings?.failedChecks?.length ?? 0) > 0,
  );
  expect(
    proofreadingJob.payload?.proofreadingFindings?.failedChecks?.[0]?.semantic_hit
      ?.column_key,
  ).toBe(semanticTableColumnKey);
  expect(String(proofreadingJob.payload?.reportMarkdown)).toContain(
    semanticTableReportTarget,
  );
  await navigateToProofreadingIssueWorkbench(page, manuscriptId, proofreadingDraftAsset.id);
  const seededIssue = page
    .locator(".manuscript-workbench-proofreading-issue")
    .filter({ hasText: "Seeded proofreading issue" })
    .first();
  await clickViaDom(seededIssue.getByRole("button").first());
  const issueDetail = seededIssue.locator(
    ".manuscript-workbench-proofreading-issue-detail",
  );
  await expect(issueDetail).toBeVisible();
  const ruleCandidateCheckbox = issueDetail.getByRole("checkbox", {
    name: "转规则候选",
  });
  await expect(ruleCandidateCheckbox).toBeVisible();
  await ruleCandidateCheckbox.check();
  await expect(ruleCandidateCheckbox).toBeChecked();

  await resolveRemainingProofreadingIssues(page, 0);

  const publishHumanFinalButton = page.getByRole("button", { name: "发布人工终稿" });
  await expect(publishHumanFinalButton).toBeEnabled();
  await clickViaDom(publishHumanFinalButton);
  await expect(page.locator("body")).toContainText("已发布人工终稿资产");
  const learningReviewHref =
    `#template-governance?manuscriptId=${manuscriptId}` +
    "&templateGovernanceView=rule-ledger&ruleCenterMode=learning";

  await page.getByRole("button", { name: "导出当前资产" }).click();
  await expect(page.locator("body")).toContainText("已准备导出");
  await expect(page.locator("body")).toContainText("导出文件名");
  await expect(page.locator("body")).toContainText("人工终稿.docx");
  await expect(page.locator("body")).toContainText("下载 MIME 类型");
  await expect(page.locator("body")).toContainText("Word 文档（DOCX）");
  await expect(page.locator("body")).not.toContainText(
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  await expect(page.locator("body")).not.toContainText(
    `runs/${manuscriptId}/proofreading/human-final`,
  );
  const downloadLink = page.locator('a[href*="/api/v1/document-assets/"]').last();
  const downloadUrl = await downloadLink.getAttribute("href");
  expect(downloadUrl).toBeTruthy();
  const downloadResponse = await request.get(downloadUrl!);
  expect(downloadResponse.ok()).toBeTruthy();
  expect(downloadResponse.headers()["content-type"]).toContain(
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  expect(downloadResponse.headers()["content-disposition"] ?? "").toContain("filename*=");
  expect(downloadResponse.headers()["content-disposition"] ?? "").toContain(".docx");

  await page.goto(`/${learningReviewHref}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "规则工作台" })).toBeVisible();
  await expect(page.locator(".rule-center-v2")).toHaveAttribute(
    "data-active-section",
    "recovery",
  );
  await expect(
    page.getByRole("navigation", { name: "规则中心分区" }).getByRole("button", {
      name: /^回流/,
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "统一复核队列" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`回流来源稿件：${manuscriptId}`);
  await expect(page.locator("body")).toContainText("回流候选");
});

async function waitForCurrentAsset(
  request: APIRequestContext,
  manuscriptId: string,
  assetType: string,
) {
  await expect
    .poll(async () => {
      const assetsResponse = await request.get(
        `${apiBaseUrl}/api/v1/manuscripts/${manuscriptId}/assets`,
      );
      const assets = (await assetsResponse.json()) as Array<{
        id: string;
        asset_type: string;
        is_current?: boolean;
        source_job_id?: string;
      }>;
      return (
        assets.find(
          (asset) =>
            asset.asset_type === assetType && asset.is_current !== false,
        )?.source_job_id ?? ""
      );
    })
    .not.toBe("");

  const assetsResponse = await request.get(
    `${apiBaseUrl}/api/v1/manuscripts/${manuscriptId}/assets`,
  );
  const assets = (await assetsResponse.json()) as Array<{
    id: string;
    asset_type: string;
    is_current?: boolean;
    source_job_id?: string;
  }>;
  const asset = assets.find(
    (record) => record.asset_type === assetType && record.is_current !== false,
  );
  expect(asset).toBeTruthy();
  return asset!;
}

async function waitForJob(
  request: APIRequestContext,
  jobId: string,
  predicate: (job: {
    status?: string;
    payload?: {
      tableInspectionFindings?: Array<{
        semantic_hit?: {
          column_key?: string;
        };
      }>;
      proofreadingFindings?: {
        failedChecks?: Array<{
          semantic_hit?: {
            column_key?: string;
          };
        }>;
      };
      reportMarkdown?: string;
    };
  }) => boolean,
) {
  await expect
    .poll(async () => {
      const jobResponse = await request.get(`${apiBaseUrl}/api/v1/jobs/${jobId}`);
      if (!jobResponse.ok()) {
        return false;
      }

      const job = (await jobResponse.json()) as {
        status?: string;
        payload?: {
          tableInspectionFindings?: Array<{
            semantic_hit?: {
              column_key?: string;
            };
          }>;
          proofreadingFindings?: {
            failedChecks?: Array<{
              semantic_hit?: {
                column_key?: string;
              };
            }>;
          };
          reportMarkdown?: string;
        };
      };

      return job.status === "completed" && predicate(job);
    }, { timeout: 30_000 })
    .toBe(true);

  const jobResponse = await request.get(`${apiBaseUrl}/api/v1/jobs/${jobId}`);
  expect(jobResponse.ok()).toBeTruthy();
  return (await jobResponse.json()) as {
    status?: string;
    payload?: {
      tableInspectionFindings?: Array<{
        semantic_hit?: {
          column_key?: string;
        };
      }>;
      proofreadingFindings?: {
        failedChecks?: Array<{
          semantic_hit?: {
            column_key?: string;
          };
        }>;
      };
      reportMarkdown?: string;
    };
  };
}

async function expectLoadedManuscript(page: Page, title: string) {
  const workspaceStage = page.locator('[data-pane="workspace-stage"]').first();
  await expect(workspaceStage).toContainText("当前稿件");
  await expect(workspaceStage).toContainText(title);
}

async function navigateViaHashLink(
  page: Page,
  link: Locator,
) {
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(`/${href}`, {
    waitUntil: "domcontentloaded",
  });
}

async function navigateToProofreadingIssueWorkbench(
  page: Page,
  manuscriptId: string,
  assetId: string,
) {
  const currentResultLink = page
    .getByRole("link", { name: /进入结果页|查看当前结果/ })
    .first();
  await expect(currentResultLink).toBeVisible();
  await expect(currentResultLink).toHaveAttribute(
    "href",
    new RegExp(`#proofreading\\?manuscriptId=${manuscriptId}&assetId=${assetId}`),
  );
  await navigateViaHashLink(page, currentResultLink);
  await expect(page).toHaveURL(
    new RegExp(`#proofreading\\?manuscriptId=${manuscriptId}&assetId=${assetId}(&presentation=fullscreen)?$`),
  );
  await expect(
    page.locator('[data-detail-kind="proofreading_workspace"]'),
  ).toBeVisible();

  const issueToggle = page.locator(".manuscript-workbench-proofreading-issue-toggle").first();
  const issueDetail = page.locator(".manuscript-workbench-proofreading-issue-detail").first();
  await expect(issueToggle).toBeVisible();
  if (!(await issueDetail.isVisible())) {
    await issueToggle.evaluate((element: HTMLElement) => element.click());
  }
  await expect(issueDetail).toBeVisible();
  const realDocumentSurface = page.getByText("真实文档面").first();
  if ((await realDocumentSurface.count()) > 0) {
    await expect(realDocumentSurface).toBeVisible();
    return;
  }

  await expect(
    page.locator('.manuscript-workbench-proofreading-block[data-selected="true"]').first(),
  ).toBeVisible();
}

async function navigateToEditingSharedReview(
  page: Page,
  manuscriptId: string,
  assetId: string,
) {
  await page.goto(`/#editing?manuscriptId=${manuscriptId}&assetId=${assetId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(
    new RegExp(`#editing\\?manuscriptId=${manuscriptId}&assetId=${assetId}$`),
  );
  const onlyOfficeReview = page.locator('[data-editing-layout="onlyoffice-review"]');
  await expect(onlyOfficeReview).toBeVisible();
  await expect(onlyOfficeReview).toContainText("编辑稿全文");
  await expect(onlyOfficeReview).toContainText("人工核验");
  await expect(onlyOfficeReview).toContainText("改动台账");
  await expect(onlyOfficeReview).toContainText("阻断项");

  const blockerDetails = onlyOfficeReview
    .locator("summary")
    .filter({ hasText: "查看阻断详情" })
    .first();
  await expect(blockerDetails).toBeVisible();
  await clickViaDom(blockerDetails);
  await expect(onlyOfficeReview).toContainText("前置信息槽位");
  await expect(onlyOfficeReview).toContainText("编辑完成门禁");
}

async function navigateToScreeningSharedReview(
  page: Page,
  manuscriptId: string,
  assetId: string,
) {
  await page.goto(`/#screening?manuscriptId=${manuscriptId}&assetId=${assetId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(
    new RegExp(`#screening\\?manuscriptId=${manuscriptId}&assetId=${assetId}$`),
  );
  const sharedReview = page.locator('[data-screening-layout="shared-review"]');
  await expect(sharedReview).toBeVisible();
  await expect(sharedReview).toContainText("稿件全文");
  await expect(sharedReview).toContainText("风险与建议");
  await expect(sharedReview).toContainText("风险等级");
  await expect(sharedReview).toContainText("建议结论");
  await expect(
    sharedReview
      .locator(
        ".manuscript-workbench-proofreading-block, .manuscript-workbench-detail-empty",
      )
      .first(),
  ).toBeVisible();
}

async function expandResultDetails(page: Page) {
  const summary = page.locator("summary").filter({ hasText: "展开完整处理详情" }).first();
  await expect(summary).toBeVisible();
  await clickViaDom(summary);
}

async function resolveRemainingProofreadingIssues(page: Page, startIndex: number) {
  const issues = page.locator(".manuscript-workbench-proofreading-issue");
  const issueCount = await issues.count();
  for (let index = startIndex; index < issueCount; index += 1) {
    const issue = issues.nth(index);
    const issueButton = issue.getByRole("button").first();
    const issueLabel = await issueButton.innerText();
    if (
      /转规则候选|转知识候选|驳回|采纳|仅人工处理|升级处理/u.test(issueLabel)
    ) {
      continue;
    }

    await clickViaDom(issueButton);
    const detail = issue.locator(".manuscript-workbench-proofreading-issue-detail");
    await expect(detail).toBeVisible();
    const rejectButton = detail.getByRole("button", { name: "驳回" });
    if ((await rejectButton.count()) > 0) {
      await clickViaDom(rejectButton);
      await expect(rejectButton).toHaveClass(/is-selected/);
      continue;
    }
    const manualOnlyButton = detail.getByRole("button", { name: "仅人工处理" });
    await clickViaDom(manualOnlyButton);
    await expect(manualOnlyButton).toHaveClass(/is-selected/);
  }
}

async function clickViaDom(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate((element: HTMLElement) => element.click());
}
