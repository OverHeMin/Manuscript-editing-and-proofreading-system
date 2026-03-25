import type { DocumentAssetId, ManuscriptId, UserId } from "./manuscript.js";

export type DocumentAssetStatus =
  | "created"
  | "active"
  | "superseded"
  | "archived";

// Suggested asset types per docs/superpowers/specs/2026-03-25-medical-manuscript-system-v1-design.md
export type DocumentAssetType =
  | "original"
  | "normalized_docx"
  | "screening_report"
  | "edited_docx"
  | "proofreading_draft_report"
  | "proofread_annotated_docx"
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

export interface DocumentAsset {
  id: DocumentAssetId;
  manuscript_id: ManuscriptId;

  asset_type: DocumentAssetType;
  status: DocumentAssetStatus;

  storage_key: string;
  mime_type: string;

  parent_asset_id?: DocumentAssetId;

  source_module: ManuscriptModule;
  source_job_id?: string;

  created_by: UserId;
  version_no: number;
  is_current: boolean;
}

