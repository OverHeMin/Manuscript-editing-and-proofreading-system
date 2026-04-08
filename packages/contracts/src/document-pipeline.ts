import type {
  DocumentAsset,
  DocumentAssetType,
  ManuscriptModule,
} from "./assets.js";
import type { DocumentAssetId, ManuscriptId } from "./manuscript.js";
import type { TableSemanticSnapshot } from "./table-semantics.js";

export type DocumentStructureStatus =
  | "ready"
  | "partial"
  | "needs_manual_review";

export interface DocumentStructureSection {
  id?: string;
  heading: string;
  order: number;
  style?: string;
  level?: number;
  paragraph_index?: number;
  start_page?: number;
  end_page?: number;
  page_no?: number;
  notes?: string;
  warnings?: string[];
}

export interface DocumentStructureSnapshot {
  id?: string;
  manuscript_id: ManuscriptId;
  asset_id: DocumentAssetId;
  created_at?: string;
  status?: DocumentStructureStatus;
  parser?: "python_docx" | "mammoth" | "other";
  sections: DocumentStructureSection[];
  tables?: TableSemanticSnapshot[];
  warnings?: string[];
  fallback_to_manual_review?: boolean;
}

export type DocumentPreviewSessionStatus =
  | "pending"
  | "ready"
  | "failed"
  | "pending_normalization";
export type DocumentPreviewMode = "view" | "comment" | "comment_review";
export type DocumentPreviewViewer = "onlyoffice" | "pdf" | "html";
export type DocumentCommentSource = "onlyoffice" | "system";

export interface DocumentCommentView {
  id: string;
  session_id?: string;
  author_id?: string;
  author?: string;
  created_at?: string;
  resolved?: boolean;
  text?: string;
  body?: string;
  source?: DocumentCommentSource;
  paragraph_index?: number;
  section_heading?: string;
  anchor_text?: string;
}

export interface DocumentPreviewSession {
  id?: string;
  manuscript_id: ManuscriptId;
  asset_id?: DocumentAssetId;
  viewer: DocumentPreviewViewer;
  mode: DocumentPreviewMode;
  status: DocumentPreviewSessionStatus;
  comment_source: DocumentCommentSource;
  source_asset_type?: Extract<DocumentAssetType, "original" | "normalized_docx">;
  created_at?: string;
  updated_at?: string;
  comment_view?: DocumentCommentView[];
  comments?: DocumentCommentView[];
  save_back_enabled: false;
  warnings?: string[];
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
  manuscript_id?: ManuscriptId;
  asset_id?: DocumentAssetId;
  asset_type?: DocumentAssetType;
  storage_key?: string;
  file_name?: string;
  mime_type?: string;
  request?: DocumentExportRequest;
  asset?: DocumentAsset;
  download?: DocumentExportDownload;
  exported_at?: string;
  comment_snapshot?: DocumentCommentView[];
}
