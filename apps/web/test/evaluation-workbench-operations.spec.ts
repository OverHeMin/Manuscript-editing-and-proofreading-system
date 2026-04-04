import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvaluationWorkbenchSuiteOperationsSummary,
} from "../src/features/evaluation-workbench/evaluation-workbench-operations.ts";

type RecommendationStatus = "recommended" | "needs_review" | "rejected";
type RunStatus = "passed" | "failed";
type EvidencePackStatus = "recommended" | "needs_review" | "rejected";

function createHistoryEntry(input: {
  runId: string;
  recommendationCreatedAt: string;
  recommendationStatus: RecommendationStatus;
  runStatus?: RunStatus;
  evidencePackSummaryStatus?: EvidencePackStatus;
  regressionSummary?: string;
  failureSummary?: string;
}) {
  return {
    run: {
      id: input.runId,
      suite_id: "suite-1",
      status: input.runStatus ?? "passed",
      evidence_ids: [],
      started_at: input.recommendationCreatedAt,
      finished_at: input.recommendationCreatedAt,
    },
    finalized: {
      run: {
        id: input.runId,
        suite_id: "suite-1",
        status: input.runStatus ?? "passed",
        evidence_ids: [],
        started_at: input.recommendationCreatedAt,
        finished_at: input.recommendationCreatedAt,
      },
      evidence_pack: {
        id: `pack-${input.runId}`,
        experiment_run_id: input.runId,
        summary_status: input.evidencePackSummaryStatus ?? input.recommendationStatus,
        score_summary: "Average weighted score 90.0 across 1 item(s).",
        regression_summary: input.regressionSummary ?? "No regression failures were recorded.",
        failure_summary: input.failureSummary ?? "No failure annotations were recorded.",
        created_at: input.recommendationCreatedAt,
      },
      recommendation: {
        id: `recommendation-${input.runId}`,
        experiment_run_id: input.runId,
        evidence_pack_id: `pack-${input.runId}`,
        status: input.recommendationStatus,
        created_at: input.recommendationCreatedAt,
      },
    },
  } as const;
}

test("suite operations summary classifies delta by recommendation severity before run status", () => {
  const summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory: [
      createHistoryEntry({
        runId: "run-baseline",
        recommendationCreatedAt: "2026-04-01T00:00:00.000Z",
        recommendationStatus: "needs_review",
        runStatus: "passed",
      }),
      createHistoryEntry({
        runId: "run-latest",
        recommendationCreatedAt: "2026-04-02T00:00:00.000Z",
        recommendationStatus: "recommended",
        runStatus: "failed",
      }),
    ],
  });

  assert.equal(summary.delta?.classification, "better");
  assert.equal(summary.delta?.reason, "recommendation_improved");
});

test("suite operations summary falls back to finalized run status when recommendation severity is flat", () => {
  const summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory: [
      createHistoryEntry({
        runId: "run-baseline",
        recommendationCreatedAt: "2026-04-01T00:00:00.000Z",
        recommendationStatus: "recommended",
        runStatus: "failed",
      }),
      createHistoryEntry({
        runId: "run-latest",
        recommendationCreatedAt: "2026-04-02T00:00:00.000Z",
        recommendationStatus: "recommended",
        runStatus: "passed",
      }),
    ],
  });

  assert.equal(summary.delta?.classification, "better");
  assert.equal(summary.delta?.reason, "finalized_status_improved");
});

test("suite operations summary classifies worse when recommendation severity regresses", () => {
  const summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory: [
      createHistoryEntry({
        runId: "run-baseline",
        recommendationCreatedAt: "2026-04-01T00:00:00.000Z",
        recommendationStatus: "recommended",
        runStatus: "passed",
      }),
      createHistoryEntry({
        runId: "run-latest",
        recommendationCreatedAt: "2026-04-02T00:00:00.000Z",
        recommendationStatus: "rejected",
        runStatus: "passed",
      }),
    ],
  });

  assert.equal(summary.delta?.classification, "worse");
  assert.equal(summary.delta?.reason, "recommendation_regressed");
});

