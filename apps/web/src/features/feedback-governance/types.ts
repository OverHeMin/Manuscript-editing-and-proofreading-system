import type { TemplateModule } from "../templates/types.ts";

export type HumanFeedbackType =
  | "manual_confirmation"
  | "manual_correction"
  | "manual_rejection";

export interface HumanFeedbackRecordViewModel {
  id: string;
  manuscript_id: string;
  module: TemplateModule;
  snapshot_id: string;
  feedback_type: HumanFeedbackType;
  feedback_text?: string;
  created_by: string;
  created_at: string;
}

export interface LearningCandidateSourceLinkViewModel {
  id: string;
  learning_candidate_id: string;
  snapshot_id: string;
  feedback_record_id: string;
  source_asset_id: string;
  created_at: string;
}

export interface RecordHumanFeedbackInput {
  manuscriptId: string;
  module: TemplateModule;
  snapshotId: string;
  feedbackType: HumanFeedbackType;
  feedbackText?: string;
  createdBy: string;
}

export interface LinkLearningCandidateSourceInput {
  learningCandidateId: string;
  snapshotId: string;
  feedbackRecordId: string;
  sourceAssetId: string;
}
