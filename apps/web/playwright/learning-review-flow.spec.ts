import { expect, test } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const abstractObjectiveSource = "\u6458\u8981 \u76ee\u7684";
const abstractObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const screeningHeading = "\u521d\u7b5b\u5de5\u4f5c\u53f0";
const editingHeading = "\u7f16\u8f91\u5de5\u4f5c\u53f0";
const proofreadingHeading = "\u6821\u5bf9\u5de5\u4f5c\u53f0";
const ruleCenterHeading = "\u89c4\u5219\u4e2d\u5fc3";
const runScreeningLabel = "\u6267\u884c\u521d\u7b5b";
const runEditingLabel = "\u6267\u884c\u7f16\u8f91";
const createDraftLabel = "\u751f\u6210\u8349\u7a3f";
const finalizeProofLabel = "\u6821\u5bf9\u5b9a\u7a3f";
const publishHumanFinalLabel = "\u53d1\u5e03\u4eba\u5de5\u7ec8\u7a3f";
const prefilledDraftNotePrefix =
  "\u5df2\u4ece\u5b66\u4e60\u5019\u9009\u9884\u586b\u89c4\u5219\u8349\u7a3f\uff1a";

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
  const evidenceSummary = `Phase 8AA reviewed snapshot normalization ${manuscriptId}`;

  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveTitle(/Medical Manuscript System - Web/i);
  await expect(page.getByRole("heading", { name: screeningHeading })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`Auto-loaded manuscript ${manuscriptId}`);

  await page.getByRole("button", { name: runScreeningLabel }).click();
  await expect(page.locator("body")).toContainText("Action Complete");
  const editingLink = page.locator(`a[href*="#editing?manuscriptId=${manuscriptId}"]`).first();
  await expect(editingLink).toBeVisible();

  await editingLink.click();
  await expect(page.getByRole("heading", { name: editingHeading })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: runEditingLabel }).click();
  const proofreadingLink = page
    .locator(`a[href*="#proofreading?manuscriptId=${manuscriptId}"]`)
    .first();
  await expect(proofreadingLink).toBeVisible();

  await proofreadingLink.click();
  await expect(page.getByRole("heading", { name: proofreadingHeading })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: createDraftLabel }).click();
  await expect(page.locator("body")).toContainText("proofreading_draft_report");

  await page.getByRole("button", { name: finalizeProofLabel }).click();
  await expect(page.locator("body")).toContainText("Finalized asset");

  await page.getByRole("button", { name: publishHumanFinalLabel }).click();
  await expect(page.locator("body")).toContainText("Published human-final asset");
  const learningReviewLink = page
    .locator(`a[href*="#learning-review?manuscriptId=${manuscriptId}"]`)
    .first();
  await expect(learningReviewLink).toBeVisible();

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

  await learningReviewLink.click();
  await expect(page.getByRole("heading", { name: ruleCenterHeading })).toBeVisible();
  await expect(page.locator("body")).toContainText(
    `This rule-learning desk was opened from manuscript handoff ${manuscriptId}.`,
  );
  await expect(page.locator("body")).toContainText(manuscriptId);
  await expect(page.locator("body")).toContainText("Rule Candidate Review");

  await page
    .getByRole("button", { name: new RegExp(escapeRegExp(candidateListLabel)) })
    .click();
  await expect(page.locator("body")).toContainText(evidenceSummary);
  await expect(page.locator("body")).toContainText(abstractObjectiveSource);
  await expect(page.locator("body")).toContainText(abstractObjectiveNormalized);
  await expect(page.locator("body")).toContainText("family-seeded-1");

  await expect(page.getByRole("button", { name: "Approve Candidate" })).toBeEnabled();
  await page.getByRole("button", { name: "Approve Candidate" }).click();
  await expect(page.locator("body")).toContainText(
    `Learning candidate approved: ${extractedCandidate.id}`,
  );
  await expect(page.getByRole("button", { name: "Convert To Rule Draft" })).toBeEnabled();

  await page.getByRole("button", { name: "Convert To Rule Draft" }).click();
  await expect(page.locator("body")).toContainText(
    `Rule draft prefilled from learning candidate ${extractedCandidate.id}.`,
  );
  await expect(page.locator("body")).toContainText(
    `${prefilledDraftNotePrefix}${extractedCandidate.id}`,
  );
  await expect(page.locator("body")).toContainText("Seeded Clinical Study Family");
  await expect(page.locator("body")).toContainText(abstractObjectiveSource);
  await expect(page.locator("body")).toContainText(abstractObjectiveNormalized);

  await page.getByRole("button", { name: "Create Rule Set Draft" }).click();
  await expect(page.locator("body")).toContainText("Rule set draft created.");
  await expect(page.getByRole("button", { name: "Create Rule Draft" })).toBeEnabled();
  await page.getByRole("button", { name: "Create Rule Draft" }).click();
  await expect(page.locator("body")).toContainText("Rule draft created.");
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    abstractObjectiveSource,
  );
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    abstractObjectiveNormalized,
  );
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
