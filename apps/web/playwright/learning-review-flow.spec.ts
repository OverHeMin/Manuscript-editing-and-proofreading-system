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
  await expect(page.locator("body")).toContainText("已生成校对批注稿");

  const publishHumanFinalButton = page.getByRole("button", {
    name: publishHumanFinalLabel,
  });
  await publishHumanFinalButton.click();
  await expect(page.locator("body")).toContainText("已确认 0/1 项");
  const acceptSuggestionButton = page
    .getByRole("button", { name: /^\u63a5\u53d7$/ })
    .first();
  await acceptSuggestionButton.click();
  await expect(publishHumanFinalButton).toBeEnabled();
  await publishHumanFinalButton.click();
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

  const learningReviewHref = await learningReviewLink.getAttribute("href");
  expect(learningReviewHref).toBeTruthy();
  await page.goto(`/${appendHashQueryParam(learningReviewHref ?? "", "learningCandidateId", extractedCandidate.id)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "回流候选转规则" })).toBeVisible();
  await expect(page.locator("body")).toContainText("规则中心 · 统一复核中心");
  await expect(page.locator("body")).toContainText(`稿件 ${manuscriptId}`);
  await expect(page.locator("body")).toContainText(`回流来源稿件：${manuscriptId}`);
  await expect(page.locator("body")).toContainText("回流候选");

  const extractedCandidateRowButton = page.locator(
    `[data-review-item-id="${extractedCandidate.id}"]`,
  );
  await expect(extractedCandidateRowButton).toBeVisible({ timeout: 10_000 });
  await extractedCandidateRowButton.click();
  await expect(page.locator("body")).toContainText(evidenceSummary);
  await expect(page.locator("body")).toContainText(abstractObjectiveSource);
  await expect(page.locator("body")).toContainText(abstractObjectiveNormalized);
  await expect(page.locator("body")).toContainText("family-seeded-1");

  await expect(page.getByRole("button", { name: "审核通过" })).toBeEnabled();
  await page.getByRole("button", { name: "审核通过" }).click();
  await expect(page.locator("body")).toContainText(
    `已审核通过学习候选：${extractedCandidate.id}`,
  );
  await expect(page.getByRole("button", { name: "转成规则草稿" })).toBeEnabled();

  await page.getByRole("button", { name: "转成规则草稿" }).click();
  await expect(page.locator("body")).toContainText("已完成规则草稿写回：");
  const writebacksResponse = await request.get(
    `${apiBaseUrl}/api/v1/learning-governance/candidates/${extractedCandidate.id}/writebacks`,
  );
  expect(writebacksResponse.ok()).toBeTruthy();
  const writebacks = (await writebacksResponse.json()) as Array<{
    id: string;
    target_type: string;
    status: string;
    created_draft_asset_id?: string;
  }>;
  const editorialRuleDraftWriteback = writebacks.find(
    (writeback) => writeback.target_type === "editorial_rule_draft",
  );
  expect(editorialRuleDraftWriteback).toBeTruthy();
  expect(editorialRuleDraftWriteback?.status).toBe("applied");
  expect(editorialRuleDraftWriteback?.created_draft_asset_id).toBeTruthy();
  await expect(page.locator("body")).toContainText(candidateListLabel);
  await expect(page.locator("body")).toContainText(evidenceSummary);
  await expect(page.locator("body")).toContainText(abstractObjectiveSource);
  await expect(page.locator("body")).toContainText(abstractObjectiveNormalized);
  await expect(page.locator("body")).toContainText(
    editorialRuleDraftWriteback?.created_draft_asset_id ?? "",
  );
});

test("admin can hand off editing manual feedback into rule center and open the selected learning candidate", async ({
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
      title: "Phase 8AE Manual Feedback Browser Smoke",
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "phase8ae-source.docx",
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
  };
  const manuscriptId = uploaded.manuscript.id;
  const manualFeedbackNote = `Phase 8AE manual feedback ${manuscriptId}`;

  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: screeningHeading })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: runScreeningLabel }).click();
  const editingLink = page.locator(`a[href*="#editing?manuscriptId=${manuscriptId}"]`).first();
  await expect(editingLink).toBeVisible();

  await navigateViaHashLink(page, editingLink);
  await expect(page.getByRole("heading", { name: editingHeading })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: runEditingLabel }).click();
  const editedAsset = await waitForCurrentAsset(request, manuscriptId, "edited_docx");
  await waitForJob(
    request,
    editedAsset.source_job_id ?? "",
    (job) => (job.payload?.tableInspectionFindings?.length ?? 0) > 0,
  );
  const manuscriptResponse = await request.get(
    `${apiBaseUrl}/api/v1/manuscripts/${manuscriptId}`,
  );
  expect(manuscriptResponse.ok()).toBeTruthy();
  const manuscript = (await manuscriptResponse.json()) as {
    manuscript_type: string;
    module_execution_overview?: {
      editing?: {
        latest_snapshot?: {
          id: string;
        };
      };
    };
  };
  const editingSnapshotId =
    manuscript.module_execution_overview?.editing?.latest_snapshot?.id ?? "";
  expect(editingSnapshotId).toBeTruthy();

  const manualFeedbackCard = page
    .locator(".manuscript-workbench-manual-feedback")
    .filter({ has: page.locator("textarea") });
  const manualFeedbackSubmitButton = manualFeedbackCard.locator(
    "button.manuscript-workbench-shortcut",
  );
  await expect(manualFeedbackCard).toBeVisible();
  await expect(manualFeedbackSubmitButton).toBeDisabled();
  await manualFeedbackCard.scrollIntoViewIfNeeded();

  const incorrectHitRadio = manualFeedbackCard.getByRole("radio").nth(1);
  await incorrectHitRadio.focus();
  await incorrectHitRadio.press("Space");
  await expect(incorrectHitRadio).toBeChecked();
  await manualFeedbackCard.locator("textarea").fill(manualFeedbackNote);
  await expect(manualFeedbackSubmitButton).toBeEnabled();

  const manualFeedbackResponse = await request.post(
    `${apiBaseUrl}/api/v1/feedback-governance/manual-feedback-handoffs`,
    {
      data: {
        input: {
          manuscriptId,
          module: "editing",
          snapshotId: editingSnapshotId,
          sourceAssetId: editedAsset.id,
          feedbackCategory: "incorrect_hit",
          feedbackText: manualFeedbackNote,
        },
      },
    },
  );
  expect(manualFeedbackResponse.ok()).toBeTruthy();
  const manualFeedbackResult = (await manualFeedbackResponse.json()) as {
    learningCandidate: {
      id: string;
      type: string;
      status: string;
      proposal_text?: string;
      governed_provenance_kind?: string;
    };
  };
  const learningCandidateId = manualFeedbackResult.learningCandidate.id;
  expect(learningCandidateId).toBeTruthy();
  expect(manualFeedbackResult.learningCandidate.type).toBe("rule_candidate");
  expect(manualFeedbackResult.learningCandidate.status).toBe("pending_review");
  expect(manualFeedbackResult.learningCandidate.proposal_text).toBe(manualFeedbackNote);
  expect(manualFeedbackResult.learningCandidate.governed_provenance_kind).toBe(
    "human_feedback",
  );

  await page.goto(
    `/#template-governance?manuscriptId=${manuscriptId}&templateGovernanceView=rule-ledger&ruleCenterMode=learning&learningCandidateId=${learningCandidateId}`,
    {
      waitUntil: "domcontentloaded",
    },
  );
  await expect(page.locator("body")).toContainText(manuscriptId);
  await expect(page.locator("body")).toContainText(manualFeedbackNote);
  await expect(page.locator("body")).toContainText(learningCandidateId ?? "");
});

function appendHashQueryParam(href: string, key: string, value: string): string {
  const [hashPath, queryString = ""] = href.split("?", 2);
  const params = new URLSearchParams(queryString);
  params.set(key, value);
  return `${hashPath}?${params.toString()}`;
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
