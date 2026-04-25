import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type {
  DocumentStructureObjectEvidence,
  DocumentStructureTableCellStyleEvidence,
  DocumentStructureSection,
  DocumentStructureTableDataCell,
  DocumentStructureTableFootnoteItem,
  DocumentStructureTableGridCell,
  DocumentStructureTableHeaderCell,
  DocumentStructureTableInlineFragment,
  DocumentStructureTableInlineStyleEvidence,
  DocumentStructureTableMergedRelation,
  DocumentStructureTableParagraphSnapshot,
  DocumentStructureTableParagraphStyleEvidence,
  DocumentStructureTableSemanticCoordinate,
  DocumentStructureTableSnapshot,
  DocumentStructureTableStyleFact,
  DocumentStructureTableStubColumn,
  DocumentStructureTableUnitMarker,
  DocumentStructureWorkerAdapter,
  DocumentStructureWorkerResult,
} from "./document-structure-service.ts";
import {
  buildPythonCommandCandidates,
  buildWorkspaceChildProcessEnv,
  isCommandUnavailableError,
} from "../shared/windows-command-runtime.ts";
import { buildMetadataCandidatesFromBlocks } from "./docx-metadata-hunter.ts";

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
    metadata_candidates: [],
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
    metadata_candidates: buildMetadataCandidatesFromBlocks(record.blocks),
    tables: normalizeTables(record.tables),
    objects: normalizeObjects(record.objects),
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
    const rowCount = readOptionalNumber(semantic.row_count);
    const columnCount = readOptionalNumber(semantic.column_count);
    const tableLabel = normalizeTextAnchor(semantic.table_label, tableId, "table_label");
    const tableTitle = normalizeTextAnchor(semantic.table_title, tableId, "table_title");
    const captionFields = normalizeCaptionFields(semantic.caption_fields);
    const noteZone = normalizeNoteZone(semantic.note_zone, tableId);
    const styleProfile = normalizeStyleProfile(semantic.style_profile, tableId);
    const stubColumns = normalizeStubColumns(semantic.stub_columns);
    const unitMarkers = normalizeUnitMarkers(semantic.unit_markers);
    const mergedRelations = normalizeMergedRelations(semantic.merged_relations);
    const gridCells = normalizeGridCells(semantic.grid_cells);

    if (rowCount !== undefined) {
      snapshot.row_count = rowCount;
    }
    if (columnCount !== undefined) {
      snapshot.column_count = columnCount;
    }

    if (tableLabel) {
      snapshot.table_label = tableLabel;
    }
    if (tableTitle) {
      snapshot.table_title = tableTitle;
    }
    if (captionFields) {
      snapshot.caption_fields = captionFields;
    }
    if (noteZone) {
      snapshot.note_zone = noteZone;
    }
    if (styleProfile) {
      snapshot.style_profile = styleProfile;
    }
    if (stubColumns?.length) {
      snapshot.stub_columns = stubColumns;
    }
    if (unitMarkers?.length) {
      snapshot.unit_markers = unitMarkers;
    }
    if (mergedRelations?.length) {
      snapshot.merged_relations = mergedRelations;
    }
    if (gridCells?.length) {
      snapshot.grid_cells = gridCells;
    }

    tables.push(snapshot);
  });

  return tables;
}

function normalizeObjects(value: unknown): DocumentStructureObjectEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const objects: DocumentStructureObjectEvidence[] = [];

  value.forEach((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    const objectId = readOptionalString(record.object_id) ?? `object-${index + 1}`;
    const objectKind = readOptionalString(record.object_kind);
    const containerKind = readOptionalString(record.container_kind);
    const sourceZone = readOptionalString(record.source_zone);
    const sourceLocator = readOptionalString(record.source_locator);
    const originalTag = readOptionalString(record.original_tag);

    if (
      !sourceLocator ||
      !originalTag ||
      (objectKind !== "image" &&
        objectKind !== "equation" &&
        objectKind !== "nested_table" &&
        objectKind !== "text_box_table" &&
        objectKind !== "ocr_image_table" &&
        objectKind !== "embedded_object" &&
        objectKind !== "drawing" &&
        objectKind !== "chart" &&
        objectKind !== "unknown") ||
      (containerKind !== "paragraph" &&
        containerKind !== "table_cell" &&
        containerKind !== "header" &&
        containerKind !== "footer") ||
      (sourceZone !== "front_matter" &&
        sourceZone !== "title_area" &&
        sourceZone !== "abstract_neighborhood" &&
        sourceZone !== "header" &&
        sourceZone !== "footer" &&
        sourceZone !== "document_tail" &&
        sourceZone !== "suspicious_nearby_paragraph" &&
        sourceZone !== "body")
    ) {
      return;
    }

    objects.push({
      object_id: objectId,
      object_kind: objectKind,
      container_kind: containerKind,
      source_zone: sourceZone,
      source_locator: sourceLocator,
      original_tag: originalTag,
      ...(readOptionalString(record.relationship_id)
        ? { relationship_id: readOptionalString(record.relationship_id) }
        : {}),
      ...(readOptionalString(record.evidence_text)
        ? { evidence_text: readOptionalString(record.evidence_text) }
        : {}),
      ...(readOptionalString(record.surrounding_text)
        ? { surrounding_text: readOptionalString(record.surrounding_text) }
        : {}),
      ...(readOptionalString(record.intended_target)
        ? { intended_target: readOptionalString(record.intended_target) }
        : {}),
    });
  });

  return objects;
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

