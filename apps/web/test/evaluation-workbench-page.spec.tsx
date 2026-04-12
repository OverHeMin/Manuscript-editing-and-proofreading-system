import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  describeHistoryComparisonGuidance,
  describeHistoryComparisonGuidanceSummary,
  describeHistoryComparisonRoleLabels,
  describeHistoryStatusPair,
  describeHistoryOriginSummary,
  describeHistoryEntryOriginLabel,
  describeGovernedLearningHandoffGuidance,
  describeComparisonOperatorSummary,
  describeComparisonBaselinePolicy,
  describeComparisonTriageHint,
  describeHistoryVisibilitySummary,
  describeHistoryControlSummaryLines,
  describeHistoryCompareStatusSummary,
  summarizeEvidencePackChanges,
  summarizeFinalizedEntry,
  summarizeBindingChanges,
  EvaluationWorkbenchEvidenceList,
  EvaluationWorkbenchEvidencePackSummary,
  EvaluationWorkbenchFinalizePanel,
  EvaluationWorkbenchGovernedSourceDetailCard,
  EvaluationWorkbenchLinkedSampleContextList,
  EvaluationWorkbenchHistoryEntrySignals,
  EvaluationWorkbenchPage,
  sortFinalizedRunHistory,
  EvaluationWorkbenchRunComparisonCard,
  EvaluationWorkbenchSelectedRunItemDetailCard,
  filterFinalizedRunHistory,
  isSelectedRunHiddenFromHistoryList,
  searchFinalizedRunHistory,
} from "../src/features/evaluation-workbench/evaluation-workbench-page.tsx";

function createFinalizedHistoryEntry(input: {
  runId: string;
  recommendationStatus: "recommended" | "needs_review" | "rejected";
  summaryStatus?: "recommended" | "needs_review" | "rejected";
  score: number;
  decisionReason: string;
  createdAt: string;
  regressionSummary?: string;
  failureSummary?: string;
  evidenceLabel?: string;
}) {
  return {
    run: {
      id: input.runId,
      suite_id: "suite-ops-1",
      sample_set_id: "sample-set-ops-1",
      baseline_binding: {
        lane: "baseline",
        model_id: "baseline-model-stable",
        runtime_id: "runtime-prod-1",
        prompt_template_id: "prompt-prod-1",
        skill_package_ids: ["skill-prod-1"],
        module_template_id: "template-prod-1",
      },
      candidate_binding: {
        lane: "candidate",
        model_id: `candidate-model-${input.runId}`,
        runtime_id: "runtime-candidate-1",
        prompt_template_id: `prompt-${input.runId}`,
        skill_package_ids: ["skill-candidate-1"],
        module_template_id: "template-candidate-1",
      },
      run_item_count: 1,
      status: "passed",
      evidence_ids: [`evidence-${input.runId}`],
      started_at: input.createdAt,
      finished_at: input.createdAt,
    },
    finalized: {
      run: {
        id: input.runId,
        suite_id: "suite-ops-1",
        status: "passed",
        evidence_ids: [`evidence-${input.runId}`],
        started_at: input.createdAt,
        finished_at: input.createdAt,
      },
      evidence_pack: {
        id: `pack-${input.runId}`,
        experiment_run_id: input.runId,
        summary_status: input.summaryStatus ?? input.recommendationStatus,
        score_summary: `Average weighted score ${input.score.toFixed(1)} across 1 item(s).`,
        regression_summary:
          input.regressionSummary ?? "No regression failures were recorded.",
        failure_summary: input.failureSummary ?? "No failure annotations were recorded.",
        cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
        latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
        created_at: input.createdAt,
      },
      recommendation: {
        id: `recommendation-${input.runId}`,
        experiment_run_id: input.runId,
        evidence_pack_id: `pack-${input.runId}`,
        status: input.recommendationStatus,
        decision_reason: input.decisionReason,
        created_at: input.createdAt,
      },
      evidence: [
        {
          id: `evidence-${input.runId}`,
          kind: "url",
          label: input.evidenceLabel ?? `Evidence for ${input.runId}`,
          uri: `https://example.test/evidence/${input.runId}`,
          created_at: input.createdAt,
        },
      ],
    },
  };
}

function createOperationsOverviewFixture() {
  const finalizedRunHistory = [
    createFinalizedHistoryEntry({
      runId: "run-12",
      recommendationStatus: "recommended",
      score: 96,
      decisionReason: "Latest finalized recommendation is safe to promote.",
      createdAt: "2026-04-12T09:00:00.000Z",
      evidenceLabel: "Latest browser QA",
    }),
    createFinalizedHistoryEntry({
      runId: "run-11",
      recommendationStatus: "needs_review",
      summaryStatus: "needs_review",
      score: 82,
      decisionReason: "Previous finalized recommendation needed manual review.",
      createdAt: "2026-04-11T09:00:00.000Z",
      regressionSummary: "Regression drift detected in terminology consistency.",
      failureSummary: "One hard gate warning remains open.",
      evidenceLabel: "Previous browser QA",
    }),
    createFinalizedHistoryEntry({
      runId: "run-10",
      recommendationStatus: "recommended",
      score: 91,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-10T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-09",
      recommendationStatus: "rejected",
      summaryStatus: "rejected",
      score: 54,
      decisionReason: "Inspection run was rejected for regression drift.",
      createdAt: "2026-04-09T09:00:00.000Z",
      regressionSummary: "2 regression-failed item(s) detected.",
      failureSummary: "Structure regression triggered the hard gate.",
    }),
    createFinalizedHistoryEntry({
      runId: "run-08",
      recommendationStatus: "recommended",
      score: 89,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-08T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-07",
      recommendationStatus: "needs_review",
      summaryStatus: "needs_review",
      score: 76,
      decisionReason: "Historical reference needs review.",
      createdAt: "2026-04-07T09:00:00.000Z",
      regressionSummary: "Regression drift detected in citation formatting.",
      failureSummary: "One hard gate warning remains open.",
    }),
    createFinalizedHistoryEntry({
      runId: "run-06",
      recommendationStatus: "recommended",
      score: 88,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-06T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-05",
      recommendationStatus: "recommended",
      score: 90,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-05T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-04",
      recommendationStatus: "needs_review",
      summaryStatus: "needs_review",
      score: 74,
      decisionReason: "Historical reference needs review.",
      createdAt: "2026-04-04T09:00:00.000Z",
      failureSummary: "Runtime_failed required a manual check.",
    }),
    createFinalizedHistoryEntry({
      runId: "run-03",
      recommendationStatus: "recommended",
      score: 86,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-03T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-02",
      recommendationStatus: "recommended",
      score: 84,
      decisionReason: "Older suite history remained recommended.",
      createdAt: "2026-04-02T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-01",
      recommendationStatus: "rejected",
      summaryStatus: "rejected",
      score: 49,
      decisionReason: "Selected inspection run regressed and was rejected.",
      createdAt: "2026-04-01T09:00:00.000Z",
      regressionSummary: "3 regression-failed item(s) detected.",
      failureSummary: "Structure regression triggered the hard gate.",
    }),
  ];
  const visibleHistory = finalizedRunHistory.slice(0, 10);

  return {
    checkProfiles: [{ id: "check-1", status: "published" }],
    releaseCheckProfiles: [{ id: "release-1", status: "published" }],
    sampleSets: [
      {
        id: "sample-set-ops-1",
        name: "Editing Suite Set",
        module: "editing",
        sample_count: 12,
        status: "published",
      },
    ],
    suites: [
      {
        id: "suite-ops-1",
        name: "Editing Delta Suite",
        suite_type: "governed_evaluation",
        status: "active",
        module_scope: ["editing"],
      },
    ],
    selectedSuiteId: "suite-ops-1",
    runs: finalizedRunHistory.map((entry) => entry.run),
    selectedRunId: "run-01",
    sampleSetItems: [],
    runItems: [],
    selectedRunEvidence: [
      {
        id: "selected-evidence-run-01",
        kind: "url",
        label: "Selected inspection evidence",
        uri: "https://example.test/evidence/selected-run-01",
        created_at: "2026-04-01T09:05:00.000Z",
      },
    ],
    previousRunEvidence: [],
    selectedRunFinalization: null,
    finalizedRunHistory,
    suiteOperations: {
      defaultWindow: "latest_10",
      visibleHistory,
      defaultComparison: {
        selected: visibleHistory[0],
        baseline: visibleHistory[1],
      },
      defaultComparisonDetail: {
        selectedEvidence: visibleHistory[0].finalized.evidence,
        baselineEvidence: visibleHistory[1].finalized.evidence,
      },
      delta: {
        classification: "better",
        reason: "recommendation_improved",
      },
      signals: {
        recommendationDistribution: {
          recommended: 6,
          needs_review: 3,
          rejected: 1,
        },
        evidencePackOutcomeMix: {
          recommended: 6,
          needs_review: 3,
          rejected: 1,
        },
        recurrence: {
          regressionMentions: 3,
          failureMentions: 4,
          runsWithRecurrenceSignals: 4,
        },
      },
      honestDegradation: null,
    },
    manuscriptContext: null,
  };
}

