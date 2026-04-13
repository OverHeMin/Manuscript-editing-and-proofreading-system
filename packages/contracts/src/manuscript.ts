export type ManuscriptId = string;
export type UserId = string;
export type TemplateFamilyId = string;
export type JournalTemplateId = string;
export type DocumentAssetId = string;

export const MAX_MANUSCRIPT_BATCH_UPLOAD_COUNT = 10;

// Lifecycle per docs/superpowers/specs/01-domain-model-and-lifecycle.md
export type ManuscriptStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "awaiting_review"
  | "completed"
  | "archived";

// Fixed type set per docs/superpowers/specs/2026-03-25-medical-manuscript-system-v1-design.md
export type ManuscriptType =
  | "clinical_study"
  | "review"
  | "systematic_review"
  | "meta_analysis"
  | "case_report"
  | "guideline_interpretation"
  | "expert_consensus"
  | "diagnostic_study"
  | "basic_research"
  | "nursing_study"
  | "methodology_paper"
  | "brief_report"
  | "other";

export type ManuscriptTypeDetectionSource = "ai" | "heuristic";

export interface ManuscriptTypeDetectionSummary {
  detected_type: ManuscriptType;
  final_type: ManuscriptType;
  source: ManuscriptTypeDetectionSource;
  confidence: number;
  matched_signals?: string[];
}

export interface Manuscript {
  id: ManuscriptId;
  title: string;
  manuscript_type: ManuscriptType;
  manuscript_type_detection_summary?: ManuscriptTypeDetectionSummary;
  status: ManuscriptStatus;
  created_by: UserId;
  current_screening_asset_id?: DocumentAssetId;
  current_editing_asset_id?: DocumentAssetId;
  current_proofreading_asset_id?: DocumentAssetId;
  current_template_family_id?: TemplateFamilyId;
  current_journal_template_id?: JournalTemplateId;
}
