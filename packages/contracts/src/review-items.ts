import type { ManuscriptModule } from "./assets.js";
import type {
  DocumentAssetId,
  JournalTemplateId,
  ManuscriptId,
  ManuscriptType,
  TemplateFamilyId,
  UserId,
} from "./manuscript.js";
import type {
  LearningCandidateStatus,
  LearningCandidateType,
} from "./learning.js";
import type {
  ResidualHarnessValidationStatus,
  ResidualIssueRoute,
  ResidualIssueRiskLevel,
  ResidualIssueStatus,
} from "./residual-learning.js";

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
export type ReviewItemReviewAction =
  | "submitted_for_review"
  | "approved"
  | "rejected";

interface ReviewItemBase {
  id: string;
  source_kind: ReviewItemSourceKind;
  source_status: string;
  review_status: ReviewItemReviewStatus;
  module: ManuscriptModule;
  manuscript_id?: ManuscriptId;
  manuscript_type: ManuscriptType;
  snapshot_id?: string;
  title: string;
  summary?: string;
  excerpt?: string;
  source_asset_id?: DocumentAssetId;
  location?: Record<string, unknown>;
  risk_level?: ResidualIssueRiskLevel;
  suggestion?: string;
  rationale?: string;
  related_rule_ids?: string[];
  related_knowledge_item_ids?: string[];
  recommended_route?:
    | ResidualIssueRoute
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate";
  harness_validation_status?: ResidualHarnessValidationStatus | "not_required";
  origin_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  available_actions: ReviewItemAction[];
}

export interface GovernedHitReviewItem extends ReviewItemBase {
  source_kind: "governed_hit";
  source_status: GovernedHitReviewItemStatus;
  module: "screening" | "editing" | "proofreading";
  snapshot_id: string;
  feedback_category: GovernedHitFeedbackCategory;
  feedback_record_id?: string;
  recommended_route:
    | "rule_candidate"
    | "knowledge_candidate"
    | "prompt_template_candidate";
  harness_validation_status: "not_required";
  created_by: UserId;
  learning_candidate_id?: string;
}

export interface ResidualReviewItem extends ReviewItemBase {
  source_kind: "residual_issue";
  source_status: ResidualIssueStatus;
  issue_type: string;
  execution_snapshot_id: string;
  recommended_route: ResidualIssueRoute;
  harness_validation_status: ResidualHarnessValidationStatus;
  learning_candidate_id?: string;
}

export interface ReviewItemAuditAction {
  action: ReviewItemReviewAction;
  actor_role: string;
  review_note?: string;
  created_at: string;
}

export interface LearningCandidateReviewItem extends ReviewItemBase {
  source_kind: "learning_candidate";
  source_status: LearningCandidateStatus;
  status: LearningCandidateStatus;
  candidate_type: LearningCandidateType;
  type: LearningCandidateType;
  governed_provenance_kind?: string;
  proposal_text?: string;
  candidate_payload?: Record<string, unknown>;
  suggested_rule_object?: string;
  suggested_template_family_id?: TemplateFamilyId;
  suggested_journal_template_id?: JournalTemplateId;
  created_by: UserId;
  review_actions?: readonly ReviewItemAuditAction[];
}

export type ReviewItem =
  | GovernedHitReviewItem
  | ResidualReviewItem
  | LearningCandidateReviewItem;

export interface ReviewItemDecisionResult {
  action: ReviewItemAction;
  item: ReviewItem | null;
}