function renderLoadedPage(
  overview: ReturnType<typeof createOperationsOverviewFixture>,
): string {
  const controller = {
    loadOverview: async () => overview,
  } as React.ComponentProps<typeof EvaluationWorkbenchPage>["controller"];

  return renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={controller}
      initialOverview={overview}
    />,
  );
}

test("evaluation workbench page renders an explicit loading state for server-side shell output", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
        activateSuiteAndReload: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /Harness 控制概览/u);
  assert.match(markup, /默认聚焦总体评测状态与风险分布/u);
  assert.match(markup, /Loading suites, runs, and verification assets\.\.\./);
});

test("evaluation workbench loading placeholder follows section-specific first-view emphasis", () => {
  const overviewLoadingMarkup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      section="overview"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );
  const runsLoadingMarkup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      section="runs"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(overviewLoadingMarkup, /Harness 控制概览/u);
  assert.match(overviewLoadingMarkup, /默认聚焦总体评测状态与风险分布/u);
  assert.match(runsLoadingMarkup, /Harness 运行记录/u);
  assert.match(runsLoadingMarkup, /默认聚焦最近运行队列与最终建议变化/u);
});

test("evaluation workbench loaded page renders a read-only release-gate summary card", () => {
  const markup = renderLoadedPage(createOperationsOverviewFixture());

  assert.match(markup, /Release Gate Summary/);
  assert.match(markup, /Candidate run: run-12/);
  assert.match(markup, /Baseline run: run-11/);
  assert.match(markup, /Baseline vs candidate: run-11 vs run-12/);
  assert.match(markup, /Recommendation status: recommended/);
  assert.match(markup, /Regression summary: No regression failures were recorded\./);
  assert.match(markup, /Failure summary: No failure annotations were recorded\./);
  assert.match(markup, /Manifest-ready summary/);
  assert.match(
    markup,
    /Candidate run run-12 compared against baseline run run-11 is recommended\./,
  );
});

test("evaluation workbench page lands on different first-view emphasis for overview vs runs sections", () => {
  const overview = createOperationsOverviewFixture();
  const controller = {
    loadOverview: async () => overview,
  } as React.ComponentProps<typeof EvaluationWorkbenchPage>["controller"];

  const overviewMarkup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={controller}
      section="overview"
      initialOverview={overview}
    />,
  );
  const runsMarkup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={controller}
      section="runs"
      initialOverview={overview}
    />,
  );

  assert.match(overviewMarkup, /Harness 控制概览/u);
  assert.match(overviewMarkup, /默认聚焦总体评测状态与风险分布/u);
  assert.match(runsMarkup, /Harness 运行记录/u);
  assert.match(runsMarkup, /默认聚焦最近运行队列与最终建议变化/u);
});

test("evaluation workbench loaded page renders a delta-first summary with bounded read-only history", () => {
  const markup = renderLoadedPage(createOperationsOverviewFixture());

  assert.match(markup, /Read-Only Operations Desk/);
  assert.match(markup, /管理区/);
  assert.match(markup, /workbench-core-strip is-secondary/);
  assert.match(markup, /Delta Summary/);
  assert.match(markup, /Classification: better/i);
  assert.match(
    markup,
    /Chosen because the latest finalized recommendation improved from needs_review to recommended\./,
  );
  assert.match(markup, /Next operator cue:/);
  assert.match(markup, /Latest-versus-previous finalized comparison/);
  assert.match(markup, /Default comparison: run-12 vs run-11\./);
  assert.match(markup, /Latest 10/);
  assert.match(markup, /Last 7 Days/);
  assert.match(markup, /Last 30 Days/);
  assert.match(markup, /All Suite History/);
  assert.match(markup, /All/);
  assert.match(markup, /Recommended/);
  assert.match(markup, /Needs Review/);
  assert.match(markup, /Rejected/);
  assert.match(markup, /Newest First/);
  assert.match(markup, /Failures First/);
  assert.match(markup, /Visible history window: 10 of 12 finalized runs are in scope\./);
  assert.match(markup, /run-12/);
  assert.match(markup, /run-03/);
  assert.doesNotMatch(markup, /run-02/);
  assert.match(markup, /Default latest run/);
  assert.match(markup, /Default baseline/);
  assert.match(markup, /Selected inspection run: run-01/);
  assert.match(markup, /Selected run run-01 is outside the visible history window\./);
  assert.match(markup, /Recommendation Distribution/);
  assert.match(markup, /6 recommended \/ 3 needs review \/ 1 rejected/);
  assert.match(markup, /Evidence Pack Outcomes/);
  assert.match(markup, /Recurrence Signals/);
  assert.match(markup, /3 regression mentions \/ 4 failure mentions \/ 4 runs flagged/);
  assert.doesNotMatch(markup, /Activate/);
  assert.doesNotMatch(markup, /Run Launch/);
  assert.doesNotMatch(markup, /Complete And Finalize Run/);
  assert.doesNotMatch(markup, /Finalize Recommendation/);
});

