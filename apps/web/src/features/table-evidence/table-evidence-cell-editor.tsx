import type { ChangeEvent } from "react";
import type {
  TableCorrectionOperation,
  TableEvidenceCellSnapshot,
  TableEvidenceParagraph,
  TableEvidenceTextRun,
} from "./table-evidence-types.ts";

export interface TableEvidenceCellEditorProps {
  cell?: TableEvidenceCellSnapshot;
  selectedRunId?: string;
  onOperation: (operation: TableCorrectionOperation) => void;
}

export function TableEvidenceCellEditor({
  cell,
  selectedRunId,
  onOperation,
}: TableEvidenceCellEditorProps) {
  const selection = cell ? selectEditableRun(cell, selectedRunId) : undefined;
  const run = selection?.run;

  if (!cell || !run) {
    return (
      <section className="table-evidence-panel table-evidence-cell-editor" data-empty="true">
        <h3>单元格编辑</h3>
        <p>请选择一个包含文本运行的单元格。</p>
      </section>
    );
  }

  function handleTextCommit(event: ChangeEvent<HTMLTextAreaElement>) {
    if (!cell || !run || event.currentTarget.value === run.text) {
      return;
    }

    const operation = buildReplaceRunTextOperation(
      cell,
      run.id,
      event.currentTarget.value,
    );
    if (operation) {
      onOperation(operation);
    }
  }

  return (
    <section
      className="table-evidence-panel table-evidence-cell-editor"
      data-cell-id={cell.cell_id}
    >
      <h3>单元格编辑</h3>
      <label>
        文本
        <textarea
          data-cell-editor-field="text"
          defaultValue={run.text}
          key={`${cell.cell_id}:${run.id}:${run.text}`}
          onBlur={handleTextCommit}
          rows={4}
        />
      </label>
      <dl>
        <div>
          <dt>位置</dt>
          <dd>
            R{cell.row + 1} C{cell.column + 1}
          </dd>
        </div>
        <div>
          <dt>跨度</dt>
          <dd>
            {cell.rowspan} x {cell.colspan}
          </dd>
        </div>
        <div>
          <dt>Codepoints</dt>
          <dd>{run.codepoints.join(" ") || cell.codepoints.join(" ")}</dd>
        </div>
      </dl>
    </section>
  );
}

export function selectEditableRun(
  cell: TableEvidenceCellSnapshot,
  selectedRunId?: string,
): { paragraph: TableEvidenceParagraph; run: TableEvidenceTextRun } | undefined {
  const paragraphSelection = findParagraphRun(cell, selectedRunId);
  if (paragraphSelection) {
    return paragraphSelection;
  }

  const firstTextRun = cell.paragraphs
    .flatMap((paragraph) => paragraph.runs.map((run) => ({ paragraph, run })))
    .find((entry) => entry.run.kind === "text");
  if (firstTextRun) {
    return firstTextRun;
  }

  const firstParagraph = cell.paragraphs[0];
  const firstRun = firstParagraph?.runs[0];
  return firstParagraph && firstRun
    ? { paragraph: firstParagraph, run: firstRun }
    : undefined;
}

export function buildReplaceRunTextOperation(
  cell: TableEvidenceCellSnapshot,
  selectedRunId: string | undefined,
  afterText: string,
): Extract<TableCorrectionOperation, { op: "replace_run_text" }> | undefined {
  const selection = selectEditableRun(cell, selectedRunId);
  if (!selection || selection.run.text === afterText) {
    return undefined;
  }

  return {
    op: "replace_run_text",
    cell_id: cell.cell_id,
    paragraph_id: selection.paragraph.id,
    run_id: selection.run.id,
    before_text: selection.run.text,
    after_text: afterText,
    after_codepoints: codepointsForText(afterText),
  };
}

function findParagraphRun(
  cell: TableEvidenceCellSnapshot,
  selectedRunId?: string,
): { paragraph: TableEvidenceParagraph; run: TableEvidenceTextRun } | undefined {
  if (!selectedRunId) {
    return undefined;
  }

  for (const paragraph of cell.paragraphs) {
    const run = paragraph.runs.find((entry) => entry.id === selectedRunId);
    if (run) {
      return { paragraph, run };
    }
  }

  return undefined;
}

function codepointsForText(text: string): string[] {
  return [...text].map((character) =>
    character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "",
  );
}
