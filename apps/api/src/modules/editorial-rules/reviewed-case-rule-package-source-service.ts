import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ExampleDocumentBlockSnapshot,
  ExampleDocumentParserStatus,
  ExampleDocumentSectionSnapshot,
  ExampleDocumentSnapshot,
  ExampleDocumentSource,
  ExampleDocumentTableSnapshot,
} from "@medical/contracts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import {
  LearningDeidentificationRequiredError,
  ReviewedCaseSnapshotNotFoundError,
} from "../learning/learning-service.ts";
import type { ReviewedCaseSnapshotRepository } from "../learning/learning-repository.ts";
import type {
  GenerateRulePackageCandidatesFromReviewedCaseInput,
  GenerateRulePackageCandidatesInput,
} from "./editorial-rule-package-types.ts";

const EXTRACT_DOCX_STRUCTURE_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/extract_docx_structure.py",
);

export class ReviewedCaseSourceAssetNotFoundError extends Error {
  constructor(
    assetId: string,
    relationField: "snapshot_asset_id" | "human_final_asset_id",
  ) {
    super(
      `Reviewed snapshot source resolution failed: asset "${assetId}" from "${relationField}" was not found.`,
    );
    this.name = "ReviewedCaseSourceAssetNotFoundError";
  }
}

export class ReviewedCaseSourceAssetPayloadError extends Error {
  constructor(assetId: string, detail: string) {
    super(`Reviewed snapshot source asset "${assetId}" is unsupported: ${detail}`);
    this.name = "ReviewedCaseSourceAssetPayloadError";
  }
}

export interface ReviewedCaseRulePackageExampleSource {
  extract(input: {
    source: ExampleDocumentSource;
    assetId: string;
    manuscriptId: string;
  }): Promise<ExampleDocumentSnapshot>;
}

export interface ReviewedCaseRulePackageSourceServiceOptions {
  snapshotRepository: ReviewedCaseSnapshotRepository;
  assetRepository?: DocumentAssetRepository;
  rootDir?: string;
  exampleSource?: ReviewedCaseRulePackageExampleSource;
}

export class ReviewedCaseRulePackageSourceService {
  private readonly snapshotRepository: ReviewedCaseSnapshotRepository;
  private readonly assetRepository?: DocumentAssetRepository;
  private readonly rootDir?: string;
  private readonly exampleSource?: ReviewedCaseRulePackageExampleSource;

  constructor(options: ReviewedCaseRulePackageSourceServiceOptions) {
    this.snapshotRepository = options.snapshotRepository;
    this.assetRepository = options.assetRepository;
    this.rootDir = options.rootDir ? path.resolve(options.rootDir) : undefined;
    this.exampleSource = options.exampleSource;

    if (!this.exampleSource && (!this.assetRepository || !this.rootDir)) {
      throw new Error(
        "ReviewedCaseRulePackageSourceService requires either exampleSource or both assetRepository and rootDir.",
      );
    }
  }

  async buildExamplePair(
    input: GenerateRulePackageCandidatesFromReviewedCaseInput,
  ): Promise<GenerateRulePackageCandidatesInput> {
    const snapshot = await this.snapshotRepository.findById(
      input.reviewedCaseSnapshotId,
    );
    if (!snapshot) {
      throw new ReviewedCaseSnapshotNotFoundError(input.reviewedCaseSnapshotId);
    }
    if (!snapshot.deidentification_passed) {
      throw new LearningDeidentificationRequiredError();
    }

    return {
      context: {
        manuscript_type: snapshot.manuscript_type,
        module: resolveRulePackageModule(snapshot.module),
        ...(input.journalKey ? { journal_key: input.journalKey } : {}),
      },
      original: await this.extractExampleSnapshot({
        source: "original",
        assetId: snapshot.snapshot_asset_id,
        manuscriptId: snapshot.manuscript_id,
        relationField: "snapshot_asset_id",
      }),
      edited: await this.extractExampleSnapshot({
        source: "edited",
        assetId: snapshot.human_final_asset_id,
        manuscriptId: snapshot.manuscript_id,
        relationField: "human_final_asset_id",
      }),
    };
  }

