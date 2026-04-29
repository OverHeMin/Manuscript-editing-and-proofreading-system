import type { MouseEventHandler } from "react";
import { InvisibleCharacterOverlay } from "./invisible-character-overlay.tsx";
import type {
  ConfirmedTableSnapshot,
  TableEvidenceCellSnapshot,
  TableSourceSnapshot,
} from "./table-evidence-types.ts";

export type TableEvidenceRenderableSnapshot = Pick<
  TableSourceSnapshot | ConfirmedTableSnapshot,
  "row_count" | "column_count" | "grid_cells"
>;

export interface TableEvidenceRendererProps {
  snapshot: TableEvidenceRenderableSnapshot;
  showInvisibleCharacters?: boolean;
  selectedCellId?: string;
  onSelectCell?: (cellId: string) => void;
}

export function TableEvidenceRenderer({
  snapshot,
  showInvisibleCharacters = false,
  selectedCellId,
  onSelectCell,
}: TableEvidenceRendererProps) {
  const rows = createTableRows(snapshot);

  return (
    <>
      <style>{TABLE_EVIDENCE_RENDERER_STYLE}</style>
      <table className="table-evidence-renderer" data-row-count={snapshot.row_count}>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} data-row-index={rowIndex}>
              {row.map((entry) =>
                entry.kind === "cell" ? (
                  <TableEvidenceCell
                    cell={entry.cell}
                    isSelected={entry.cell.cell_id === selectedCellId}
                    key={entry.cell.cell_id}
                    onSelectCell={onSelectCell}
                    showInvisibleCharacters={showInvisibleCharacters}
                  />
                ) : (
                  <td
                    aria-hidden="true"
                    className="table-evidence-placeholder-cell"
                    data-column-index={entry.column}
                    data-placeholder="true"
                    key={`placeholder-${entry.row}-${entry.column}`}
                  />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function TableEvidenceCell({
  cell,
  isSelected,
  onSelectCell,
  showInvisibleCharacters,
}: {
  cell: TableEvidenceCellSnapshot;
  isSelected: boolean;
  onSelectCell?: (cellId: string) => void;
  showInvisibleCharacters: boolean;
}) {
  const CellTag = cell.role === "header" ? "th" : "td";
  const onClick: MouseEventHandler<HTMLTableCellElement> | undefined = onSelectCell
    ? () => onSelectCell(cell.cell_id)
    : undefined;

  return (
    <CellTag
      className={createCellClassName(cell, isSelected)}
      colSpan={cell.colspan}
      data-cell-id={cell.cell_id}
      data-codepoints={cell.codepoints.join(" ")}
      data-column-index={cell.column}
      data-role={cell.role}
      data-selected={isSelected ? "true" : undefined}
      onClick={onClick}
      rowSpan={cell.rowspan}
    >
      <span className="table-evidence-cell-text">{cell.display_text ?? cell.text}</span>
      {showInvisibleCharacters ? (
        <InvisibleCharacterOverlay invisibleChars={cell.invisible_chars} />
      ) : null}
    </CellTag>
  );
}

type TableRowEntry =
  | { kind: "cell"; cell: TableEvidenceCellSnapshot }
  | { kind: "placeholder"; row: number; column: number };

function createTableRows(snapshot: TableEvidenceRenderableSnapshot): TableRowEntry[][] {
  const cellsByPosition = new Map<string, TableEvidenceCellSnapshot>();
  snapshot.grid_cells.forEach((cell) => {
    cellsByPosition.set(positionKey(cell.row, cell.column), cell);
  });

  const occupied = new Set<string>();
  const rows: TableRowEntry[][] = [];

  for (let row = 0; row < snapshot.row_count; row += 1) {
    const entries: TableRowEntry[] = [];
    for (let column = 0; column < snapshot.column_count; ) {
      if (occupied.has(positionKey(row, column))) {
        column += 1;
        continue;
      }

      const cell = cellsByPosition.get(positionKey(row, column));
      if (cell) {
        entries.push({ kind: "cell", cell });
        markOccupied(occupied, cell);
        column += Math.max(cell.colspan, 1);
        continue;
      }

      entries.push({ kind: "placeholder", row, column });
      column += 1;
    }
    rows.push(entries);
  }

  return rows;
}

function markOccupied(occupied: Set<string>, cell: TableEvidenceCellSnapshot): void {
  for (let row = cell.row; row < cell.row + Math.max(cell.rowspan, 1); row += 1) {
    for (
      let column = cell.column;
      column < cell.column + Math.max(cell.colspan, 1);
      column += 1
    ) {
      if (row !== cell.row || column !== cell.column) {
        occupied.add(positionKey(row, column));
      }
    }
  }
}

function positionKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function createCellClassName(
  cell: TableEvidenceCellSnapshot,
  isSelected: boolean,
): string {
  const classes = [
    "table-evidence-cell",
    `cell-role-${cell.role}`,
    cell.style_summary.border_profile
      ? `border-${toKebabClass(cell.style_summary.border_profile)}`
      : undefined,
    cell.style_summary.horizontal_alignment
      ? `align-x-${toKebabClass(cell.style_summary.horizontal_alignment)}`
      : undefined,
    cell.style_summary.vertical_alignment
      ? `align-y-${toKebabClass(cell.style_summary.vertical_alignment)}`
      : undefined,
    ...(cell.style_summary.script_positions ?? []).map(
      (position) => `script-${toKebabClass(position)}`,
    ),
    isSelected ? "is-selected" : undefined,
  ];

  return classes.filter(Boolean).join(" ");
}

function toKebabClass(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-").replace(/[^a-z0-9-]+/g, "-");
}

const TABLE_EVIDENCE_RENDERER_STYLE = `
.table-evidence-cell {
  position: relative;
}

.table-evidence-invisible-overlay {
  pointer-events: none;
  user-select: none;
}

.table-evidence-invisible-mark::before {
  content: attr(data-mark);
}
`;