test("evaluation workbench release-gate summary falls back to an honest empty state when finalized evidence is missing", () => {
  const insufficientComparisonOverview = createOperationsOverviewFixture();
  const onlyVisibleEntry = insufficientComparisonOverview.finalizedRunHistory[0];
  insufficientComparisonOverview.suiteOperations = {
    ...insufficientComparisonOverview.suiteOperations,
    visibleHistory: [onlyVisibleEntry],
    defaultComparison: null,
    defaultComparisonDetail: null,
    delta: null,
    honestDegradation: {
      kind: "comparison_unavailable",
      reason: "fewer_than_two_visible_finalized_runs",
    },
  };
  const insufficientComparisonMarkup = renderLoadedPage(insufficientComparisonOverview);

  assert.match(insufficientComparisonMarkup, /Release Gate Summary/);
  assert.match(
    insufficientComparisonMarkup,
    /Release gate summary is unavailable until at least two finalized runs are visible in the current history window\./,
  );

  const selectedRunNotFinalizedOverview = createOperationsOverviewFixture();
  selectedRunNotFinalizedOverview.runs = [
    {
      ...selectedRunNotFinalizedOverview.runs[0],
      id: "run-current",
      status: "passed",
      finished_at: "2026-04-13T09:00:00.000Z",
    },
    ...selectedRunNotFinalizedOverview.runs,
  ];
  selectedRunNotFinalizedOverview.selectedRunId = "run-current";
  selectedRunNotFinalizedOverview.selectedRunFinalization = null;
  const selectedRunNotFinalizedMarkup = renderLoadedPage(selectedRunNotFinalizedOverview);

  assert.match(selectedRunNotFinalizedMarkup, /Release Gate Summary/);
  assert.match(
    selectedRunNotFinalizedMarkup,
    /Release gate summary is unavailable until the selected run has a finalized recommendation and evidence pack\./,
  );
});

test("evaluation workbench loaded page keeps selected inspection finalization outside the visible history window", () => {
  const overview = createOperationsOverviewFixture();
  const selectedFinalized = overview.finalizedRunHistory.find((entry) => entry.run.id === "run-01");
  assert.ok(selectedFinalized);
  overview.selectedRunFinalization = {
    run: selectedFinalized.run,
    evidence_pack: selectedFinalized.finalized.evidence_pack,
    recommendation: selectedFinalized.finalized.recommendation,
  };

  const markup = renderLoadedPage(overview);

  assert.match(markup, /Selected inspection run: run-01/);
  assert.match(markup, /Recommendation: rejected/);
  assert.match(markup, /Evidence Pack: pack-run-01/);
  assert.match(markup, /Selected inspection run regressed and was rejected\./);
  assert.match(markup, /This run is outside the finalized history slice that powers the default delta summary\./);
});

test("evaluation workbench loaded page renders honest degradation when fewer than two finalized runs are visible", () => {
  const overview = createOperationsOverviewFixture();
  const onlyVisibleEntry = overview.finalizedRunHistory[0];
  overview.suiteOperations = {
    ...overview.suiteOperations,
    visibleHistory: [onlyVisibleEntry],
    defaultComparison: null,
    defaultComparisonDetail: null,
    delta: null,
    honestDegradation: {
      kind: "comparison_unavailable",
      reason: "fewer_than_two_visible_finalized_runs",
    },
    signals: {
      recommendationDistribution: {
        recommended: 1,
        needs_review: 0,
        rejected: 0,
      },
      evidencePackOutcomeMix: {
        recommended: 1,
        needs_review: 0,
        rejected: 0,
      },
      recurrence: {
        regressionMentions: 0,
        failureMentions: 0,
        runsWithRecurrenceSignals: 0,
      },
    },
  };

  const markup = renderLoadedPage(overview);

  assert.match(markup, /Delta Summary/);
  assert.match(
    markup,
    /Honest degradation: fewer than two finalized runs are visible in the Latest 10 window, so no default delta can be claimed yet\./,
  );
  assert.match(
    markup,
    /Finalize one more run in the visible window before treating the suite as improved, worse, or flat\./,
  );
});

test("evaluation workbench run-item detail card renders linked sample context and frozen bindings", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchSelectedRunItemDetailCard
      selectedRun={{
        id: "run-1",
        suite_id: "suite-1",
        sample_set_id: "sample-set-1",
        baseline_binding: {
          lane: "baseline",
          model_id: "baseline-model-1",
          runtime_id: "runtime-prod-1",
          prompt_template_id: "prompt-prod-1",
          skill_package_ids: ["skill-prod-1", "skill-prod-2"],
          module_template_id: "template-prod-1",
        },
        candidate_binding: {
          lane: "candidate",
          model_id: "candidate-model-1",
          runtime_id: "runtime-candidate-1",
          prompt_template_id: "prompt-candidate-1",
          skill_package_ids: ["skill-candidate-1"],
          module_template_id: "template-candidate-1",
        },
        release_check_profile_id: "release-1",
        run_item_count: 1,
        status: "running",
        evidence_ids: [],
        started_at: "2026-04-01T08:00:00.000Z",
      }}
      selectedRunItem={{
        id: "run-item-1",
        evaluation_run_id: "run-1",
        sample_set_item_id: "sample-item-1",
        lane: "candidate",
        result_asset_id: "asset-1",
        hard_gate_passed: false,
        weighted_score: 61,
        failure_kind: "regression_failed",
        failure_reason: "Structure regression triggered the hard gate.",
        diff_summary: "Candidate drifted from the approved editing structure.",
        requires_human_review: true,
      }}
      linkedSampleSetItem={{
        id: "sample-item-1",
        sample_set_id: "sample-set-1",
        manuscript_id: "manuscript-1",
        snapshot_asset_id: "snapshot-asset-1",
        reviewed_case_snapshot_id: "reviewed-case-snapshot-1",
        module: "editing",
        manuscript_type: "clinical_study",
        risk_tags: ["structure", "terminology"],
      }}
    />,
  );

  assert.match(markup, /Selected Sample Detail/);
  assert.match(markup, /sample-item-1/);
  assert.match(markup, /clinical_study/);
  assert.match(markup, /structure, terminology/);
  assert.match(markup, /snapshot-asset-1/);
  assert.match(markup, /reviewed-case-snapshot-1/);
  assert.match(markup, /baseline-model-1/);
  assert.match(markup, /candidate-model-1/);
  assert.match(markup, /skill-prod-1, skill-prod-2/);
  assert.match(markup, /skill-candidate-1/);
  assert.match(markup, /Open Editing Workbench/);
  assert.match(
    markup,
    /#editing\?manuscriptId=manuscript-1&amp;reviewedCaseSnapshotId=reviewed-case-snapshot-1&amp;sampleSetItemId=sample-item-1/,
  );
});

test("evaluation workbench governed-source detail card renders execution trace and manuscript navigation", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchGovernedSourceDetailCard
      selectedRun={{
        id: "run-governed-1",
        suite_id: "suite-1",
        governed_source: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-1",
          execution_snapshot_id: "execution-snapshot-1",
          output_asset_id: "output-asset-1",
        },
        release_check_profile_id: "release-1",
        run_item_count: 0,
        status: "queued",
        evidence_ids: [],
        started_at: "2026-04-03T08:00:00.000Z",
      }}
    />,
  );

  assert.match(markup, /Governed Source Detail/);
  assert.match(markup, /Source Module: editing/);
  assert.match(markup, /Manuscript: manuscript-1/);
  assert.match(markup, /Execution Snapshot: execution-snapshot-1/);
  assert.match(markup, /Agent Execution Log: execution-log-1/);
  assert.match(markup, /Output Asset: output-asset-1/);
  assert.match(markup, /Release Check Profile: release-1/);
  assert.match(markup, /Download Governed Output Asset/);
  assert.match(markup, /\/api\/v1\/document-assets\/output-asset-1\/download/);
  assert.match(markup, /Open Editing Workbench/);
  assert.match(markup, /#editing\?manuscriptId=manuscript-1/);
  assert.doesNotMatch(markup, /reviewedCaseSnapshotId=/);
  assert.doesNotMatch(markup, /sampleSetItemId=/);
});

