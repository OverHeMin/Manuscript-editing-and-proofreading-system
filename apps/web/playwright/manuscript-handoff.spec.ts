import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import {
  semanticTableColumnKey,
  semanticTableDocxBase64,
  semanticTableReportTarget,
} from "../../../test-support/semantic-table-docx.ts";

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
  await expect(page.getByRole("heading", { name: "当前稿件初筛判断" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`正在加载稿件 ${manuscriptId}...`);
  await expect(page.locator("body")).toContainText(
    "正在拉取工作区资产与最新治理状态，完成后即可继续操作。",
  );
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`已自动带入稿件 ${manuscriptId}`);

  const runScreeningButton = page.getByRole("button", { name: "执行初筛" });
  await expect(runScreeningButton).toBeEnabled();
  await runScreeningButton.click();
  await expect(page.locator("body")).toContainText("操作已完成");
  await expect(page.locator("body")).toContainText("已生成资产");
  const editingLink = page.locator(`a[href*="#editing?manuscriptId=${manuscriptId}"]`).first();
  await expect(editingLink).toBeVisible();

  await navigateViaHashLink(page, editingLink);
  await expect(page.getByRole("heading", { name: "当前稿件编辑工作区" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`正在加载稿件 ${manuscriptId}...`);
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`已自动带入稿件 ${manuscriptId}`);

  const runEditingButton = page.getByRole("button", { name: "执行编辑" });
  await expect(runEditingButton).toBeEnabled();
  await runEditingButton.click();
  await expect(page.locator("body")).toContainText("已生成资产");
  const editedAsset = await waitForCurrentAsset(request, manuscriptId, "edited_docx");
  const editingJob = await waitForJob(
    request,
    editedAsset.source_job_id ?? "",
    (job) => (job.payload?.tableInspectionFindings?.length ?? 0) > 0,
  );
  expect(
    editingJob.payload?.tableInspectionFindings?.[0]?.semantic_hit?.column_key,
  ).toBe(semanticTableColumnKey);
  const proofreadingLink = page
    .locator(`a[href*="#proofreading?manuscriptId=${manuscriptId}"]`)
    .first();
  await expect(proofreadingLink).toBeVisible();

  await navigateViaHashLink(page, proofreadingLink);
  await expect(page.getByRole("heading", { name: "当前稿件校对工作区" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`正在加载稿件 ${manuscriptId}...`);
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`已自动带入稿件 ${manuscriptId}`);

  const createDraftButton = page.getByRole("button", { name: "生成校对草稿" });
  await expect(createDraftButton).toBeEnabled();
  await createDraftButton.click();
  await expect(page.locator("body")).toContainText("proofreading_draft_report");
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
  await expect(page.locator("body")).toContainText(
    "生成校对终稿前仍需人工确认。",
  );
  await expect(page.getByRole("button", { name: "确认校对定稿" })).toBeEnabled();

  await page.getByRole("button", { name: "确认校对定稿" }).click();
  await expect(page.locator("body")).toContainText("已完成终稿资产");
  await expect(page.locator("body")).toContainText("当前校对终稿已激活，可继续下游交付。");

  await page.getByRole("button", { name: "发布人工终稿" }).click();
  await expect(page.locator("body")).toContainText("已发布人工终稿资产");
  await expect(page.locator("body")).toContainText(
    "当前阶段：审核。下一步：前往规则中心完成审核，并继续转成规则草稿。",
  );
  const learningReviewLink = page.getByRole("link", { name: "前往规则中心" });
  await expect(learningReviewLink).toBeVisible();
  await expect(learningReviewLink).toHaveAttribute(
    "href",
    new RegExp(
      `^#template-governance\\?manuscriptId=${manuscriptId}&templateGovernanceView=rule-ledger&ruleCenterMode=learning$`,
    ),
  );

  await page.getByRole("button", { name: "导出当前资产" }).click();
  await expect(page.locator("body")).toContainText("已准备导出");
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

  await navigateViaHashLink(page, learningReviewLink);
  await expect(page.getByRole("heading", { name: "回流候选转规则" })).toBeVisible();
  await expect(page.locator("body")).toContainText("规则中心 · 转规则站");
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
