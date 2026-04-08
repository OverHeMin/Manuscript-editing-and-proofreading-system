import type {
  DocumentStructureSnapshot,
  EditorialRulePreviewMatchedRule,
  EditorialRuleTableSemanticSelector,
  TableSemanticCoordinate,
  TableSemanticDataCell,
  TableSemanticFootnoteItem,
  TableSemanticHeaderCell,
  TableSemanticProfile,
  TableSemanticSnapshot,
  TableSemanticTarget,
} from "../src/index.js";

type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;
type Assert<T extends true> = T;
type IsAssignable<A, B> = A extends B ? true : false;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

type _TableSemanticTarget = Assert<
  IsEqual<
    TableSemanticTarget,
    | "table_block"
    | "table_label"
    | "table_title"
    | "header_cell"
    | "stub_column"
    | "data_cell"
    | "unit_marker"
    | "footnote_item"
  >
>;

type ExpectedTableSemanticProfile = {
  is_three_line_table: boolean;
  header_depth: number;
  has_stub_column: boolean;
  has_statistical_footnotes: boolean;
  has_unit_markers: boolean;
};

type _TableSemanticProfileShapeForward = Assert<
  IsAssignable<TableSemanticProfile, ExpectedTableSemanticProfile>
>;
type _TableSemanticProfileShapeBackward = Assert<
  IsAssignable<ExpectedTableSemanticProfile, TableSemanticProfile>
>;

type ExpectedCoordinate = {
  table_id: string;
  target: TableSemanticTarget;
  header_path?: string[];
  row_key?: string;
  column_key?: string;
  footnote_anchor?: string;
};

type _TableSemanticCoordinateShapeForward = Assert<
  IsAssignable<TableSemanticCoordinate, ExpectedCoordinate>
>;
type _TableSemanticCoordinateShapeBackward = Assert<
  IsAssignable<ExpectedCoordinate, TableSemanticCoordinate>
>;

type _TableSemanticHeaderCellHasHeaderPath = Assert<
  HasKey<TableSemanticHeaderCell, "header_path">
>;
type _TableSemanticHeaderCellHasCoordinate = Assert<
  HasKey<TableSemanticHeaderCell, "coordinate">
>;
type _TableSemanticDataCellHasColumnKey = Assert<
  HasKey<TableSemanticDataCell, "column_key">
>;
type _TableSemanticDataCellHasStubKey = Assert<
  HasKey<TableSemanticDataCell, "row_key">
>;
type _TableSemanticFootnoteItemHasKind = Assert<
  HasKey<TableSemanticFootnoteItem, "note_kind">
>;

type ExpectedSnapshot = {
  table_id: string;
  profile: TableSemanticProfile;
  header_cells: TableSemanticHeaderCell[];
  data_cells: TableSemanticDataCell[];
  footnote_items: TableSemanticFootnoteItem[];
};

type _SnapshotShapeForward = Assert<
  IsAssignable<TableSemanticSnapshot, ExpectedSnapshot>
>;
type _SnapshotShapeBackward = Assert<
  IsAssignable<ExpectedSnapshot, TableSemanticSnapshot>
>;

type _DocumentStructureSnapshotHasTables = Assert<
  HasKey<DocumentStructureSnapshot, "tables">
>;

type ExpectedSelector = {
  semantic_target: "header_cell" | "stub_column" | "data_cell" | "footnote_item";
  header_path_includes?: string[];
  row_key?: string;
  column_key?: string;
  note_kind?: "statistical_significance" | "abbreviation" | "general";
  unit_context?: "header" | "stub" | "footnote";
};

type _SelectorShapeForward = Assert<
  IsAssignable<EditorialRuleTableSemanticSelector, ExpectedSelector>
>;
type _SelectorShapeBackward = Assert<
  IsAssignable<ExpectedSelector, EditorialRuleTableSemanticSelector>
>;

type _PreviewMatchedRuleHasSemanticTarget = Assert<
  HasKey<EditorialRulePreviewMatchedRule, "semantic_target">
>;
type _PreviewMatchedRuleHasSemanticCoordinate = Assert<
  HasKey<EditorialRulePreviewMatchedRule, "semantic_coordinate">
>;
