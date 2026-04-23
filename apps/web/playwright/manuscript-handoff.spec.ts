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
  await expect(page.locator("body")).toContainText("正在加载稿件...");
  await expect(page.locator("body")).toContainText(
    "正在拉取工作区资产与最新治理状态，完成后即可继续操作。",
  );
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText("已自动带入稿件");
  await expect(page.getByRole("textbox", { name: "稿件查找" })).toHaveValue(
    manuscriptTitle,
  );

  const runScreeningButton = page.getByRole("button", { name: "执行初筛" });
  await expect(runScreeningButton).toBeEnabled();
  await runScreeningButton.click();
  await expect(page.locator("body")).toContainText("操作已完成");
  await expect(page.locator("body")).toContainText("已生成初筛报告");
  await expandResultDetails(page);
  const editingLink = page.getByRole("link", { name: "前往编辑工作台" });
  await expect(editingLink).toBeVisible();

  await navigateViaHashLink(page, editingLink);
  await expect(page.getByRole("heading", { name: /编辑工作区/ })).toBeVisible();
  await expect(page.locator("body")).toContainText("正在加载稿件...");
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText("已自动带入稿件");
  await expect(page.getByRole("textbox", { name: "稿件查找" })).toHaveValue(
    manuscriptTitle,
  );

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
  await expandResultDetails(page);
  const proofreadingLink = page.getByRole("link", { name: "前往校对工作台" });
  await expect(proofreadingLink).toBeVisible();

  await navigateViaHashLink(page, proofreadingLink);
  await expect(page.getByRole("heading", { name: /校对工作区/ })).toBeVisible();
  await expect(page.locator("body")).toContainText("正在加载稿件...");
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText("已自动带入稿件");
  await expect(page.getByRole("textbox", { name: "稿件查找" })).toHaveValue(
    manuscriptTitle,
  );

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
  const selectedIssue = page.locator(
    ".manuscript-workbench-proofreading-issue.is-selected",
  );
  const issueDetail = selectedIssue.locator(
    ".manuscript-workbench-proofreading-issue-detail",
  );
  await clickViaDom(issueDetail.getByRole("button", { name: "转规则候选" }));
  await expect(
    issueDetail.getByRole("button", { name: "转规则候选" }),
  ).toHaveClass(/is-selected/);

  const publishHumanFinalButton = page.locator(
    ".manuscript-workbench-proofreading-issue-pane .manuscript-workbench-button-row--sticky button",
  );
  await expect(publishHumanFinalButton).toBeEnabled();
  await clickViaDom(publishHumanFinalButton);
  await expect(page.locator("body")).toContainText("已发布人工终稿资产");
  const learningReviewHref =
    `#template-governance?manuscriptId=${manuscriptId}` +
    "&templateGovernanceView=rule-ledger&ruleCenterMode=learning";

  await page.getByRole("button", { name: "导出当前资产" }).click();
  await expect(page.locator("body")).toContainText("已准备导出");
  await expect(page.locator("body")).toContainText("导出文件名");
  await expect(page.locator("body")).toContainText("human-final.docx");
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
  expect(downloadResponse.headers()["content-disposition"] ?? "").toContain(
    "human-final.docx",
  );

  await page.goto(`/${learningReviewHref}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "回流候选转规则" })).toBeVisible();
  await expect(page.locator("body")).toContainText("规则中心 · 统一复核中心");
  await expect(page.locator("body")).toContainText(`稿件 ${manuscriptId}`);
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
    })
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
    .locator(`a[href="#proofreading?manuscriptId=${manuscriptId}&assetId=${assetId}"]`)
    .first();
  await expect(currentResultLink).toBeVisible();
  await navigateViaHashLink(page, currentResultLink);
  await expect(page).toHaveURL(
    new RegExp(`#proofreading\\?manuscriptId=${manuscriptId}&assetId=${assetId}$`),
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
  await expect(
    page.locator('.manuscript-workbench-proofreading-block[data-selected="true"]').first(),
  ).toBeVisible();
}

async function expandResultDetails(page: Page) {
  const summary = page.locator("summary").filter({ hasText: "展开完整处理详情" }).first();
  await expect(summary).toBeVisible();
  await clickViaDom(summary);
}

async function clickViaDom(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate((element: HTMLElement) => element.click());
}
