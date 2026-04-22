import type { LearningCandidateStatus, LearningCandidateViewModel } from "../learning-review/types.ts";

export type GovernedHitFeedbackCategory =
  | "missed_hit"
  | "incorrect_hit"
  | "missing_knowledge";
export type GovernedHitReviewItemStatus =
  | "submitted"
  | "accepted_change_only"
  | "rejected_as_false_positive"
  | "routed_rule_candidate"
  | "routed_knowledge_candidate"
  | "routed_prompt_candidate"
  | "archived_as_evidence_only";
export type ReviewItemReviewStatus = "pending" | "decided" | "routed";
export type ReviewItemAction =
  | "validate"
  | "accept_change_only"
  | "reject_as_false_positive"
  | "route_to_rule_candidate"
  | "route_to_knowledge_candidate"
  | "route_to_prompt_candidate"
  | "archive_as_evidence_only"
  | "approve"
  | "reject";

interface ReviewItemBaseViewModel {
  id: string;
  source_kind: "governed_hit" | "residual_issue" | "learning_candidate";
  source_status: string;
  review_status: ReviewItemReviewStatus;
  module: string;
  manuscript_id?: string;
  manuscript_type: string;
  snapshot_id?: string;
  title: string;
  summary?: string;
  excerpt?: string;
  source_asset_id?: string;
  location?: Record<string, unknown>;
  risk_level?: "low" | "medium" | "high" | "critical";
  suggestion?: string;
  rationale?: string;
  related_rule_ids?: string[];
  related_knowledge_item_ids?: string[];
  recommended_route?:
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate"
    | "manual_only"
    | "evidence_only";
  harness_validation_status?: "not_required" | "queued" | "passed" | "failed";
  origin_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  available_actions: ReviewItemAction[];
}

export interface GovernedHitReviewItemViewModel extends ReviewItemBaseViewModel {
  source_kind: "governed_hit";
  source_status: GovernedHitReviewItemStatus;
  module: "screening" | "editing" | "proofreading";
  snapshot_id: string;
  candidate_posture?: "candidate_change" | "inspect_only";
  decision_source?: "manual_feedback" | "execution_hit";
  evidence_pack?: {
    location?: Record<string, unknown>;
    excerpt?: string;
    suggestion?: string;
    rationale?: string;
  };
  feedback_category: GovernedHitFeedbackCategory;
  feedback_record_id?: string;
  recommended_route:
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate";
  harness_validation_status: "not_required";
  created_by: string;
  learning_candidate_id?: string;
}

export interface ResidualReviewItemViewModel extends ReviewItemBaseViewModel {
  source_kind: "residual_issue";
  source_status:
    | "observed"
    | "validation_pending"
    | "candidate_ready"
    | "validation_failed"
    | "manual_only"
    | "evidence_only"
    | "candidate_created"
    | "archived";
  issue_type: string;
  execution_snapshot_id: string;
  recommended_route:
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate"
    | "manual_only"
    | "evidence_only";
  harness_validation_status: "not_required" | "queued" | "passed" | "failed";
  learning_candidate_id?: string;
}

export type LearningCandidateReviewItemViewModel = LearningCandidateViewModel & {
  source_kind: "learning_candidate";
  source_status: LearningCandidateStatus;
  review_status: ReviewItemReviewStatus;
  available_actions: ReviewItemAction[];
  summary?: string;
  snapshot_id?: string;
  source_asset_id?: string;
  risk_level?: "low" | "medium" | "high" | "critical";
  candidate_type: LearningCandidateViewModel["type"];
  recommended_route?:
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate";
  origin_payload?: Record<string, unknown>;
};

export type ReviewItemViewModel =
  | GovernedHitReviewItemViewModel
  | ResidualReviewItemViewModel
  | LearningCandidateReviewItemViewModel;

export interface ReviewItemDecisionResultViewModel {
  action: ReviewItemAction;
  item: ReviewItemViewModel | null;
}

export function formatResidualReviewSourceStatusLabel(
  status: ResidualReviewItemViewModel["source_status"],
): string {
  switch (status) {
    case "observed":
      return "已发现残差";
    case "validation_pending":
      return "Harness 待复验";
    case "candidate_ready":
      return "候选已就绪";
    case "validation_failed":
      return "Harness 未通过";
    case "manual_only":
      return "仅人工处理";
    case "evidence_only":
      return "只保留证据";
    case "candidate_created":
      return "已生成候选";
    case "archived":
      return "已归档";
  }
}

export function isLearningCandidateReviewItem(
  item: ReviewItemViewModel | null | undefined,
): item is LearningCandidateReviewItemViewModel {
  return item?.source_kind === "learning_candidate";
}

export function isGovernedHitReviewItem(
  item: ReviewItemViewModel | null | undefined,
): item is GovernedHitReviewItemViewModel {
  return item?.source_kind === "governed_hit";
}

export function isResidualReviewItem(
  item: ReviewItemViewModel | null | undefined,
): item is ResidualReviewItemViewModel {
  return item?.source_kind === "residual_issue";
}