test("suite operations summary classifies flat when recommendation and finalized status are unchanged", () => {
  const summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory: [
      createHistoryEntry({
        runId: "run-baseline",
        recommendationCreatedAt: "2026-04-01T00:00:00.000Z",
        recommendationStatus: "recommended",
        runStatus: "passed",
      }),
      createHistoryEntry({
        runId: "run-latest",
        recommendationCreatedAt: "2026-04-02T00:00:00.000Z",
        recommendationStatus: "recommended",
        runStatus: "passed",
      }),
    ],
  });

  assert.equal(summary.delta?.classification, "flat");
  assert.equal(summary.delta?.reason, "no_material_change");
});

test("suite operations summary clamps the default visible history to the latest 10 by recommendation created_at", () => {
  const finalizedRunHistory = Array.from({ length: 12 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return createHistoryEntry({
      runId: `run-${day}`,
      recommendationCreatedAt: `2026-03-${day}T00:00:00.000Z`,
      recommendationStatus: "recommended",
      runStatus: "passed",
    });
  });

  const summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory,
  });

  assert.equal(summary.windowPreset, "latest_10");
  assert.equal(summary.visibleHistory.length, 10);
  assert.deepEqual(
    summary.visibleHistory.map((entry) => entry.run.id),
    ["run-12", "run-11", "run-10", "run-09", "run-08", "run-07", "run-06", "run-05", "run-04", "run-03"],
  );
  assert.equal(summary.defaultComparison?.selected.run.id, "run-12");
  assert.equal(summary.defaultComparison?.baseline.run.id, "run-11");
});

test("suite operations summary supports latest_10, last_7_days, last_30_days, and all_suite window presets", () => {
  const finalizedRunHistory = [
    createHistoryEntry({
      runId: "run-1-day",
      recommendationCreatedAt: "2026-04-03T00:00:00.000Z",
      recommendationStatus: "recommended",
    }),
    createHistoryEntry({
      runId: "run-5-days",
      recommendationCreatedAt: "2026-03-30T00:00:00.000Z",
      recommendationStatus: "recommended",
    }),
    createHistoryEntry({
      runId: "run-8-days",
      recommendationCreatedAt: "2026-03-27T00:00:00.000Z",
      recommendationStatus: "needs_review",
    }),
    createHistoryEntry({
      runId: "run-20-days",
      recommendationCreatedAt: "2026-03-15T00:00:00.000Z",
      recommendationStatus: "rejected",
    }),
    createHistoryEntry({
      runId: "run-40-days",
      recommendationCreatedAt: "2026-02-23T00:00:00.000Z",
      recommendationStatus: "rejected",
    }),
  ];

  const now = "2026-04-04T00:00:00.000Z";
  const latest10Summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory,
    windowPreset: "latest_10",
    now,
  });
  const last7DaysSummary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory,
    windowPreset: "last_7_days",
    now,
  });
  const last30DaysSummary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory,
    windowPreset: "last_30_days",
    now,
  });
  const allSuiteSummary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory,
    windowPreset: "all_suite",
    now,
  });

  assert.deepEqual(latest10Summary.visibleHistory.map((entry) => entry.run.id), [
    "run-1-day",
    "run-5-days",
    "run-8-days",
    "run-20-days",
    "run-40-days",
  ]);
  assert.deepEqual(last7DaysSummary.visibleHistory.map((entry) => entry.run.id), [
    "run-1-day",
    "run-5-days",
  ]);
  assert.deepEqual(last30DaysSummary.visibleHistory.map((entry) => entry.run.id), [
    "run-1-day",
    "run-5-days",
    "run-8-days",
    "run-20-days",
  ]);
  assert.deepEqual(allSuiteSummary.visibleHistory.map((entry) => entry.run.id), [
    "run-1-day",
    "run-5-days",
    "run-8-days",
    "run-20-days",
    "run-40-days",
  ]);
});

test("suite operations summary keeps range windows deterministic without explicit now", () => {
  const finalizedRunHistory = [
    createHistoryEntry({
      runId: "run-anchor",
      recommendationCreatedAt: "2026-04-03T00:00:00.000Z",
      recommendationStatus: "recommended",
    }),
    createHistoryEntry({
      runId: "run-inside",
      recommendationCreatedAt: "2026-03-30T00:00:00.000Z",
      recommendationStatus: "recommended",
    }),
    createHistoryEntry({
      runId: "run-outside",
      recommendationCreatedAt: "2026-03-20T00:00:00.000Z",
      recommendationStatus: "rejected",
    }),
  ];

  const summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory,
    windowPreset: "last_7_days",
  });

  assert.deepEqual(summary.visibleHistory.map((entry) => entry.run.id), [
    "run-anchor",
    "run-inside",
  ]);
});

