import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  describeHistoryComparisonGuidance,
  describeHistoryComparisonGuidanceSummary,
  describeHistoryOriginSummary,
  describeHistoryEntryOriginLabel,
  describeComparisonOperatorSummary,
  describeComparisonTriageHint,
  describeHistoryVisibilitySummary,
  EvaluationWorkbenchEvidenceList,
  EvaluationWorkbenchEvidencePackSummary,
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

  assert.match(markup, /Evaluation Workbench/);
  assert.match(markup, /Loading suites, runs, and verification assets\.\.\./);
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
  assert.match(markup, /#editing\?manuscriptId=manuscript-1/);
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
  assert.match(markup, /Suggested action: Promote candidate/);
  assert.match(markup, /Comparison scope: Broader suite history/);
  assert.match(markup, /Selected origin: Current manuscript/);
  assert.match(markup, /Previous origin: Broader suite/);
  assert.match(markup, /Binding Changes/);
  assert.match(markup, /Recommendation shift: unchanged at recommended/);
  assert.match(markup, /Evidence count: 1 \(was 1\)/);
  assert.match(markup, /Baseline model changed: baseline-model-2 \(was baseline-model-1\)/);
  assert.match(markup, /Candidate model changed: candidate-model-2 \(was candidate-model-1\)/);
  assert.match(markup, /Candidate prompt changed: prompt-2 \(was prompt-1\)/);
  assert.match(markup, /Candidate skills changed: skill-1, skill-2 \(was skill-1\)/);
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
          reviewed_case_snapshot_id: "snapshot-1",
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
  assert.match(markup, /snapshot-1/);
  assert.match(markup, /Weighted Score: 91/);
  assert.match(markup, /Structure regression triggered the hard gate\./);
  assert.match(markup, /Focused/);
  assert.match(markup, /Focus Run Item run-item-1/);
  assert.match(markup, /Download Result Asset/);
  assert.match(markup, /\/api\/v1\/document-assets\/result-asset-1\/download/);
  assert.match(markup, /Download Sample Snapshot/);
  assert.match(markup, /\/api\/v1\/document-assets\/snapshot-asset-1\/download/);
  assert.match(markup, /Open Editing Workbench/);
  assert.match(markup, /#editing\?manuscriptId=manuscript-1/);
  assert.deepEqual(focusedRunItems, []);
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
