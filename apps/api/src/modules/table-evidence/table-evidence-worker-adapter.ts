import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  TableSourceSnapshot,
} from "./table-evidence-record.ts";
import type {
  TableEvidenceCellSnapshot,
  TableEvidenceCaption,
  TableEvidenceInvisibleChar,
  TableEvidenceParagraph,
  TableEvidenceRunStyle,
  TableEvidenceTextRun,
} from "@medical/contracts";
import {
  buildPythonCommandCandidates,
  buildWorkspaceChildProcessEnv,
  isCommandUnavailableError,
} from "../shared/windows-command-runtime.ts";

const EXTRACT_DOCX_STRUCTURE_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/extract_docx_structure.py",
);

export interface TableEvidenceWorkerResult {
  parser: "python_docx_ooxml";
  parser_version: string;
  tables: TableSourceSnapshot[];
  warnings: string[];
}

export interface TableEvidenceWorkerAdapter {
  extractTables(input: {
    sourcePath: string;
    sourceFileAssetId: string;
  }): Promise<TableEvidenceWorkerResult>;
}

export class PythonTableEvidenceWorkerAdapter implements TableEvidenceWorkerAdapter {
  async extractTables(input: {
    sourcePath: string;
    sourceFileAssetId: string;
  }): Promise<TableEvidenceWorkerResult> {
    await readFile(input.sourcePath);
    const raw = await runWorker(input.sourcePath);
    return normalizeTableEvidenceWorkerResult(raw, input.sourceFileAssetId);
  }
}

