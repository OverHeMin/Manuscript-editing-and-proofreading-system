import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildProofreadingClosurePreflightReport,
  renderProofreadingClosurePreflightMarkdown,
} from "./proofreading-closure-preflight.mjs";

test("proofreading closure preflight identifies when only a real gold-set-scored rerun remains", async () => {
  const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "proofreading-preflight-"));
  await seedRequiredReports(evidenceRoot);
  await mkdir(path.join(evidenceRoot, "multi-manuscript"), { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "multi-manuscript", "multi-manuscript-acceptance.json"),
    JSON.stringify({
      status: "failed",
      manuscriptCount: 2,
      qualityEvidenceSummary: {
        issueQualitySummaryCount: 2,
        residualFreePlaySummaryCount: 2,
        contextConsistencyLayerCount: 2,
        releaseQualityGateReportCount: 2,
        harnessQualityReportCount: 0,
        humanFinalReconciliationCount: 2,
      },
      acceptanceGoldSetStatus: {
        currentRunnerSeedsAcceptanceGoldSet: true,
        hardGateEnabled: true,
        requiredLayerCoverageBlocksRelease: true,
        rerunRequiredForGoldSetScoredRealEvidence: true,
      },
    }),
    "utf8",
  );

  const report = await buildProofreadingClosurePreflightReport({ evidenceRoot });

  assert.equal(report.status, "ready_for_real_rerun");
  assert.deepEqual(report.blockers, []);
  assert.match(
    renderProofreadingClosurePreflightMarkdown(report),
    /Run pnpm\.cmd run verify:real-proofreading/,
  );
});

test("proofreading closure preflight accepts fully scored real acceptance evidence", async () => {
  const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "proofreading-preflight-"));
  await seedRequiredReports(evidenceRoot);
  await mkdir(path.join(evidenceRoot, "multi-manuscript"), { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "multi-manuscript", "multi-manuscript-acceptance.json"),
    JSON.stringify({
      status: "passed",
      manuscriptCount: 2,
      qualityEvidenceSummary: {
        issueQualitySummaryCount: 2,
        residualFreePlaySummaryCount: 2,
        contextConsistencyLayerCount: 2,
        releaseQualityGateReportCount: 2,
        harnessQualityReportCount: 2,
        wouldBlockFinalizeCount: 0,
        humanFinalReconciliationCount: 2,
      },
      acceptanceGoldSetStatus: {},
    }),
    "utf8",
  );

  const report = await buildProofreadingClosurePreflightReport({ evidenceRoot });

  assert.equal(report.status, "accepted");
  assert.deepEqual(report.blockers, []);
  assert.match(
    renderProofreadingClosurePreflightMarkdown(report),
    /No further proof run is required/,
  );
});

async function seedRequiredReports(evidenceRoot) {
  const reports = [
    "slice1/REAL_MODEL_PROOFREADING_ACCEPTANCE.md",
    "slice2/HARNESS_CONTENT_GATE_REPORT.md",
    "slice3/FINAL_ARTIFACT_RECONCILIATION_REPORT.md",
    "slice4/GOLD_SET_UX_REPORT.md",
    "slice5/MULTI_USER_AUTHORING_ACCEPTANCE.md",
    "slice6/COMPLEX_TABLE_ACCEPTANCE_REPORT.md",
    "slice7/DOC_NORMALIZATION_AUDIT_REPORT.md",
    "slice9/RESIDUAL_KNOWLEDGE_BACKFLOW_REPORT.md",
  ];
  await Promise.all(
    reports.map(async (relativePath) => {
      const filePath = path.join(evidenceRoot, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "ok", "utf8");
    }),
  );
}
