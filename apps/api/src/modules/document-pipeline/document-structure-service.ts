import type { EditingMetadataCandidate, EditingMetadataSourceZone } from "@medical/contracts";

import { buildTableFullFidelitySnapshotFromDocumentTable } from "../knowledge/table-full-fidelity-snapshot.ts";
import type {
  TableEvidenceMandatoryFactGroup,
  TableFullFidelitySnapshotRecord,
} from "../knowledge/knowledge-record.ts";

export interface DocumentStructureSection {
  order: number;
  heading: string;
  level?: number;
  paragraph_index?: number;
  page_no?: number;
}

export interface DocumentStructureTableSemanticProfile {
  is_three_line_table: boolean;
  header_depth: number;
  has_stub_column: boolean;
  has_statistical_footnotes: boolean;
  has_unit_markers: boolean;
  has_merged_headers?: boolean;
}

export interface DocumentStructureTableSemanticCoordinate {
  table_id: string;
  target:
    | "table_block"
    | "table_label"
    | "table_title"
    | "note_zone"
    | "style_profile"
    | "header_cell"
    | "stub_column"
    | "data_cell"
    | "unit_marker"
    | "footnote_item";
  header_path?: string[];
  row_key?: string;
  column_key?: string;
  footnote_anchor?: string;
}