test("evaluation workbench comparison card renders binding deltas between finalized runs", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchRunComparisonCard
      comparisonScopeLabel="Broader suite history"
      selectedOriginLabel="Current manuscript"
      previousOriginLabel="Broader suite"
      selectedEvidence={[
        {
          id: "evidence-2",
          kind: "url",
          label: "Latest browser QA",
          uri: "https://example.test/evidence/latest-browser-qa",
          created_at: "2026-04-01T08:19:00.000Z",
        },
      ]}
      previousEvidence={[
        {
          id: "evidence-1",
          kind: "url",
          label: "Rejected browser QA",
          uri: "https://example.test/evidence/rejected-browser-qa",
          created_at: "2026-04-01T07:19:00.000Z",
        },
      ]}
      selectedEntry={{
        run: {
          id: "run-2",
          suite_id: "suite-1",
          sample_set_id: "sample-set-1",
          baseline_binding: {
            lane: "baseline",
            model_id: "baseline-model-2",
            runtime_id: "runtime-1",
            prompt_template_id: "prompt-1",
            skill_package_ids: ["skill-1"],
            module_template_id: "template-1",
          },
          candidate_binding: {
            lane: "candidate",
            model_id: "candidate-model-2",
            runtime_id: "runtime-1",
            prompt_template_id: "prompt-2",
            skill_package_ids: ["skill-1", "skill-2"],
            module_template_id: "template-1",
          },
          run_item_count: 1,
          status: "passed",
          evidence_ids: [],
          started_at: "2026-04-01T08:00:00.000Z",
          finished_at: "2026-04-01T08:20:00.000Z",
        },
        finalized: {
          run: {
            id: "run-2",
            suite_id: "suite-1",
            status: "passed",
            evidence_ids: [],
            started_at: "2026-04-01T08:00:00.000Z",
          },
          evidence_pack: {
            id: "pack-2",
            experiment_run_id: "run-2",
            summary_status: "recommended",
            score_summary: "Average weighted score 97.0 across 1 item(s).",
            regression_summary: "No regression failures were recorded.",
            failure_summary: "No failure annotations were recorded.",
            cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
            latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
            created_at: "2026-04-01T08:20:00.000Z",
          },
          recommendation: {
            id: "recommendation-2",
            experiment_run_id: "run-2",
            evidence_pack_id: "pack-2",
            status: "recommended",
            created_at: "2026-04-01T08:20:00.000Z",
          },
        },
      }}
      previousEntry={{
        run: {
          id: "run-1",
          suite_id: "suite-1",
          sample_set_id: "sample-set-1",
          baseline_binding: {
            lane: "baseline",
            model_id: "baseline-model-1",
            runtime_id: "runtime-1",
            prompt_template_id: "prompt-1",
            skill_package_ids: ["skill-1"],
            module_template_id: "template-1",
          },
          candidate_binding: {
            lane: "candidate",
            model_id: "candidate-model-1",
            runtime_id: "runtime-1",
            prompt_template_id: "prompt-1",
            skill_package_ids: ["skill-1"],
            module_template_id: "template-1",
          },
          run_item_count: 1,
          status: "passed",
          evidence_ids: [],
          started_at: "2026-04-01T07:00:00.000Z",
          finished_at: "2026-04-01T07:20:00.000Z",
        },
        finalized: {
          run: {
            id: "run-1",
            suite_id: "suite-1",
            status: "passed",
            evidence_ids: [],
            started_at: "2026-04-01T07:00:00.000Z",
          },
          evidence_pack: {
            id: "pack-1",
            experiment_run_id: "run-1",
            summary_status: "recommended",
            score_summary: "Average weighted score 91.0 across 1 item(s).",
            regression_summary: "No regression failures were recorded.",
            failure_summary: "No failure annotations were recorded.",
            cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
            latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
            created_at: "2026-04-01T07:20:00.000Z",
          },
          recommendation: {
            id: "recommendation-1",
            experiment_run_id: "run-1",
            evidence_pack_id: "pack-1",
            status: "recommended",
            created_at: "2026-04-01T07:20:00.000Z",
          },
        },
      }}
    />,
  );

  assert.match(
    markup,
    /Operator summary: Improved over broader suite history by 6\.0 weighted points while holding recommended\./,
  );
  assert.match(
    markup,
    /Baseline policy: Chronological previous finalized run within broader suite history\./,
  );
  assert.match(markup, /Suggested action: Promote candidate/);
  assert.match(markup, /Comparison scope: Broader suite history/);
  assert.match(markup, /Selected origin: Current manuscript/);
  assert.match(markup, /Previous origin: Broader suite/);
  assert.match(markup, /Selected summary: Finished 2026-04-01T08:20:00.000Z/);
  assert.match(markup, /Previous summary: Finished 2026-04-01T07:20:00.000Z/);
  assert.match(markup, /Binding Changes/);
  assert.match(markup, /Evidence Pack Changes/);
  assert.match(markup, /Recommendation shift: unchanged at recommended/);
  assert.match(markup, /Evidence count: 1 \(was 1\)/);
  assert.match(markup, /Baseline model changed: baseline-model-2 \(was baseline-model-1\)/);
  assert.match(markup, /Candidate model changed: candidate-model-2 \(was candidate-model-1\)/);
  assert.match(markup, /Candidate prompt changed: prompt-2 \(was prompt-1\)/);
  assert.match(markup, /Candidate skills changed: skill-1, skill-2 \(was skill-1\)/);
  assert.match(
    markup,
    /Score summary changed: Average weighted score 97\.0 across 1 item\(s\)\. \(was Average weighted score 91\.0 across 1 item\(s\)\.\)/,
  );
  assert.match(markup, /Selected evidence: Latest browser QA/);
  assert.match(markup, /Previous evidence: Rejected browser QA/);
  assert.match(markup, /Selected evidence pack/);
  assert.match(markup, /Previous evidence pack/);
  assert.match(markup, /Average weighted score 97.0 across 1 item\(s\)\./);
  assert.match(markup, /Average weighted score 91.0 across 1 item\(s\)\./);
});

test("evaluation workbench evidence list renders actionable links for url and artifact evidence", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchEvidenceList
      evidence={[
        {
          id: "evidence-url-1",
          kind: "url",
          label: "Browser QA evidence",
          uri: "https://example.test/evidence/browser-qa",
          created_at: "2026-04-02T08:10:00.000Z",
        },
        {
          id: "evidence-artifact-1",
          kind: "artifact",
          label: "Proof artifact evidence",
          artifact_asset_id: "asset-proof-1",
          created_at: "2026-04-02T08:11:00.000Z",
        },
      ]}
    />,
  );

  assert.match(markup, /Browser QA evidence/);
  assert.match(markup, /Open evidence link/);
  assert.match(markup, /https:\/\/example\.test\/evidence\/browser-qa/);
  assert.match(markup, /Proof artifact evidence/);
  assert.match(markup, /Download evidence artifact/);
  assert.match(markup, /\/api\/v1\/document-assets\/asset-proof-1\/download/);
});

