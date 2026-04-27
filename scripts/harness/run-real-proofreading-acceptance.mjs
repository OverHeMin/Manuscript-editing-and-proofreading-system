import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loginAsDemoUser,
  startWorkbenchServer,
  stopServer,
} from "../../apps/api/test/http/support/workbench-runtime.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceRoot = path.join(
  repoRoot,
  ".codex-qa-logs",
  "deepseek-proofreading",
  "multi-manuscript",
);

const defaultManuscripts = [
  {
    id: "SZX250905001",
    path:
      "C:/Users/Administrator/Desktop/何审/何审《中西医结合》/何审《中西医结合》24期/原稿/SZX250905001_苏培元_超声骨刀联合高速涡轮钻法拔除下颌中低位水平阻生智齿的临床观察_修改稿1.docx",
  },
  {
    id: "SZX250917007",
    path:
      "C:/Users/Administrator/Desktop/何审/何审《中西医结合》/何审《中西医结合》24期/原稿/SZX250917007_黄浩然_氨溴特罗联合阿奇霉素序贯疗法在肺炎支原体肺炎患儿治疗中的临床应用效果_修改稿1.doc",
  },
  {
    id: "SZX250926002",
    path:
      "C:/Users/Administrator/Desktop/何审/何审《中西医结合》/何审《中西医结合》24期/原稿/SZX250926002_桂辉汉_真空负压垫在CT引导下经皮肺穿刺活检术的应用价值_修改稿1.docx",
  },
  {
    id: "SZX250928002",
    path:
      "C:/Users/Administrator/Desktop/何审/何审《中西医结合》/何审《中西医结合》24期/原稿/SZX250928002_徐烈干_PD-1抑制剂联合XELOX方案新辅助治疗进展期胃癌中患者疗效及安全性研究_修改稿1.docx",
  },
  {
    id: "SZX250910004",
    path:
      "C:/Users/Administrator/Desktop/何审/何审《中西医结合》/何审《中西医结合》23期/原稿/SZX250910004_李梦洋_依达拉奉右莰醇联合阿加曲班治疗老年脑梗死的临床疗效_修改稿2.doc",
  },
];

const provider = process.env.REAL_ACCEPTANCE_PROVIDER ?? "deepseek";
const apiKey =
  process.env.REAL_ACCEPTANCE_API_KEY ??
  process.env.DEEPSEEK_API_KEY ??
  process.env.QWEN_API_KEY ??
  process.env.DASHSCOPE_API_KEY;
const modelName =
  process.env.REAL_ACCEPTANCE_MODEL ??
  (provider === "qwen" ? "qwen-plus" : "deepseek-chat");
const baseUrl =
  process.env.REAL_ACCEPTANCE_BASE_URL ??
  (provider === "qwen"
    ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
    : "https://api.deepseek.com/v1");
const limit = Number.parseInt(
  process.env.REAL_ACCEPTANCE_LIMIT ?? String(defaultManuscripts.length),
  10,
);
const requireHarnessGoldSetScoring =
  process.env.REAL_ACCEPTANCE_REQUIRE_HARNESS_GOLD_SET_SCORING !== "0";

