export type ManuscriptStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "awaiting_review"
  | "completed"
  | "archived";

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

export type DocumentAssetType =
  | "original"
  | "normalized_docx"
  | "screening_report"
  | "edited_docx"
  | "proofreading_draft_report"
  | "final_proof_issue_report"
  | "final_proof_annotated_docx"
  | "pdf_consistency_report"
  | "human_final_docx"
  | "learning_snapshot_attachment";

export type ManuscriptModule =
  | "upload"
  | "screening"
  | "editing"
  | "proofreading"
  | "pdf_consistency"
  | "learning"
  | "manual";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ManuscriptViewModel {
  id: string;
  title: string;
  manuscript_type: ManuscriptType;
  status: ManuscriptStatus;
  created_by: string;
  current_screening_asset_id?: string;
  current_editing_asset_id?: string;
  current_proofreading_asset_id?: string;
  current_template_family_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentAssetViewModel {
  id: string;
  manuscript_id: string;
  asset_type: DocumentAssetType;
  status: "created" | "active" | "superseded" | "archived";
  storage_key: string;
  mime_type: string;
  parent_asset_id?: string;
  source_module: ManuscriptModule;
  source_job_id?: string;
  created_by: string;
  version_no: number;
  is_current: boolean;
  file_name?: string;
  created_at: string;
  updated_at: string;
}

export interface JobViewModel {
  id: string;
  manuscript_id?: string;
  module: ManuscriptModule;
  job_type: string;
  status: JobStatus;
  requested_by: string;
  payload?: Record<string, unknown>;
  attempt_count: number;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface UploadManuscriptInput {
  title: string;
  manuscriptType: ManuscriptType;
  createdBy: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
}

export interface UploadManuscriptResult {
  manuscript: ManuscriptViewModel;
  asset: DocumentAssetViewModel;
  job: JobViewModel;
}