  resolveCandidateInput(
    input: GenerateRulePackageCandidatesFromReviewedCaseInput,
  ): Promise<GenerateRulePackageCandidatesInput> {
    return this.buildExamplePair(input);
  }

  private async extractExampleSnapshot(input: {
    source: ExampleDocumentSource;
    assetId: string;
    manuscriptId: string;
    relationField: "snapshot_asset_id" | "human_final_asset_id";
  }): Promise<ExampleDocumentSnapshot> {
    if (this.exampleSource) {
      return this.exampleSource.extract({
        source: input.source,
        assetId: input.assetId,
        manuscriptId: input.manuscriptId,
      });
    }

    const asset = await this.assetRepository!.findById(input.assetId);
    if (!asset) {
      throw new ReviewedCaseSourceAssetNotFoundError(
        input.assetId,
        input.relationField,
      );
    }
    if (asset.manuscript_id !== input.manuscriptId) {
      throw new ReviewedCaseSourceAssetPayloadError(
        asset.id,
        `asset manuscript mismatch: expected "${input.manuscriptId}" but received "${asset.manuscript_id}".`,
      );
    }

    const absolutePath = resolveStoragePath(this.rootDir!, asset.storage_key);
    const bytes = await readFile(absolutePath).catch((error) => {
      if (isMissingFileError(error)) {
        throw new ReviewedCaseSourceAssetPayloadError(
          asset.id,
          `storage key "${asset.storage_key}" could not be materialized from "${this.rootDir!}".`,
        );
      }
      throw error;
    });

    const mimeType = asset.mime_type.trim().toLowerCase();
    const fileName = asset.file_name?.trim().toLowerCase() ?? "";
    if (isJsonLikePayload({ mimeType, fileName, bytes })) {
      const parsed = parseJsonPayload(bytes, asset.id);
      if (parsed.ok) {
        return extractSnapshotFromJsonPayload({
          source: input.source,
          payload: parsed.value,
          assetId: asset.id,
        });
      }
      if (!isDocxLikePayload({ mimeType, fileName, bytes })) {
        throw parsed.error;
      }
    }

    if (!isDocxLikePayload({ mimeType, fileName, bytes })) {
      throw new ReviewedCaseSourceAssetPayloadError(
        asset.id,
        `expected DOCX bytes or a JSON snapshot payload, received mime_type="${asset.mime_type || "unknown"}".`,
      );
    }

    return buildSnapshotFromParsedDocx({
      source: input.source,
      parsedDocx: await runDocxStructureWorker(absolutePath, asset.id),
    });
  }
}

function resolveStoragePath(rootDir: string, storageKey: string): string {
  const absolutePath = path.resolve(
    rootDir,
    ...storageKey
      .replaceAll("\\", "/")
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean),
  );
  const relativePath = path.relative(rootDir, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ReviewedCaseSourceAssetPayloadError(
      storageKey,
      `resolved path escaped configured root: "${storageKey}".`,
    );
  }
  return absolutePath;
}

