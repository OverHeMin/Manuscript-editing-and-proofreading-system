import type {
  ConfirmedTableSnapshot,
  TableCorrectionPatch,
  TableSourceSnapshot,
} from "./table-evidence-record.ts";
import type {
  TableEvidenceCellSnapshot,
  TableEvidenceInvisibleChar,
  TableEvidenceParagraph,
  TableEvidenceTextRun,
} from "@medical/contracts";

export function applyTableCorrectionPatch(input: {
  sourceSnapshot: TableSourceSnapshot;
  patch: TableCorrectionPatch;
}): ConfirmedTableSnapshot {
  const confirmed: ConfirmedTableSnapshot = {
    snapshot_id: `${input.sourceSnapshot.snapshot_id}:confirmed`,
    source_snapshot_id: input.sourceSnapshot.snapshot_id,
    row_count: input.sourceSnapshot.row_count,
    column_count: input.sourceSnapshot.column_count,
    ...(input.sourceSnapshot.caption
      ? { caption: structuredClone(input.sourceSnapshot.caption) }
      : {}),
    notes: structuredClone(input.sourceSnapshot.notes),
    grid_cells: structuredClone(input.sourceSnapshot.grid_cells),
  };

  for (const operation of input.patch.operations) {
    switch (operation.op) {
      case "replace_caption":
        confirmed.caption = structuredClone(operation.caption);
        break;
      case "replace_notes":
        confirmed.notes = structuredClone(operation.notes);
        break;
      case "replace_run_text":
        replaceRunText(confirmed.grid_cells, operation);
        break;
      case "set_run_style":
        setRunStyle(confirmed.grid_cells, operation);
        break;
      case "set_cell_structure":
        {
          const cell = requireCell(confirmed.grid_cells, operation.cell_id);
          cell.row = operation.row;
          cell.column = operation.column;
          cell.rowspan = operation.rowspan;
          cell.colspan = operation.colspan;
        }
        break;
      case "set_cell_borders":
        requireCell(confirmed.grid_cells, operation.cell_id).style_summary.border_profile =
          operation.border_profile;
        break;
      case "set_cell_alignment":
        {
          const cell = requireCell(confirmed.grid_cells, operation.cell_id);
          if (operation.horizontal_alignment !== undefined) {
            cell.style_summary.horizontal_alignment = operation.horizontal_alignment;
          }
          if (operation.vertical_alignment !== undefined) {
            cell.style_summary.vertical_alignment = operation.vertical_alignment;
          }
        }
        break;
      case "confirm_invisible_chars":
        {
          const allowedCells = validateCellIds(confirmed.grid_cells, operation.cell_ids);
          validateInvisibleCharIds(
            allowedCells,
            operation.confirmed_invisible_char_ids,
          );
        }
        break;
      case "confirm_special_symbols":
        {
          const allowedCells = validateCellIds(confirmed.grid_cells, operation.cell_ids);
          validateSymbolRunIds(allowedCells, operation.confirmed_symbol_run_ids);
        }
        break;
    }
  }

  confirmed.grid_cells = confirmed.grid_cells.map(recomputeCellText);
  return confirmed;
}

function replaceRunText(
  cells: TableEvidenceCellSnapshot[],
  operation: Extract<TableCorrectionPatch["operations"][number], { op: "replace_run_text" }>,
): void {
  const run = requireRun(cells, operation.cell_id, operation.paragraph_id, operation.run_id);
  if (run.text !== operation.before_text) {
    throw new Error(
      `Table correction patch before_text mismatch for run ${operation.run_id}: expected "${operation.before_text}", found "${run.text}".`,
    );
  }
  run.text = operation.after_text;
  run.codepoints = [...operation.after_codepoints];
  run.invisible_chars = classifyInvisibleChars(operation.after_text, run.id);
}

function setRunStyle(
  cells: TableEvidenceCellSnapshot[],
  operation: Extract<TableCorrectionPatch["operations"][number], { op: "set_run_style" }>,
): void {
  const run = requireRun(cells, operation.cell_id, operation.paragraph_id, operation.run_id);
  run.style = { ...run.style, ...operation.style };
}

