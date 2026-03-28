import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { ManuscriptModule } from "../jobs/job-record.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";

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

export interface ReviewedCaseSnapshotRecord {
  id: string;
  manuscript_id: string;
  module: ManuscriptModule;
  manuscript_type: ManuscriptType;
  human_final_asset_id: string;
  deidentification_passed: boolean;
  annotated_asset_id?: string;
  snapshot_asset_id: string;
  created_by: string;
  created_at: string;
}

export interface LearningCandidateRecord {
  id: string;
  type: LearningCandidateType;
  status: LearningCandidateStatus;
  module: ManuscriptModule;
  manuscript_type: ManuscriptType;
  human_final_asset_id?: DocumentAssetRecord["id"];
  annotated_asset_id?: DocumentAssetRecord["id"];
  snapshot_asset_id?: DocumentAssetRecord["id"];
  title?: string;
  proposal_text?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
