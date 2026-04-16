import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import {
  semanticTableColumnKey,
  semanticTableDocxBase64,
  semanticTableReportTarget,
} from "../../../test-support/semantic-table-docx.ts";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const abstractObjectiveSource = "\u6458\u8981 \u76ee\u7684";
const abstractObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const screeningHeading = "当前稿件初筛判断";
const editingHeading = "当前稿件编辑工作区";
const proofreadingHeading = "当前稿件校对工作区";
const ruleCenterHeading = "规则台账";
const runScreeningLabel = "\u6267\u884c\u521d\u7b5b";
const runEditingLabel = "\u6267\u884c\u7f16\u8f91";
const createDraftLabel = "生成校对草稿";
const finalizeProofLabel = "确认校对定稿";
const publishHumanFinalLabel = "\u53d1\u5e03\u4eba\u5de5\u7ec8\u7a3f";

test("admin can complete the governed learning review flow from manuscript handoff", async ({
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
      title: "Phase 8AA Learning Review Browser Smoke",
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "phase8aa-source.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: semanticTableDocxBase64,
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
  const evidenceSummary = `Phase 8AA reviewed snapshot normalization ${manuscriptId}`;

  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveTitle(/Medical Manuscript System - Web/i);
  await expect(page.getByRole("heading", { name: screeningHeading })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`已自动带入稿件 ${manuscriptId}`);

  await page.getByRole("button", { name: runScreeningLabel }).click();
  await expect(page.locator("body")).toContainText("操作已完成");
  const editingLink = page.locator(`a[href*="#editing?manuscriptId=${manuscriptId}"]`).first();
  await expect(editingLink).toBeVisible();

  await navigateViaHashLink(page, editingLink);
  await expect(page.getByRole("heading", { name: editingHeading })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: runEditingLabel }).click();
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
  await expect(page.getByRole("heading", { name: proofreadingHeading })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: createDraftLabel }).click();
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

  await page.getByRole("button", { name: finalizeProofLabel }).click();
  await expect(page.locator("body")).toContainText("已完成终稿资产");

  await page.getByRole("button", { name: publishHumanFinalLabel }).click();
  await expect(page.locator("body")).toContainText("已发布人工终稿资产");
  await expect(page.locator("body")).toContainText(
    "人工终稿已就绪，可进入规则中心的回流工作区。",
  );
  const learningReviewLink = page.getByRole("link", { name: "前往回流工作区" });
  await expect(learningReviewLink).toBeVisible();
  await expect(learningReviewLink).toHaveAttribute(
    "href",
    new RegExp(
      `^#template-governance\\?manuscriptId=${manuscriptId}&templateGovernanceView=rule-ledger&ruleCenterMode=learning$`,
    ),
  );

  const assetsResponse = await request.get(
    `${apiBaseUrl}/api/v1/manuscripts/${manuscriptId}/assets`,
  );
  expect(assetsResponse.ok()).toBeTruthy();
  const assets = (await assetsResponse.json()) as Array<{
    id: string;
    asset_type: string;
    is_current?: boolean;
  }>;
  const humanFinalAsset = assets.find(
    (asset) => asset.asset_type === "human_final_docx" && asset.is_current !== false,
  );
  expect(humanFinalAsset).toBeTruthy();

  const snapshotResponse = await request.post(
    `${apiBaseUrl}/api/v1/learning/reviewed-case-snapshots`,
    {
      data: {
        manuscriptId,
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset!.id,
        deidentificationPassed: true,
        storageKey: `learning/${manuscriptId}/phase8aa-browser-snapshot.bin`,
      },
    },
  );
  expect(snapshotResponse.ok()).toBeTruthy();
  const snapshot = (await snapshotResponse.json()) as {
    id: string;
  };

  const extractResponse = await request.post(
    `${apiBaseUrl}/api/v1/learning/candidates/extract`,
    {
      data: {
        deidentificationPassed: true,
        suggestedTemplateFamilyId: "family-seeded-1",
        source: {
          kind: "reviewed_case_snapshot",
          reviewedCaseSnapshotId: snapshot.id,
          beforeFragment: abstractObjectiveSource,
          afterFragment: abstractObjectiveNormalized,
          evidenceSummary,
        },
      },
    },
  );
  expect(extractResponse.ok()).toBeTruthy();
  const extractedCandidate = (await extractResponse.json()) as {
    id: string;
    status: string;
    title?: string;
  };
  expect(extractedCandidate.status).toBe("pending_review");
  const candidateListLabel = extractedCandidate.title ?? extractedCandidate.id;

  await navigateViaHashLink(page, learningReviewLink);
  await expect(page.getByRole("heading", { name: ruleCenterHeading })).toBeVisible();
  await expect(page.locator("body")).toContainText("规则中心 · 回流工作区");
  await expect(page.locator("body")).toContainText(`稿件 ${manuscriptId}`);
  await expect(page.locator("body")).toContainText(`回流来源稿件：${manuscriptId}`);
  await expect(page.locator("body")).toContainText("回流候选");

  await page
    .getByRole("button", { name: new RegExp(escapeRegExp(candidateListLabel)) })
    .click();
  await expect(page.locator("body")).toContainText(evidenceSummary);
  await expect(page.locator("body")).toContainText(abstractObjectiveSource);
  await expect(page.locator("body")).toContainText(abstractObjectiveNormalized);
  await expect(page.locator("body")).toContainText("family-seeded-1");

  await expect(page.getByRole("button", { name: "批准候选" })).toBeEnabled();
  await page.getByRole("button", { name: "批准候选" }).click();
  await expect(page.locator("body")).toContainText(
    `已批准回流候选：${extractedCandidate.id}`,
  );
  await expect(page.getByRole("button", { name: "转成规则" })).toBeEnabled();

  await page.getByRole("button", { name: "转成规则" }).click();
  await expect(page.locator("body")).toContainText("规则向导");
  await expect(page.locator("body")).toContainText("返回规则台账");
  await expect(page.locator("body")).toContainText(candidateListLabel);
  await expect(page.locator("body")).toContainText(evidenceSummary);
  await expect(page.locator("body")).toContainText(abstractObjectiveSource);
  await expect(page.locator("body")).toContainText(abstractObjectiveNormalized);
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