function normalizeTextAnchor(
  value: unknown,
  tableId: string,
  target: "table_label" | "table_title",
): DocumentStructureTableSnapshot["table_label"] | DocumentStructureTableSnapshot["table_title"] {
  const record = isRecord(value) ? value : {};
  const text = readOptionalString(record.text);
  if (!text) {
    return undefined;
  }

  return {
    id: readOptionalString(record.id) ?? `${tableId}-${target === "table_label" ? "label" : "title"}`,
    text,
    coordinate: normalizeCoordinate(record.coordinate, {
      tableId,
      target,
    }),
  };
}

function normalizeCaptionFields(
  value: unknown,
): DocumentStructureTableSnapshot["caption_fields"] | undefined {
  const record = isRecord(value) ? value : {};
  const text = readOptionalString(record.text);
  if (!text) {
    return undefined;
  }

  const captionFields: NonNullable<DocumentStructureTableSnapshot["caption_fields"]> = {
    text,
  };
  const labelText = readOptionalString(record.label_text);
  const titleText = readOptionalString(record.title_text);

  if (labelText !== undefined) {
    captionFields.label_text = labelText;
  }
  if (titleText !== undefined) {
    captionFields.title_text = titleText;
  }
  const paragraphs = normalizeParagraphSnapshots(record.paragraphs);
  if (paragraphs?.length) {
    captionFields.paragraphs = paragraphs;
  }

  return captionFields;
}

function normalizeNoteZone(
  value: unknown,
  tableId?: string,
): DocumentStructureTableSnapshot["note_zone"] | undefined {
  const record = isRecord(value) ? value : {};
  const text = readOptionalString(record.text);
  if (!text) {
    return undefined;
  }
  const paragraphs = normalizeParagraphSnapshots(record.paragraphs);

  return {
    text,
    line_texts: normalizeStringArray(record.line_texts),
    footnote_ids: normalizeStringArray(record.footnote_ids),
    ...(paragraphs?.length ? { paragraphs } : {}),
    coordinate: normalizeCoordinate(record.coordinate, {
      tableId,
      target: "note_zone",
    }),
  };
}

