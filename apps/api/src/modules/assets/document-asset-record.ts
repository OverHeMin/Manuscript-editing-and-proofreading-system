import type { ManuscriptModule } from "../jobs/job-record.ts";

export type DocumentAssetStatus =
  | "created"
  | "active"
  | "superseded"
  | "archived";

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

export interface DocumentAssetRecord {
  id: string;
  manuscript_id: string;
  asset_type: DocumentAssetType;
  status: DocumentAssetStatus;
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
