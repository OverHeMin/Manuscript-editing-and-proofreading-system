export type TableEvidenceSourceKind = "docx_upload";
export type TableEvidenceParser = "python_docx_ooxml";
export type TableEvidenceFidelityStatus = "pending" | "confirmed" | "needs_review";
export type TableEvidenceConfirmationStatus =
  | "pending"
  | "confirmed"
  | "needs_review";
export type TableEvidenceAuthority =
  | "authoritative"
  | "review_required"
  | "unavailable";
export type TableEvidenceBindingTargetType =
  | "knowledge_revision"
  | "editorial_rule"
  | "rule_draft";
export type TableEvidenceBindingRole =
  | "source_evidence"
  | "example"
  | "rule_basis"
  | "format_requirement";

export interface TableEvidenceSourceFile {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  byte_length: number;
  sha256: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface TableEvidenceAsset {
  id: string;
  title: string;
  source_file_asset_id: string;
  source_file_name: string;
  source_kind: TableEvidenceSourceKind;
  parser: TableEvidenceParser;
  parser_version: string;
  active_revision_id?: string;
  fidelity_status: TableEvidenceFidelityStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TableEvidenceInvisibleChar {
  id: string;
  kind:
    | "space"
    | "full_width_space"
    | "nbsp"
    | "tab"
    | "line_break"
    | "paragraph_boundary"
    | "leading_space"
    | "trailing_space"
    | "consecutive_space";
  codepoint: string;
  offset: number;
  length: number;
}

export interface TableEvidenceRunStyle {
  font_family?: string;
  font_size_pt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  script_position?: "baseline" | "superscript" | "subscript" | "mixed" | "unknown";
}

export interface TableEvidenceTextRun {
  id: string;
  kind: "text" | "symbol" | "tab" | "line_break" | "object" | "paragraph_boundary";
  text: string;
  codepoints: string[];
  style: TableEvidenceRunStyle;
  symbol_font?: string;
  symbol_char?: string;
  object_id?: string;
  object_kind?: string;
  invisible_chars: TableEvidenceInvisibleChar[];
}

export interface TableEvidenceParagraph {
  id: string;
  runs: TableEvidenceTextRun[];
  paragraph_boundary_after: boolean;
  style?: Record<string, unknown>;
}

export interface TableEvidenceCaption {
  text: string;
  label_text?: string;
  title_text?: string;
  runs: TableEvidenceTextRun[];
}

export interface TableEvidenceCellSnapshot {
  cell_id: string;
  row: number;
  column: number;
  rowspan: number;
  colspan: number;
  role: "header" | "stub" | "data" | "unknown";
  text: string;
  codepoints: string[];
  paragraphs: TableEvidenceParagraph[];
  runs: TableEvidenceTextRun[];
  header_path: string[];
  row_header_path: string[];
  column_header_path: string[];
  invisible_chars: TableEvidenceInvisibleChar[];
  style_summary: {
    bold?: boolean;
    italic?: boolean;
    script_positions?: string[];
    border_profile?: string;
    horizontal_alignment?: string;
    vertical_alignment?: string;
    three_line_role?: "top_rule" | "header_rule" | "bottom_rule" | "none";
  };
}

export interface TableSourceSnapshot {
  snapshot_id: string;
  table_id: string;
  source_file_asset_id: string;
  parser: TableEvidenceParser;
  parser_version: string;
  row_count: number;
  column_count: number;
  caption?: TableEvidenceCaption;
  notes: TableEvidenceParagraph[];
  grid_cells: TableEvidenceCellSnapshot[];
  object_evidence: Record<string, unknown>[];
  warnings: string[];
}

export type TableCorrectionOperation =
  | {
      op: "replace_run_text";
      cell_id: string;
      paragraph_id: string;
      run_id: string;
      before_text: string;
      after_text: string;
      after_codepoints: string[];
    }
  | {
      op: "set_run_style";
      cell_id: string;
      paragraph_id: string;
      run_id: string;
      style: TableEvidenceRunStyle;
    }
  | {
      op: "set_cell_structure";
      cell_id: string;
      row: number;
      column: number;
      rowspan: number;
      colspan: number;
    }
  | {
      op: "set_cell_borders";
      cell_id: string;
      border_profile: string;
      border_payload: Record<string, unknown>;
    }
  | {
      op: "set_cell_alignment";
      cell_id: string;
      horizontal_alignment?: string;
      vertical_alignment?: string;
    }
  | {
      op: "replace_caption";
      caption: TableEvidenceCaption;
    }
  | {
      op: "replace_notes";
      notes: TableEvidenceParagraph[];
    }
  | {
      op: "confirm_special_symbols";
      cell_ids: string[];
      confirmed_symbol_run_ids: string[];
    }
  | {
      op: "confirm_invisible_chars";
      cell_ids: string[];
      confirmed_invisible_char_ids: string[];
    };

export interface TableCorrectionPatch {
  patch_id: string;
  operations: TableCorrectionOperation[];
}

export interface ConfirmedTableSnapshot {
  snapshot_id: string;
  source_snapshot_id: string;
  row_count: number;
  column_count: number;
  caption?: TableEvidenceCaption;
  notes: TableEvidenceParagraph[];
  grid_cells: TableEvidenceCellSnapshot[];
}

export interface TableFidelityReport {
  status: TableEvidenceFidelityStatus;
  failure_codes: string[];
  unsupported_fact_groups: string[];
  required_confirmations: string[];
  invisible_chars_confirmed: boolean;
  special_symbols_confirmed: boolean;
}

export interface ConfirmedAiTablePackage {
  package_id: string;
  asset_id: string;
  revision_id: string;
  revision_no: number;
  source_file_asset_id: string;
  authority: TableEvidenceAuthority;
  confirmation_status: TableEvidenceConfirmationStatus;
  fidelity_status: TableEvidenceFidelityStatus;
  confirmed_by_human: boolean;
  confirmed_by?: string;
  confirmed_at?: string;
  parser: TableEvidenceParser;
  parser_version: string;
  source_snapshot_hash: string;
  confirmed_snapshot_hash: string;
  ai_table_package_hash: string;
  caption?: TableEvidenceCaption;
  notes: TableEvidenceParagraph[];
  structure: {
    row_count: number;
    column_count: number;
    header_depth: number;
    merged_cells: Array<{
      cell_id?: string;
      row: number;
      column: number;
      rowspan: number;
      colspan: number;
    }>;
  };
  cells: TableEvidenceCellSnapshot[];
  fidelity_report: TableFidelityReport;
}

export interface TableEvidenceRevision {
  id: string;
  table_evidence_asset_id: string;
  revision_no: number;
  source_snapshot: TableSourceSnapshot;
  correction_patch: TableCorrectionPatch;
  confirmed_snapshot?: ConfirmedTableSnapshot;
  ai_table_package?: ConfirmedAiTablePackage;
  fidelity_report: TableFidelityReport;
  confirmation_status: TableEvidenceConfirmationStatus;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
}

export interface TableEvidenceBinding {
  id: string;
  table_evidence_asset_id: string;
  table_evidence_revision_id: string;
  target_type: TableEvidenceBindingTargetType;
  target_id: string;
  binding_role: TableEvidenceBindingRole;
  created_at: string;
}
