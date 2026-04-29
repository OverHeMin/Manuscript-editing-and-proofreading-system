import type {
  ConfirmedTableSnapshot,
  TableCorrectionPatch,
  TableSourceSnapshot,
} from "./table-evidence-types.ts";

export type TableEvidenceViewMode = "source" | "confirmed" | "diff";

export interface TableEvidenceSelectionState {
  selectedCellId?: string;
  selectedRunId?: string;
  showInvisibleCharacters: boolean;
  showSpecialCodepoints: boolean;
  viewMode: TableEvidenceViewMode;
}

export interface TableEvidencePreviewState {
  sourceSnapshot: TableSourceSnapshot;
  correctionPatch: TableCorrectionPatch;
  confirmedSnapshot?: ConfirmedTableSnapshot;
  selection: TableEvidenceSelectionState;
}

export function createTableEvidenceSelectionState(
  input: Partial<TableEvidenceSelectionState> = {},
): TableEvidenceSelectionState {
  return {
    selectedCellId: input.selectedCellId,
    selectedRunId: input.selectedRunId,
    showInvisibleCharacters: input.showInvisibleCharacters ?? false,
    showSpecialCodepoints: input.showSpecialCodepoints ?? false,
    viewMode: input.viewMode ?? "source",
  };
}

export function selectTableEvidenceCell(
  state: TableEvidenceSelectionState,
  selectedCellId?: string,
): TableEvidenceSelectionState {
  return {
    ...state,
    selectedCellId,
  };
}