test("evaluation workbench finalize panel shows finalize-only guidance for machine-completed governed runs", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchFinalizePanel
      selectedRun={{
        id: "run-governed-1",
        suite_id: "suite-1",
        governed_source: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-1",
          execution_snapshot_id: "execution-snapshot-1",
          output_asset_id: "output-asset-1",
        },
        release_check_profile_id: "release-1",
        run_item_count: 0,
        status: "passed",
        evidence_ids: ["evidence-machine-1"],
        started_at: "2026-04-03T08:00:00.000Z",
        finished_at: "2026-04-03T08:05:00.000Z",
      }}
      effectiveFinalizedResult={null}
      finalizeForm={{
        status: "passed",
        evidenceKind: "url",
        evidenceLabel: "Browser QA evidence",
        evidenceUrl: "https://example.test/evidence/browser-qa",
        artifactAssetId: "",
      }}
      finalizeArtifactOptions={[]}
      selectedRunEvidence={[
        {
          id: "evidence-machine-1",
          kind: "url",
          label: "Automatic governed browser QA passed for Editing Output Check",
          uri: "/api/v1/document-assets/output-asset-1/download",
          check_profile_id: "check-1",
          created_at: "2026-04-03T08:04:00.000Z",
        },
      ]}
      isBusy={false}
      onFinalizeStatusChange={() => {}}
      onEvidenceKindChange={() => {}}
      onEvidenceLabelChange={() => {}}
      onEvidenceUrlChange={() => {}}
      onArtifactAssetIdChange={() => {}}
      onSelectArtifactSuggestion={() => {}}
      onCompleteAndFinalize={() => {}}
      onFinalizeRecommendation={() => {}}
    />,
  );

  assert.match(
    markup,
    /Automatic governed checks completed\. Review machine evidence before finalizing\./,
  );
  assert.match(markup, /Finalize Recommendation/);
  assert.match(markup, /Automatic governed browser QA passed for Editing Output Check/);
  assert.doesNotMatch(markup, /Complete And Finalize Run/);
});

test("evaluation workbench finalize panel keeps the legacy completion path for queued sample-backed runs", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchFinalizePanel
      selectedRun={{
        id: "run-queued-1",
        suite_id: "suite-1",
        sample_set_id: "sample-set-1",
        run_item_count: 1,
        status: "queued",
        evidence_ids: [],
        started_at: "2026-04-03T08:00:00.000Z",
      }}
      effectiveFinalizedResult={null}
      finalizeForm={{
        status: "failed",
        evidenceKind: "artifact",
        evidenceLabel: "Result asset evidence",
        evidenceUrl: "",
        artifactAssetId: "human-final-demo-1",
      }}
      finalizeArtifactOptions={[
        {
          source: "result_asset",
          assetId: "human-final-demo-1",
          actionLabel: "Use Result Asset (human-final-demo-1)",
        },
      ]}
      selectedRunEvidence={[]}
      isBusy={false}
      onFinalizeStatusChange={() => {}}
      onEvidenceKindChange={() => {}}
      onEvidenceLabelChange={() => {}}
      onEvidenceUrlChange={() => {}}
      onArtifactAssetIdChange={() => {}}
      onSelectArtifactSuggestion={() => {}}
      onCompleteAndFinalize={() => {}}
      onFinalizeRecommendation={() => {}}
    />,
  );

  assert.match(markup, /Run Status/);
  assert.match(markup, /Evidence Label/);
  assert.match(markup, /Complete And Finalize Run/);
  assert.doesNotMatch(
    markup,
    /Automatic governed checks completed\. Review machine evidence before finalizing\./,
  );
});

test("evaluation workbench evidence pack summary renders labeled outcome fields", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchEvidencePackSummary
      evidencePack={{
        id: "pack-1",
        experiment_run_id: "run-1",
        summary_status: "recommended",
        score_summary: "Average weighted score 94.0 across 1 item(s).",
        regression_summary: "No regression failures were recorded.",
        failure_summary: "No failure annotations were recorded.",
        cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
        latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
        created_at: "2026-04-02T08:15:00.000Z",
      }}
    />,
  );

  assert.match(markup, /Summary Status/);
  assert.match(markup, /recommended/);
  assert.match(markup, /Score Summary/);
  assert.match(markup, /Average weighted score 94.0 across 1 item\(s\)\./);
  assert.match(markup, /Regression Summary/);
  assert.match(markup, /No regression failures were recorded\./);
  assert.match(markup, /Failure Summary/);
  assert.match(markup, /No failure annotations were recorded\./);
  assert.match(markup, /Cost Summary/);
  assert.match(markup, /Latency Summary/);
});

test("evaluation workbench history entry signals render structured list summaries", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchHistoryEntrySignals
      entry={{
        run: {
          id: "run-history-1",
        },
        finalized: {
          recommendation: {
            status: "rejected",
          },
          evidence_pack: {
            score_summary: "Average weighted score 52.0 across 1 item(s).",
            regression_summary: "1 regression-failed item(s) detected.",
            failure_summary: "Structure regression triggered the hard gate.",
          },
        },
      } as never}
    />,
  );

  assert.match(markup, /Score:/);
  assert.match(markup, /Average weighted score 52.0 across 1 item\(s\)\./);
  assert.match(markup, /Regression:/);
  assert.match(markup, /1 regression-failed item\(s\) detected\./);
  assert.match(markup, /Failure:/);
  assert.match(markup, /Structure regression triggered the hard gate\./);
});

test("evaluation workbench linked sample context list renders run-item sample mappings", () => {
  const focusedRunItems: string[] = [];
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchLinkedSampleContextList
      runItems={[
        {
          id: "run-item-1",
          lane: "candidate",
          sample_set_item_id: "sample-item-1",
          result_asset_id: "result-asset-1",
          weighted_score: 91,
          failure_kind: "regression_failed",
          failure_reason: "Structure regression triggered the hard gate.",
        },
      ] as never}
      sampleSetItems={[
        {
          id: "sample-item-1",
          module: "structure",
          manuscript_type: "clinical_study",
          snapshot_asset_id: "snapshot-asset-1",
          reviewed_case_snapshot_id: "reviewed-case-snapshot-1",
          manuscript_id: "manuscript-1",
        },
      ] as never}
      selectedRunItemId="run-item-1"
      defaultWorkbenchMode="editing"
      onFocusRunItem={(runItemId) => {
        focusedRunItems.push(runItemId);
      }}
    />,
  );

  assert.match(markup, /Linked Sample Context/);
  assert.match(markup, /Run Item: run-item-1/);
  assert.match(markup, /candidate/);
  assert.match(markup, /Sample Item: sample-item-1/);
  assert.match(markup, /structure/);
  assert.match(markup, /clinical_study/);
  assert.match(markup, /reviewed-case-snapshot-1/);
  assert.match(markup, /Weighted Score: 91/);
  assert.match(markup, /Structure regression triggered the hard gate\./);
  assert.match(markup, /Focused/);
  assert.match(markup, /Focus Run Item run-item-1/);
  assert.match(markup, /Download Result Asset/);
  assert.match(markup, /\/api\/v1\/document-assets\/result-asset-1\/download/);
  assert.match(markup, /Download Sample Snapshot/);
  assert.match(markup, /\/api\/v1\/document-assets\/snapshot-asset-1\/download/);
  assert.match(markup, /Open Editing Workbench/);
  assert.match(
    markup,
    /#editing\?manuscriptId=manuscript-1&amp;reviewedCaseSnapshotId=reviewed-case-snapshot-1&amp;sampleSetItemId=sample-item-1/,
  );
  assert.deepEqual(focusedRunItems, []);
});

test("evaluation workbench linked sample context falls back to manuscript-only handoff when sample context is unavailable", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchLinkedSampleContextList
      runItems={[
        {
          id: "run-item-1",
          lane: "candidate",
          sample_set_item_id: "",
          result_asset_id: "result-asset-1",
          weighted_score: 91,
        },
      ] as never}
      sampleSetItems={[
        {
          id: "",
          module: "editing",
          manuscript_type: "clinical_study",
          snapshot_asset_id: "snapshot-asset-1",
          reviewed_case_snapshot_id: "  ",
          manuscript_id: "manuscript-1",
        },
      ] as never}
      selectedRunItemId="run-item-1"
      defaultWorkbenchMode="editing"
    />,
  );

  assert.match(markup, /Open Editing Workbench/);
  assert.match(markup, /#editing\?manuscriptId=manuscript-1/);
  assert.doesNotMatch(markup, /reviewedCaseSnapshotId=/);
  assert.doesNotMatch(markup, /sampleSetItemId=/);
});

