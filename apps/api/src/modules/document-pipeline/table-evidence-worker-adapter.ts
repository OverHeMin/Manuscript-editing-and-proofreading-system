import { spawn } from "node:child_process";
import path from "node:path";

import {
  type AiReadableTablePayloadCell,
  type TableEvidenceCell,
  type TableEvidenceCharacter,
  type TableEvidenceCharacterClass,
  tableEvidenceCharacterClasses,
  type TableEvidenceRun,
  type TableEvidenceSnapshot,
  type TableEvidenceStyleSpan,
  type TableEvidenceTable,
} from "./table-evidence-record.ts";
import type { TableEvidenceWorker } from "./table-evidence-center.ts";
import {
  buildPythonCommandCandidates,
  buildWorkspaceChildProcessEnv,
  isCommandUnavailableError,
} from "../shared/windows-command-runtime.ts";

const EXTRACT_DOCX_STRUCTURE_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/extract_docx_structure.py",
);

export class PythonTableEvidenceWorkerAdapter implements TableEvidenceWorker {
  private readonly pythonCandidates: string[];
  private readonly scriptPath: string;

  constructor(options: { pythonCandidates?: string[]; scriptPath?: string } = {}) {
    this.pythonCandidates =
      options.pythonCandidates ?? buildPythonCommandCandidates();
    this.scriptPath = options.scriptPath ?? EXTRACT_DOCX_STRUCTURE_SCRIPT;
  }

  async extract(
    input: Parameters<TableEvidenceWorker["extract"]>[0],
  ): Promise<TableEvidenceSnapshot> {
    let lastError: Error | undefined;
    for (const pythonBin of this.pythonCandidates) {
      try {
        const workerResult = await runWorker({
          pythonBin,
          scriptPath: this.scriptPath,
          sourcePath: input.sourcePath,
        });
        return normalizeTableEvidenceWorkerResult({
          manuscriptId: input.manuscriptId,
          assetId: input.assetId,
          sourceStorageKey: input.sourceStorageKey,
          docxHash: input.docxHash,
          parserVersion: input.parserVersion,
          snapshotId: input.snapshotId,
          createdAt: input.createdAt,
          workerResult,
        });
      } catch (error) {
        if (isCommandUnavailableError(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError ?? new Error("No usable Python interpreter was found.");
  }
}

export function normalizeTableEvidenceWorkerResult(input: {
  manuscriptId: string;
  assetId: string;
  sourceStorageKey: string;
  docxHash: string;
  parserVersion: string;
  snapshotId: string;
  createdAt: string;
  workerResult: unknown;
}): TableEvidenceSnapshot {
  const record = isRecord(input.workerResult) ? input.workerResult : {};
  const tables = normalizeTables(record.tables);
  const workerWarnings = normalizeStringArray(record.warnings);
  const missingAuthority = tables.flatMap((table) => table.fidelityReport.warnings);
  const status =
    record.status === "ready"
      ? missingAuthority.length === 0
        ? "complete"
        : "partial"
      : record.status === "needs_manual_review"
        ? "unsupported"
        : "failed";

  return {
    snapshotId: input.snapshotId,
    manuscriptId: input.manuscriptId,
    assetId: input.assetId,
    sourceStorageKey: input.sourceStorageKey,
    docxHash: input.docxHash,
    parserVersion: input.parserVersion,
    createdAt: input.createdAt,
    status,
    tables,
    warnings: [...workerWarnings, ...missingAuthority].map((message) => ({
      code: "table_evidence_warning",
      message,
    })),
  };
}

function normalizeTables(value: unknown): TableEvidenceTable[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry, index) => normalizeTable(entry, index));
}

function normalizeTable(value: unknown, index: number): TableEvidenceTable {
  const record = isRecord(value) ? value : {};
  const ordinal = readNumber(record.order) ?? index + 1;
  const tableId = `table-${ordinal}`;
  const rowCount = readNumber(record.row_count) ?? 0;
  const columnCount = readNumber(record.column_count) ?? 0;
  const rawRows = Array.isArray(record.raw_rows) ? record.raw_rows : [];
  const cells = rawRows.flatMap((row, rowIndex) =>
    Array.isArray(row)
      ? row.map((cell, cellIndex) =>
          normalizeCell(cell, {
            tableId,
            rowIndex,
            cellIndex,
          }),
        )
      : [],
  );
  const warnings = [
    ...(readString(record.raw_tbl_xml) ? [] : [`${tableId} missing rawTblXml.`]),
    ...(readString(record.ooxml_hash) ? [] : [`${tableId} missing ooxmlHash.`]),
  ];
  const aiCells = cells.map(toAiPayloadCell);
  const specialCharacterWarnings = aiCells.flatMap((cell) =>
    cell.characterClasses
      .filter((character) => character.charClass !== "normal")
      .map(
        (character) =>
          `${cell.cellId}:${character.codePoint}:${character.charClass}`,
      ),
  );

  return {
    tableId,
    ordinal,
    bodyPath:
      readString(record.body_path) ?? `word/document.xml/body/tbl[${ordinal}]`,
    ooxmlHash: readString(record.ooxml_hash) ?? "",
    rawTblXml: readString(record.raw_tbl_xml),
    rowCount,
    columnCount,
    cells,
    aiPayload: {
      tableId,
      caption: readString(record.caption),
      notes: normalizeStringArray(record.notes),
      rowCount,
      columnCount,
      cells: aiCells,
      specialCharacterWarnings,
      lowConfidenceReasons: warnings,
    },
    fidelityReport: {
      status: warnings.length === 0 ? "complete" : "partial",
      warnings,
    },
  };
}

function normalizeCell(
  value: unknown,
  fallback: { tableId: string; rowIndex: number; cellIndex: number },
): TableEvidenceCell {
  const record = isRecord(value) ? value : {};
  const rowIndex = fallback.rowIndex;
  const columnIndex = readNumber(record.grid_column_index) ?? fallback.cellIndex;
  const cellId = `${fallback.tableId}-cell-${rowIndex}-${columnIndex}`;
  const characters = normalizeCharacters(record.characters);
  const styleSpans = normalizeStyleSpans(record.style_spans);
  return {
    cellId,
    rowIndex,
    columnIndex,
    rowSpan: readNumber(record.row_span) ?? 1,
    columnSpan: readNumber(record.column_span) ?? 1,
    tcPath: readString(record.tc_path) ?? "",
    rawTcXml: readString(record.raw_xml_text) ?? "",
    tcHash: readString(record.tc_hash) ?? "",
    text: readString(record.text) ?? "",
    paragraphs: normalizeParagraphs(record.paragraphs),
    runs: normalizeRuns(record.runs),
    characters,
    styleSpans,
  };
}

function normalizeParagraphs(value: unknown): TableEvidenceCell["paragraphs"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    return {
      paragraphId:
        readString(record.paragraph_id) ??
        readString(record.id) ??
        `paragraph-${index + 1}`,
      pPath: readString(record.p_path) ?? "",
      rawPXml: readString(record.raw_p_xml) ?? "",
      pHash: readString(record.p_hash) ?? "",
    };
  });
}

