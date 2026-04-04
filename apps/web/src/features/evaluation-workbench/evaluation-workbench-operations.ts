import type { EvaluationWorkbenchFinalizedRunHistoryEntry } from "./evaluation-workbench-controller.ts";
import type { EvaluationDecisionStatus, EvaluationRunStatus } from "../verification-ops/types.ts";

export type EvaluationWorkbenchHistoryWindowPreset =
  | "latest_10"
  | "last_7_days"
  | "last_30_days"
  | "all_suite";

export type EvaluationWorkbenchDeltaClassification = "better" | "worse" | "flat";

export type EvaluationWorkbenchDeltaReason =
  | "recommendation_improved"
  | "recommendation_regressed"
  | "finalized_status_improved"
  | "finalized_status_regressed"
  | "no_material_change";

export interface EvaluationWorkbenchComparisonPair {
  selected: EvaluationWorkbenchFinalizedRunHistoryEntry;
  baseline: EvaluationWorkbenchFinalizedRunHistoryEntry;
}

export interface EvaluationWorkbenchSuiteOperationsDelta {
  classification: EvaluationWorkbenchDeltaClassification;
  reason: EvaluationWorkbenchDeltaReason;
}

export interface EvaluationWorkbenchSuiteOperationsEmptyState {
  kind: "comparison_unavailable";
  reason: "fewer_than_two_visible_finalized_runs" | "insufficient_comparison_data";
}

export interface EvaluationWorkbenchSuiteOperationsSignals {
  recommendationDistribution: Record<EvaluationDecisionStatus, number>;
  evidencePackOutcomeMix: Record<EvaluationDecisionStatus, number>;
  recurrence: {
    regressionMentions: number;
    failureMentions: number;
    runsWithRecurrenceSignals: number;
  };
}

export interface EvaluationWorkbenchSuiteOperationsSummary {
  windowPreset: EvaluationWorkbenchHistoryWindowPreset;
  orderedHistory: EvaluationWorkbenchFinalizedRunHistoryEntry[];
  visibleHistory: EvaluationWorkbenchFinalizedRunHistoryEntry[];
  defaultComparison: EvaluationWorkbenchComparisonPair | null;
  delta: EvaluationWorkbenchSuiteOperationsDelta | null;
  emptyState: EvaluationWorkbenchSuiteOperationsEmptyState | null;
  signals: EvaluationWorkbenchSuiteOperationsSignals;
}

const recommendationSeverityRank: Record<EvaluationDecisionStatus, number> = {
  rejected: 0,
  needs_review: 1,
  recommended: 2,
};

const finalizedStatusRank: Partial<Record<EvaluationRunStatus, number>> = {
  failed: 0,
  passed: 1,
};

const msPerDay = 24 * 60 * 60 * 1000;

export function getRecommendationSeverity(status: string): number | null {
  if (status === "recommended") return recommendationSeverityRank.recommended;
  if (status === "needs_review") return recommendationSeverityRank.needs_review;
  if (status === "rejected") return recommendationSeverityRank.rejected;
  return null;
}

export function selectDefaultHistoryWindowPreset(
  windowPreset?: EvaluationWorkbenchHistoryWindowPreset,
): EvaluationWorkbenchHistoryWindowPreset {
  return windowPreset ?? "latest_10";
}

export function sortFinalizedHistoryByRecommendationCreatedAt(
  finalizedRunHistory: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[],
): EvaluationWorkbenchFinalizedRunHistoryEntry[] {
  return [...finalizedRunHistory].sort((left, right) => {
    const timestampDelta =
      getCreatedAtEpochMs(right.finalized.recommendation.created_at) -
      getCreatedAtEpochMs(left.finalized.recommendation.created_at);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }
    return right.run.id.localeCompare(left.run.id);
  });
}

export function filterVisibleHistoryByWindowPreset(input: {
  orderedHistory: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[];
  windowPreset: EvaluationWorkbenchHistoryWindowPreset;
  now?: string | Date;
}): EvaluationWorkbenchFinalizedRunHistoryEntry[] {
  const { orderedHistory, windowPreset } = input;

  if (windowPreset === "latest_10") {
    return [...orderedHistory].slice(0, 10);
  }

  if (windowPreset === "all_suite") {
    return [...orderedHistory];
  }

  const days = windowPreset === "last_7_days" ? 7 : 30;
  const nowEpochMs = resolveWindowAnchorEpochMs({
    now: input.now,
    orderedHistory,
  });
  const cutoffEpochMs = nowEpochMs - days * msPerDay;

  return orderedHistory.filter(
    (entry) => getCreatedAtEpochMs(entry.finalized.recommendation.created_at) >= cutoffEpochMs,
  );
}

export function selectDefaultComparisonPair(
  visibleHistory: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[],
): EvaluationWorkbenchComparisonPair | null {
  const selected = visibleHistory[0];
  const baseline = visibleHistory[1];
  if (!selected || !baseline) return null;
  return { selected, baseline };
}