test("describeGovernedLearningHandoffGuidance explains why learning handoff is unavailable without reviewed snapshot context", () => {
  assert.equal(
    describeGovernedLearningHandoffGuidance({
      hasFinalizedResult: true,
      hasLinkedSampleContext: false,
      hasGovernedSource: true,
    }),
    "Learning handoff is unavailable for governed-source runs until a reviewed snapshot is linked.",
  );

  assert.equal(
    describeGovernedLearningHandoffGuidance({
      hasFinalizedResult: true,
      hasLinkedSampleContext: true,
      hasGovernedSource: true,
    }),
    null,
  );
});

test("describeHistoryComparisonGuidance explains why history compare is unavailable", () => {
  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-2",
        status: "running",
      } as never,
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
    }),
    "Current run run-2 is still running. Complete and finalize it to compare against history.",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-governed-2",
        status: "passed",
        governed_source: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-2",
          execution_snapshot_id: "execution-snapshot-2",
          output_asset_id: "output-asset-2",
        },
      } as never,
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
    }),
    "Current run run-governed-2 already completed automatic governed checks. Finalize the recommendation to compare against history.",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: null,
    }),
    "Finalize one more run in this suite to compare the current result against history.",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: null,
      scope: "manuscript",
      totalFinalizedCount: 3,
      scopedCount: 1,
    }),
    "This manuscript only has one finalized run. Switch to Entire Suite History to compare it against broader suite history.",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: null,
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
    }),
    "Select a finalized run from the suite to compare it against prior history.",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: {
        run: {
          id: "run-1",
        },
      } as never,
    }),
    null,
  );
});

test("describeHistoryComparisonGuidanceSummary explains the next compare recovery step", () => {
  assert.equal(
    describeHistoryComparisonGuidanceSummary({
      selectedRun: {
        id: "run-2",
        status: "running",
      } as never,
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
    }),
    "Comparison unlocks after this run reaches a finalized recommendation with persisted evidence.",
  );

  assert.equal(
    describeHistoryComparisonGuidanceSummary({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: null,
      scope: "manuscript",
      totalFinalizedCount: 3,
      scopedCount: 1,
    }),
    "Broader suite history already has 2 additional finalized runs available for comparison.",
  );

  assert.equal(
    describeHistoryComparisonGuidanceSummary({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: null,
      scope: "suite",
      totalFinalizedCount: 1,
      scopedCount: 1,
    }),
    "Current suite history only contains this finalized run, so there is no earlier baseline yet.",
  );
});

test("describeHistoryComparisonRoleLabels marks selected and baseline history runs", () => {
  assert.deepEqual(
    describeHistoryComparisonRoleLabels({
      entryRunId: "run-2",
      selectedRunId: "run-2",
      previousRunId: "run-1",
    }),
    ["Selected run"],
  );

  assert.deepEqual(
    describeHistoryComparisonRoleLabels({
      entryRunId: "run-1",
      selectedRunId: "run-2",
      previousRunId: "run-1",
    }),
    ["Compare baseline"],
  );

  assert.deepEqual(
    describeHistoryComparisonRoleLabels({
      entryRunId: "run-3",
      selectedRunId: "run-2",
      previousRunId: "run-1",
    }),
    [],
  );
});

test("describeHistoryStatusPair formats recommendation and summary status with a readable separator", () => {
  assert.equal(
    describeHistoryStatusPair("recommended", "needs_review"),
    "recommended / needs_review",
  );
});

test("summarizeFinalizedEntry joins fields with a readable separator", () => {
  assert.equal(
    summarizeFinalizedEntry({
      run: {
        finished_at: "2026-04-01T07:20:00.000Z",
      },
      finalized: {
        recommendation: {
          decision_reason: "Accepted output",
        },
      },
    } as never),
    "Accepted output | Finished 2026-04-01T07:20:00.000Z",
  );
});

test("describeHistoryEntryOriginLabel distinguishes current manuscript from broader suite history", () => {
  assert.equal(
    describeHistoryEntryOriginLabel({
      runId: "run-2",
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "suite",
    }),
    "Current manuscript",
  );

  assert.equal(
    describeHistoryEntryOriginLabel({
      runId: "run-3",
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "suite",
    }),
    "Broader suite",
  );

  assert.equal(
    describeHistoryEntryOriginLabel({
      runId: "run-2",
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "manuscript",
    }),
    "Matched manuscript",
  );

  assert.equal(
    describeHistoryEntryOriginLabel({
      runId: "run-2",
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: false,
      scope: "suite",
    }),
    null,
  );
});

test("describeHistoryOriginSummary counts manuscript and broader-suite runs", () => {
  assert.equal(
    describeHistoryOriginSummary({
      runIds: ["run-2", "run-3", "run-1"],
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "suite",
    }),
    "Current manuscript runs: 2 | Broader suite references: 1",
  );

  assert.equal(
    describeHistoryOriginSummary({
      runIds: ["run-2", "run-1"],
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "manuscript",
    }),
    "Matched manuscript runs: 2",
  );

  assert.equal(
    describeHistoryOriginSummary({
      runIds: ["run-2"],
      matchedRunIds: ["run-2"],
      hasManuscriptContext: false,
      scope: "suite",
    }),
    null,
  );
});

test("describeComparisonOperatorSummary summarizes compare outcomes for operators", () => {
  assert.equal(
    describeComparisonOperatorSummary({
      comparisonScopeLabel: "Broader suite history",
      selectedStatus: "recommended",
      previousStatus: "recommended",
      selectedScoreSummary: "Average weighted score 97.0 across 1 item(s).",
      previousScoreSummary: "Average weighted score 91.0 across 1 item(s).",
    }),
    "Operator summary: Improved over broader suite history by 6.0 weighted points while holding recommended.",
  );

  assert.equal(
    describeComparisonOperatorSummary({
      comparisonScopeLabel: "Entire suite history",
      selectedStatus: "rejected",
      previousStatus: "recommended",
      selectedScoreSummary: "Average weighted score 52.0 across 1 item(s).",
      previousScoreSummary: "Average weighted score 91.0 across 1 item(s).",
    }),
    "Operator summary: Regressed against entire suite history (recommended -> rejected) and dropped 39.0 weighted points.",
  );

  assert.equal(
    describeComparisonOperatorSummary({
      comparisonScopeLabel: "Matched manuscript history",
      selectedStatus: "recommended",
      previousStatus: "recommended",
      selectedScoreSummary: "Average weighted score 91.0 across 1 item(s).",
      previousScoreSummary: "Average weighted score 91.0 across 1 item(s).",
    }),
    "Operator summary: Held steady against matched manuscript history at recommended.",
  );
});

