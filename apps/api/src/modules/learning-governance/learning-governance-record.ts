export type LearningWritebackTarget =
  | "knowledge_item"
  | "module_template"
  | "prompt_template"
  | "skill_package";

export type LearningWritebackStatus = "draft" | "applied" | "archived";

export interface LearningWritebackRecord {
  id: string;
  learning_candidate_id: string;
  target_type: LearningWritebackTarget;
  status: LearningWritebackStatus;
  created_draft_asset_id?: string;
  created_by: string;
  created_at: string;
  applied_by?: string;
  applied_at?: string;
}
