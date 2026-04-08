import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type {
  DocumentStructureSection,
  DocumentStructureTableDataCell,
  DocumentStructureTableFootnoteItem,
  DocumentStructureTableHeaderCell,
  DocumentStructureTableMergedRelation,
  DocumentStructureTableSemanticCoordinate,
  DocumentStructureTableSnapshot,
  DocumentStructureTableStubColumn,
  DocumentStructureTableUnitMarker,
  DocumentStructureWorkerAdapter,
  DocumentStructureWorkerResult,
} from "./document-structure-service.ts";

const EXTRACT_DOCX_STRUCTURE_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/extract_docx_structure.py",
);

interface PythonDocxStructureWorkerAdapterOptions {
  assetRepository: DocumentAssetRepository;
  rootDir: string;
}

export class PythonDocxStructureWorkerAdapter implements DocumentStructureWorkerAdapter {
  private readonly assetRepository: DocumentAssetRepository;
  private readonly rootDir: string;

  constructor(options: PythonDocxStructureWorkerAdapterOptions) {
    this.assetRepository = options.assetRepository;
    this.rootDir = path.resolve(options.rootDir);
  }

  async extract(input: {
    manuscriptId: string;
    assetId: string;
    fileName: string;
  }): Promise<DocumentStructureWorkerResult> {
    const asset = await this.assetRepository.findById(input.assetId);
    if (!asset) {
      return buildManualReviewResult(
        `The source asset ${input.assetId} could not be found for DOCX structure extraction.`,
      );
    }

    const sourcePath = resolveStoragePath(this.rootDir, asset.storage_key);
    try {
      await readFile(sourcePath);
    } catch (error) {
      if (isMissingFileError(error)) {
        return buildManualReviewResult(
          `The source DOCX bytes are not available at ${sourcePath}.`,
        );
      }

      throw error;
    }

    try {
      const workerResult = await runWorker(sourcePath);
      return normalizeWorkerResult(workerResult);
    } catch (error) {
      return buildManualReviewResult(
        error instanceof Error
          ? error.message
          : "The DOCX structure worker failed unexpectedly.",
      );
    }
  }
}

function buildManualReviewResult(message: string): DocumentStructureWorkerResult {
  return {
    status: "needs_manual_review",
    parser: "python_docx",
    sections: [],
    tables: [],
    warnings: [message],
  };
}

function resolveStoragePath(rootDir: string, storageKey: string): string {
  const normalizedSegments = storageKey
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const absolutePath = path.resolve(rootDir, ...normalizedSegments);
  const relativePath = path.relative(rootDir, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Resolved asset path escaped the configured root: "${storageKey}".`);
  }

  return absolutePath;
}

function buildPythonCandidates(): string[] {
  const configured = process.env.PYTHON_BIN?.trim();
  const candidates = [configured, "python", "python3"].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return [...new Set(candidates)];
}

async function runWorker(sourcePath: string): Promise<unknown> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCandidates()) {
    try {
      return await runPythonScript(pythonBin, sourcePath);
    } catch (error) {
      if (isCommandMissing(error)) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError ??
    new Error("No usable Python interpreter was found for DOCX structure extraction.")
  );
}

function runPythonScript(pythonBin: string, sourcePath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [EXTRACT_DOCX_STRUCTURE_SCRIPT, "--source-path", sourcePath],
      {
        stdio: ["ignore", "pipe", "pipe"],
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

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `DOCX structure extraction failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `DOCX structure extraction returned invalid JSON: ${String(error)}${
              stdout.trim() ? `\n${stdout.trim()}` : ""
            }`,
          ),
        );
      }
    });
  });
}

function normalizeWorkerResult(raw: unknown): DocumentStructureWorkerResult {
  const record = isRecord(raw) ? raw : {};
  return {
    status: normalizeStatus(record.status),
    parser: normalizeParser(record.parser),
    sections: normalizeSections(record.sections),
    tables: normalizeTables(record.tables),
    warnings: normalizeStringArray(record.warnings),
  };
}

function normalizeStatus(
  value: unknown,
): DocumentStructureWorkerResult["status"] {
  return value === "ready" || value === "partial" || value === "needs_manual_review"
    ? value
    : "needs_manual_review";
}

function normalizeParser(
  value: unknown,
): DocumentStructureWorkerResult["parser"] {
  if (value === "python_docx" || value === "python_docx_ooxml") {
    return "python_docx";
  }

  if (value === "mammoth") {
    return "mammoth";
  }

  return "other";
}

function normalizeSections(value: unknown): DocumentStructureWorkerResult["sections"] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sections: DocumentStructureSection[] = [];

  value.forEach((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    const heading = readOptionalString(record.heading);
    if (!heading) {
      return;
    }

    const section: DocumentStructureSection = {
      order: readOptionalNumber(record.order) ?? index + 1,
      heading,
    };
    const level = readOptionalNumber(record.level);
    const paragraphIndex = readOptionalNumber(record.paragraph_index);
    const pageNo = readOptionalNumber(record.page_no);

    if (level !== undefined) {
      section.level = level;
    }
    if (paragraphIndex !== undefined) {
      section.paragraph_index = paragraphIndex;
    }
    if (pageNo !== undefined) {
      section.page_no = pageNo;
    }

    sections.push(section);
  });

  return sections;
}

