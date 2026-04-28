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
export type DocumentPreviewMode = "view" | "edit" | "comment" | "comment_review";
export type DocumentPreviewViewer = "onlyoffice" | "pdf" | "html";
export type DocumentCommentSource = "onlyoffice" | "system";
export type DocumentPreviewSurfaceMode = "read_only_review" | "editable_review";
export type DocumentPreviewSessionAuthorizationKind = "surface_session";
export type DocumentPreviewSessionTokenScheme = "none" | "surface_session_jwt";
export type DocumentPreviewEventBridgeTransport = "window_post_message";
export type DocumentPreviewAnchorKind =
  | "block"
  | "paragraph"
  | "heading"
  | "table"
  | "table_cell"
  | "image"
  | "caption"
  | "reference_entry";

export interface DocumentPreviewEmbeddedDocumentPermissions {
  edit: boolean;
  comment: boolean;
  review: boolean;
  download: true;
  print: true;
}

export interface DocumentPreviewEmbeddedDocument {
  document_key: string;
  file_name: string;
  file_extension: string;
  mime_type: string;
  download_path: string;
  permissions: DocumentPreviewEmbeddedDocumentPermissions;
}

export interface DocumentPreviewSessionAuthorization {
  kind: DocumentPreviewSessionAuthorizationKind;
  requires_surface_session: true;
  token_scheme: DocumentPreviewSessionTokenScheme;
  access_token?: string;
}

export interface DocumentPreviewEventBridgeCapabilities {
  ready_event: true;
  locate_to_anchor: true;
  selection_from_document: true;
  visible_issue_marks: boolean;
  bi_directional_sync: true;
}

export interface DocumentPreviewEventBridge {
  provider: "onlyoffice";
  transport: DocumentPreviewEventBridgeTransport;
  capabilities: DocumentPreviewEventBridgeCapabilities;
}

export interface DocumentPreviewEmbedEditorConfigCustomization {
  autosave: boolean;
  chat: false;
  comments: boolean;
  compactHeader: true;
  compactToolbar: true;
  feedback: false;
  forcesave: boolean;
  help: false;
  submitForm: false;
}

export interface DocumentPreviewEmbedEditorConfig {
  mode: "view" | "edit";
  lang: "zh-CN";
  customization: DocumentPreviewEmbedEditorConfigCustomization;
}

export interface DocumentPreviewEmbed {
  provider: "onlyoffice";
  provider_origin: string;
  api_js_url: string;
  document_type: "word";
  ui_type: "desktop";
  editor_config: DocumentPreviewEmbedEditorConfig;
}

export interface DocumentPreviewLocateTarget {
  anchor_key: string;
  anchor_kind: DocumentPreviewAnchorKind;
  block_index?: number;
  quote?: string;
  section_label?: string;
  table_id?: string;
  table_target?: string;
  row_key?: string;
  column_key?: string;
  footnote_anchor?: string;
}

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
  session_id: string;
  correlation_id: string;
  viewer: DocumentPreviewViewer;
  mode: DocumentPreviewMode;
  surface_mode: DocumentPreviewSurfaceMode;
  status: DocumentPreviewSessionStatus;
  comment_source: DocumentCommentSource;
  source_asset_type?: Extract<
    DocumentAssetType,
    | "original"
    | "normalized_docx"
    | "edited_docx"
    | "final_proof_annotated_docx"
    | "human_final_docx"
  >;
  document: DocumentPreviewEmbeddedDocument;
  authorization: DocumentPreviewSessionAuthorization;
  event_bridge: DocumentPreviewEventBridge;
  embed: DocumentPreviewEmbed;
  created_at?: string;
  updated_at?: string;
  comment_view?: DocumentCommentView[];
  comments?: DocumentCommentView[];
  save_back_enabled: boolean;
  save_back?: {
    module: Extract<ManuscriptModule, "editing" | "proofreading">;
    baseline_asset_id: DocumentAssetId;
    output_asset_type: Extract<
      DocumentAssetType,
      "edited_docx" | "human_final_docx" | "human_review_working_docx"
    >;
    callback_token: string;
  };
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
