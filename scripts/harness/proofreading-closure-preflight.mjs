import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const evidenceRoot = ".codex-qa-logs/deepseek-proofreading";

async function main() {
  const report = await buildProofreadingClosurePreflightReport({
    evidenceRoot,
  });
  await mkdir(path.join(evidenceRoot, "closure"), { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "closure", "PROOFREADING_CLOSURE_PREFLIGHT.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(evidenceRoot, "closure", "PROOFREADING_CLOSURE_PREFLIGHT.md"),
    renderProofreadingClosurePreflightMarkdown(report),
    "utf8",
  );
  if (report.status !== "ready_for_real_rerun") {
    process.exitCode = 1;
  }
}

async function buildProofreadingClosurePreflightReport(input) {
  const multi = await readJson(
    path.join(input.evidenceRoot, "multi-manuscript", "multi-manuscript-acceptance.json"),
  );
  const requiredReports = [
    "slice1/REAL_MODEL_PROOFREADING_ACCEPTANCE.md",
    "slice2/HARNESS_CONTENT_GATE_REPORT.md",
    "slice3/FINAL_ARTIFACT_RECONCILIATION_REPORT.md",
    "slice4/GOLD_SET_UX_REPORT.md",
    "slice5/MULTI_USER_AUTHORING_ACCEPTANCE.md",
    "slice6/COMPLEX_TABLE_ACCEPTANCE_REPORT.md",
    "slice7/DOC_NORMALIZATION_AUDIT_REPORT.md",
    "slice9/RESIDUAL_KNOWLEDGE_BACKFLOW_REPORT.md",
  ];
  const reportPresence = {};
  for (const relativePath of requiredReports) {
    reportPresence[relativePath] = await fileExists(
      path.join(input.evidenceRoot, relativePath),
    );
  }
  const missingReports = Object.entries(reportPresence)
    .filter(([, exists]) => !exists)
    .map(([relativePath]) => relativePath);
  const quality = multi.qualityEvidenceSummary ?? {};
  const gold = multi.acceptanceGoldSetStatus ?? {};
  const blockers = [];
  if (missingReports.length > 0) {
    blockers.push(`missing evidence reports: ${missingReports.join(", ")}`);
  }
  if (quality.issueQualitySummaryCount !== multi.manuscriptCount) {
    blockers.push("not every manuscript has issue quality evidence");
  }
  if (quality.residualFreePlaySummaryCount !== multi.manuscriptCount) {
    blockers.push("not every manuscript has residual/free-play evidence");
  }
  if (quality.contextConsistencyLayerCount !== multi.manuscriptCount) {
    blockers.push("not every manuscript has context consistency evidence");
  }
  if (quality.releaseQualityGateReportCount !== multi.manuscriptCount) {
    blockers.push("not every manuscript has release quality gate evidence");
  }
  if (quality.humanFinalReconciliationCount !== multi.manuscriptCount) {
    blockers.push("not every manuscript has human-final reconciliation evidence");
  }

  const onlyNeedsRealRerun =
    blockers.length === 0 &&
    gold.currentRunnerSeedsAcceptanceGoldSet === true &&
    gold.hardGateEnabled === true &&
    gold.requiredLayerCoverageBlocksRelease === true &&
    gold.rerunRequiredForGoldSetScoredRealEvidence === true &&
    quality.harnessQualityReportCount === 0;
  const fullyAccepted =
    blockers.length === 0 &&
    multi.status === "passed" &&
    quality.harnessQualityReportCount === multi.manuscriptCount &&
    quality.humanFinalReconciliationCount === multi.manuscriptCount &&
    quality.wouldBlockFinalizeCount === 0;

  return {
    status: fullyAccepted
      ? "accepted"
      : onlyNeedsRealRerun
        ? "ready_for_real_rerun"
        : blockers.length > 0
          ? "blocked"
          : "needs_review",
    manuscriptCount: multi.manuscriptCount,
    historicalMultiManuscriptStatus: multi.status,
    qualityEvidenceSummary: quality,
    acceptanceGoldSetStatus: gold,
    reportPresence,
    blockers,
    nextStep: onlyNeedsRealRerun
      ? "Run pnpm.cmd run verify:real-proofreading with a real model API key to generate gold-set-scored evidence."
      : fullyAccepted
        ? "No further proof run is required for the current acceptance scope."
        : "Resolve blockers before spending real-model tokens.",
  };
}

function renderProofreadingClosurePreflightMarkdown(report) {
  return `# Proofreading Closure Preflight

Status: ${report.status}

## Current Evidence

- Manuscripts: ${report.manuscriptCount}
- Historical multi-manuscript status: ${report.historicalMultiManuscriptStatus}
- Issue quality summaries: ${report.qualityEvidenceSummary.issueQualitySummaryCount ?? 0}/${report.manuscriptCount}
- Residual/free-play summaries: ${report.qualityEvidenceSummary.residualFreePlaySummaryCount ?? 0}/${report.manuscriptCount}
- Context consistency layers: ${report.qualityEvidenceSummary.contextConsistencyLayerCount ?? 0}/${report.manuscriptCount}
- Release quality gate reports: ${report.qualityEvidenceSummary.releaseQualityGateReportCount ?? 0}/${report.manuscriptCount}
- Harness gold-set quality reports: ${report.qualityEvidenceSummary.harnessQualityReportCount ?? 0}/${report.manuscriptCount}
- Human-final reconciliation payloads: ${report.qualityEvidenceSummary.humanFinalReconciliationCount ?? 0}/${report.manuscriptCount}

## Gold Set Gate

- Current runner seeds acceptance gold set: ${report.acceptanceGoldSetStatus.currentRunnerSeedsAcceptanceGoldSet === true ? "yes" : "no"}
- Hard gate enabled: ${report.acceptanceGoldSetStatus.hardGateEnabled === true ? "yes" : "no"}
- Required layer coverage blocks release: ${report.acceptanceGoldSetStatus.requiredLayerCoverageBlocksRelease === true ? "yes" : "no"}
- Rerun required for gold-set-scored evidence: ${report.acceptanceGoldSetStatus.rerunRequiredForGoldSetScoredRealEvidence === true ? "yes" : "no"}

## Blockers

${report.blockers.length > 0 ? report.blockers.map((item) => `- ${item}`).join("\n") : "- None before real-model rerun."}

## Next Step

${report.nextStep}
`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export {
  buildProofreadingClosurePreflightReport,
  renderProofreadingClosurePreflightMarkdown,
};
