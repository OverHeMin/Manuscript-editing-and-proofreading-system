import type {
  GovernedExecutionEvidencePack,
  GovernedExecutionHitPosture,
} from "../editorial-execution/types.ts";
import type { LearningCandidateRecord } from "../learning/learning-record.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { ResidualIssueRecord } from "../residual-learning/residual-learning-record.ts";

export type GovernedHitFeedbackCategory =
  | "missed_hit"
  | "incorrect_hit"
  | "missing_knowledge";
export type GovernedHitDecisionSource = "manual_feedback" | "execution_hit";
export type GovernedHitReviewItemStatus =
  | "submitted"
  | "accepted_change_only"
  | "rejected_as_false_positive"
  | "routed_rule_candidate"
  | "routed_knowledge_candidate"
  | "routed_prompt_candidate"
  | "archived_as_evidence_only";
export type ReviewItemSourceKind =
  | "governed_hit"
  | "residual_issue"
  | "learning_candidate";
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

interface ReviewItemBaseRecord {
  id: string;
  source_kind: ReviewItemSourceKind;
  source_status: string;
  review_status: ReviewItemReviewStatus;
  module: LearningCandidateRecord["module"] | ResidualIssueRecord["module"];
  manuscript_id?: string;
  manuscript_type: ManuscriptType;
  snapshot_id?: string;
  title: string;
  summary?: string;
  excerpt?: string;
  source_asset_id?: string;
  location?: Record<string, unknown>;
  risk_level?: ResidualIssueRecord["risk_level"];
  suggestion?: string;
  rationale?: string;
  related_rule_ids?: string[];
  related_knowledge_item_ids?: string[];
  recommended_route?:
    | ResidualIssueRecord["recommended_route"]
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate";
  harness_validation_status?: ResidualIssueRecord["harness_validation_status"];
  origin_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  available_actions: ReviewItemAction[];
}

export interface GovernedHitReviewItemRecord extends ReviewItemBaseRecord {
  source_kind: "governed_hit";
  source_status: GovernedHitReviewItemStatus;
  module: "screening" | "editing" | "proofreading";
  snapshot_id: string;
  candidate_posture?: GovernedExecutionHitPosture;
  decision_source?: GovernedHitDecisionSource;
  evidence_pack?: GovernedExecutionEvidencePack;
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

export interface ResidualReviewItemRecord extends ReviewItemBaseRecord {
  source_kind: "residual_issue";
  source_status: ResidualIssueRecord["status"];
  issue_type: ResidualIssueRecord["issue_type"];
  execution_snapshot_id: ResidualIssueRecord["execution_snapshot_id"];
  snapshot_id: ResidualIssueRecord["execution_snapshot_id"];
  recommended_route: ResidualIssueRecord["recommended_route"];
  harness_validation_status: ResidualIssueRecord["harness_validation_status"];
  learning_candidate_id?: ResidualIssueRecord["learning_candidate_id"];
}

export interface LearningCandidateReviewItemRecord extends ReviewItemBaseRecord {
  source_kind: "learning_candidate";
  source_status: LearningCandidateRecord["status"];
  status: LearningCandidateRecord["status"];
  candidate_type: LearningCandidateRecord["type"];
  type: LearningCandidateRecord["type"];
  governed_provenance_kind?: LearningCandidateRecord["governed_provenance_kind"];
  proposal_text?: LearningCandidateRecord["proposal_text"];
  candidate_payload?: LearningCandidateRecord["candidate_payload"];
  suggested_rule_object?: LearningCandidateRecord["suggested_rule_object"];
  suggested_template_family_id?: LearningCandidateRecord["suggested_template_family_id"];
  suggested_journal_template_id?: LearningCandidateRecord["suggested_journal_template_id"];
  created_by: LearningCandidateRecord["created_by"];
  review_actions?: LearningCandidateRecord["review_actions"];
}

export type ReviewItemRecord =
  | GovernedHitReviewItemRecord
  | ResidualReviewItemRecord
  | LearningCandidateReviewItemRecord;

export interface ReviewItemDecisionResult {
  action: ReviewItemAction;
  item: ReviewItemRecord | null;
}
