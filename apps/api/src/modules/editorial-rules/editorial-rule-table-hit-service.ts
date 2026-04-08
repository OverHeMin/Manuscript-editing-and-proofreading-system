import type {
  DocumentStructureTableDataCell,
  DocumentStructureTableFootnoteItem,
  DocumentStructureTableHeaderCell,
  DocumentStructureTableSemanticCoordinate,
  DocumentStructureTableSnapshot,
  DocumentStructureTableStubColumn,
} from "../document-pipeline/document-structure-service.ts";
import type { EditorialRuleRecord } from "./editorial-rule-record.ts";

type TableSemanticTarget =
  | "header_cell"
  | "stub_column"
  | "data_cell"
  | "footnote_item";

interface TableSemanticSelector {
  semantic_target?: TableSemanticTarget;
  header_path_includes?: string[];
  row_key?: string;
  column_key?: string;
  note_kind?: "statistical_significance" | "abbreviation" | "general";
  unit_context?: "header" | "stub" | "footnote";
}

export interface EditorialRuleTableHit {
  table_id: string;
  semantic_target: TableSemanticTarget;
  semantic_coordinate: DocumentStructureTableSemanticCoordinate;
  reason: string;
}

export interface FindEditorialRuleTableHitsInput {
  rule: Pick<EditorialRuleRecord, "rule_object" | "selector" | "trigger">;
  tableSnapshots: DocumentStructureTableSnapshot[];
}

export class EditorialRuleTableHitService {
  findMatches(input: FindEditorialRuleTableHitsInput): EditorialRuleTableHit[] {
    if (input.rule.rule_object !== "table") {
      return [];
    }

    const selector = normalizeSelector(input.rule.selector);
    if (!selector.semantic_target) {
      return [];
    }

    return input.tableSnapshots.flatMap((table): EditorialRuleTableHit[] => {
      if (!matchesTableTrigger(table, input.rule.trigger)) {
        return [];
      }

      switch (selector.semantic_target) {
        case "header_cell":
          return table.header_cells
            .filter((cell) => matchesHeaderCell(cell, selector))
            .map((cell) => ({
              table_id: table.table_id,
              semantic_target: "header_cell" as const,
              semantic_coordinate: cloneCoordinate(cell.coordinate),
              reason: buildHeaderCellReason(table.table_id, cell),
            }));
        case "stub_column":
          return (table.stub_columns ?? [])
            .filter((column) => matchesStubColumn(column, selector))
            .map((column) => ({
              table_id: table.table_id,
              semantic_target: "stub_column" as const,
              semantic_coordinate: cloneCoordinate(column.coordinate),
              reason: `Matched semantic target "stub_column" in table "${table.table_id}" for row key "${column.row_key}".`,
            }));
        case "data_cell":
          return table.data_cells
            .filter((cell) => matchesDataCell(cell, selector))
            .map((cell) => ({
              table_id: table.table_id,
              semantic_target: "data_cell" as const,
              semantic_coordinate: cloneCoordinate(cell.coordinate),
              reason: `Matched semantic target "data_cell" in table "${table.table_id}" at row "${cell.row_key}" and column "${cell.column_key}".`,
            }));
        case "footnote_item":
          return table.footnote_items
            .filter((item) => matchesFootnoteItem(item, selector))
            .map((item) => ({
              table_id: table.table_id,
              semantic_target: "footnote_item" as const,
              semantic_coordinate: cloneCoordinate(item.coordinate),
              reason: `Matched semantic target "footnote_item" in table "${table.table_id}" for note kind "${item.note_kind}".`,
            }));
      }

      return [];
    });
  }
}

function normalizeSelector(
  selector: Record<string, unknown>,
): TableSemanticSelector {
  return selector as TableSemanticSelector;
}

function matchesTableTrigger(
  table: DocumentStructureTableSnapshot,
  trigger: EditorialRuleRecord["trigger"],
): boolean {
  if (trigger.kind !== "table_shape") {
    return false;
  }

  if (trigger.layout === "three_line_table") {
    return table.profile.is_three_line_table;
  }

  return false;
}

function matchesHeaderCell(
  cell: DocumentStructureTableHeaderCell,
  selector: TableSemanticSelector,
): boolean {
  if (
    selector.header_path_includes &&
    !includesAllSegments(cell.header_path, selector.header_path_includes)
  ) {
    return false;
  }

  if (
    selector.column_key &&
    normalizeText(cell.coordinate.column_key) !== normalizeText(selector.column_key)
  ) {
    return false;
  }

  return true;
}

function matchesStubColumn(
  column: DocumentStructureTableStubColumn,
  selector: TableSemanticSelector,
): boolean {
  if (
    selector.row_key &&
    normalizeText(column.row_key) !== normalizeText(selector.row_key)
  ) {
    return false;
  }

  return true;
}

function matchesDataCell(
  cell: DocumentStructureTableDataCell,
  selector: TableSemanticSelector,
): boolean {
  if (
    selector.row_key &&
    normalizeText(cell.row_key) !== normalizeText(selector.row_key)
  ) {
    return false;
  }

  if (
    selector.column_key &&
    normalizeText(cell.column_key) !== normalizeText(selector.column_key)
  ) {
    return false;
  }

  if (
    selector.unit_context &&
    normalizeText(cell.unit_context) !== normalizeText(selector.unit_context)
  ) {
    return false;
  }

  return true;
}

function matchesFootnoteItem(
  item: DocumentStructureTableFootnoteItem,
  selector: TableSemanticSelector,
): boolean {
  if (
    selector.note_kind &&
    normalizeText(item.note_kind) !== normalizeText(selector.note_kind)
  ) {
    return false;
  }

  return true;
}

function buildHeaderCellReason(
  tableId: string,
  cell: DocumentStructureTableHeaderCell,
): string {
  const headerPath = cell.header_path.join(" > ");
  return `Matched semantic target "header_cell" in table "${tableId}" for header path "${headerPath}".`;
}

function includesAllSegments(
  source: string[],
  expected: string[],
): boolean {
  const normalizedSource = source.map(normalizeText);

  return expected.every((segment) => normalizedSource.includes(normalizeText(segment)));
}

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function cloneCoordinate(
  coordinate: DocumentStructureTableSemanticCoordinate,
): DocumentStructureTableSemanticCoordinate {
  return {
    ...coordinate,
    header_path: coordinate.header_path ? [...coordinate.header_path] : undefined,
  };
}
