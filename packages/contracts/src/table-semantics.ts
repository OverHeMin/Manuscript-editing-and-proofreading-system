export type TableSemanticTarget =
  | "table_block"
  | "table_label"
  | "table_title"
  | "header_cell"
  | "stub_column"
  | "data_cell"
  | "unit_marker"
  | "footnote_item";

export interface TableSemanticProfile {
  is_three_line_table: boolean;
  header_depth: number;
  has_stub_column: boolean;
  has_statistical_footnotes: boolean;
  has_unit_markers: boolean;
  has_merged_headers?: boolean;
}

export interface TableSemanticCoordinate {
  table_id: string;
  target: TableSemanticTarget;
  header_path?: string[];
  row_key?: string;
  column_key?: string;
  footnote_anchor?: string;
}

export interface TableSemanticHeaderCell {
  id: string;
  text: string;
  row_index: number;
  column_index: number;
  row_span?: number;
  column_span?: number;
  header_path: string[];
  coordinate: TableSemanticCoordinate;
}

export interface TableSemanticStubColumn {
  id: string;
  text: string;
  row_key: string;
  coordinate: TableSemanticCoordinate;
}

export interface TableSemanticDataCell {
  id: string;
  text: string;
  row_index: number;
  column_index: number;
  row_key: string;
  column_key: string;
  coordinate: TableSemanticCoordinate;
  unit_context?: "header" | "stub" | "footnote";
}

export interface TableSemanticUnitMarker {
  id: string;
  text: string;
  source_target: "header_cell" | "stub_column" | "footnote_item";
  coordinate: TableSemanticCoordinate;
}

export interface TableSemanticFootnoteItem {
  id: string;
  text: string;
  note_kind: "statistical_significance" | "abbreviation" | "general";
  marker?: string;
  coordinate: TableSemanticCoordinate;
}

export interface TableSemanticMergedRelation {
  id: string;
  target_ids: string[];
  axis: "row" | "column" | "block";
}

export interface TableSemanticSnapshot {
  table_id: string;
  profile: TableSemanticProfile;
  header_cells: TableSemanticHeaderCell[];
  data_cells: TableSemanticDataCell[];
  footnote_items: TableSemanticFootnoteItem[];
  stub_columns?: TableSemanticStubColumn[];
  unit_markers?: TableSemanticUnitMarker[];
  merged_relations?: TableSemanticMergedRelation[];
}