function normalizeTables(value: unknown): DocumentStructureTableSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tables: DocumentStructureTableSnapshot[] = [];

  value.forEach((entry) => {
    const table = isRecord(entry) ? entry : {};
    const semantic = isRecord(table.semantic) ? table.semantic : table;
    const tableId = readOptionalString(semantic.table_id);
    if (!tableId) {
      return;
    }

    const snapshot: DocumentStructureTableSnapshot = {
      table_id: tableId,
      profile: normalizeProfile(semantic.profile),
      header_cells: normalizeHeaderCells(semantic.header_cells),
      data_cells: normalizeDataCells(semantic.data_cells),
      footnote_items: normalizeFootnoteItems(semantic.footnote_items),
    };
    const stubColumns = normalizeStubColumns(semantic.stub_columns);
    const unitMarkers = normalizeUnitMarkers(semantic.unit_markers);
    const mergedRelations = normalizeMergedRelations(semantic.merged_relations);

    if (stubColumns?.length) {
      snapshot.stub_columns = stubColumns;
    }
    if (unitMarkers?.length) {
      snapshot.unit_markers = unitMarkers;
    }
    if (mergedRelations?.length) {
      snapshot.merged_relations = mergedRelations;
    }

    tables.push(snapshot);
  });

  return tables;
}

function normalizeProfile(value: unknown): DocumentStructureTableSnapshot["profile"] {
  const record = isRecord(value) ? value : {};
  const profile: DocumentStructureTableSnapshot["profile"] = {
    is_three_line_table: Boolean(record.is_three_line_table),
    header_depth: readOptionalNumber(record.header_depth) ?? 0,
    has_stub_column: Boolean(record.has_stub_column),
    has_statistical_footnotes: Boolean(record.has_statistical_footnotes),
    has_unit_markers: Boolean(record.has_unit_markers),
  };
  if (typeof record.has_merged_headers === "boolean") {
    profile.has_merged_headers = record.has_merged_headers;
  }
  return profile;
}

function normalizeHeaderCells(value: unknown): DocumentStructureTableHeaderCell[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const headerCells: DocumentStructureTableHeaderCell[] = [];

  value.forEach((entry) => {
    const record = isRecord(entry) ? entry : {};
    const id = readOptionalString(record.id);
    if (!id) {
      return;
    }

    const headerPath = normalizeStringArray(record.header_path);
    const headerCell: DocumentStructureTableHeaderCell = {
      id,
      text: readOptionalString(record.text) ?? "",
      row_index: readOptionalNumber(record.row_index) ?? 0,
      column_index: readOptionalNumber(record.column_index) ?? 0,
      header_path: headerPath,
      coordinate: normalizeCoordinate(record.coordinate, {
        tableId: readOptionalString(record.table_id),
        target: "header_cell",
        headerPath,
      }),
    };
    const rowSpan = readOptionalNumber(record.row_span);
    const columnSpan = readOptionalNumber(record.column_span);

    if (rowSpan !== undefined) {
      headerCell.row_span = rowSpan;
    }
    if (columnSpan !== undefined) {
      headerCell.column_span = columnSpan;
    }

    headerCells.push(headerCell);
  });

  return headerCells;
}

function normalizeStubColumns(value: unknown): DocumentStructureTableStubColumn[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const stubColumns: DocumentStructureTableStubColumn[] = [];

  value.forEach((entry) => {
    const record = isRecord(entry) ? entry : {};
    const id = readOptionalString(record.id);
    if (!id) {
      return;
    }

    const rowKey = readOptionalString(record.row_key) ?? "";
    stubColumns.push({
      id,
      text: readOptionalString(record.text) ?? "",
      row_key: rowKey,
      coordinate: normalizeCoordinate(record.coordinate, {
        tableId: readOptionalString(record.table_id),
        target: "stub_column",
        rowKey,
      }),
    });
  });

  return stubColumns;
}

function normalizeDataCells(value: unknown): DocumentStructureTableDataCell[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const dataCells: DocumentStructureTableDataCell[] = [];

  value.forEach((entry) => {
    const record = isRecord(entry) ? entry : {};
    const id = readOptionalString(record.id);
    if (!id) {
      return;
    }

    const unitContext = readOptionalString(record.unit_context);
    const dataCell: DocumentStructureTableDataCell = {
      id,
      text: readOptionalString(record.text) ?? "",
      row_index: readOptionalNumber(record.row_index) ?? 0,
      column_index: readOptionalNumber(record.column_index) ?? 0,
      row_key: readOptionalString(record.row_key) ?? "",
      column_key: readOptionalString(record.column_key) ?? "",
      coordinate: normalizeCoordinate(record.coordinate, {
        tableId: readOptionalString(record.table_id),
        target: "data_cell",
        rowKey: readOptionalString(record.row_key),
        columnKey: readOptionalString(record.column_key),
      }),
    };

    if (
      unitContext === "header" ||
      unitContext === "stub" ||
      unitContext === "footnote"
    ) {
      dataCell.unit_context = unitContext;
    }

    dataCells.push(dataCell);
  });

  return dataCells;
}

