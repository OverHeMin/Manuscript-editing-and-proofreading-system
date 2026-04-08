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
  header_path: string[];
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableStubColumn {
  id: string;
  text: string;
  row_key: string;
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableDataCell {
  id: string;
  text: string;
  row_index: number;
  column_index: number;
  row_key: string;
  column_key: string;
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
  coordinate: DocumentStructureTableSemanticCoordinate;
}

export interface DocumentStructureTableMergedRelation {
  id: string;
  target_ids: string[];
  axis: "row" | "column" | "block";
}

export interface DocumentStructureTableSnapshot {
  table_id: string;
  profile: DocumentStructureTableSemanticProfile;
  header_cells: DocumentStructureTableHeaderCell[];
  data_cells: DocumentStructureTableDataCell[];
  footnote_items: DocumentStructureTableFootnoteItem[];
  stub_columns?: DocumentStructureTableStubColumn[];
  unit_markers?: DocumentStructureTableUnitMarker[];
  merged_relations?: DocumentStructureTableMergedRelation[];
}

export interface DocumentStructureWorkerResult {
  status: "ready" | "partial" | "needs_manual_review";
  parser: "python_docx" | "mammoth" | "other";
  sections: DocumentStructureSection[];
  tables?: DocumentStructureTableSnapshot[];
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
  tables: DocumentStructureTableSnapshot[];
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
      tables: (result.tables ?? []).map(cloneTableSnapshot),
      warnings: [...result.warnings],
    };
  }
}

function cloneTableSnapshot(
  table: DocumentStructureTableSnapshot,
): DocumentStructureTableSnapshot {
  return {
    table_id: table.table_id,
    profile: { ...table.profile },
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