function normalizeStyleProfile(
  value: unknown,
  tableId?: string,
): DocumentStructureTableSnapshot["style_profile"] | undefined {
  const record = isRecord(value) ? value : {};
  if (
    typeof record.has_top_rule !== "boolean" &&
    typeof record.has_header_rule !== "boolean" &&
    typeof record.has_bottom_rule !== "boolean" &&
    typeof record.has_vertical_rules !== "boolean"
  ) {
    return undefined;
  }

  return {
    has_top_rule: Boolean(record.has_top_rule),
    has_header_rule: Boolean(record.has_header_rule),
    has_bottom_rule: Boolean(record.has_bottom_rule),
    has_vertical_rules: Boolean(record.has_vertical_rules),
    coordinate: normalizeCoordinate(record.coordinate, {
      tableId,
      target: "style_profile",
    }),
  };
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
    const sourceCellId = readOptionalString(record.source_cell_id);
    if (sourceCellId !== undefined) {
      headerCell.source_cell_id = sourceCellId;
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
      ...(readOptionalString(record.source_cell_id)
        ? { source_cell_id: readOptionalString(record.source_cell_id) }
        : {}),
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
    const sourceCellId = readOptionalString(record.source_cell_id);
    if (sourceCellId !== undefined) {
      dataCell.source_cell_id = sourceCellId;
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
    const paragraphs = normalizeParagraphSnapshots(record.paragraphs);
    if (paragraphs?.length) {
      footnoteItem.paragraphs = paragraphs;
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

function normalizeGridCells(
  value: unknown,
): DocumentStructureTableGridCell[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const gridCells: DocumentStructureTableGridCell[] = [];

  value.forEach((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    const id = readOptionalString(record.id) ?? `grid-cell-${index + 1}`;
    const inferredRole = readOptionalString(record.inferred_role);
    const gridCell: DocumentStructureTableGridCell = {
      id,
      text: readOptionalString(record.text) ?? "",
      row_index: readOptionalNumber(record.row_index) ?? 0,
      column_index: readOptionalNumber(record.column_index) ?? 0,
      row_span: readOptionalNumber(record.row_span) ?? 1,
      column_span: readOptionalNumber(record.column_span) ?? 1,
      inferred_role:
        inferredRole === "header" ||
        inferredRole === "stub" ||
        inferredRole === "data" ||
        inferredRole === "unknown"
          ? inferredRole
          : "unknown",
      style_evidence: normalizeCellStyleEvidence(record.style_evidence),
      paragraphs: normalizeParagraphSnapshots(record.paragraphs) ?? [],
    };
    const borderHints = normalizeBorderHints(record.border_hints);
    if (borderHints) {
      gridCell.border_hints = borderHints;
    }
    const objectEvidence = normalizeObjects(record.object_evidence);
    if (objectEvidence.length > 0) {
      gridCell.object_evidence = objectEvidence;
    }
    gridCells.push(gridCell);
  });

  return gridCells;
}

function normalizeBorderHints(
  value: unknown,
): DocumentStructureTableGridCell["border_hints"] | undefined {
  const record = isRecord(value) ? value : {};
  const hints: NonNullable<DocumentStructureTableGridCell["border_hints"]> = {};

  (["top", "bottom", "left", "right"] as const).forEach((side) => {
    if (typeof record[side] === "boolean") {
      hints[side] = record[side];
    }
  });

  return Object.keys(hints).length > 0 ? hints : undefined;
}

function normalizeParagraphSnapshots(
  value: unknown,
): DocumentStructureTableParagraphSnapshot[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const paragraphs: DocumentStructureTableParagraphSnapshot[] = [];

  value.forEach((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    const paragraphId = readOptionalString(record.id) ?? `paragraph-${index + 1}`;
    paragraphs.push({
      id: paragraphId,
      text: readOptionalString(record.text) ?? "",
      style: normalizeParagraphStyleEvidence(record.style),
      fragments: normalizeInlineFragments(record.fragments, paragraphId) ?? [],
    });
  });

  return paragraphs;
}

function normalizeInlineFragments(
  value: unknown,
  paragraphId: string,
): DocumentStructureTableInlineFragment[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const fragments: DocumentStructureTableInlineFragment[] = [];

  value.forEach((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    const kind = readOptionalString(record.kind);
    fragments.push({
      id: readOptionalString(record.id) ?? `${paragraphId}-fragment-${index + 1}`,
      kind:
        kind === "text" ||
        kind === "symbol" ||
        kind === "tab" ||
        kind === "line_break" ||
        kind === "object"
          ? kind
          : "text",
      text: typeof record.text === "string" ? record.text : "",
      style: normalizeInlineStyleEvidence(record.style),
      ...(readOptionalString(record.symbol_font)
        ? { symbol_font: readOptionalString(record.symbol_font) }
        : {}),
      ...(readOptionalString(record.symbol_char)
        ? { symbol_char: readOptionalString(record.symbol_char) }
        : {}),
      ...(readOptionalString(record.object_id)
        ? { object_id: readOptionalString(record.object_id) }
        : {}),
      ...(readOptionalString(record.object_kind)
        ? {
            object_kind: readOptionalString(
              record.object_kind,
            ) as DocumentStructureTableInlineFragment["object_kind"],
          }
        : {}),
      ...(readOptionalString(record.original_tag)
        ? { original_tag: readOptionalString(record.original_tag) }
        : {}),
      ...(readOptionalString(record.relationship_id)
        ? { relationship_id: readOptionalString(record.relationship_id) }
        : {}),
      ...(readOptionalString(record.evidence_text)
        ? { evidence_text: readOptionalString(record.evidence_text) }
        : {}),
    });
  });

  return fragments;
}

function normalizeInlineStyleEvidence(
  value: unknown,
): DocumentStructureTableInlineStyleEvidence {
  const record = isRecord(value) ? value : {};
  return {
    font_family: normalizeStyleFact(record.font_family, readOptionalString),
    font_size_pt: normalizeStyleFact(record.font_size_pt, readOptionalNumber),
    bold: normalizeStyleFact(record.bold, readOptionalBoolean),
    italic: normalizeStyleFact(record.italic, readOptionalBoolean),
    script_position: normalizeStyleFact(record.script_position, readOptionalString),
  };
}

function normalizeParagraphStyleEvidence(
  value: unknown,
): DocumentStructureTableParagraphStyleEvidence {
  const record = isRecord(value) ? value : {};
  return {
    alignment: normalizeStyleFact(record.alignment, readOptionalString),
    spacing_before_pt: normalizeStyleFact(
      record.spacing_before_pt,
      readOptionalNumber,
    ),
    spacing_after_pt: normalizeStyleFact(
      record.spacing_after_pt,
      readOptionalNumber,
    ),
    line_spacing: normalizeStyleFact(record.line_spacing, readOptionalNumber),
    line_spacing_mode: normalizeStyleFact(
      record.line_spacing_mode,
      readOptionalString,
    ),
    left_indent_pt: normalizeStyleFact(record.left_indent_pt, readOptionalNumber),
    right_indent_pt: normalizeStyleFact(record.right_indent_pt, readOptionalNumber),
    first_line_indent_pt: normalizeStyleFact(
      record.first_line_indent_pt,
      readOptionalNumber,
    ),
    hanging_indent_pt: normalizeStyleFact(
      record.hanging_indent_pt,
      readOptionalNumber,
    ),
  };
}

function normalizeCellStyleEvidence(
  value: unknown,
): DocumentStructureTableCellStyleEvidence {
  const record = isRecord(value) ? value : {};
  return {
    font_family: normalizeStyleFact(record.font_family, readOptionalString),
    font_size_pt: normalizeStyleFact(record.font_size_pt, readOptionalNumber),
    bold: normalizeStyleFact(record.bold, readOptionalBoolean),
    italic: normalizeStyleFact(record.italic, readOptionalBoolean),
    script_position: normalizeStyleFact(record.script_position, readOptionalString),
    alignment: normalizeStyleFact(record.alignment, readOptionalString),
    spacing_before_pt: normalizeStyleFact(
      record.spacing_before_pt,
      readOptionalNumber,
    ),
    spacing_after_pt: normalizeStyleFact(
      record.spacing_after_pt,
      readOptionalNumber,
    ),
    line_spacing: normalizeStyleFact(record.line_spacing, readOptionalNumber),
    line_spacing_mode: normalizeStyleFact(
      record.line_spacing_mode,
      readOptionalString,
    ),
    left_indent_pt: normalizeStyleFact(record.left_indent_pt, readOptionalNumber),
    right_indent_pt: normalizeStyleFact(record.right_indent_pt, readOptionalNumber),
    first_line_indent_pt: normalizeStyleFact(
      record.first_line_indent_pt,
      readOptionalNumber,
    ),
    hanging_indent_pt: normalizeStyleFact(
      record.hanging_indent_pt,
      readOptionalNumber,
    ),
    vertical_alignment: normalizeStyleFact(
      record.vertical_alignment,
      readOptionalString,
    ),
    text_direction: normalizeStyleFact(record.text_direction, readOptionalString),
  };
}

function normalizeStyleFact<T>(
  value: unknown,
  parseValue: (value: unknown) => T | undefined,
): DocumentStructureTableStyleFact<T> {
  const record = isRecord(value) ? value : {};
  const availability = readOptionalString(record.availability);
  if (
    availability !== "authoritative" &&
    availability !== "mixed" &&
    availability !== "unavailable"
  ) {
    return {
      availability: "unavailable",
    };
  }

  const normalized: DocumentStructureTableStyleFact<T> = {
    availability,
  };
  const parsedValue = parseValue(record.value);
  if (parsedValue !== undefined && availability !== "unavailable") {
    normalized.value = parsedValue;
  }
  return normalized;
}

function normalizeCoordinate(
  value: unknown,
  fallback: {
    tableId?: string;
    target:
      | "table_block"
      | "table_label"
      | "table_title"
      | "note_zone"
      | "style_profile"
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
      target === "note_zone" ||
      target === "style_profile" ||
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

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