test("suite operations summary degrades honestly when fewer than two finalized runs are visible", () => {
  const summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory: [
      createHistoryEntry({
        runId: "run-only",
        recommendationCreatedAt: "2026-04-02T00:00:00.000Z",
        recommendationStatus: "recommended",
      }),
    ],
  });

  assert.equal(summary.defaultComparison, null);
  assert.equal(summary.delta, null);
  assert.equal(summary.emptyState?.kind, "comparison_unavailable");
  assert.equal(summary.emptyState?.reason, "fewer_than_two_visible_finalized_runs");
});

test("suite operations summary computes signals only from the active visible history window", () => {
  const finalizedRunHistory = [
    createHistoryEntry({
      runId: "run-12",
      recommendationCreatedAt: "2026-03-12T00:00:00.000Z",
      recommendationStatus: "recommended",
      evidencePackSummaryStatus: "recommended",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-11",
      recommendationCreatedAt: "2026-03-11T00:00:00.000Z",
      recommendationStatus: "recommended",
      evidencePackSummaryStatus: "recommended",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-10",
      recommendationCreatedAt: "2026-03-10T00:00:00.000Z",
      recommendationStatus: "recommended",
      evidencePackSummaryStatus: "recommended",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-09",
      recommendationCreatedAt: "2026-03-09T00:00:00.000Z",
      recommendationStatus: "recommended",
      evidencePackSummaryStatus: "recommended",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-08",
      recommendationCreatedAt: "2026-03-08T00:00:00.000Z",
      recommendationStatus: "recommended",
      evidencePackSummaryStatus: "recommended",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-07",
      recommendationCreatedAt: "2026-03-07T00:00:00.000Z",
      recommendationStatus: "needs_review",
      evidencePackSummaryStatus: "needs_review",
      regressionSummary: "Regression drift remains unresolved.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-06",
      recommendationCreatedAt: "2026-03-06T00:00:00.000Z",
      recommendationStatus: "needs_review",
      evidencePackSummaryStatus: "needs_review",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "Failure recurrence was observed for hard gate checks.",
    }),
    createHistoryEntry({
      runId: "run-05",
      recommendationCreatedAt: "2026-03-05T00:00:00.000Z",
      recommendationStatus: "rejected",
      evidencePackSummaryStatus: "rejected",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-04",
      recommendationCreatedAt: "2026-03-04T00:00:00.000Z",
      recommendationStatus: "recommended",
      evidencePackSummaryStatus: "recommended",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-03",
      recommendationCreatedAt: "2026-03-03T00:00:00.000Z",
      recommendationStatus: "recommended",
      evidencePackSummaryStatus: "needs_review",
      regressionSummary: "No regression failures were recorded.",
      failureSummary: "No failure annotations were recorded.",
    }),
    createHistoryEntry({
      runId: "run-02-hidden",
      recommendationCreatedAt: "2026-03-02T00:00:00.000Z",
      recommendationStatus: "rejected",
      evidencePackSummaryStatus: "rejected",
      regressionSummary: "Regression failure repeated in hidden run.",
      failureSummary: "Failure spike repeated in hidden run.",
    }),
    createHistoryEntry({
      runId: "run-01-hidden",
      recommendationCreatedAt: "2026-03-01T00:00:00.000Z",
      recommendationStatus: "rejected",
      evidencePackSummaryStatus: "rejected",
      regressionSummary: "Regression failure repeated in hidden run.",
      failureSummary: "Failure spike repeated in hidden run.",
    }),
  ];

  const summary = buildEvaluationWorkbenchSuiteOperationsSummary({
    finalizedRunHistory,
    windowPreset: "latest_10",
  });

  assert.equal(summary.visibleHistory.length, 10);
  assert.deepEqual(summary.signals.recommendationDistribution, {
    recommended: 7,
    needs_review: 2,
    rejected: 1,
  });
  assert.deepEqual(summary.signals.evidencePackOutcomeMix, {
    recommended: 6,
    needs_review: 3,
    rejected: 1,
  });
  assert.equal(summary.signals.recurrence.regressionMentions, 1);
  assert.equal(summary.signals.recurrence.failureMentions, 1);
  assert.equal(summary.signals.recurrence.runsWithRecurrenceSignals, 2);
});