test("describeComparisonTriageHint recommends next operator action", () => {
  assert.equal(
    describeComparisonTriageHint({
      selectedStatus: "recommended",
      previousStatus: "recommended",
      scoreDelta: 6,
    }),
    "Suggested action: Promote candidate",
  );

  assert.equal(
    describeComparisonTriageHint({
      selectedStatus: "recommended",
      previousStatus: "recommended",
      scoreDelta: 0,
    }),
    "Suggested action: Monitor before promote",
  );

  assert.equal(
    describeComparisonTriageHint({
      selectedStatus: "needs_review",
      previousStatus: "recommended",
      scoreDelta: -8,
    }),
    "Suggested action: Review manually",
  );

  assert.equal(
    describeComparisonTriageHint({
      selectedStatus: "rejected",
      previousStatus: "recommended",
      scoreDelta: -39,
    }),
    "Suggested action: Investigate regression",
  );
});

test("describeComparisonBaselinePolicy explains how the compare baseline is chosen", () => {
  assert.equal(
    describeComparisonBaselinePolicy("Entire suite history"),
    "Baseline policy: Chronological previous finalized run within entire suite history.",
  );

  assert.equal(
    describeComparisonBaselinePolicy("Broader suite history"),
    "Baseline policy: Chronological previous finalized run within broader suite history.",
  );

  assert.equal(
    describeComparisonBaselinePolicy("Matched manuscript history"),
    "Baseline policy: Chronological previous finalized run within matched manuscript history.",
  );
});

test("summarizeEvidencePackChanges lists only changed evidence-pack fields", () => {
  assert.deepEqual(
    summarizeEvidencePackChanges(
      {
        summary_status: "needs_review",
        score_summary: "Average weighted score 84.0 across 1 item(s).",
        regression_summary: "Regression drift detected in terminology consistency.",
        failure_summary: "One hard gate warning remains open.",
        cost_summary: "Average cost $0.18 per item.",
        latency_summary: "Average latency 7.2 seconds.",
      } as never,
      {
        summary_status: "recommended",
        score_summary: "Average weighted score 91.0 across 1 item(s).",
        regression_summary: "No regression failures were recorded.",
        failure_summary: "No failure annotations were recorded.",
        cost_summary: "Average cost $0.12 per item.",
        latency_summary: "Average latency 5.1 seconds.",
      } as never,
    ),
    [
      "Summary status changed: needs_review (was recommended)",
      "Score summary changed: Average weighted score 84.0 across 1 item(s). (was Average weighted score 91.0 across 1 item(s).)",
      "Regression summary changed: Regression drift detected in terminology consistency. (was No regression failures were recorded.)",
      "Failure summary changed: One hard gate warning remains open. (was No failure annotations were recorded.)",
      "Cost summary changed: Average cost $0.18 per item. (was Average cost $0.12 per item.)",
      "Latency summary changed: Average latency 7.2 seconds. (was Average latency 5.1 seconds.)",
    ],
  );
});

test("summarizeBindingChanges normalizes optional harness binding ids when they are absent", () => {
  assert.deepEqual(
    summarizeBindingChanges(
      {
        baseline_binding: {
          lane: "baseline",
          model_id: "baseline-model-2",
          runtime_id: "baseline-runtime-2",
          prompt_template_id: "baseline-prompt-2",
          skill_package_ids: ["baseline-skill-1"],
          module_template_id: "baseline-template-2",
        },
        candidate_binding: {
          lane: "candidate",
          model_id: "candidate-model-2",
          runtime_id: "candidate-runtime-2",
          prompt_template_id: "candidate-prompt-2",
          skill_package_ids: ["candidate-skill-1"],
          module_template_id: "candidate-template-2",
        },
      } as never,
      {
        baseline_binding: {
          lane: "baseline",
          execution_profile_id: "profile-baseline-1",
          runtime_binding_id: "binding-baseline-1",
          model_routing_policy_version_id: "routing-baseline-1",
          retrieval_preset_id: "retrieval-baseline-1",
          manual_review_policy_id: "manual-review-baseline-1",
          model_id: "baseline-model-1",
          runtime_id: "baseline-runtime-1",
          prompt_template_id: "baseline-prompt-1",
          skill_package_ids: ["baseline-skill-1"],
          module_template_id: "baseline-template-1",
        },
        candidate_binding: {
          lane: "candidate",
          execution_profile_id: "profile-candidate-1",
          runtime_binding_id: "binding-candidate-1",
          model_routing_policy_version_id: "routing-candidate-1",
          retrieval_preset_id: "retrieval-candidate-1",
          manual_review_policy_id: "manual-review-candidate-1",
          model_id: "candidate-model-1",
          runtime_id: "candidate-runtime-1",
          prompt_template_id: "candidate-prompt-1",
          skill_package_ids: ["candidate-skill-1"],
          module_template_id: "candidate-template-1",
        },
      } as never,
    ),
    [
      "Baseline model changed: baseline-model-2 (was baseline-model-1)",
      "Baseline runtime changed: baseline-runtime-2 (was baseline-runtime-1)",
      "Baseline execution profile changed: None recorded (was profile-baseline-1)",
      "Baseline runtime binding changed: None recorded (was binding-baseline-1)",
      "Baseline routing version changed: None recorded (was routing-baseline-1)",
      "Baseline retrieval preset changed: None recorded (was retrieval-baseline-1)",
      "Baseline manual review policy changed: None recorded (was manual-review-baseline-1)",
      "Baseline prompt changed: baseline-prompt-2 (was baseline-prompt-1)",
      "Baseline module template changed: baseline-template-2 (was baseline-template-1)",
      "Candidate model changed: candidate-model-2 (was candidate-model-1)",
      "Candidate runtime changed: candidate-runtime-2 (was candidate-runtime-1)",
      "Candidate execution profile changed: None recorded (was profile-candidate-1)",
      "Candidate runtime binding changed: None recorded (was binding-candidate-1)",
      "Candidate routing version changed: None recorded (was routing-candidate-1)",
      "Candidate retrieval preset changed: None recorded (was retrieval-candidate-1)",
      "Candidate manual review policy changed: None recorded (was manual-review-candidate-1)",
      "Candidate prompt changed: candidate-prompt-2 (was candidate-prompt-1)",
      "Candidate module template changed: candidate-template-2 (was candidate-template-1)",
    ],
  );
});

test("describeHistoryVisibilitySummary explains how current controls narrow history", () => {
  assert.equal(
    describeHistoryVisibilitySummary({
      visibleCount: 1,
      totalCount: 2,
      scope: "suite",
      filter: "all",
      searchQuery: "run-1",
      sortMode: "newest",
      selectedRunId: "run-2",
      selectedRunHidden: true,
    }),
    'Visibility summary: 1 of 2 finalized runs visible in suite-scoped history. Active controls: search "run-1". Selected run run-2 is outside the current result set.',
  );

  assert.equal(
    describeHistoryVisibilitySummary({
      visibleCount: 0,
      totalCount: 3,
      scope: "manuscript",
      filter: "rejected",
      searchQuery: "delta",
      sortMode: "failures_first",
      selectedRunId: null,
      selectedRunHidden: false,
    }),
    'Visibility summary: 0 of 3 finalized runs visible in manuscript-scoped history. Active controls: filter rejected, search "delta", sort failures first.',
  );
});

test("describeHistoryControlSummaryLines formats readable labels for history controls", () => {
  assert.deepEqual(
    describeHistoryControlSummaryLines({
      scope: "suite",
      filter: "all",
      searchQuery: "",
      sortMode: "newest",
    }),
    [
      "Scope: Entire suite history",
      "Filter: All finalized runs",
      "Search: None",
      "Sort: Newest first",
    ],
  );

  assert.deepEqual(
    describeHistoryControlSummaryLines({
      scope: "manuscript",
      filter: "rejected",
      searchQuery: "delta",
      sortMode: "failures_first",
    }),
    [
      "Scope: Matched manuscript runs",
      "Filter: Rejected only",
      "Search: delta",
      "Sort: Failures first",
    ],
  );
});