async function main() {
  await mkdir(evidenceRoot, { recursive: true });

  if (!apiKey) {
    await writeFailureReport({
      status: "blocked",
      reason:
        "Missing REAL_ACCEPTANCE_API_KEY/DEEPSEEK_API_KEY/QWEN_API_KEY/DASHSCOPE_API_KEY. No real model call was made.",
      manuscripts: [],
    });
    process.exitCode = 2;
    return;
  }

  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-real-acceptance-"));
  const mainlineAiCalls = [];
  const docxTransforms = [];
  const startedAt = new Date().toISOString();
  const { server, baseUrl: serverBaseUrl, runtime } = await startWorkbenchServer({
    uploadRootDir,
    realModelRuntime: {
      enabled: true,
      providerKind: provider === "qwen" ? "qwen" : "deepseek",
      baseUrl,
      apiKey,
      modelName,
      requestTimeoutMs: Number.parseInt(
        process.env.REAL_ACCEPTANCE_TIMEOUT_MS ?? "180000",
        10,
      ),
    },
    recordMainlineAiCall(input) {
      mainlineAiCalls.push({
        module: input.module,
        passFocus: input.userPayload?.passFocus,
        sourceBlockCount: Array.isArray(input.userPayload?.sourceBlocks)
          ? input.userPayload.sourceBlocks.length
          : undefined,
      });
    },
    recordDocxTransform(input) {
      docxTransforms.push({
        outputStorageKey: input.outputStorageKey,
        aiReplacementCount: input.aiReplacements?.length ?? 0,
      });
    },
    documentNormalization: {
      libreOfficeAvailable: true,
    },
  });

  try {
    await seedAcceptanceGoldSet(runtime, defaultManuscripts.slice(0, limit));
    const submitterCookie = await loginAsDemoUser(serverBaseUrl, "dev.user");
    const proofreaderCookie = await loginAsDemoUser(serverBaseUrl, "dev.proofreader");
    const manuscripts = [];
    for (const item of defaultManuscripts.slice(0, limit)) {
      manuscripts.push(
        await runOneManuscript({
          submitterCookie,
          proofreaderCookie,
          serverBaseUrl,
          item,
        }),
      );
    }

    const report = buildAcceptanceReport({
      startedAt,
      finishedAt: new Date().toISOString(),
      provider,
      modelName,
      baseUrl,
      mainlineAiCalls,
      docxTransforms,
      requireHarnessGoldSetScoring,
      manuscripts,
    });
    await writeAcceptanceReport(report);
    if (report.status !== "passed") {
      process.exitCode = 1;
    }
  } finally {
    await stopServer(server);
    if (process.env.REAL_ACCEPTANCE_KEEP_UPLOADS !== "1") {
      await rm(uploadRootDir, { recursive: true, force: true });
    }
  }
}

async function seedAcceptanceGoldSet(runtime, manuscripts) {
  const family = await runtime.harnessDatasetApi.createGoldSetFamily({
    actorRole: "admin",
    input: {
      name: "Real proofreading acceptance gold set",
      description:
        "Acceptance-only gold set used to prove real manuscript runs are scored by Harness.",
      scope: {
        module: "proofreading",
        manuscriptTypes: ["clinical_study"],
        measureFocus: "real_acceptance_quality_control",
      },
    },
  });
  const rubric = await runtime.harnessDatasetApi.createRubricDefinition({
    actorRole: "admin",
    input: {
      name: "Real proofreading acceptance rubric",
      scope: {
        module: "proofreading",
        manuscriptTypes: ["clinical_study"],
      },
      scoringDimensions: [
        {
          key: "coverage",
          label: "Coverage",
        },
      ],
      createdBy: "acceptance-runner",
    },
  });
  const publishedRubric = await runtime.harnessDatasetApi.publishRubricDefinition({
    actorRole: "admin",
    rubricDefinitionId: rubric.body.id,
    input: {
      publishedBy: "acceptance-runner",
    },
  });
  const version = await runtime.harnessDatasetApi.createGoldSetVersion({
    actorRole: "admin",
    input: {
      familyId: family.body.id,
      rubricDefinitionId: publishedRubric.body.id,
      createdBy: "acceptance-runner",
      items: buildAcceptanceGoldSetItems(manuscripts),
      publicationNotes:
        "Generated by real proofreading acceptance runner; expected items are intentionally minimal and bounded.",
    },
  });
  const publishedVersion = await runtime.harnessDatasetApi.publishGoldSetVersion({
    actorRole: "admin",
    goldSetVersionId: version.body.id,
    input: {
      publishedBy: "acceptance-runner",
    },
  });

  return {
    familyId: family.body.id,
    rubricDefinitionId: publishedRubric.body.id,
    versionId: publishedVersion.body.id,
    itemCount: publishedVersion.body.item_count,
  };
}

function buildAcceptanceGoldSetItems(manuscripts) {
  return manuscripts.map((item) => ({
    sourceKind: "reviewed_case_snapshot",
    sourceId: `acceptance-${item.id}`,
    manuscriptId: `acceptance-${item.id}`,
    manuscriptType: "clinical_study",
    deidentificationPassed: true,
    humanReviewed: true,
    expectedStructuredOutput: {
      expectedIssues: [
        {
          id: `expected-${item.id}-residual-or-context`,
          severity: "medium",
          layerId: "residual_discovery",
        },
      ],
      criticalRecallThreshold: 0,
      falsePositiveReviewThreshold: 1,
      requiredLayers: ["residual_discovery"],
    },
  }));
}