export interface DocumentStructureTableHeaderCell {
  id: string;
  text: string;
  row_index: number;
  column_index: number;
  row_span?: number;
  column_span?: number;
  source_cell_id?: string;
  header_path: string[];
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableStubColumn {
  id: string;
  text: string;
  row_key: string;
  source_cell_id?: string;
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableDataCell {
  id: string;
  text: string;
  row_index: number;
  column_index: number;
  row_key: string;
  column_key: string;
  source_cell_id?: string;
  coordinate: DocumentStructureTableSemanticCoordinate;
  unit_context?: "header" | "stub" | "footnote";
}

export interface DocumentStructureTableUnitMarker {
  id: string;
  text: string;
  source_target: "header_cell" | "stub_column" | "footnote_item";
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableFootnoteItem {
  id: string;
  text: string;
  note_kind: "statistical_significance" | "abbreviation" | "general";
  marker?: string;
  paragraphs?: DocumentStructureTableParagraphSnapshot[];
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableMergedRelation {
  id: string;
  target_ids: string[];
  axis: "row" | "column" | "block";
}

export interface DocumentStructureTableTextAnchor {
  id: string;
  text: string;
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export type DocumentStructureTableStyleAvailability =
  | "authoritative"
  | "mixed"
  | "unavailable";

export interface DocumentStructureTableStyleFact<
  T = string | number | boolean,
> {
  availability: DocumentStructureTableStyleAvailability;
  value?: T;
}

export interface DocumentStructureTableInlineStyleEvidence {
  font_family: DocumentStructureTableStyleFact<string>;
  font_size_pt: DocumentStructureTableStyleFact<number>;
  bold: DocumentStructureTableStyleFact<boolean>;
  italic: DocumentStructureTableStyleFact<boolean>;
  script_position: DocumentStructureTableStyleFact<string>;
}

export interface DocumentStructureTableParagraphStyleEvidence {
  alignment: DocumentStructureTableStyleFact<string>;
  spacing_before_pt: DocumentStructureTableStyleFact<number>;
  spacing_after_pt: DocumentStructureTableStyleFact<number>;
  line_spacing: DocumentStructureTableStyleFact<number>;
  line_spacing_mode: DocumentStructureTableStyleFact<string>;
  left_indent_pt: DocumentStructureTableStyleFact<number>;
  right_indent_pt: DocumentStructureTableStyleFact<number>;
  first_line_indent_pt: DocumentStructureTableStyleFact<number>;
  hanging_indent_pt: DocumentStructureTableStyleFact<number>;
}

export interface DocumentStructureTableInlineFragment {
  id: string;
  kind: "text" | "symbol" | "tab" | "line_break" | "object";
  text: string;
  style: DocumentStructureTableInlineStyleEvidence;
  symbol_font?: string;
  symbol_char?: string;
  object_id?: string;
  object_kind?: DocumentStructureObjectKind;
  original_tag?: string;
  relationship_id?: string;
  evidence_text?: string;
}

export interface DocumentStructureTableParagraphSnapshot {
  id: string;
  text: string;
  style: DocumentStructureTableParagraphStyleEvidence;
  fragments: DocumentStructureTableInlineFragment[];
}

export interface DocumentStructureTableCellStyleEvidence {
  font_family: DocumentStructureTableStyleFact<string>;
  font_size_pt: DocumentStructureTableStyleFact<number>;
  bold: DocumentStructureTableStyleFact<boolean>;
  italic: DocumentStructureTableStyleFact<boolean>;
  script_position: DocumentStructureTableStyleFact<string>;
  alignment: DocumentStructureTableStyleFact<string>;
  spacing_before_pt: DocumentStructureTableStyleFact<number>;
  spacing_after_pt: DocumentStructureTableStyleFact<number>;
  line_spacing: DocumentStructureTableStyleFact<number>;
  line_spacing_mode: DocumentStructureTableStyleFact<string>;
  left_indent_pt: DocumentStructureTableStyleFact<number>;
  right_indent_pt: DocumentStructureTableStyleFact<number>;
  first_line_indent_pt: DocumentStructureTableStyleFact<number>;
  hanging_indent_pt: DocumentStructureTableStyleFact<number>;
  vertical_alignment: DocumentStructureTableStyleFact<string>;
  text_direction?: DocumentStructureTableStyleFact<string>;
}

export interface DocumentStructureTableBorderHints {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}

export interface DocumentStructureTableStyleRun {
  text: string;
  kind?: "text" | "symbol" | "tab" | "line_break" | "object";
  paragraph_index?: number;
  fragment_index?: number;
  start_offset?: number;
  end_offset?: number;
  font_family?: string;
  font_size_pt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  script_position?: string;
}

export interface DocumentStructureTableGridCell {
  id: string;
  text: string;
  display_text?: string;
  normalized_text?: string;
  raw_xml_text?: string;
  style_runs?: DocumentStructureTableStyleRun[];
  row_index: number;
  column_index: number;
  row_span: number;
  column_span: number;
  inferred_role: "header" | "stub" | "data" | "unknown";
  style_evidence: DocumentStructureTableCellStyleEvidence;
  paragraphs: DocumentStructureTableParagraphSnapshot[];
  border_hints?: DocumentStructureTableBorderHints;
  object_evidence?: DocumentStructureObjectEvidence[];
}

export interface DocumentStructureTableCaptionFields {
  text: string;
  label_text?: string;
  title_text?: string;
  paragraphs?: DocumentStructureTableParagraphSnapshot[];
}

export interface DocumentStructureTableNoteZone {
  text: string;
  line_texts: string[];
  footnote_ids: string[];
  paragraphs?: DocumentStructureTableParagraphSnapshot[];
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableStyleProfile {
  has_top_rule: boolean;
  has_header_rule: boolean;
  has_bottom_rule: boolean;
  has_vertical_rules: boolean;
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableSnapshot {
  table_id: string;
  row_count?: number;
  column_count?: number;
  profile: DocumentStructureTableSemanticProfile;
  table_label?: DocumentStructureTableTextAnchor;
  table_title?: DocumentStructureTableTextAnchor;
  caption_fields?: DocumentStructureTableCaptionFields;
  note_zone?: DocumentStructureTableNoteZone;
  style_profile?: DocumentStructureTableStyleProfile;
  header_cells: DocumentStructureTableHeaderCell[];
  data_cells: DocumentStructureTableDataCell[];
  footnote_items: DocumentStructureTableFootnoteItem[];
  stub_columns?: DocumentStructureTableStubColumn[];
  unit_markers?: DocumentStructureTableUnitMarker[];
  merged_relations?: DocumentStructureTableMergedRelation[];
  grid_cells?: DocumentStructureTableGridCell[];
  table_full_fidelity_snapshot?: TableFullFidelitySnapshotRecord;
  unsupported_fact_groups?: TableEvidenceMandatoryFactGroup[];
}

export type DocumentStructureObjectKind =
  | "image"
  | "equation"
  | "nested_table"
  | "text_box_table"
  | "ocr_image_table"
  | "embedded_object"
  | "drawing"
  | "chart"
  | "unknown";

export type DocumentStructureObjectContainerKind =
  | "paragraph"
  | "table_cell"
  | "header"
  | "footer";

export interface DocumentStructureObjectEvidence {
  object_id: string;
  object_kind: DocumentStructureObjectKind;
  container_kind: DocumentStructureObjectContainerKind;
  source_zone: EditingMetadataSourceZone | "body";
  source_locator: string;
  original_tag: string;
  relationship_id?: string;
  evidence_text?: string;
  surrounding_text?: string;
  intended_target?: string;
}

export interface DocumentStructureWorkerResult {
  status: "ready" | "partial" | "needs_manual_review";
  parser: "python_docx" | "mammoth" | "other";
  sections: DocumentStructureSection[];
  metadata_candidates?: EditingMetadataCandidate[];
  tables?: DocumentStructureTableSnapshot[];
  objects?: DocumentStructureObjectEvidence[];
  warnings: string[];
}

export interface DocumentStructureWorkerAdapter {
  extract(input: {
    manuscriptId: string;
    assetId: string;
    fileName: string;
  }): Promise<DocumentStructureWorkerResult>;
}

export interface ExtractDocumentStructureInput {
  manuscriptId: string;
  assetId: string;
  fileName: string;
}

export interface DocumentStructureSnapshot {
  manuscript_id: string;
  asset_id: string;
  file_name: string;
  status: DocumentStructureWorkerResult["status"];
  parser: DocumentStructureWorkerResult["parser"];
  sections: DocumentStructureSection[];
  metadata_candidates: EditingMetadataCandidate[];
  tables: DocumentStructureTableSnapshot[];
  objects?: DocumentStructureObjectEvidence[];
  warnings: string[];
}

export interface DocumentStructureServiceOptions {
  adapter: DocumentStructureWorkerAdapter;
}

export class DocumentStructureService {
  private readonly adapter: DocumentStructureWorkerAdapter;

  constructor(options: DocumentStructureServiceOptions) {
    this.adapter = options.adapter;
  }

  async extract(
    input: ExtractDocumentStructureInput,
  ): Promise<DocumentStructureSnapshot> {
    const result = await this.adapter.extract(input);

    return {
      manuscript_id: input.manuscriptId,
      asset_id: input.assetId,
      file_name: input.fileName,
      status: result.status,
      parser: result.parser,
      sections: result.sections.map((section) => ({ ...section })),
      metadata_candidates: (result.metadata_candidates ?? []).map((candidate) =>
        structuredClone(candidate),
      ),
      tables: (result.tables ?? []).map((table) =>
        attachRuntimeFullFidelitySnapshot(cloneTableSnapshot(table)),
      ),
      objects: (result.objects ?? []).map((entry) => structuredClone(entry)),
      warnings: [...result.warnings],
    };
  }
}

function cloneTableSnapshot(
  table: DocumentStructureTableSnapshot,
): DocumentStructureTableSnapshot {
  return {
    table_id: table.table_id,
    ...(typeof table.row_count === "number" ? { row_count: table.row_count } : {}),
    ...(typeof table.column_count === "number"
      ? { column_count: table.column_count }
      : {}),
    profile: { ...table.profile },
    ...(table.table_label ? { table_label: cloneTextAnchor(table.table_label) } : {}),
    ...(table.table_title ? { table_title: cloneTextAnchor(table.table_title) } : {}),
    ...(table.caption_fields
      ? { caption_fields: structuredClone(table.caption_fields) }
      : {}),
    ...(table.note_zone
      ? {
          note_zone: {
            ...table.note_zone,
            line_texts: [...table.note_zone.line_texts],
            footnote_ids: [...table.note_zone.footnote_ids],
            ...(table.note_zone.paragraphs
              ? { paragraphs: structuredClone(table.note_zone.paragraphs) }
              : {}),
            coordinate: cloneCoordinateOrFallback(
              table.note_zone.coordinate,
              table.table_id,
              "note_zone",
            ),
          },
        }
      : {}),
    ...(table.style_profile
      ? {
          style_profile: {
            ...table.style_profile,
            coordinate: cloneCoordinateOrFallback(
              table.style_profile.coordinate,
              table.table_id,
              "style_profile",
            ),
          },
        }
      : {}),
    header_cells: table.header_cells.map((cell) => ({
      ...cell,
      header_path: [...cell.header_path],
      coordinate: cloneCoordinate(cell.coordinate),
    })),
    data_cells: table.data_cells.map((cell) => ({
      ...cell,
      coordinate: cloneCoordinate(cell.coordinate),
    })),
    footnote_items: table.footnote_items.map((item) => ({
      ...item,
      ...(item.paragraphs ? { paragraphs: structuredClone(item.paragraphs) } : {}),
      coordinate: cloneCoordinate(item.coordinate),
    })),
    stub_columns: table.stub_columns?.map((column) => ({
      ...column,
      coordinate: cloneCoordinate(column.coordinate),
    })),
    unit_markers: table.unit_markers?.map((marker) => ({
      ...marker,
      coordinate: cloneCoordinate(marker.coordinate),
    })),
    merged_relations: table.merged_relations?.map((relation) => ({
      ...relation,
      target_ids: [...relation.target_ids],
    })),
    grid_cells: table.grid_cells?.map((cell) => structuredClone(cell)),
    ...(table.table_full_fidelity_snapshot
      ? {
          table_full_fidelity_snapshot: structuredClone(
            table.table_full_fidelity_snapshot,
          ),
        }
      : {}),
    ...(table.unsupported_fact_groups
      ? { unsupported_fact_groups: [...table.unsupported_fact_groups] }
      : {}),
  };
}

function attachRuntimeFullFidelitySnapshot(
  table: DocumentStructureTableSnapshot,
): DocumentStructureTableSnapshot {
  const tableFullFidelitySnapshot =
    table.table_full_fidelity_snapshot ??
    buildTableFullFidelitySnapshotFromDocumentTable(table);
  const unsupportedFactGroups = Object.entries(
    tableFullFidelitySnapshot.mandatory_fact_authority,
  )
    .filter(([, authority]) => authority === "unavailable" || authority === "unsupported")
    .map(([group]) => group as TableEvidenceMandatoryFactGroup);

  return {
    ...table,
    table_full_fidelity_snapshot: tableFullFidelitySnapshot,
    unsupported_fact_groups: unsupportedFactGroups,
  };
}

function cloneTextAnchor(
  anchor: DocumentStructureTableTextAnchor,
): DocumentStructureTableTextAnchor {
  return {
    ...anchor,
    coordinate: cloneCoordinate(anchor.coordinate),
  };
}

function cloneCoordinate(
  coordinate: DocumentStructureTableSemanticCoordinate,
): DocumentStructureTableSemanticCoordinate {
  return {
    ...coordinate,
    header_path: coordinate.header_path ? [...coordinate.header_path] : undefined,
  };
}

function cloneCoordinateOrFallback(
  coordinate: DocumentStructureTableSemanticCoordinate | undefined,
  tableId: string,
  target: "note_zone" | "style_profile",
): DocumentStructureTableSemanticCoordinate {
  if (coordinate) {
    return cloneCoordinate(coordinate);
  }

  return {
    table_id: tableId,
    target,
  };
}
