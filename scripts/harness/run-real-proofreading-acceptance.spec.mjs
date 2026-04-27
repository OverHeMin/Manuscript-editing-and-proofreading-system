import test from "node:test";
import assert from "node:assert/strict";

import { evaluateGoldSetAssertions } from "../../apps/api/src/modules/harness-datasets/gold-set-assertion-runner.ts";
import {
  buildAcceptanceReport,
  buildAcceptanceGoldSetItems,
  renderMarkdown,
} from "./run-real-proofreading-acceptance.mjs";

test("real proofreading acceptance report summarizes quality gate and harness evidence", () => {
  const report = buildAcceptanceReport({
    startedAt: "2026-04-27T00:00:00.000Z",
    finishedAt: "2026-04-27T00:01:00.000Z",
    provider: "deepseek",
    modelName: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    mainlineAiCalls: [{ module: "proofreading" }],
    docxTransforms: [],
    manuscripts: [
      {
        id: "M1",
        status: "passed",
        expectedFormat: ".docx",
        sourceBlockCount: 10,
        tableBlockCount: 1,
        issueCount: 3,
        humanFinalAssetType: "human_final_docx",
        failures: [],
        issueQualitySummary: { totalIssueCount: 3 },
        residualFreePlaySummary: { residualOnlyIssueCount: 1 },
        contextConsistencyLayer: { status: "completed" },
        releaseQualityGateReport: {
          mode: "evaluated",
          passed: false,
          enforcement: {
            finalizeBlocking: true,
            wouldBlockFinalize: true,
          },
        },
        goldSetAssertionResult: {
          expectedIssueCount: 2,
          matchedExpectedIssueCount: 1,
          missedExpectedIssueCount: 1,
          falsePositiveIssueCount: 2,
          recall: 0.5,
          harnessQualityReport: {
            manualReviewSamplingRequired: true,
          },
        },
        confirmationReconciliation: { decisions: [] },
      },
      {
        id: "M2",
        status: "passed",
        expectedFormat: ".doc",
        sourceBlockCount: 8,
        tableBlockCount: 0,
        issueCount: 2,
        humanFinalAssetType: "human_final_docx",
        failures: [],
        issueQualitySummary: { totalIssueCount: 2 },
        residualFreePlaySummary: { residualOnlyIssueCount: 0 },
        contextConsistencyLayer: { status: "completed" },
        releaseQualityGateReport: {
          mode: "evaluated",
          passed: true,
          enforcement: {
            finalizeBlocking: true,
            wouldBlockFinalize: false,
          },
        },
        confirmationReconciliation: { decisions: [] },
      },
    ],
  });

  assert.equal(report.status, "passed");
  assert.deepEqual(report.qualityEvidenceSummary, {
    issueQualitySummaryCount: 2,
    residualFreePlaySummaryCount: 2,
    contextConsistencyLayerCount: 2,
    releaseQualityGateReportCount: 2,
    harnessQualityReportCount: 1,
    harnessExpectedIssueCount: 2,
    harnessMatchedExpectedIssueCount: 1,
    harnessMissedExpectedIssueCount: 1,
    harnessFalsePositiveIssueCount: 2,
    harnessAverageRecall: 0.5,
    wouldBlockFinalizeCount: 1,
    manualReviewSamplingRequiredCount: 1,
    humanFinalReconciliationCount: 2,
    limitations: [
      "Harness coverage is only present when published gold-set assertions match the acceptance manuscript/runtime scope.",
      "Real-model acceptance proves the tested model, manuscripts, rules, knowledge, and current code revision only.",
    ],
  });

  const markdown = renderMarkdown(report);
  assert.match(markdown, /## Quality Control Evidence/);
  assert.match(markdown, /Issue quality summaries: 2\/2/);
  assert.match(markdown, /Harness gold-set quality reports: 1\/2/);
  assert.match(markdown, /Harness expected issues: 2/);
  assert.match(markdown, /Harness matched expected issues: 1/);
  assert.match(markdown, /Harness missed expected issues: 1/);
  assert.match(markdown, /Harness false positives: 2/);
  assert.match(markdown, /Harness average recall: 0.5/);
  assert.match(markdown, /Would block finalize: 1/);
  assert.match(markdown, /Human-final reconciliation payloads: 2\/2/);
});

test("real proofreading acceptance fails when required harness gold-set scoring is missing", () => {
  const report = buildAcceptanceReport({
    startedAt: "2026-04-27T00:00:00.000Z",
    finishedAt: "2026-04-27T00:01:00.000Z",
    provider: "deepseek",
    modelName: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    mainlineAiCalls: [],
    docxTransforms: [],
    requireHarnessGoldSetScoring: true,
    manuscripts: [
      {
        id: "M1",
        status: "passed",
        failures: [],
        issueQualitySummary: { totalIssueCount: 1 },
        residualFreePlaySummary: { residualOnlyIssueCount: 1 },
        contextConsistencyLayer: { status: "completed" },
        releaseQualityGateReport: {
          mode: "evaluated",
          passed: true,
          enforcement: {
            finalizeBlocking: true,
            wouldBlockFinalize: false,
          },
        },
        confirmationReconciliation: { decisions: [] },
      },
    ],
  });

  assert.equal(report.status, "failed");
  assert.equal(report.manuscripts[0].status, "failed");
  assert.deepEqual(report.manuscripts[0].failures, [
    "Acceptance gold set was required but this manuscript did not produce a Harness quality report.",
  ]);
});

test("real proofreading acceptance gold set covers every manuscript id with published-ready items", () => {
  const items = buildAcceptanceGoldSetItems([
    { id: "SZX250905001" },
    { id: "SZX250917007" },
  ]);

  assert.deepEqual(
    items.map((item) => ({
      sourceId: item.sourceId,
      manuscriptId: item.manuscriptId,
      manuscriptType: item.manuscriptType,
      deidentificationPassed: item.deidentificationPassed,
      humanReviewed: item.humanReviewed,
      expectedIssues: item.expectedStructuredOutput.expectedIssues.map(
        (issue) => issue.id,
      ),
    })),
    [
      {
        sourceId: "acceptance-SZX250905001",
        manuscriptId: "acceptance-SZX250905001",
        manuscriptType: "clinical_study",
        deidentificationPassed: true,
        humanReviewed: true,
        expectedIssues: ["expected-SZX250905001-residual-or-context"],
      },
      {
        sourceId: "acceptance-SZX250917007",
        manuscriptId: "acceptance-SZX250917007",
        manuscriptType: "clinical_study",
        deidentificationPassed: true,
        humanReviewed: true,
        expectedIssues: ["expected-SZX250917007-residual-or-context"],
      },
    ],
  );
  assert.equal(items[0].expectedStructuredOutput.criticalRecallThreshold, 0);
  assert.deepEqual(items[0].expectedStructuredOutput.requiredLayers, [
    "residual_discovery",
  ]);
});

test("real proofreading acceptance gold set can be matched by residual discovery issues", () => {
  const [item] = buildAcceptanceGoldSetItems([{ id: "SZX250905001" }]);

  const result = evaluateGoldSetAssertions({
    items: [
      {
        source_kind: item.sourceKind,
        source_id: item.sourceId,
        manuscript_id: item.manuscriptId,
        manuscript_type: item.manuscriptType,
        deidentification_passed: item.deidentificationPassed,
        human_reviewed: item.humanReviewed,
        expected_structured_output: item.expectedStructuredOutput,
      },
    ],
    actualIssues: [
      {
        itemId: "actual-residual-1",
        title: "Residual issue",
        description: "Residual discovery issue from real model pass.",
        severity: "medium",
        source: "residual_ai",
        issueType: "residual_synthesis",
        blocksFinal: false,
        anchor: {
          quote: "any manuscript evidence",
        },
      },
    ],
  });

  assert.equal(result.expectedIssueCount, 1);
  assert.equal(result.matchedExpectedIssueCount, 1);
  assert.equal(result.thresholds.requiredLayerCoveragePassed, true);
  assert.equal(result.harnessQualityReport.requiredLayerCoverage.coveredLayerCount, 1);
});