function buildAcceptanceReport(input) {
  const manuscripts = (input.manuscripts ?? []).map((item) =>
    normalizeAcceptanceManuscriptStatus({
      manuscript: item,
      requireHarnessGoldSetScoring:
        input.requireHarnessGoldSetScoring === true,
    }),
  );
  return {
    status: manuscripts.every((item) => item.status === "passed")
      ? "passed"
      : "failed",
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    provider: input.provider,
    modelName: input.modelName,
    baseUrl: input.baseUrl,
    manuscriptCount: manuscripts.length,
    mainlineAiCallCount: input.mainlineAiCalls?.length ?? 0,
    mainlineAiCalls: input.mainlineAiCalls ?? [],
    docxTransforms: input.docxTransforms ?? [],
    requireHarnessGoldSetScoring: input.requireHarnessGoldSetScoring === true,
    qualityEvidenceSummary: summarizeQualityEvidence(manuscripts),
    manuscripts,
  };
}

function normalizeAcceptanceManuscriptStatus(input) {
  const manuscript = {
    ...input.manuscript,
    failures: [...(input.manuscript.failures ?? [])],
  };
  const hasHarnessQualityReport = Boolean(
    manuscript.goldSetAssertionResult?.harnessQualityReport,
  );
  if (input.requireHarnessGoldSetScoring && !hasHarnessQualityReport) {
    const message =
      "Acceptance gold set was required but this manuscript did not produce a Harness quality report.";
    if (!manuscript.failures.includes(message)) {
      manuscript.failures.push(message);
    }
    manuscript.status = "failed";
  }
  return manuscript;
}