function parseJsonPayload(
  bytes: Buffer,
  assetId: string,
):
  | { ok: true; value: unknown }
  | { ok: false; error: ReviewedCaseSourceAssetPayloadError } {
  try {
    return { ok: true, value: JSON.parse(bytes.toString("utf8")) };
  } catch (error) {
    return {
      ok: false,
      error: new ReviewedCaseSourceAssetPayloadError(
        assetId,
        `JSON payload parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}

function extractSnapshotFromJsonPayload(input: {
  source: ExampleDocumentSource;
  payload: unknown;
  assetId: string;
}): ExampleDocumentSnapshot {
  const direct =
    tryReadExampleDocumentSnapshot(input.payload) ??
    (isRecord(input.payload)
      ? tryReadExampleDocumentSnapshot(input.payload.snapshot) ??
        tryReadExampleDocumentSnapshot(input.payload[input.source])
      : undefined);
  if (direct) {
    return {
      ...direct,
      source: input.source,
    };
  }
  if (looksLikeParsedDocxPayload(input.payload)) {
    return buildSnapshotFromParsedDocx({
      source: input.source,
      parsedDocx: input.payload,
    });
  }
  throw new ReviewedCaseSourceAssetPayloadError(
    input.assetId,
    "JSON payload did not contain a recognizable ExampleDocumentSnapshot shape.",
  );
}

async function runDocxStructureWorker(
  sourcePath: string,
  assetId: string,
): Promise<unknown> {
  let lastError: Error | undefined;
  for (const pythonBin of buildPythonCandidates()) {
    try {
      return await runPythonScript(pythonBin, sourcePath);
    } catch (error) {
      if (isCommandMissing(error)) {
        lastError = error;
        continue;
      }
      throw new ReviewedCaseSourceAssetPayloadError(
        assetId,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  throw new ReviewedCaseSourceAssetPayloadError(
    assetId,
    lastError?.message ??
      "no usable Python interpreter was found for DOCX structure extraction.",
  );
}

function buildPythonCandidates(): string[] {
  const configured = process.env.PYTHON_BIN?.trim();
  return [...new Set([configured, "python", "python3"].filter(Boolean) as string[])];
}

function runPythonScript(pythonBin: string, sourcePath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [EXTRACT_DOCX_STRUCTURE_SCRIPT, "--source-path", sourcePath],
      { stdio: ["ignore", "pipe", "pipe"] },
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
            `DOCX structure extraction returned invalid JSON: ${String(error)}${stdout.trim() ? `\n${stdout.trim()}` : ""}`,
          ),
        );
      }
    });
  });
}

function buildSnapshotFromParsedDocx(input: {
  source: ExampleDocumentSource;
  parsedDocx: unknown;
}): ExampleDocumentSnapshot {
  const payload = isRecord(input.parsedDocx) ? input.parsedDocx : {};
  const tables = normalizeTables(payload.tables);
  return {
    source: input.source,
    parser_status: normalizeParserStatus(payload.status),
    sections: normalizeSections(payload.sections),
    blocks: normalizeBlocks(payload.blocks, tables),
    tables,
    warnings: normalizeStringArray(payload.warnings),
  };
}

function normalizeSections(value: unknown): ExampleDocumentSectionSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    const heading = readOptionalString(record.heading);
    if (!heading) {
      return [];
    }
    return [
      {
        order: readOptionalNumber(record.order) ?? index + 1,
        heading,
        ...(readOptionalNumber(record.level) !== undefined
          ? { level: readOptionalNumber(record.level) }
          : {}),
        ...(readOptionalNumber(record.paragraph_index) !== undefined
          ? { paragraph_index: readOptionalNumber(record.paragraph_index) }
          : {}),
        ...(readOptionalNumber(record.page_no) !== undefined
          ? { page_no: readOptionalNumber(record.page_no) }
          : {}),
      },
    ];
  });
}

function normalizeBlocks(
  value: unknown,
  tables: ExampleDocumentTableSnapshot[],
): ExampleDocumentBlockSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const state = {
    currentSectionKey: "front_matter",
    currentHeadingToken: undefined as string | undefined,
    frontMatterCounts: Object.create(null) as Record<string, number>,
    genericParagraphCount: 0,
    referenceEntryCount: 0,
  };

  return value.flatMap((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    const directBlock = normalizeDirectBlock(record);
    if (directBlock) {
      if (directBlock.kind === "heading") {
        state.currentSectionKey =
          directBlock.section_key === "reference" ? "reference" : "body";
        state.currentHeadingToken = readHeadingToken(directBlock.text);
      }
      return [directBlock];
    }

    const kind = readOptionalString(record.kind);
    if (kind === "heading") {
      const text = readOptionalString(record.heading) ?? readOptionalString(record.text);
      if (!text) {
        return [];
      }
      const headingToken = readHeadingToken(text);
      state.currentHeadingToken = headingToken;
      state.currentSectionKey = classifyHeadingSectionKey(text, headingToken);
      return [
        {
          block_id: buildHeadingBlockId(text, headingToken, index),
          kind: "heading",
          section_key: state.currentSectionKey === "reference" ? "reference" : "body",
          semantic_role: "heading",
          text,
          ...(readOptionalNumber(record.paragraph_index) !== undefined
            ? { paragraph_index: readOptionalNumber(record.paragraph_index) }
            : {}),
        },
      ];
    }

    if (kind === "paragraph") {
      const text = readOptionalString(record.text);
      if (!text) {
        return [];
      }
      const classified = classifyParagraphBlock(text, state);
      return [
        {
          block_id: classified.block_id,
          kind: "paragraph",
          section_key: classified.section_key,
          semantic_role: classified.semantic_role,
          text,
          ...(readOptionalString(record.style)
            ? { style: readOptionalString(record.style) }
            : {}),
          ...(readOptionalNumber(record.paragraph_index) !== undefined
            ? { paragraph_index: readOptionalNumber(record.paragraph_index) }
            : {}),
        },
      ];
    }

    if (kind === "table") {
      const tableIndex = readOptionalNumber(record.table_index);
      return [
        {
          block_id:
            (tableIndex !== undefined ? tables[tableIndex]?.table_id : undefined) ??
            `table-${index + 1}`,
          kind: "table",
          section_key: state.currentSectionKey,
          semantic_role: "table",
          text: readOptionalString(record.caption) ?? `table-${index + 1}`,
        },
      ];
    }

    return [];
  });
}

function normalizeDirectBlock(
  record: Record<string, unknown>,
): ExampleDocumentBlockSnapshot | undefined {
  const blockId = readOptionalString(record.block_id);
  const kind = readOptionalString(record.kind);
  const sectionKey = readOptionalString(record.section_key);
  const semanticRole = readOptionalString(record.semantic_role);
  const text = readOptionalString(record.text);
  if (!blockId || !text || !sectionKey || !semanticRole) {
    return undefined;
  }
  if (kind !== "paragraph" && kind !== "heading" && kind !== "table") {
    return undefined;
  }
  return {
    block_id: blockId,
    kind,
    section_key: sectionKey,
    semantic_role: semanticRole,
    text,
    ...(readOptionalString(record.style) ? { style: readOptionalString(record.style) } : {}),
    ...(readOptionalNumber(record.paragraph_index) !== undefined
      ? { paragraph_index: readOptionalNumber(record.paragraph_index) }
      : {}),
  };
}

function normalizeTables(value: unknown): ExampleDocumentTableSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index) => {
    const table = isRecord(entry) ? entry : {};
    const semantic = isRecord(table.semantic) ? table.semantic : table;
    const profile = isRecord(semantic.profile) ? semantic.profile : {};
    const tableId = readOptionalString(semantic.table_id) ?? `table-${index + 1}`;
    return [
      {
        table_id: tableId,
        ...(readOptionalString(table.label) ? { label: readOptionalString(table.label) } : {}),
        ...(readOptionalString(table.title) || readOptionalString(table.caption)
          ? { title: readOptionalString(table.title) ?? readOptionalString(table.caption) }
          : {}),
        profile: {
          is_three_line_table: Boolean(
            semantic.is_three_line_table ?? profile.is_three_line_table,
          ),
          header_depth:
            readOptionalNumber(semantic.header_depth) ??
            readOptionalNumber(profile.header_depth) ??
            0,
          has_stub_column: Boolean(semantic.has_stub_column ?? profile.has_stub_column),
          has_statistical_footnotes: Boolean(
            semantic.has_statistical_footnotes ?? profile.has_statistical_footnotes,
          ),
          has_unit_markers: Boolean(semantic.has_unit_markers ?? profile.has_unit_markers),
          ...(typeof profile.has_merged_headers === "boolean"
            ? { has_merged_headers: profile.has_merged_headers }
            : {}),
        },
        header_cells: normalizeHeaderCells(semantic.header_cells, tableId),
        data_cells: normalizeDataCells(semantic.data_cells, tableId),
        footnote_items: normalizeFootnoteItems(semantic.footnote_items, tableId),
      } as ExampleDocumentTableSnapshot,
    ];
  });
}

function resolveRulePackageModule(
  module: string,
): GenerateRulePackageCandidatesInput["context"]["module"] {
  switch (module) {
    case "screening":
    case "editing":
    case "proofreading":
      return module;
    default:
      return "editing";
  }
}

function normalizeHeaderCells(
  value: unknown,
  tableId: string,
): ExampleDocumentTableSnapshot["header_cells"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap<ExampleDocumentTableSnapshot["header_cells"][number]>(
    (entry, index) => {
      const cell = isRecord(entry) ? entry : {};
      const headerPath = normalizeStringArray(cell.header_path);
      return [
        {
          id: readOptionalString(cell.id) ?? `${tableId}-header-${index + 1}`,
          text: readOptionalString(cell.text) ?? "",
          row_index: readOptionalNumber(cell.row_index) ?? 0,
          column_index: readOptionalNumber(cell.column_index) ?? 0,
          header_path: headerPath,
          ...(readOptionalNumber(cell.row_span) !== undefined
            ? { row_span: readOptionalNumber(cell.row_span) }
            : {}),
          ...(readOptionalNumber(cell.column_span) !== undefined
            ? { column_span: readOptionalNumber(cell.column_span) }
            : {}),
          coordinate: normalizeCoordinate(cell.coordinate, {
            tableId,
            target: "header_cell",
            headerPath,
            rowKey: readOptionalString(cell.row_key),
            columnKey: readOptionalString(cell.column_key),
            footnoteAnchor: readOptionalString(cell.marker),
          }),
        },
      ];
    },
  );
}

function normalizeDataCells(
  value: unknown,
  tableId: string,
): ExampleDocumentTableSnapshot["data_cells"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap<ExampleDocumentTableSnapshot["data_cells"][number]>(
    (entry, index) => {
      const cell = isRecord(entry) ? entry : {};
      const unitContext = readOptionalString(cell.unit_context);
      return [
        {
          id: readOptionalString(cell.id) ?? `${tableId}-data-${index + 1}`,
          text: readOptionalString(cell.text) ?? "",
          row_index: readOptionalNumber(cell.row_index) ?? 0,
          column_index: readOptionalNumber(cell.column_index) ?? 0,
          row_key: readOptionalString(cell.row_key) ?? "",
          column_key: readOptionalString(cell.column_key) ?? "",
          coordinate: normalizeCoordinate(cell.coordinate, {
            tableId,
            target: "data_cell",
            headerPath: normalizeStringArray(cell.header_path),
            rowKey: readOptionalString(cell.row_key),
            columnKey: readOptionalString(cell.column_key),
            footnoteAnchor: readOptionalString(cell.marker),
          }),
          ...(unitContext === "header" ||
          unitContext === "stub" ||
          unitContext === "footnote"
            ? { unit_context: unitContext }
            : {}),
        },
      ];
    },
  );
}

function normalizeFootnoteItems(
  value: unknown,
  tableId: string,
): ExampleDocumentTableSnapshot["footnote_items"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap<ExampleDocumentTableSnapshot["footnote_items"][number]>(
    (entry, index) => {
      const cell = isRecord(entry) ? entry : {};
      const noteKind = readOptionalString(cell.note_kind);
      return [
        {
          id: readOptionalString(cell.id) ?? `${tableId}-footnote-${index + 1}`,
          text: readOptionalString(cell.text) ?? "",
          note_kind:
            noteKind === "statistical_significance" ||
            noteKind === "abbreviation" ||
            noteKind === "general"
              ? noteKind
              : "general",
          ...(readOptionalString(cell.marker) ? { marker: readOptionalString(cell.marker) } : {}),
          coordinate: normalizeCoordinate(cell.coordinate, {
            tableId,
            target: "footnote_item",
            headerPath: normalizeStringArray(cell.header_path),
            rowKey: readOptionalString(cell.row_key),
            columnKey: readOptionalString(cell.column_key),
            footnoteAnchor: readOptionalString(cell.marker),
          }),
        },
      ];
    },
  );
}

function normalizeCoordinate(
  value: unknown,
  fallback: {
    tableId: string;
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
) {
  const coordinate = isRecord(value) ? value : {};
  const headerPath = normalizeStringArray(coordinate.header_path);
  return {
    table_id: readOptionalString(coordinate.table_id) ?? fallback.tableId,
    target:
      readOptionalString(coordinate.target) === "table_block" ||
      readOptionalString(coordinate.target) === "table_label" ||
      readOptionalString(coordinate.target) === "table_title" ||
      readOptionalString(coordinate.target) === "header_cell" ||
      readOptionalString(coordinate.target) === "stub_column" ||
      readOptionalString(coordinate.target) === "data_cell" ||
      readOptionalString(coordinate.target) === "unit_marker" ||
      readOptionalString(coordinate.target) === "footnote_item"
        ? (readOptionalString(coordinate.target) as typeof fallback.target)
        : fallback.target,
    ...(headerPath.length
      ? { header_path: headerPath }
      : fallback.headerPath?.length
        ? { header_path: fallback.headerPath }
        : {}),
    ...(readOptionalString(coordinate.row_key) ?? fallback.rowKey
      ? { row_key: readOptionalString(coordinate.row_key) ?? fallback.rowKey }
      : {}),
    ...(readOptionalString(coordinate.column_key) ?? fallback.columnKey
      ? { column_key: readOptionalString(coordinate.column_key) ?? fallback.columnKey }
      : {}),
    ...(readOptionalString(coordinate.footnote_anchor) ?? fallback.footnoteAnchor
      ? {
          footnote_anchor:
            readOptionalString(coordinate.footnote_anchor) ?? fallback.footnoteAnchor,
        }
      : {}),
  };
}

function normalizeParserStatus(value: unknown): ExampleDocumentParserStatus {
  return value === "ready" || value === "partial" || value === "needs_manual_review"
    ? value
    : "needs_manual_review";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => readOptionalString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function looksLikeParsedDocxPayload(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.sections) &&
    Array.isArray(value.blocks) &&
    Array.isArray(value.tables)
  );
}

function tryReadExampleDocumentSnapshot(
  value: unknown,
): ExampleDocumentSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (!Array.isArray(value.sections) || !Array.isArray(value.blocks) || !Array.isArray(value.tables)) {
    return undefined;
  }
  const tables = normalizeTables(value.tables);
  return {
    source:
      value.source === "original" || value.source === "edited"
        ? value.source
        : "original",
    parser_status: normalizeParserStatus(value.parser_status),
    sections: normalizeSections(value.sections),
    blocks: normalizeBlocks(value.blocks, tables),
    tables,
    warnings: normalizeStringArray(value.warnings),
  };
}

function classifyParagraphBlock(
  text: string,
  state: {
    currentSectionKey: string;
    currentHeadingToken?: string;
    frontMatterCounts: Record<string, number>;
    genericParagraphCount: number;
    referenceEntryCount: number;
  },
) {
  const normalized = normalizeSemanticText(text);
  if (isReferenceHeading(normalized)) {
    state.currentSectionKey = "reference";
    state.currentHeadingToken = undefined;
    return {
      block_id: "reference-heading",
      section_key: "reference",
      semantic_role: "reference_heading",
    };
  }
  if (isKeywordLine(normalized)) {
    return { block_id: "keyword-main", section_key: "abstract", semantic_role: "keyword_line" };
  }
  if (isAbstractLine(normalized)) {
    return { block_id: "abstract-main", section_key: "abstract", semantic_role: "abstract_heading" };
  }
  if (!state.currentHeadingToken && state.currentSectionKey === "front_matter") {
    const role = classifyFrontMatterSemanticRole(normalized, text);
    state.frontMatterCounts[role] = (state.frontMatterCounts[role] ?? 0) + 1;
    const count = state.frontMatterCounts[role];
    const suffix = count > 1 ? `-${count}` : "";
    const prefix =
      role === "author_bio"
        ? "front-author-bio"
        : role === "corresponding_author"
          ? "front-corresponding"
          : role === "author_line"
            ? "front-author-line"
            : role === "affiliation"
              ? "front-affiliation"
              : role === "classification_line"
                ? "front-classification"
                : "front-paragraph";
    return { block_id: `${prefix}${suffix}`, section_key: "front_matter", semantic_role: role };
  }
  if (state.currentSectionKey === "reference") {
    state.referenceEntryCount += 1;
    return {
      block_id: `reference-${state.referenceEntryCount}`,
      section_key: "reference",
      semantic_role: "reference_entry",
    };
  }
  if (hasNumericStatisticPattern(text)) {
    return {
      block_id: buildStatisticalBlockId(state.currentHeadingToken, normalized),
      section_key: state.currentSectionKey === "results" ? "results" : "body",
      semantic_role: "statistical_expression",
    };
  }
  state.genericParagraphCount += 1;
  return {
    block_id: `paragraph-${state.genericParagraphCount}`,
    section_key: state.currentSectionKey,
    semantic_role: "paragraph",
  };
}

function classifyHeadingSectionKey(text: string, headingToken?: string): string {
  const normalized = normalizeSemanticText(text);
  if (isReferenceHeading(normalized)) {
    return "reference";
  }
  if (isAbstractLine(normalized) || isKeywordLine(normalized)) {
    return "abstract";
  }
  if ((headingToken && headingToken.startsWith("2")) || normalized.includes("结果") || normalized.includes("results")) {
    return "results";
  }
  return "body";
}

function classifyFrontMatterSemanticRole(normalized: string, rawText: string): string {
  if (normalized.includes("作者简介") || normalized.includes("第一作者")) {
    return "author_bio";
  }
  if (normalized.includes("通信作者") || normalized.includes("通訊作者") || normalized.includes("correspondingauthor")) {
    return "corresponding_author";
  }
  if (normalized.includes("中图分类号") || normalized.includes("文献标志码")) {
    return "classification_line";
  }
  if (/[\u4e00-\u9fff]{2,4}[、，,\s\u3000]+[\u4e00-\u9fff]{2,4}/u.test(rawText) && !normalized.includes("医院") && !normalized.includes("大学") && !normalized.includes("email")) {
    return "author_line";
  }
  if (normalized.includes("医院") || normalized.includes("大学") || normalized.includes("学院") || normalized.includes("研究所") || normalized.includes("department")) {
    return "affiliation";
  }
  return "front_matter";
}

function buildStatisticalBlockId(
  headingToken: string | undefined,
  normalizedText: string,
): string {
  if (headingToken === "1.5" || normalizedText.includes("spss") || normalizedText.includes("统计")) {
    return "numeric-methods";
  }
  if (headingToken?.startsWith("2.")) {
    return `numeric-results-${headingToken.split(".").at(-1) ?? "1"}`;
  }
  return headingToken?.length ? `numeric-${headingToken.replaceAll(".", "-")}` : "numeric-paragraph";
}

function buildHeadingBlockId(text: string, headingToken: string | undefined, index: number): string {
  if (headingToken?.length) {
    return `heading-${headingToken.replaceAll(".", "-")}`;
  }
  return isReferenceHeading(normalizeSemanticText(text)) ? "reference-heading" : `heading-${index + 1}`;
}

function readHeadingToken(text: string): string | undefined {
  return text.trim().match(/^(\d+(?:\.\d+)*)/u)?.[1];
}

function normalizeSemanticText(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/gu, "");
}

function isReferenceHeading(normalized: string): boolean {
  return normalized.includes("参考文献") || normalized.includes("references");
}

function isAbstractLine(normalized: string): boolean {
  return normalized.includes("摘要") || normalized.includes("abstract");
}

function isKeywordLine(normalized: string): boolean {
  return normalized.includes("关键词") || normalized.includes("keyword");
}

function hasNumericStatisticPattern(text: string): boolean {
  const normalized = text.trim();
  return /\d/u.test(normalized) && /(%|P<|P>|mg|cm|mm|~|d\b)/iu.test(normalized);
}

function isJsonLikePayload(input: { mimeType: string; fileName: string; bytes: Buffer }): boolean {
  if (input.mimeType.includes("json") || input.fileName.endsWith(".json")) {
    return true;
  }
  const text = input.bytes.toString("utf8", 0, Math.min(input.bytes.byteLength, 64)).trimStart();
  return text.startsWith("{") || text.startsWith("[");
}

function isDocxLikePayload(input: { mimeType: string; fileName: string; bytes: Buffer }): boolean {
  if (input.mimeType.includes("wordprocessingml") || input.mimeType.includes("application/msword") || input.fileName.endsWith(".docx")) {
    return true;
  }
  return input.bytes.byteLength >= 4 && input.bytes[0] === 0x50 && input.bytes[1] === 0x4b && input.bytes[2] === 0x03 && input.bytes[3] === 0x04;
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
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