export function classifyDeterministicDelta(
  pair: EvaluationWorkbenchComparisonPair | null,
): EvaluationWorkbenchSuiteOperationsDelta | null {
  if (!pair) return null;

  const selectedRecommendationSeverity = getRecommendationSeverity(
    pair.selected.finalized.recommendation.status,
  );
  const baselineRecommendationSeverity = getRecommendationSeverity(
    pair.baseline.finalized.recommendation.status,
  );

  if (
    selectedRecommendationSeverity == null ||
    baselineRecommendationSeverity == null
  ) {
    return null;
  }

  if (selectedRecommendationSeverity !== baselineRecommendationSeverity) {
    return selectedRecommendationSeverity > baselineRecommendationSeverity
      ? {
          classification: "better",
          reason: "recommendation_improved",
        }
      : {
          classification: "worse",
          reason: "recommendation_regressed",
        };
  }

  const selectedRunStatusRank = finalizedStatusRank[pair.selected.run.status];
  const baselineRunStatusRank = finalizedStatusRank[pair.baseline.run.status];

  if (selectedRunStatusRank == null || baselineRunStatusRank == null) {
    return null;
  }

  if (selectedRunStatusRank !== baselineRunStatusRank) {
    return selectedRunStatusRank > baselineRunStatusRank
      ? {
          classification: "better",
          reason: "finalized_status_improved",
        }
      : {
          classification: "worse",
          reason: "finalized_status_regressed",
        };
  }

  return {
    classification: "flat",
    reason: "no_material_change",
  };
}

export function summarizeVisibleWindowSignals(
  visibleHistory: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[],
): EvaluationWorkbenchSuiteOperationsSignals {
  const recommendationDistribution: Record<EvaluationDecisionStatus, number> = {
    recommended: 0,
    needs_review: 0,
    rejected: 0,
  };
  const evidencePackOutcomeMix: Record<EvaluationDecisionStatus, number> = {
    recommended: 0,
    needs_review: 0,
    rejected: 0,
  };

  let regressionMentions = 0;
  let failureMentions = 0;
  let runsWithRecurrenceSignals = 0;

  for (const entry of visibleHistory) {
    recommendationDistribution[entry.finalized.recommendation.status] += 1;
    evidencePackOutcomeMix[entry.finalized.evidence_pack.summary_status] += 1;

    const hasRegressionMention = hasMeaningfulRegressionMention(
      entry.finalized.evidence_pack.regression_summary,
    );
    const hasFailureMention = hasMeaningfulFailureMention(
      entry.finalized.evidence_pack.failure_summary,
    );

    if (hasRegressionMention) {
      regressionMentions += 1;
    }
    if (hasFailureMention) {
      failureMentions += 1;
    }
    if (hasRegressionMention || hasFailureMention) {
      runsWithRecurrenceSignals += 1;
    }
  }

  return {
    recommendationDistribution,
    evidencePackOutcomeMix,
    recurrence: {
      regressionMentions,
      failureMentions,
      runsWithRecurrenceSignals,
    },
  };
}

export function buildEvaluationWorkbenchSuiteOperationsSummary(input: {
  finalizedRunHistory: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[];
  windowPreset?: EvaluationWorkbenchHistoryWindowPreset;
  now?: string | Date;
}): EvaluationWorkbenchSuiteOperationsSummary {
  const windowPreset = selectDefaultHistoryWindowPreset(input.windowPreset);
  const orderedHistory = sortFinalizedHistoryByRecommendationCreatedAt(
    input.finalizedRunHistory,
  );
  const visibleHistory = filterVisibleHistoryByWindowPreset({
    orderedHistory,
    windowPreset,
    now: input.now,
  });
  const defaultComparison = selectDefaultComparisonPair(visibleHistory);
  const delta = classifyDeterministicDelta(defaultComparison);
  const emptyState =
    defaultComparison != null
      ? delta == null
        ? {
            kind: "comparison_unavailable" as const,
            reason: "insufficient_comparison_data" as const,
          }
        : null
      : {
          kind: "comparison_unavailable" as const,
          reason: "fewer_than_two_visible_finalized_runs" as const,
        };

  return {
    windowPreset,
    orderedHistory,
    visibleHistory,
    defaultComparison,
    delta,
    emptyState,
    signals: summarizeVisibleWindowSignals(visibleHistory),
  };
}

function getCreatedAtEpochMs(createdAt: string | undefined): number {
  if (!createdAt) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) return Number.NEGATIVE_INFINITY;
  return parsed;
}

function resolveWindowAnchorEpochMs(input: {
  now?: string | Date;
  orderedHistory: readonly EvaluationWorkbenchFinalizedRunHistoryEntry[];
}): number {
  const explicitNowEpochMs = resolveExplicitNowEpochMs(input.now);
  if (explicitNowEpochMs != null) {
    return explicitNowEpochMs;
  }

  let latestHistoryEpochMs = Number.NEGATIVE_INFINITY;
  for (const entry of input.orderedHistory) {
    const epochMs = getCreatedAtEpochMs(entry.finalized.recommendation.created_at);
    if (epochMs > latestHistoryEpochMs) {
      latestHistoryEpochMs = epochMs;
    }
  }

  return latestHistoryEpochMs;
}

function resolveExplicitNowEpochMs(now?: string | Date): number | null {
  if (now instanceof Date) {
    return now.getTime();
  }
  if (typeof now === "string") {
    const parsed = Date.parse(now);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function hasMeaningfulRegressionMention(summary: string | undefined): boolean {
  if (!summary) return false;
  const normalized = summary.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("no regression failures were recorded")) return false;
  return normalized.includes("regression");
}

function hasMeaningfulFailureMention(summary: string | undefined): boolean {
  if (!summary) return false;
  const normalized = summary.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("no failure annotations were recorded")) return false;
  return normalized.includes("failure");
}