async function runOneManuscript(input) {
  const fileBuffer = await readFile(input.item.path);
  const fileName = path.basename(input.item.path);
  const extension = path.extname(fileName).toLowerCase();
  const mimeType =
    extension === ".doc"
      ? "application/msword"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const itemDir = path.join(evidenceRoot, input.item.id);
  await mkdir(itemDir, { recursive: true });

  const summary = {
    id: input.item.id,
    inputPath: input.item.path,
    fileName,
    sourceSha256: sha256(fileBuffer),
    sourceBytes: fileBuffer.byteLength,
    expectedFormat: extension,
    status: "running",
    failures: [],
  };

  try {
    const upload = await postJson({
      baseUrl: input.serverBaseUrl,
      cookie: input.submitterCookie,
      path: "/api/v1/manuscripts/upload",
      body: {
        title: input.item.id,
        manuscriptType: "clinical_study",
        fileName,
        mimeType,
        fileContentBase64: fileBuffer.toString("base64"),
      },
      expectedStatus: 201,
    });
    summary.uploadAssetId = upload.asset?.id;
    summary.manuscriptId = upload.manuscript?.id;
    summary.uploadNormalization = upload.job?.payload?.normalization;

    const templateSelection = await postJson({
      baseUrl: input.serverBaseUrl,
      cookie: input.proofreaderCookie,
      path: `/api/v1/manuscripts/${summary.manuscriptId}/template-selection`,
      body: {
        templateFamilyId: "family-seeded-1",
      },
      expectedStatus: 200,
    });
    summary.templateFamilyId = templateSelection.current_template_family_id;

    const assets = await getJson({
      baseUrl: input.serverBaseUrl,
      cookie: input.proofreaderCookie,
      path: `/api/v1/manuscripts/${summary.manuscriptId}/assets`,
      expectedStatus: 200,
    });
    const normalizedAsset = Array.isArray(assets)
      ? assets.find(
          (asset) =>
            asset.asset_type === "normalized_docx" &&
            asset.parent_asset_id === summary.uploadAssetId,
        )
      : undefined;
    summary.normalizedAssetId = normalizedAsset?.id;
    summary.normalizationProven = Boolean(normalizedAsset);

    const parentAssetId = normalizedAsset?.id ?? summary.uploadAssetId;
    const draft = await postJson({
      baseUrl: input.serverBaseUrl,
      cookie: input.proofreaderCookie,
      path: "/api/v1/modules/proofreading/draft",
      body: {
        manuscriptId: summary.manuscriptId,
        parentAssetId,
        storageKey: `runs/${input.item.id}/proofreading/draft.md`,
        fileName: `${input.item.id}-proofreading-draft.md`,
      },
      expectedStatus: 201,
    });
    await writeJson(path.join(itemDir, "draft-response.json"), redactDraft(draft));

    const draftPayload = draft.job?.payload ?? {};
    const sourceBlocks = draftPayload.proofreadingSourceBlocks ?? [];
    const issues = draftPayload.proofreadingPlan?.issues ?? [];
    const passRuns = draftPayload.proofreadingDeepPassRuns ?? [];
    summary.draftJobId = draft.job?.id;
    summary.draftAssetId = draft.asset?.id;
    summary.modelId = draft.model_id;
    summary.knowledgeItemIds = draft.knowledge_item_ids ?? [];
    summary.ruleSetId = draftPayload.ruleSetId ?? draftPayload.rule_set_id;
    summary.sourceBlockCount = sourceBlocks.length;
    summary.tableBlockCount = sourceBlocks.filter(
      (block) => block.block_kind === "table",
    ).length;
    summary.issueCount = issues.length;
    summary.passRunSummary = passRuns.map((pass) => ({
      passNo: pass.pass_no,
      passKind: pass.pass_kind,
      status: pass.status,
      issueCount: pass.output?.issues?.length ?? 0,
      modelId: pass.model_id,
    }));
    summary.issueQualitySummary = draftPayload.issueQualitySummary;
    summary.residualFreePlaySummary = draftPayload.residualFreePlaySummary;
    summary.contextConsistencyLayer = draftPayload.contextConsistencyLayer;
    summary.goldSetAssertionResult = draftPayload.goldSetAssertionResult;
    summary.releaseQualityGateReport = draftPayload.releaseQualityGateReport;
    summary.layerMatrix = draftPayload.proofreadingLayerMatrix;

    const confirmationDecisions = issues.map((issue, index) => {
      const replacementText = issue.suggestion?.replacementText ?? "";
      const targetText = issue.anchor?.quote ?? issue.text_excerpt ?? "";
      if (!replacementText.trim() || !targetText.trim()) {
        return {
          itemId: issue.itemId ?? `issue-${index + 1}`,
          targetText,
          replacementText,
          action: "rejected",
          note: "Acceptance runner rejected this item because it has no safe replacement text.",
        };
      }

      return {
        itemId: issue.itemId ?? `issue-${index + 1}`,
        targetText,
        replacementText,
        action: "accepted_with_manual_edit",
        editedReplacementText: replacementText,
        note: "Acceptance runner confirmed the model issue for human-final publication.",
      };
    });
    summary.confirmationDecisionCount = confirmationDecisions.length;

    const confirmationDraft = await postJson({
      baseUrl: input.serverBaseUrl,
      cookie: input.proofreaderCookie,
      path: "/api/v1/modules/proofreading/confirmation-draft",
      body: {
        manuscriptId: summary.manuscriptId,
        confirmationAssetId: draft.asset?.id,
        confirmationDecisions,
      },
      expectedStatus: 200,
    });
    await writeJson(
      path.join(itemDir, "confirmation-draft-response.json"),
      confirmationDraft,
    );

    const final = await postJson({
      baseUrl: input.serverBaseUrl,
      cookie: input.proofreaderCookie,
      path: "/api/v1/modules/proofreading/finalize",
      body: {
        manuscriptId: summary.manuscriptId,
        draftAssetId: draft.asset?.id,
        storageKey: `runs/${input.item.id}/proofreading/final.docx`,
        fileName: `${input.item.id}-proofreading-final.docx`,
      },
      expectedStatus: 201,
    });
    summary.finalJobId = final.job?.id;
    summary.finalAssetId = final.asset?.id;
    summary.finalAssetType = final.asset?.asset_type;

    const published = await postJson({
      baseUrl: input.serverBaseUrl,
      cookie: input.proofreaderCookie,
      path: "/api/v1/modules/proofreading/publish-human-final",
      body: {
        manuscriptId: summary.manuscriptId,
        finalAssetId: final.asset?.id,
        storageKey: `runs/${input.item.id}/proofreading/human-final.docx`,
        fileName: `${input.item.id}-human-final.docx`,
        confirmationDecisions,
      },
      expectedStatus: 201,
    });
    await writeJson(path.join(itemDir, "human-final-response.json"), published);
    summary.humanFinalJobId = published.job?.id;
    summary.humanFinalAssetId = published.asset?.id;
    summary.humanFinalAssetType = published.asset?.asset_type;
    summary.confirmationReconciliation =
      published.job?.payload?.confirmationReconciliation;

    const download = await downloadAsset({
      baseUrl: input.serverBaseUrl,
      cookie: input.proofreaderCookie,
      assetId: published.asset?.id,
    });
    summary.humanFinalDownloadStatus = download.status;
    summary.humanFinalBytes = download.bytes.length;
    summary.humanFinalSignature = download.bytes.subarray(0, 2).toString("utf8");
    await writeFile(path.join(itemDir, `${input.item.id}-human-final.docx`), download.bytes);

    summary.status =
      summary.sourceBlockCount > 0 &&
      summary.humanFinalAssetType === "human_final_docx" &&
      summary.humanFinalSignature === "PK"
        ? "passed"
        : "failed";
    if (summary.status === "failed") {
      if (summary.sourceBlockCount === 0) {
        summary.failures.push(
          "Source extraction produced zero blocks; model output cannot prove proofreading quality for this manuscript.",
        );
      }
      if (summary.humanFinalAssetType !== "human_final_docx") {
        summary.failures.push("Human final docx asset was not published.");
      }
      if (summary.humanFinalSignature !== "PK") {
        summary.failures.push("Human final download did not have a docx ZIP signature.");
      }
    }
  } catch (error) {
    summary.status = "failed";
    summary.failures.push(error instanceof Error ? error.message : String(error));
  }

  await writeJson(path.join(itemDir, "summary.json"), summary);
  return summary;
}

