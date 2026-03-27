import type { DocumentAssetType } from "./assets.js";
import type { DocumentAssetId, ManuscriptId } from "./manuscript.js";

export type DocumentStructureStatus =
  | "ready"
  | "partial"
  | "needs_manual_review";

export interface DocumentStructureSection {
  order: number;
  heading: string;
  level?: number;
  paragraph_index?: number;
  page_no?: number;
  warnings?: string[];
}

export interface DocumentStructureSnapshot {
  manuscript_id: ManuscriptId;
  asset_id: DocumentAssetId;
  status: DocumentStructureStatus;
  parser: "python_docx" | "mammoth" | "other";
  sections: DocumentStructureSection[];
  warnings?: string[];
}

export type DocumentPreviewSessionStatus =
  | "ready"
  | "pending_normalization"
  | "failed";

export interface DocumentCommentView {
  id: string;
  author?: string;
  body: string;
  anchor_text?: string;
  created_at?: string;
}

export interface DocumentPreviewSession {
  manuscript_id: ManuscriptId;
  asset_id?: DocumentAssetId;
  viewer: "onlyoffice";
  mode: "view" | "comment_review";
  status: DocumentPreviewSessionStatus;
  source_asset_type: Extract<DocumentAssetType, "original" | "normalized_docx">;
  comment_source: "onlyoffice" | "system";
  comments?: DocumentCommentView[];
  save_back_enabled: false;
  warnings?: string[];
}

export interface DocumentExportRequest {
  manuscript_id: ManuscriptId;
  preferred_asset_type?: DocumentAssetType;
  requested_by: string;
}

export interface DocumentExportResult {
  manuscript_id: ManuscriptId;
  asset_id: DocumentAssetId;
  asset_type: DocumentAssetType;
  storage_key: string;
  file_name?: string;
  mime_type: string;
}
