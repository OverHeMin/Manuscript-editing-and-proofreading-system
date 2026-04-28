export type DocumentPreviewStatus = "ready" | "pending_normalization";
export type DocumentPreviewSurfaceMode = "read_only_review" | "editable_review";
export type DocumentPreviewMode = "view" | "edit";
export type DocumentPreviewSessionTokenScheme = "none" | "surface_session_jwt";
export type DocumentPreviewSaveBackModule = "editing" | "proofreading";
export type ProofreadingDocumentAnchorKind =
  | "block"
  | "paragraph"
  | "heading"
  | "table"
  | "table_cell"
  | "image"
  | "caption"
  | "reference_entry";
export type ProofreadingDocumentAnchorConfidence =
  | "provided"
  | "derived"
  | "fallback";

export interface DocumentPreviewCommentViewModel {
  id: string;
  author?: string;
  body: string;
  anchor_text?: string;
  created_at?: string;
}

export interface ProofreadingDocumentLocatorViewModel {
  anchorKind: ProofreadingDocumentAnchorKind;
  anchorKey: string;
  confidence?: ProofreadingDocumentAnchorConfidence;
  blockIndex?: number;
  sectionLabel?: string;
  ordinalWithinSection?: number;
  tableId?: string;
  tableTarget?: string;
  rowKey?: string;
  columnKey?: string;
  footnoteAnchor?: string;
}

export interface ProofreadingIssueAnchorInputViewModel {
  blockIndex: number;
  quote: string;
  sectionLabel?: string;
  blockKind?: string;
  documentLocator?: ProofreadingDocumentLocatorViewModel;
}

export interface DocumentPreviewLocateTargetViewModel {
  blockIndex: number;
  quote: string;
  sectionLabel?: string;
  anchorKey: string;
  anchorKind: ProofreadingDocumentAnchorKind;
  confidence: ProofreadingDocumentAnchorConfidence;
  tableId?: string;
  tableTarget?: string;
  rowKey?: string;
  columnKey?: string;
  footnoteAnchor?: string;
}

export interface DocumentPreviewViewModel {
  manuscript_id: string;
  source_asset_id?: string;
  normalized_asset_type: "normalized_docx";
  viewer: "onlyoffice";
  status: DocumentPreviewStatus;
  mime_type: string;
  file_name: string;
  storage_key: string;
  warnings: string[];
}

export interface DocumentPreviewSessionViewModel {
  manuscript_id: string;
  source_asset_id: string;
  source_asset_type:
    | "original"
    | "normalized_docx"
    | "edited_docx"
    | "final_proof_annotated_docx"
    | "human_final_docx";
  session_id: string;
  correlation_id: string;
  viewer: "onlyoffice";
  mode: DocumentPreviewMode;
  surface_mode: DocumentPreviewSurfaceMode;
  status: DocumentPreviewStatus;
  mime_type: string;
  comment_source: "onlyoffice";
  document: {
    document_key: string;
    file_name: string;
    file_extension: string;
    mime_type: string;
    download_path: string;
    permissions: {
      edit: boolean;
      comment: boolean;
      review: boolean;
      download: true;
      print: true;
    };
  };
  authorization: {
    kind: "surface_session";
    requires_surface_session: true;
    token_scheme: DocumentPreviewSessionTokenScheme;
    access_token?: string;
  };
  event_bridge: {
    provider: "onlyoffice";
    transport: "window_post_message";
    capabilities: {
      ready_event: true;
      locate_to_anchor: true;
      selection_from_document: true;
      visible_issue_marks: boolean;
      bi_directional_sync: true;
    };
  };
  embed: {
    provider: "onlyoffice";
    provider_origin: string;
    api_js_url: string;
    document_type: "word";
    ui_type: "desktop";
    editor_config: {
      mode: DocumentPreviewMode;
      lang: "zh-CN";
      customization: {
        autosave: boolean;
        chat: false;
        comments: boolean;
        compactHeader: true;
        compactToolbar: true;
        feedback: false;
        forcesave: boolean;
        help: false;
        submitForm: false;
      };
    };
  };
  comments: DocumentPreviewCommentViewModel[];
  save_back_enabled: boolean;
  save_back?: {
    module: DocumentPreviewSaveBackModule;
    baseline_asset_id: string;
    output_asset_type: "edited_docx" | "human_final_docx";
    callback_token: string;
  };
  warnings: string[];
}

export interface DocumentNormalizationExecutionViewModel {
  plan: {
    manuscript_id: string;
    derived_asset: {
      asset_type: "normalized_docx";
      file_name: string;
      storage_key: string;
      mime_type: string;
    };
  };
  normalized_asset?: {
    id: string;
    asset_type: "normalized_docx";
    file_name?: string;
    storage_key: string;
  };
  preview: {
    viewer: "onlyoffice";
    status: DocumentPreviewStatus;
    source_asset_id?: string;
    mime_type: string;
    warnings: string[];
  };
}
