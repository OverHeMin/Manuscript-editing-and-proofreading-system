import type {
  EvaluationDecisionStatus,
  EvaluationRunItemRecord,
  EvaluationRunRecord,
  EvaluationSuiteRecord,
} from "./verification-ops-record.ts";

export interface EvaluationRunOutcomeSummary {
  summaryStatus: EvaluationDecisionStatus;
  scoreSummary: string;
  regressionSummary: string;
  failureSummary: string;
  costSummary: string;
  latencySummary: string;
  recommendationStatus: EvaluationDecisionStatus;
  decisionReason: string;
}

export function summarizeEvaluationRun(input: {
  run: EvaluationRunRecord;
  suite: EvaluationSuiteRecord;
  runItems: EvaluationRunItemRecord[];
}): EvaluationRunOutcomeSummary {
  const regressionFailures = input.runItems.filter(
    (item) => item.failure_kind === "regression_failed",
  );
  const failedHardGates = input.runItems.filter(
    (item) => item.hard_gate_passed === false,
  );
  const incompleteItems = input.runItems.filter(
    (item) =>
      item.hard_gate_passed === undefined || item.weighted_score === undefined,
  );
  const scoredItems = input.runItems.filter(
    (item) => typeof item.weighted_score === "number",
  );

  if (regressionFailures.length > 0 || failedHardGates.length > 0) {
    return {
      summaryStatus: "rejected",
      scoreSummary: buildScoreSummary(scoredItems),
      regressionSummary: `${regressionFailures.length} regression-failed item(s) detected.`,
      failureSummary: buildFailureSummary(input.runItems),
      costSummary: "Cost tracking is not recorded in Phase 6A v1.",
      latencySummary: "Latency tracking is not recorded in Phase 6A v1.",
      recommendationStatus: "rejected",
      decisionReason:
        "Run contains regression failures or hard-gate violations against the frozen baseline.",
    };
  }

  if (input.runItems.length === 0 || incompleteItems.length > 0) {
    return {
      summaryStatus: "needs_review",
      scoreSummary: buildScoreSummary(scoredItems),
      regressionSummary: "No explicit regression failures were recorded.",
      failureSummary: buildFailureSummary(input.runItems),
      costSummary: "Cost tracking is not recorded in Phase 6A v1.",
      latencySummary: "Latency tracking is not recorded in Phase 6A v1.",
      recommendationStatus: "needs_review",
      decisionReason:
        "Run scoring is incomplete, so human review is required before any recommendation.",
    };
  }

  return {
    summaryStatus: "recommended",
    scoreSummary: buildScoreSummary(scoredItems),
    regressionSummary: "No regression failures were recorded.",
    failureSummary: buildFailureSummary(input.runItems),
    costSummary: "Cost tracking is not recorded in Phase 6A v1.",
    latencySummary: "Latency tracking is not recorded in Phase 6A v1.",
    recommendationStatus: "recommended",
    decisionReason:
      "All run items passed hard gates and completed scoring without recorded regressions.",
  };
}

function buildScoreSummary(items: EvaluationRunItemRecord[]): string {
  if (items.length === 0) {
    return "No weighted scores were recorded.";
  }

  const total = items.reduce(
    (sum, item) => sum + (item.weighted_score ?? 0),
    0,
  );
  const average = total / items.length;
  return `Average weighted score ${average.toFixed(1)} across ${items.length} item(s).`;
}

function buildFailureSummary(items: EvaluationRunItemRecord[]): string {
  const failures = items.filter(
    (item) =>
      item.failure_kind || item.failure_reason || item.hard_gate_passed === false,
  );
  if (failures.length === 0) {
    return "No failure annotations were recorded.";
  }

  return failures
    .map((item) => item.failure_reason ?? item.failure_kind ?? "hard_gate_failed")
    .join(" | ");
}
