import type { DocumentAssetId, ManuscriptType } from "./manuscript.js";
import type { ManuscriptModule } from "./assets.js";

export type LearningRunId = string;
export type LearningCandidateId = string;

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

export interface LearningRun {
  id: LearningRunId;
  started_at: string;
  finished_at?: string;
}

export interface LearningCandidate {
  id: LearningCandidateId;
  type: LearningCandidateType;
  status: LearningCandidateStatus;

  module: ManuscriptModule;
  manuscript_type: ManuscriptType;

  // Evidence chain inputs; at least one should exist for a real candidate.
  human_final_asset_id?: DocumentAssetId;
  annotated_asset_id?: DocumentAssetId;
  snapshot_asset_id?: DocumentAssetId;

  // Candidate content is intentionally flexible in V1.
  title?: string;
  proposal_text?: string;

  created_at?: string;
}
