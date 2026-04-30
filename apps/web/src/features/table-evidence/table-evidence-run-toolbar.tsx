import type {
  TableCorrectionOperation,
  TableEvidenceCellSnapshot,
  TableEvidenceRunStyle,
} from "./table-evidence-types.ts";
import { selectEditableRun } from "./table-evidence-cell-editor.tsx";

export interface TableEvidenceRunToolbarProps {
  cell?: TableEvidenceCellSnapshot;
  selectedRunId?: string;
  onOperation: (operation: TableCorrectionOperation) => void;
}

export function TableEvidenceRunToolbar({
  cell,
  selectedRunId,
  onOperation,
}: TableEvidenceRunToolbarProps) {
  const selection = cell ? selectEditableRun(cell, selectedRunId) : undefined;
  const run = selection?.run;
  const paragraph = selection?.paragraph;

  function commitStyle(style: TableEvidenceRunStyle) {
    if (!cell || !paragraph || !run) {
      return;
    }

    onOperation({
      op: "set_run_style",
      cell_id: cell.cell_id,
      paragraph_id: paragraph.id,
      run_id: run.id,
      style,
    });
  }

  return (
    <section className="table-evidence-toolbar" aria-label="运行样式工具栏">
      <button
        type="button"
        aria-label="加粗"
        data-run-style="bold"
        onClick={() => commitStyle({ bold: true })}
      >
        B
      </button>
      <button
        type="button"
        aria-label="斜体"
        data-run-style="italic"
        onClick={() => commitStyle({ italic: true })}
      >
        I
      </button>
      <button
        type="button"
        aria-label="下划线"
        data-run-style="underline"
        onClick={() => commitStyle({ underline: true })}
      >
        U
      </button>
      <button
        type="button"
        aria-label="上标"
        data-run-style="superscript"
        onClick={() => commitStyle({ superscript: true, script_position: "superscript" })}
      >
        x²
      </button>
      <button
        type="button"
        aria-label="下标"
        data-run-style="subscript"
        onClick={() => commitStyle({ subscript: true, script_position: "subscript" })}
      >
        x₂
      </button>
    </section>
  );
}