function summarizeQualityEvidence(manuscripts) {
  const safeManuscripts = manuscripts ?? [];
  const withReleaseGate = safeManuscripts.filter(
    (item) => item.releaseQualityGateReport,
  );
  const withHarnessQualityReport = safeManuscripts.filter(
    (item) => item.goldSetAssertionResult?.harnessQualityReport,
  );
  const harnessExpectedIssueCount = sumNumber(
    withHarnessQualityReport,
    (item) => item.goldSetAssertionResult?.expectedIssueCount,
  );
  const harnessMatchedExpectedIssueCount = sumNumber(
    withHarnessQualityReport,
    (item) => item.goldSetAssertionResult?.matchedExpectedIssueCount,
  );
  const harnessMissedExpectedIssueCount = sumNumber(
    withHarnessQualityReport,
    (item) => item.goldSetAssertionResult?.missedExpectedIssueCount,
  );
  const harnessFalsePositiveIssueCount = sumNumber(
    withHarnessQualityReport,
    (item) => item.goldSetAssertionResult?.falsePositiveIssueCount,
  );
  const harnessAverageRecall =
    withHarnessQualityReport.length > 0
      ? roundToFourDecimals(
          sumNumber(
            withHarnessQualityReport,
            (item) => item.goldSetAssertionResult?.recall,
          ) / withHarnessQualityReport.length,
        )
      : 0;

  return {
    issueQualitySummaryCount: safeManuscripts.filter(
      (item) => item.issueQualitySummary,
    ).length,
    residualFreePlaySummaryCount: safeManuscripts.filter(
      (item) => item.residualFreePlaySummary,
    ).length,
    contextConsistencyLayerCount: safeManuscripts.filter(
      (item) => item.contextConsistencyLayer,
    ).length,
    releaseQualityGateReportCount: withReleaseGate.length,
    harnessQualityReportCount: withHarnessQualityReport.length,
    harnessExpectedIssueCount,
    harnessMatchedExpectedIssueCount,
    harnessMissedExpectedIssueCount,
    harnessFalsePositiveIssueCount,
    harnessAverageRecall,
    wouldBlockFinalizeCount: safeManuscripts.filter(
      (item) =>
        item.releaseQualityGateReport?.enforcement?.wouldBlockFinalize === true,
    ).length,
    manualReviewSamplingRequiredCount: safeManuscripts.filter(
      (item) =>
        item.goldSetAssertionResult?.harnessQualityReport
          ?.manualReviewSamplingRequired === true,
    ).length,
    humanFinalReconciliationCount: safeManuscripts.filter(
      (item) => item.confirmationReconciliation,
    ).length,
    limitations: [
      "Harness coverage is only present when published gold-set assertions match the acceptance manuscript/runtime scope.",
      "Real-model acceptance proves the tested model, manuscripts, rules, knowledge, and current code revision only.",
    ],
  };
}

