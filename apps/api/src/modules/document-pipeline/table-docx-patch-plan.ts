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

export type TableReconstructionOperationKind =
  | "preserve_content_mapping"
  | "place_caption"
  | "place_note_zone"
  | "normalize_border_system"
  | "normalize_layout"
  | "normalize_paragraph_style"
  | "normalize_typography"
  | "preserve_rich_fragments"
  | "handle_object_content";

export interface NormalizedTableCellObject {
  source_cell_id: string;
  target_cell_id: string;
  row_index: number;
  column_index: number;
  row_span: number;
  column_span: number;
  inferred_role: string;
  text: string;
  paragraphs: unknown[];
  style_evidence: unknown;
  border_hints?: unknown;
}

export interface NormalizedTableObject {
  table_id: string;
  row_count?: number;
  column_count?: number;
  caption_text?: string;
  note_text?: string;
  cells: NormalizedTableCellObject[];
}

export interface TableReconstructionOperation {
  kind: TableReconstructionOperationKind;
  status: "planned" | "manual_review_required" | "blocked";
  source_ids: string[];
  target_ids: string[];
  reason: string;
}

export interface TableReconstructionPlan {
  plan_kind: "table_reconstruction_plan";
  outcome: "safe_patch" | "full_rebuild" | "manual_review" | "blocked";
  normalized_table_object: NormalizedTableObject;
  operations: TableReconstructionOperation[];
  downgrade_reasons: string[];
  content_preservation_map: Array<{
    source_cell_id: string;
    target_cell_id: string;
    source_text: string;
    target_text: string;
    preserved: boolean;
  }>;
  required_validation: string[];
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
  table_reconstruction_plan?: TableReconstructionPlan;
}

export type TableDocxPatchResultStatus =
  | "applied"
  | "validation_failed"
  | "skipped_no_anchor"
  | "skipped_conflict"
  | "skipped_unsafe";

export interface TableReconstructionValidationSnapshot {
  snapshot_id: string;
  patch_id: string;
  status: "passed" | "failed";
  checks: Array<{
    check_kind:
      | "content_preservation"
      | "topology_preservation"
      | "target_border_system"
      | "caption_note_placement"
      | "rich_fragment_preservation"
      | "object_policy"
      | "idempotence";
    passed: boolean;
    reason: string;
  }>;
  rollback_point: {
    source_table_id: string;
    source_patch_id: string;
  };
  idempotence_key: string;
}

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
  validation_snapshot?: TableReconstructionValidationSnapshot;
}

export const TABLE_DOCX_PATCH_RESULT_STATUSES: TableDocxPatchResultStatus[] = [
  "applied",
  "validation_failed",
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
