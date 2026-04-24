export type TableDocxSnapshotCapability =
  | "header_cell"
  | "footnote_item"
  | "unit_marker"
  | "table_label"
  | "table_title"
  | "caption_fields"
  | "note_zone"
  | "style_profile"
  | "grid_cells";

export type TableDocxPatchType =
  | "replace_header_cell_text"
  | "replace_footnote_text"
  | "normalize_unit_text"
  | "replace_table_caption_text"
  | "replace_table_note_text"
  | "apply_three_line_table_style";

export type TableDocxPatchGrade = "A" | "B" | "C";
export type TableDocxPatchApplyScope = "inspect_only" | "editing_only";
export type TableDocxExecutionPath =
  | "safe_patch"
  | "controlled_rebuild"
  | "manual_downgrade";

export interface TableDocxPatchAnchor {
  table_id: string;
  semantic_target: string;
  header_path?: string[];
  row_key?: string;
  column_key?: string;
  footnote_anchor?: string;
}

export interface TableDocxPatchPlan {
  patch_id: string;
  rule_id: string;
  table_id: string;
  patch_type: TableDocxPatchType;
  grade: TableDocxPatchGrade;
  apply_scope: TableDocxPatchApplyScope;
  semantic_target: string;
  anchor: TableDocxPatchAnchor;
  required_snapshot_capabilities: TableDocxSnapshotCapability[];
  proposed_before: string;
  proposed_after: string;
  rationale: string;
  evidence_pack: Record<string, unknown>;
  execution_path?: TableDocxExecutionPath;
  rebuild_payload?: Record<string, unknown>;
}

export type TableDocxPatchResultStatus =
  | "applied"
  | "skipped_no_anchor"
  | "skipped_conflict"
  | "skipped_unsafe";

export interface TableDocxPatchResult {
  patch_id: string;
  rule_id: string;
  table_id?: string;
  patch_type: string;
  status: TableDocxPatchResultStatus;
  reason: string;
  semantic_target?: string;
  anchor?: TableDocxPatchAnchor;
  required_snapshot_capabilities: TableDocxSnapshotCapability[];
  execution_path?: TableDocxExecutionPath;
}

export const TABLE_DOCX_PATCH_RESULT_STATUSES: TableDocxPatchResultStatus[] = [
  "applied",
  "skipped_no_anchor",
  "skipped_conflict",
  "skipped_unsafe",
];

export const TABLE_DOCX_PATCH_APPLY_PRIORITY: Record<TableDocxPatchType, number> = {
  replace_table_caption_text: 10,
  replace_header_cell_text: 20,
  normalize_unit_text: 30,
  replace_footnote_text: 40,
  replace_table_note_text: 50,
  apply_three_line_table_style: 60,
};