function normalizeRuns(value: unknown): TableEvidenceRun[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    const runId = readString(record.runId) ?? `run-${index + 1}`;
    const styleSpan = normalizeStyleSpan(
      record.styleSpan ?? record.style_span,
      runId,
    );
    return {
      runId,
      runPath: readString(record.runPath) ?? readString(record.run_path) ?? "",
      rawRunXml:
        readString(record.rawRunXml) ?? readString(record.raw_run_xml) ?? "",
      runHash: readString(record.runHash) ?? readString(record.run_hash) ?? "",
      text: readString(record.text) ?? "",
      characters: normalizeCharacters(record.characters),
      styleSpan,
    };
  });
}

function normalizeCharacters(value: unknown): TableEvidenceCharacter[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    return {
      index: readNumber(record.index) ?? index,
      char: readString(record.char) ?? "",
      codePoint: readString(record.codePoint) ?? "",
      unicodeName: readString(record.unicodeName),
      charClass: normalizeCharacterClass(record.charClass),
      sourceRunId: readString(record.sourceRunId) ?? "",
      preserved: true,
      visible: typeof record.visible === "boolean" ? record.visible : true,
    };
  });
}

function normalizeStyleSpans(value: unknown): TableEvidenceStyleSpan[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry, index) =>
    normalizeStyleSpan(entry, `style-run-${index + 1}`),
  );
}

function normalizeStyleSpan(value: unknown, fallbackRunId: string): TableEvidenceStyleSpan {
  const record = isRecord(value) ? value : {};
  return {
    runId: readString(record.runId) ?? readString(record.run_id) ?? fallbackRunId,
    startIndex: readNumber(record.startIndex) ?? readNumber(record.start_index) ?? 0,
    endIndex: readNumber(record.endIndex) ?? readNumber(record.end_index) ?? 0,
    italic: readBoolean(record.italic),
    bold: readBoolean(record.bold),
    underline: readBoolean(record.underline),
    scriptPosition:
      readString(record.scriptPosition) ?? readString(record.script_position),
    fontFamily: readString(record.fontFamily) ?? readString(record.font_family),
    fontSizePt: readNumber(record.fontSizePt) ?? readNumber(record.font_size_pt),
  };
}

function toAiPayloadCell(cell: TableEvidenceCell): AiReadableTablePayloadCell {
  return {
    cellId: cell.cellId,
    rowIndex: cell.rowIndex,
    columnIndex: cell.columnIndex,
    rowSpan: cell.rowSpan,
    columnSpan: cell.columnSpan,
    text: cell.text,
    characterClasses: cell.characters.map((character) => ({
      index: character.index,
      char: character.char,
      codePoint: character.codePoint,
      charClass: character.charClass,
    })),
    styleSpans: cell.styleSpans,
  };
}

async function runWorker(input: {
  pythonBin: string;
  scriptPath: string;
  sourcePath: string;
}): Promise<unknown> {
  const child = spawn(
    input.pythonBin,
    [input.scriptPath, "--source-path", input.sourcePath],
    {
      env: buildWorkspaceChildProcessEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(
      `Table evidence worker exited with ${exitCode}: ${stderr.trim()}`,
    );
  }
  return JSON.parse(stdout);
}

function normalizeCharacterClass(value: unknown): TableEvidenceCharacterClass {
  return typeof value === "string" &&
    tableEvidenceCharacterClasses.includes(value as TableEvidenceCharacterClass)
    ? (value as TableEvidenceCharacterClass)
    : "normal";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