test("describeHistoryCompareStatusSummary explains whether compare remains available", () => {
  assert.equal(
    describeHistoryCompareStatusSummary({
      selectedRunHistoryEntry: { run: { id: "run-2" } },
      previousRunHistoryEntry: { run: { id: "run-1" } },
      historyComparisonGuidance: null,
      historyComparisonGuidanceSummary: null,
    } as never),
    "Compare status: Current compare summary remains available for the selected run and compare baseline.",
  );

  assert.equal(
    describeHistoryCompareStatusSummary({
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
      historyComparisonGuidance: "Select a finalized run from the suite to compare it against prior history.",
      historyComparisonGuidanceSummary:
        "Visible suite history currently has 2 finalized runs ready for compare selection.",
    } as never),
    "Compare status: Visible suite history currently has 2 finalized runs ready for compare selection.",
  );
});

test("filterFinalizedRunHistory narrows finalized runs by recommendation status", () => {
  const entries = [
    {
      run: { id: "run-recommended" },
      finalized: { recommendation: { status: "recommended" } },
    },
    {
      run: { id: "run-needs-review" },
      finalized: { recommendation: { status: "needs_review" } },
    },
    {
      run: { id: "run-rejected" },
      finalized: { recommendation: { status: "rejected" } },
    },
  ] as const;

  assert.deepEqual(
    filterFinalizedRunHistory(entries as never, "all").map((entry) => entry.run.id),
    ["run-recommended", "run-needs-review", "run-rejected"],
  );
  assert.deepEqual(
    filterFinalizedRunHistory(entries as never, "recommended").map((entry) => entry.run.id),
    ["run-recommended"],
  );
  assert.deepEqual(
    filterFinalizedRunHistory(entries as never, "needs_review").map((entry) => entry.run.id),
    ["run-needs-review"],
  );
  assert.deepEqual(
    filterFinalizedRunHistory(entries as never, "rejected").map((entry) => entry.run.id),
    ["run-rejected"],
  );
});

test("searchFinalizedRunHistory matches run ids, model bindings, and decision text", () => {
  const entries = [
    {
      run: {
        id: "run-alpha",
        baseline_binding: { model_id: "baseline-alpha" },
        candidate_binding: { model_id: "candidate-alpha" },
      },
      finalized: {
        evidence_pack: {
          id: "pack-alpha",
          score_summary: "Alpha score summary",
          regression_summary: "No regression failures were recorded.",
          failure_summary: "None",
        },
        recommendation: {
          status: "recommended",
          decision_reason: "Alpha is safe to promote",
        },
      },
    },
    {
      run: {
        id: "run-beta",
        baseline_binding: { model_id: "baseline-beta" },
        candidate_binding: { model_id: "candidate-beta" },
      },
      finalized: {
        evidence_pack: {
          id: "pack-beta",
          score_summary: "Beta score summary",
          regression_summary: "1 regression-failed item(s) detected.",
          failure_summary: "Hard gate failure",
        },
        recommendation: {
          status: "rejected",
          decision_reason: "Beta cannot be promoted",
        },
      },
    },
  ] as const;

  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "candidate-beta").map((entry) => entry.run.id),
    ["run-beta"],
  );
  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "safe to promote").map((entry) => entry.run.id),
    ["run-alpha"],
  );
  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "run-beta").map((entry) => entry.run.id),
    ["run-beta"],
  );
  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "pack-beta").map((entry) => entry.run.id),
    ["run-beta"],
  );
  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "regression-failed item").map((entry) => entry.run.id),
    ["run-beta"],
  );
});

test("isSelectedRunHiddenFromHistoryList detects when filters hide the current run", () => {
  const entries = [
    { run: { id: "run-one" } },
    { run: { id: "run-two" } },
  ] as const;

  assert.equal(isSelectedRunHiddenFromHistoryList(entries as never, "run-two"), false);
  assert.equal(isSelectedRunHiddenFromHistoryList(entries as never, "run-three"), true);
  assert.equal(isSelectedRunHiddenFromHistoryList(entries as never, null), false);
});

test("sortFinalizedRunHistory can prioritize failures ahead of recommendations", () => {
  const entries = [
    {
      run: { id: "run-recommended", finished_at: "2026-04-01T10:00:00.000Z" },
      finalized: { recommendation: { status: "recommended" } },
    },
    {
      run: { id: "run-needs-review", finished_at: "2026-04-01T09:00:00.000Z" },
      finalized: { recommendation: { status: "needs_review" } },
    },
    {
      run: { id: "run-rejected", finished_at: "2026-04-01T08:00:00.000Z" },
      finalized: { recommendation: { status: "rejected" } },
    },
  ] as const;

  assert.deepEqual(
    sortFinalizedRunHistory(entries as never, "newest").map((entry) => entry.run.id),
    ["run-recommended", "run-needs-review", "run-rejected"],
  );
  assert.deepEqual(
    sortFinalizedRunHistory(entries as never, "failures_first").map((entry) => entry.run.id),
    ["run-rejected", "run-needs-review", "run-recommended"],
  );
});

test("evaluation workbench selected run detail surfaces governed harness binding ids without exposing activation controls", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchSelectedRunItemDetailCard
      selectedRun={{
        id: "run-1",
        suite_id: "suite-1",
        sample_set_id: "sample-set-1",
        baseline_binding: {
          lane: "baseline",
          execution_profile_id: "profile-active-1",
          runtime_binding_id: "binding-active-1",
          model_routing_policy_version_id: "routing-active-1",
          retrieval_preset_id: "retrieval-active-1",
          manual_review_policy_id: "manual-review-active-1",
          model_id: "model-active-1",
          runtime_id: "runtime-active-1",
          prompt_template_id: "prompt-active-1",
          skill_package_ids: ["skill-active-1"],
          module_template_id: "template-active-1",
        },
        candidate_binding: {
          lane: "candidate",
          execution_profile_id: "profile-preview-2",
          runtime_binding_id: "binding-preview-2",
          model_routing_policy_version_id: "routing-preview-2",
          retrieval_preset_id: "retrieval-preview-2",
          manual_review_policy_id: "manual-review-preview-2",
          model_id: "model-preview-2",
          runtime_id: "runtime-preview-2",
          prompt_template_id: "prompt-preview-2",
          skill_package_ids: ["skill-preview-2"],
          module_template_id: "template-preview-2",
        },
        release_check_profile_id: "release-1",
        run_item_count: 1,
        status: "passed",
        evidence_ids: [],
        started_at: "2026-04-01T08:00:00.000Z",
      } as never}
      selectedRunItem={{
        id: "run-item-1",
        evaluation_run_id: "run-1",
        sample_set_item_id: "sample-item-1",
        lane: "candidate",
        result_asset_id: "asset-1",
        hard_gate_passed: true,
        weighted_score: 94,
        requires_human_review: false,
      }}
      linkedSampleSetItem={null}
    />,
  );

  assert.match(markup, /Execution Profile/i);
  assert.match(markup, /Retrieval Preset/i);
  assert.match(markup, /Manual Review Policy/i);
  assert.match(markup, /profile-preview-2/);
  assert.match(markup, /retrieval-preview-2/);
  assert.match(markup, /manual-review-preview-2/);
  assert.doesNotMatch(markup, /Activate/i);
  assert.doesNotMatch(markup, /Rollback/i);
});
