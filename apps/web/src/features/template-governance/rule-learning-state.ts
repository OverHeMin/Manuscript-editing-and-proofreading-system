import type { LearningWritebackViewModel } from "../learning-governance/types.ts";
import type { ReviewItemViewModel } from "../review-items/types.ts";

export interface RuleLearningReviewFilters {
  sourceKind?: ReviewItemViewModel["source_kind"] | "all";
  module?: string;
  manuscriptId?: string;
  riskLevel?: Exclude<ReviewItemViewModel["risk_level"], undefined> | "all";
  reviewStatus?: ReviewItemViewModel["review_status"] | "all";
}

export function createDefaultRuleLearningReviewFilters(input: {
  manuscriptId?: string;
} = {}): RuleLearningReviewFilters {
  return {
    sourceKind: "all",
    module: "all",
    manuscriptId: input.manuscriptId?.trim() ?? "",
    riskLevel: "all",
    reviewStatus: "all",
  };
}

export function filterRuleLearningReviewItems(
  items: readonly ReviewItemViewModel[],
  filters: RuleLearningReviewFilters = {},
): ReviewItemViewModel[] {
  const normalizedManuscriptId = filters.manuscriptId?.trim() ?? "";

  return items.filter((item) => {
    if (!isRuleCenterReviewItem(item)) {
      return false;
    }

    if (filters.sourceKind && filters.sourceKind !== "all" && item.source_kind !== filters.sourceKind) {
      return false;
    }

    if (filters.module && filters.module !== "all" && item.module !== filters.module) {
      return false;
    }

    if (normalizedManuscriptId.length > 0 && item.manuscript_id !== normalizedManuscriptId) {
      return false;
    }

    if (filters.riskLevel && filters.riskLevel !== "all" && item.risk_level !== filters.riskLevel) {
      return false;
    }

    if (
      filters.reviewStatus &&
      filters.reviewStatus !== "all" &&
      item.review_status !== filters.reviewStatus
    ) {
      return false;
    }

    return true;
  });
}

export function isRuleCenterReviewItem(item: ReviewItemViewModel): boolean {
  if (item.source_kind === "governed_hit") {
    return true;
  }

  if (item.source_kind === "residual_issue") {
    return item.recommended_route === "rule_candidate";
  }

  return item.type === "rule_candidate";
}

export function resolveEditorialRuleDraftWriteback(
  writebacks: readonly LearningWritebackViewModel[],
): LearningWritebackViewModel | null {
  const matches = writebacks
    .filter((writeback) => writeback.target_type === "editorial_rule_draft")
    .sort(compareEditorialRuleDraftWritebacks);

  return matches[0] ?? null;
}

function compareEditorialRuleDraftWritebacks(
  left: LearningWritebackViewModel,
  right: LearningWritebackViewModel,
): number {
  if (left.status !== right.status) {
    return readWritebackStatusPriority(right.status) - readWritebackStatusPriority(left.status);
  }

  if (left.applied_at !== right.applied_at) {
    return (right.applied_at ?? "").localeCompare(left.applied_at ?? "");
  }

  if (left.created_at !== right.created_at) {
    return right.created_at.localeCompare(left.created_at);
  }

  return right.id.localeCompare(left.id);
}

function readWritebackStatusPriority(status: LearningWritebackViewModel["status"]): number {
  switch (status) {
    case "applied":
      return 2;
    case "draft":
      return 1;
    case "archived":
    default:
      return 0;
  }
}
