import type { UserId } from "./manuscript.js";
import type { LearningCandidateId } from "./learning.js";

export type LearningWritebackId = string;

export type LearningWritebackTarget =
  | "knowledge_item"
  | "module_template"
  | "prompt_template"
  | "skill_package"
  | "editorial_rule_draft";

export type LearningWritebackStatus = "draft" | "applied" | "archived";

export interface LearningWriteback {
  id: LearningWritebackId;
  learning_candidate_id: LearningCandidateId;
  target_type: LearningWritebackTarget;
  status: LearningWritebackStatus;
  target_asset_id?: string;
  created_draft_asset_id?: string;
  created_by?: UserId;
  applied_by?: UserId;
  created_at?: string;
  applied_at?: string;
}