function normalizeUnitMarkers(
  value: unknown,
): DocumentStructureTableUnitMarker[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const unitMarkers: DocumentStructureTableUnitMarker[] = [];

  value.forEach((entry) => {
    const record = isRecord(entry) ? entry : {};
    const id = readOptionalString(record.id);
    const sourceTarget = readOptionalString(record.source_target);
    if (
      !id ||
      (sourceTarget !== "header_cell" &&
        sourceTarget !== "stub_column" &&
        sourceTarget !== "footnote_item")
    ) {
      return;
    }

    unitMarkers.push({
      id,
      text: readOptionalString(record.text) ?? "",
      source_target: sourceTarget,
      coordinate: normalizeCoordinate(record.coordinate, {
        tableId: readOptionalString(record.table_id),
        target: "unit_marker",
      }),
    });
  });

  return unitMarkers;
}

function normalizeFootnoteItems(value: unknown): DocumentStructureTableFootnoteItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const footnoteItems: DocumentStructureTableFootnoteItem[] = [];

  value.forEach((entry) => {
    const record = isRecord(entry) ? entry : {};
    const id = readOptionalString(record.id);
    const noteKind = readOptionalString(record.note_kind);
    if (
      !id ||
      (noteKind !== "statistical_significance" &&
        noteKind !== "abbreviation" &&
        noteKind !== "general")
    ) {
      return;
    }

    const footnoteItem: DocumentStructureTableFootnoteItem = {
      id,
      text: readOptionalString(record.text) ?? "",
      note_kind: noteKind,
      coordinate: normalizeCoordinate(record.coordinate, {
        tableId: readOptionalString(record.table_id),
        target: "footnote_item",
        footnoteAnchor: readOptionalString(record.marker),
      }),
    };
    const marker = readOptionalString(record.marker);
    if (marker !== undefined) {
      footnoteItem.marker = marker;
    }

    footnoteItems.push(footnoteItem);
  });

  return footnoteItems;
}

function normalizeMergedRelations(
  value: unknown,
): DocumentStructureTableMergedRelation[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const mergedRelations: DocumentStructureTableMergedRelation[] = [];

  value.forEach((entry) => {
    const record = isRecord(entry) ? entry : {};
    const id = readOptionalString(record.id);
    const axis = readOptionalString(record.axis);
    if (!id || (axis !== "row" && axis !== "column" && axis !== "block")) {
      return;
    }

    mergedRelations.push({
      id,
      target_ids: normalizeStringArray(record.target_ids),
      axis,
    });
  });

  return mergedRelations;
}

function normalizeCoordinate(
  value: unknown,
  fallback: {
    tableId?: string;
    target:
      | "table_block"
      | "table_label"
      | "table_title"
      | "header_cell"
      | "stub_column"
      | "data_cell"
      | "unit_marker"
      | "footnote_item";
    headerPath?: string[];
    rowKey?: string;
    columnKey?: string;
    footnoteAnchor?: string;
  },
): DocumentStructureTableSemanticCoordinate {
  const record = isRecord(value) ? value : {};
  const target = readOptionalString(record.target);
  const normalizedHeaderPath = normalizeStringArray(record.header_path);
  const coordinate: DocumentStructureTableSemanticCoordinate = {
    table_id: readOptionalString(record.table_id) ?? fallback.tableId ?? "",
    target:
      target === "table_block" ||
      target === "table_label" ||
      target === "table_title" ||
      target === "header_cell" ||
      target === "stub_column" ||
      target === "data_cell" ||
      target === "unit_marker" ||
      target === "footnote_item"
        ? target
        : fallback.target,
  };
  const headerPath = normalizedHeaderPath.length ? normalizedHeaderPath : fallback.headerPath;
  const rowKey = readOptionalString(record.row_key) ?? fallback.rowKey;
  const columnKey = readOptionalString(record.column_key) ?? fallback.columnKey;
  const footnoteAnchor =
    readOptionalString(record.footnote_anchor) ?? fallback.footnoteAnchor;

  if (headerPath?.length) {
    coordinate.header_path = headerPath;
  }
  if (rowKey !== undefined) {
    coordinate.row_key = rowKey;
  }
  if (columnKey !== undefined) {
    coordinate.column_key = columnKey;
  }
  if (footnoteAnchor !== undefined) {
    coordinate.footnote_anchor = footnoteAnchor;
  }

  return coordinate;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => readOptionalString(entry))
    .filter((entry): entry is string => Boolean(entry));
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

function isCommandMissing(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
