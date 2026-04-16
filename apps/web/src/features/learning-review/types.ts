import type { AuthRole } from "../auth/roles.ts";
import type { LearningWritebackViewModel } from "../learning-governance/types.ts";

export type LearningCandidateType =
  | "rule_candidate"
  | "case_pattern_candidate"
  | "template_update_candidate"
  | "prompt_optimization_candidate"
  | "checklist_update_candidate"
  | "skill_update_candidate";

export type LearningCandidateStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";

export type LearningCandidateGovernedProvenanceKind =
  | "human_feedback"
  | "evaluation_experiment"
  | "reviewed_case_snapshot";

export type LearningCandidateReviewAction =
  | "submitted_for_review"
  | "approved"
  | "rejected";

export interface LearningCandidateReviewActionViewModel {
  action: LearningCandidateReviewAction;
  actor_role: AuthRole;
  review_note?: string;
  created_at: string;
}

export interface ReviewedCaseSnapshotViewModel {
  id: string;
  manuscript_id: string;
  module: string;
  manuscript_type: string;
  human_final_asset_id: string;
  deidentification_passed: boolean;
  annotated_asset_id?: string;
  snapshot_asset_id: string;
  created_by: string;
  created_at: string;
}

export interface LearningCandidateViewModel {
  id: string;
  type: LearningCandidateType;
  status: LearningCandidateStatus;
  module: string;
  manuscript_type: string;
  governed_provenance_kind?: LearningCandidateGovernedProvenanceKind;
  governed_feedback_record_id?: string;
  governed_evaluation_run_id?: string;
  governed_evidence_pack_id?: string;
  human_final_asset_id?: string;
  annotated_asset_id?: string;
  snapshot_asset_id?: string;
  title?: string;
  proposal_text?: string;
  candidate_payload?: Record<string, unknown>;
  suggested_rule_object?: string;
  suggested_template_family_id?: string;
  suggested_journal_template_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  review_actions?: readonly LearningCandidateReviewActionViewModel[];
  // Admin workbench can render approval state and governed writebacks from one payload.
  writeback_summaries?: LearningWritebackViewModel[];
}

export interface CreateReviewedCaseSnapshotInput {
  manuscriptId: string;
  module: string;
  manuscriptType: string;
  humanFinalAssetId: string;
  deidentificationPassed: boolean;
  annotatedAssetId?: string;
  requestedBy: string;
  storageKey: string;
}

export interface CreateLearningCandidateInput {
  snapshotId: string;
  type: LearningCandidateType;
  title?: string;
  proposalText?: string;
  requestedBy: string;
  deidentificationPassed: boolean;
}

export interface CreateGovernedLearningCandidateInput
  extends CreateLearningCandidateInput {
  governedSource: {
    sourceKind: "evaluation_experiment";
    reviewedCaseSnapshotId: string;
    evaluationRunId: string;
    evidencePackId: string;
    sourceAssetId: string;
  };
}

export interface ApproveLearningCandidateInput {
  candidateId: string;
  actorRole: AuthRole;
  reviewNote?: string;
}

export interface RejectLearningCandidateInput {
  candidateId: string;
  actorRole: AuthRole;
  reviewNote?: string;
}