function requireRun(
  cells: TableEvidenceCellSnapshot[],
  cellId: string,
  paragraphId: string,
  runId: string,
): TableEvidenceTextRun {
  const cell = requireCell(cells, cellId);
  const paragraph = cell.paragraphs.find((entry) => entry.id === paragraphId);
  if (!paragraph) {
    throw new Error(
      `Table correction patch paragraph ${paragraphId} was not found in cell ${cellId}.`,
    );
  }
  const run = paragraph.runs.find((entry) => entry.id === runId);
  if (!run) {
    throw new Error(
      `Table correction patch run ${runId} was not found in paragraph ${paragraphId}.`,
    );
  }
  return run;
}

function requireCell(
  cells: TableEvidenceCellSnapshot[],
  cellId: string,
): TableEvidenceCellSnapshot {
  const cell = cells.find((entry) => entry.cell_id === cellId);
  if (!cell) {
    throw new Error(`Table correction patch cell ${cellId} was not found.`);
  }
  return cell;
}

function validateCellIds(
  cells: TableEvidenceCellSnapshot[],
  cellIds: string[],
): TableEvidenceCellSnapshot[] {
  return cellIds.map((cellId) => requireCell(cells, cellId));
}

function validateSymbolRunIds(
  cells: TableEvidenceCellSnapshot[],
  runIds: string[],
): void {
  const existingRunIds = new Set(
    cells.flatMap((cell) => cell.runs.map((run) => run.id)),
  );

  runIds.forEach((runId) => {
    if (!existingRunIds.has(runId)) {
      throw new Error(`Table correction patch symbol run ${runId} was not found.`);
    }
  });
}

function validateInvisibleCharIds(
  cells: TableEvidenceCellSnapshot[],
  invisibleCharIds: string[],
): void {
  const existingInvisibleCharIds = new Set(
    cells.flatMap((cell) => cell.invisible_chars.map((entry) => entry.id)),
  );

  invisibleCharIds.forEach((invisibleCharId) => {
    if (!existingInvisibleCharIds.has(invisibleCharId)) {
      throw new Error(
        `Table correction patch invisible char ${invisibleCharId} was not found.`,
      );
    }
  });
}

function recomputeCellText(cell: TableEvidenceCellSnapshot): TableEvidenceCellSnapshot {
  const paragraphs = cell.paragraphs.map(recomputeParagraphText);
  if (paragraphs.length === 0) {
    return cell;
  }
  const runs = paragraphs.flatMap((paragraph) => paragraph.runs);
  const textParts: string[] = [];
  const codepoints: string[] = [];

  paragraphs.forEach((paragraph, index) => {
    textParts.push(paragraph.runs.map((run) => run.text).join(""));
    codepoints.push(...paragraph.runs.flatMap((run) => run.codepoints));
    if (index < paragraphs.length - 1 && paragraph.paragraph_boundary_after) {
      textParts.push("\n");
      codepoints.push("000A");
    }
  });

  const text = textParts.join("");

  return {
    ...cell,
    text,
    display_text: text,
    codepoints,
    paragraphs,
    runs,
    invisible_chars: runs.flatMap((run) => run.invisible_chars),
  };
}

function recomputeParagraphText(paragraph: TableEvidenceParagraph): TableEvidenceParagraph {
  return {
    ...paragraph,
    runs: paragraph.runs.map((run) => ({
      ...run,
      codepoints: run.codepoints.length ? [...run.codepoints] : codepointsForText(run.text),
      invisible_chars: run.invisible_chars.map((entry) => ({ ...entry })),
    })),
  };
}

function codepointsForText(text: string): string[] {
  return [...text].map((character) =>
    character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "",
  );
}

function classifyInvisibleChars(
  text: string,
  runId: string,
): TableEvidenceInvisibleChar[] {
  const entries: TableEvidenceInvisibleChar[] = [];
  [...text].forEach((character, offset) => {
    const codepoint =
      character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "";
    const kind =
      character === " "
        ? "space"
        : character === "\u3000"
          ? "full_width_space"
          : character === "\u00A0"
            ? "nbsp"
            : character === "\t"
              ? "tab"
              : character === "\n"
                ? "line_break"
                : undefined;
    if (kind) {
      entries.push({
        id: `${runId}-invisible-${offset}`,
        kind,
        codepoint,
        offset,
        length: 1,
      });
    }
  });
  return entries;
}
