import type { DocumentAsset, DocumentAssetType, ManuscriptModule } from "./assets.js";
import type { DocumentAssetId, ManuscriptId } from "./manuscript.js";

export interface DocumentStructureSection {
  id: string;
  heading: string;
  order: number;
  style?: string;
  paragraph_index?: number;
  start_page?: number;
  end_page?: number;
  notes?: string;
}

export interface DocumentStructureSnapshot {
  id: string;
  manuscript_id: ManuscriptId;
  asset_id: DocumentAssetId;
  created_at: string;
  sections: DocumentStructureSection[];
  warnings?: string[];
  fallback_to_manual_review?: boolean;
}

export type DocumentPreviewSessionStatus = "pending" | "ready" | "failed";
export type DocumentPreviewMode = "view" | "comment";
export type DocumentPreviewViewer = "onlyoffice" | "pdf" | "html";
export type DocumentCommentSource = "onlyoffice" | "system";

export interface DocumentCommentView {
  id: string;
  session_id: string;
  author_id: string;
  created_at: string;
  resolved: boolean;
  text: string;
  source: DocumentCommentSource;
  paragraph_index?: number;
  section_heading?: string;
}

export interface DocumentPreviewSession {
  id: string;
  manuscript_id: ManuscriptId;
  asset_id: DocumentAssetId;
  viewer: DocumentPreviewViewer;
  mode: DocumentPreviewMode;
  status: DocumentPreviewSessionStatus;
  comment_source: DocumentCommentSource;
  created_at: string;
  updated_at?: string;
  comment_view?: DocumentCommentView[];
  save_back_enabled: false;
}

export interface DocumentExportRequest {
  manuscript_id: ManuscriptId;
  preferred_asset_type?: DocumentAssetType;
  requested_by: string;
  include_comments?: boolean;
  module?: ManuscriptModule;
}

export interface DocumentExportDownload {
  storage_key: string;
  file_name?: string;
  mime_type: string;
  expires_at?: string;
}

export interface DocumentExportResult {
  request: DocumentExportRequest;
  asset: DocumentAsset;
  download: DocumentExportDownload;
  exported_at: string;
  comment_snapshot?: DocumentCommentView[];
}