async function runWorker(sourcePath: string): Promise<unknown> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCommandCandidates()) {
    try {
      return await runPythonScript(pythonBin, sourcePath);
    } catch (error) {
      if (isCommandUnavailableError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw (
    lastError ??
    new Error("No usable Python interpreter was found for table evidence extraction.")
  );
}

function runPythonScript(pythonBin: string, sourcePath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [EXTRACT_DOCX_STRUCTURE_SCRIPT, "--source-path", sourcePath],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: buildWorkspaceChildProcessEnv(),
      },
    );
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Table evidence extraction failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Table evidence extraction returned invalid JSON: ${String(error)}${
              stdout.trim() ? `\n${stdout.trim()}` : ""
            }`,
          ),
        );
      }
    });
  });
}

export function normalizeTableEvidenceWorkerResult(
  raw: unknown,
  sourceFileAssetId: string,
): TableEvidenceWorkerResult {
  if (!isRecord(raw)) {
    return {
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      tables: [],
      warnings: ["worker_payload_invalid:top_level_not_object"],
    };
  }

  const record = raw;
  const warnings = normalizeStringArray(record.warnings);
  if (!Array.isArray(record.tables)) {
    return {
      parser: "python_docx_ooxml",
      parser_version: readOptionalString(record.parser_version) ?? "table-evidence-v1",
      tables: [],
      warnings: [...warnings, "worker_payload_invalid:tables_missing"],
    };
  }

  const tableWarnings: string[] = [];
  const tables = record.tables
    .map((entry, index) => {
      if (!isRecord(entry)) {
        tableWarnings.push(`worker_payload_invalid:table_${index}_not_object`);
        return undefined;
      }
      return normalizeTableSnapshot(entry, index, sourceFileAssetId, warnings);
    })
    .filter((entry): entry is TableSourceSnapshot => Boolean(entry));

  return {
    parser: "python_docx_ooxml",
    parser_version: readOptionalString(record.parser_version) ?? "table-evidence-v1",
    tables,
    warnings: [...warnings, ...tableWarnings],
  };
}

function normalizeTableSnapshot(
  value: unknown,
  index: number,
  sourceFileAssetId: string,
  workerWarnings: string[],
): TableSourceSnapshot | undefined {
  const table = isRecord(value) ? value : {};
  const semantic = isRecord(table.semantic) ? table.semantic : table;
  const tableWarnings: string[] = [];
  const tableId = readOptionalString(semantic.table_id);
  if (!tableId) {
    tableWarnings.push("worker_payload_invalid:table_missing_table_id");
  }
  if (!Array.isArray(semantic.grid_cells)) {
    tableWarnings.push("worker_payload_invalid:table_missing_grid_cells");
  }
  const gridResult = normalizeGridCells(semantic.grid_cells, semantic);
  const gridCells = gridResult.cells;
  const objectEvidence = collectObjectEvidence(table, semantic);
  const warnings = [
    ...workerWarnings,
    ...tableWarnings,
    ...gridResult.warnings,
    ...normalizeStringArray(semantic.warnings),
    ...inferFidelityWarnings(gridCells, objectEvidence),
  ];
  const caption = normalizeCaption(semantic.caption_fields);
  const notes = normalizeNotes(semantic);

  return {
    snapshot_id: `${sourceFileAssetId}-${tableId ?? `table-${index + 1}`}-source`,
    table_id: tableId ?? `table-${index + 1}`,
    source_file_asset_id: sourceFileAssetId,
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: readOptionalNumber(semantic.row_count) ?? gridCells.length,
    column_count: readOptionalNumber(semantic.column_count) ?? inferColumnCount(gridCells),
    ...(caption ? { caption } : {}),
    notes,
    grid_cells: gridCells,
    object_evidence: objectEvidence,
    warnings: [...new Set(warnings)],
  };
}

function normalizeGridCells(
  value: unknown,
  semantic: Record<string, unknown>,
): { cells: TableEvidenceCellSnapshot[]; warnings: string[] } {
  if (!Array.isArray(value)) {
    return {
      cells: [],
      warnings: [],
    };
  }

  const warnings: string[] = [];
  const cells = value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        warnings.push("worker_payload_invalid:cell_not_object");
        return undefined;
      }
      const cell = entry;
      const missingRequiredFields =
        !readOptionalString(cell.id) ||
        typeof cell.row_index !== "number" ||
        typeof cell.column_index !== "number" ||
        typeof cell.row_span !== "number" ||
        typeof cell.column_span !== "number" ||
        !isValidCellRole(cell.inferred_role);
      if (missingRequiredFields) {
        warnings.push("worker_payload_invalid:cell_missing_required_fields");
      }
    const cellId = readOptionalString(cell.id) ?? `cell-${index + 1}`;
    const paragraphs = normalizeParagraphs(cell.paragraphs, cellId);
    const runs = paragraphs.flatMap((paragraph) => paragraph.runs);
    const fallbackText = readGuaranteeString(cell.text) ?? "";
    const textPayload = buildCellTextPayload(paragraphs, fallbackText);
    const displayText = readGuaranteeString(cell.display_text);
    const text = textPayload.text;
    const role = normalizeCellRole(cell.inferred_role);

      return {
      cell_id: cellId,
      row: readOptionalNumber(cell.row_index) ?? 0,
      column: readOptionalNumber(cell.column_index) ?? 0,
      rowspan: readOptionalNumber(cell.row_span) ?? 1,
      colspan: readOptionalNumber(cell.column_span) ?? 1,
      role,
      text,
      ...(displayText !== undefined ? { display_text: displayText } : {}),
      codepoints: textPayload.codepoints,
      paragraphs,
      runs,
      header_path: inferHeaderPath(cellId, role, text, semantic),
      row_header_path: role === "stub" ? [text].filter(Boolean) : [],
      column_header_path: inferColumnHeaderPath(cellId, cell, role, text, semantic),
      invisible_chars: runs.flatMap((run) => run.invisible_chars),
      style_summary: buildStyleSummary(cell),
    };
    })
    .filter((entry): entry is TableEvidenceCellSnapshot => Boolean(entry));

  return {
    cells,
    warnings: [...new Set(warnings)],
  };
}

function normalizeParagraphs(value: unknown, cellId: string): TableEvidenceParagraph[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry, paragraphIndex) => {
    const paragraph = isRecord(entry) ? entry : {};
    const paragraphId = readOptionalString(paragraph.id) ?? `${cellId}-paragraph-${paragraphIndex}`;
    return {
      id: paragraphId,
      runs: normalizeRuns(paragraph.fragments, paragraphId),
      paragraph_boundary_after:
        typeof paragraph.paragraph_boundary_after === "boolean"
          ? paragraph.paragraph_boundary_after
          : paragraphIndex < value.length - 1,
      ...(isRecord(paragraph.style) ? { style: structuredClone(paragraph.style) } : {}),
    };
  });
}

function normalizeRuns(value: unknown, paragraphId: string): TableEvidenceTextRun[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry, index) => {
    const fragment = isRecord(entry) ? entry : {};
    const text = readGuaranteeString(fragment.text) ?? "";
    const kind = normalizeRunKind(fragment.kind);
    const run: TableEvidenceTextRun = {
      id: readOptionalString(fragment.id) ?? `${paragraphId}-run-${index}`,
      kind,
      text,
      codepoints: normalizeStringArray(fragment.codepoints),
      style: normalizeRunStyle(fragment.style),
      invisible_chars: normalizeInvisibleChars(fragment.invisible_chars, `${paragraphId}-run-${index}`),
      ...(readOptionalString(fragment.symbol_font)
        ? { symbol_font: readOptionalString(fragment.symbol_font) }
        : {}),
      ...(readOptionalString(fragment.symbol_char)
        ? { symbol_char: readOptionalString(fragment.symbol_char) }
        : {}),
      ...(readOptionalString(fragment.object_id)
        ? { object_id: readOptionalString(fragment.object_id) }
        : {}),
      ...(readOptionalString(fragment.object_kind)
        ? { object_kind: readOptionalString(fragment.object_kind) }
        : {}),
    };

    if (run.codepoints.length === 0) {
      run.codepoints = codepointsForText(text);
    }
    return run;
  });
}

function normalizeCaption(value: unknown): TableEvidenceCaption | undefined {
  const record = isRecord(value) ? value : {};
  const text = readGuaranteeString(record.text);
  if (text === undefined) {
    return undefined;
  }
  const paragraphs = normalizeParagraphs(record.paragraphs, "caption");
  const runs = paragraphs.flatMap((paragraph) => paragraph.runs);
  return {
    text,
    ...(readOptionalString(record.label_text)
      ? { label_text: readOptionalString(record.label_text) }
      : {}),
    ...(readOptionalString(record.title_text)
      ? { title_text: readOptionalString(record.title_text) }
      : {}),
    runs: runs.length
      ? runs
      : [
          {
            id: "caption-run-0",
            kind: "text",
            text,
            codepoints: codepointsForText(text),
            style: {},
            invisible_chars: [],
          },
        ],
  };
}

function normalizeNotes(semantic: Record<string, unknown>): TableEvidenceParagraph[] {
  const noteZone = isRecord(semantic.note_zone) ? semantic.note_zone : {};
  const zoneParagraphs = normalizeParagraphs(noteZone.paragraphs, "note-zone");
  if (zoneParagraphs.length) {
    return zoneParagraphs;
  }

  if (!Array.isArray(semantic.footnote_items)) {
    return [];
  }

  return semantic.footnote_items.flatMap((entry, index) => {
    const item = isRecord(entry) ? entry : {};
    const paragraphs = normalizeParagraphs(item.paragraphs, `footnote-${index}`);
    if (paragraphs.length) {
      return paragraphs;
    }
    const text = readGuaranteeString(item.text);
    return text
      ? [
          {
            id: `footnote-${index}-paragraph-0`,
            paragraph_boundary_after: true,
            runs: [
              {
                id: `footnote-${index}-run-0`,
                kind: "text" as const,
                text,
                codepoints: codepointsForText(text),
                style: {},
                invisible_chars: [],
              },
            ],
          },
        ]
      : [];
  });
}

function collectObjectEvidence(
  table: Record<string, unknown>,
  semantic: Record<string, unknown>,
): Record<string, unknown>[] {
  const fromTable = Array.isArray(table.objects) ? table.objects : [];
  const fromSemantic = Array.isArray(semantic.object_evidence) ? semantic.object_evidence : [];
  const fromCells = Array.isArray(semantic.grid_cells)
    ? semantic.grid_cells.flatMap((entry) => {
        const cell = isRecord(entry) ? entry : {};
        return Array.isArray(cell.object_evidence) ? cell.object_evidence : [];
      })
    : [];
  return [...fromTable, ...fromSemantic, ...fromCells]
    .filter(isRecord)
    .map((entry) => structuredClone(entry));
}

function inferFidelityWarnings(
  cells: TableEvidenceCellSnapshot[],
  objects: Record<string, unknown>[],
): string[] {
  const warnings: string[] = [];
  if (
    objects.some(
      (entry) =>
        entry.object_kind === "ocr_image_table" ||
        (entry.object_kind === "image" && entry.intended_target === "manual_ocr_table_review"),
    )
  ) {
    warnings.push("image_only_table");
  }
  if (
    objects.some(
      (entry) =>
        entry.object_kind === "nested_table",
    )
  ) {
    warnings.push("nested_table_unsupported");
  }
  if (objects.some((entry) => entry.object_kind === "text_box_table")) {
    warnings.push("text_box_table_unsupported");
  }
  if (
    cells.some((cell) =>
      cell.runs.some(
        (run) => run.kind === "symbol" && (!run.text || run.codepoints.length === 0),
      ),
    )
  ) {
    warnings.push("unknown_symbol_mapping");
  }
  return warnings;
}

function buildStyleSummary(cell: Record<string, unknown>): TableEvidenceCellSnapshot["style_summary"] {
  const styleEvidence = isRecord(cell.style_evidence) ? cell.style_evidence : {};
  const borderHints = isRecord(cell.border_hints) ? cell.border_hints : {};
  const scriptPosition = readStyleFactString(styleEvidence.script_position);
  return {
    ...(readStyleFactBoolean(styleEvidence.bold) !== undefined
      ? { bold: readStyleFactBoolean(styleEvidence.bold) }
      : {}),
    ...(readStyleFactBoolean(styleEvidence.italic) !== undefined
      ? { italic: readStyleFactBoolean(styleEvidence.italic) }
      : {}),
    ...(scriptPosition ? { script_positions: [scriptPosition] } : {}),
    ...(Object.keys(borderHints).length
      ? { border_profile: JSON.stringify(borderHints) }
      : {}),
    ...(readStyleFactString(styleEvidence.alignment)
      ? { horizontal_alignment: readStyleFactString(styleEvidence.alignment) }
      : {}),
    ...(readStyleFactString(styleEvidence.vertical_alignment)
      ? { vertical_alignment: readStyleFactString(styleEvidence.vertical_alignment) }
      : {}),
  };
}

function normalizeRunStyle(value: unknown): TableEvidenceRunStyle {
  const record = isRecord(value) ? value : {};
  const scriptPosition = readStyleFactString(record.script_position);
  return {
    ...(readStyleFactString(record.font_family)
      ? { font_family: readStyleFactString(record.font_family) }
      : {}),
    ...(readStyleFactNumber(record.font_size_pt) !== undefined
      ? { font_size_pt: readStyleFactNumber(record.font_size_pt) }
      : {}),
    ...(readStyleFactBoolean(record.bold) !== undefined
      ? { bold: readStyleFactBoolean(record.bold) }
      : {}),
    ...(readStyleFactBoolean(record.italic) !== undefined
      ? { italic: readStyleFactBoolean(record.italic) }
      : {}),
    ...(scriptPosition === "superscript" ? { superscript: true } : {}),
    ...(scriptPosition === "subscript" ? { subscript: true } : {}),
    ...(scriptPosition ? { script_position: normalizeScriptPosition(scriptPosition) } : {}),
  };
}

function inferHeaderPath(
  cellId: string,
  role: string,
  text: string,
  semantic: Record<string, unknown>,
): string[] {
  if (role !== "header") {
    return [];
  }
  const headerCell = findSemanticCell(semantic.header_cells, cellId);
  const headerPath = normalizeStringArray(headerCell?.header_path);
  return headerPath.length ? headerPath : [text].filter(Boolean);
}

function inferColumnHeaderPath(
  cellId: string,
  cell: Record<string, unknown>,
  role: string,
  text: string,
  semantic: Record<string, unknown>,
): string[] {
  if (role === "header") {
    return [text].filter(Boolean);
  }
  const dataCell = findSemanticCell(semantic.data_cells, cellId);
  const coordinate = isRecord(dataCell?.coordinate) ? dataCell.coordinate : {};
  return normalizeStringArray(coordinate.header_path);
}

function findSemanticCell(value: unknown, sourceCellId: string): Record<string, unknown> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.find((entry) => isRecord(entry) && entry.source_cell_id === sourceCellId);
}

function buildCellTextPayload(
  paragraphs: TableEvidenceParagraph[],
  fallbackText: string,
): { text: string; codepoints: string[] } {
  if (paragraphs.length === 0) {
    return {
      text: fallbackText,
      codepoints: codepointsForText(fallbackText),
    };
  }

  const textParts: string[] = [];
  const codepoints: string[] = [];

  paragraphs.forEach((paragraph, index) => {
    const paragraphText = paragraph.runs.map((run) => run.text).join("");
    textParts.push(paragraphText);
    codepoints.push(
      ...paragraph.runs.flatMap((run) =>
        run.codepoints.length ? run.codepoints : codepointsForText(run.text),
      ),
    );

    if (index < paragraphs.length - 1 && paragraph.paragraph_boundary_after) {
      textParts.push("\n");
      codepoints.push("000A");
    }
  });

  return {
    text: textParts.join(""),
    codepoints,
  };
}

function codepointsForText(text: string): string[] {
  return [...text].map((character) =>
    character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "",
  );
}

function normalizeInvisibleChars(value: unknown, prefix: string): TableEvidenceInvisibleChar[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry, index) => {
      const record = isRecord(entry) ? entry : {};
      const kind = readOptionalString(record.kind);
      const codepoint = readOptionalString(record.codepoint);
      const offset = readOptionalNumber(record.offset);
      const length = readOptionalNumber(record.length);
      if (!kind || !codepoint || offset === undefined || length === undefined) {
        return undefined;
      }
      return {
        id: `${prefix}-invisible-${index}`,
        kind: normalizeInvisibleKind(kind),
        codepoint,
        offset,
        length,
      };
    })
    .filter((entry): entry is TableEvidenceInvisibleChar => Boolean(entry));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeRunKind(value: unknown): TableEvidenceTextRun["kind"] {
  return value === "symbol" ||
    value === "tab" ||
    value === "line_break" ||
    value === "object" ||
    value === "paragraph_boundary"
    ? value
    : "text";
}

function normalizeCellRole(value: unknown): TableEvidenceCellSnapshot["role"] {
  return value === "header" || value === "stub" || value === "data" ? value : "unknown";
}

function isValidCellRole(value: unknown): boolean {
  return value === "header" || value === "stub" || value === "data" || value === "unknown";
}

function normalizeInvisibleKind(kind: string): TableEvidenceInvisibleChar["kind"] {
  if (
    kind === "space" ||
    kind === "full_width_space" ||
    kind === "nbsp" ||
    kind === "tab" ||
    kind === "line_break" ||
    kind === "paragraph_boundary" ||
    kind === "leading_space" ||
    kind === "trailing_space" ||
    kind === "consecutive_space"
  ) {
    return kind;
  }
  return "space";
}

function normalizeScriptPosition(
  value: string,
): NonNullable<TableEvidenceRunStyle["script_position"]> {
  return value === "baseline" || value === "superscript" || value === "subscript"
    ? value
    : "unknown";
}

function inferColumnCount(cells: TableEvidenceCellSnapshot[]): number {
  return cells.reduce((max, cell) => Math.max(max, cell.column + cell.colspan), 0);
}

function readStyleFactString(value: unknown): string | undefined {
  const record = isRecord(value) ? value : {};
  return record.availability === "authoritative" && typeof record.value === "string"
    ? record.value
    : undefined;
}

function readStyleFactNumber(value: unknown): number | undefined {
  const record = isRecord(value) ? value : {};
  return record.availability === "authoritative" && typeof record.value === "number"
    ? record.value
    : undefined;
}

function readStyleFactBoolean(value: unknown): boolean | undefined {
  const record = isRecord(value) ? value : {};
  return record.availability === "authoritative" && typeof record.value === "boolean"
    ? record.value
    : undefined;
}

function readGuaranteeString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