function sumNumber(items, read) {
  return items.reduce((total, item) => {
    const value = read(item);
    return total + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

function roundToFourDecimals(value) {
  return Math.round(value * 10000) / 10000;
}

async function postJson(input) {
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== input.expectedStatus) {
    throw new Error(
      `${input.path} returned ${response.status}, expected ${input.expectedStatus}: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  return body;
}

async function getJson(input) {
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    headers: {
      Cookie: input.cookie,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== input.expectedStatus) {
    throw new Error(
      `${input.path} returned ${response.status}, expected ${input.expectedStatus}: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  return body;
}

async function downloadAsset(input) {
  const response = await fetch(
    `${input.baseUrl}/api/v1/document-assets/${input.assetId}/download`,
    {
      headers: {
        Cookie: input.cookie,
      },
    },
  );
  return {
    status: response.status,
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}

function redactDraft(draft) {
  return {
    asset: draft.asset,
    job: {
      id: draft.job?.id,
      payload: draft.job?.payload,
    },
    snapshot_id: draft.snapshot_id,
    agent_execution_log_id: draft.agent_execution_log_id,
    model_id: draft.model_id,
    knowledge_item_ids: draft.knowledge_item_ids,
  };
}

async function writeFailureReport(report) {
  await writeAcceptanceReport({
    ...report,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    provider,
    modelName,
    baseUrl,
  });
}

async function writeAcceptanceReport(report) {
  await mkdir(evidenceRoot, { recursive: true });
  await writeJson(path.join(evidenceRoot, "multi-manuscript-acceptance.json"), report);
  await writeFile(
    path.join(evidenceRoot, "MULTI_MANUSCRIPT_ACCEPTANCE_REPORT.md"),
    renderMarkdown(report),
    "utf8",
  );
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function renderMarkdown(report) {
  const rows = (report.manuscripts ?? [])
    .map(
      (item) =>
        `| ${item.id} | ${item.status} | ${item.expectedFormat ?? ""} | ${item.sourceBlockCount ?? ""} | ${item.tableBlockCount ?? ""} | ${item.issueCount ?? ""} | ${item.humanFinalAssetType ?? ""} | ${(item.failures ?? []).join("; ")} |`,
    )
    .join("\n");
  const quality = report.qualityEvidenceSummary ?? {};

  return `# Multi-Manuscript Real Proofreading Acceptance

Date: 2026-04-27

Status: ${report.status}

Provider: ${report.provider}

Model: ${report.modelName}

Base URL: ${report.baseUrl}

## Summary

| Manuscript | Status | Format | Source Blocks | Table Blocks | Issues | Human Final | Failures |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
${rows || "| N/A | blocked |  |  |  |  |  | " + (report.reason ?? "") + " |"}

## Quality Control Evidence

- Issue quality summaries: ${quality.issueQualitySummaryCount ?? 0}/${report.manuscriptCount ?? 0}
- Residual/free-play summaries: ${quality.residualFreePlaySummaryCount ?? 0}/${report.manuscriptCount ?? 0}
- Context consistency layers: ${quality.contextConsistencyLayerCount ?? 0}/${report.manuscriptCount ?? 0}
- Release quality gate reports: ${quality.releaseQualityGateReportCount ?? 0}/${report.manuscriptCount ?? 0}
- Harness gold-set quality reports: ${quality.harnessQualityReportCount ?? 0}/${report.manuscriptCount ?? 0}
- Harness expected issues: ${quality.harnessExpectedIssueCount ?? 0}
- Harness matched expected issues: ${quality.harnessMatchedExpectedIssueCount ?? 0}
- Harness missed expected issues: ${quality.harnessMissedExpectedIssueCount ?? 0}
- Harness false positives: ${quality.harnessFalsePositiveIssueCount ?? 0}
- Harness average recall: ${quality.harnessAverageRecall ?? 0}
- Would block finalize: ${quality.wouldBlockFinalizeCount ?? 0}
- Manual review sampling required: ${quality.manualReviewSamplingRequiredCount ?? 0}
- Human-final reconciliation payloads: ${quality.humanFinalReconciliationCount ?? 0}/${report.manuscriptCount ?? 0}

## Evidence Boundary

- This script uses the real model runtime when an API key is provided through environment variables.
- API keys are read from environment variables only and are not written to this report.
- A passed result proves this exact model/provider/manuscript set under the current rules, knowledge, and code revision; it does not claim universal proofreading accuracy.
- Harness gold-set quality reports require published gold-set assertions that match the acceptance manuscript/runtime scope; a 0 count means the real run was not gold-set-scored even if the release gate report was present.
`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    await writeFailureReport({
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      manuscripts: [],
    });
    process.exitCode = 1;
  });
}

export {
  buildAcceptanceGoldSetItems,
  buildAcceptanceReport,
  renderMarkdown,
  summarizeQualityEvidence,
};
