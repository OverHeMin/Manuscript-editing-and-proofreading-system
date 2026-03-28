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
  human_final_asset_id?: string;
  annotated_asset_id?: string;
  snapshot_asset_id?: string;
  title?: string;
  proposal_text?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
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

export interface ApproveLearningCandidateInput {
  candidateId: string;
  actorRole: AuthRole;
}
