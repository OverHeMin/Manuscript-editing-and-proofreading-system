import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import type { DocumentStructureTableSnapshot } from "./document-structure-service.ts";
import type { ResolvedEditorialRule } from "../editorial-rules/editorial-rule-resolution-service.ts";
import {
  EditorialRuleTableHitService,
  type EditorialRuleTableHit,
} from "../editorial-rules/editorial-rule-table-hit-service.ts";
import {
  selectDeterministicFormatRules,
} from "../editorial-execution/deterministic-format-rule-executor.ts";
import type {
  ApplyDeterministicDocxRulesInput,
  DeterministicDocxTransformResult,
  TableRuleInspectionFinding,
} from "../editorial-execution/types.ts";
import { describeTableInspectionReason } from "../editorial-execution/editorial-rule-expectation.ts";
import { TableDocxPatchPlanner } from "./table-docx-patch-planner.ts";
import type {
  TableDocxPatchPlan,
  TableDocxPatchResult,
  TableReconstructionValidationSnapshot,
} from "./table-docx-patch-plan.ts";
import {
  buildPythonCommandCandidates,
  buildWorkspaceChildProcessEnv,
  isCommandUnavailableError,
} from "../shared/windows-command-runtime.ts";

const APPLY_EDITORIAL_RULES_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/apply_editorial_rules.py",
);
const MATERIALIZE_DOCX_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/materialize_docx.py",
);
const EXTRACT_DOCX_STRUCTURE_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../../../worker-py/src/document_pipeline/extract_docx_structure.py",
);

export interface EditorialDocxTransformServiceOptions {
  assetRepository: DocumentAssetRepository;
  rootDir?: string;
  tableHitService?: Pick<EditorialRuleTableHitService, "findMatches">;
  tablePatchPlanner?: Pick<TableDocxPatchPlanner, "plan">;
}

export class EditorialDocxTransformSourceAssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Source DOCX asset ${assetId} was not found for editorial transformation.`);
    this.name = "EditorialDocxTransformSourceAssetNotFoundError";
  }
}

export class EditorialDocxTransformWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorialDocxTransformWorkerError";
  }
}

export class EditorialDocxTransformService {
  private readonly assetRepository: DocumentAssetRepository;
  private readonly rootDir: string;
  private readonly tableHitService: Pick<EditorialRuleTableHitService, "findMatches">;
  private readonly tablePatchPlanner: Pick<TableDocxPatchPlanner, "plan">;

  constructor(options: EditorialDocxTransformServiceOptions) {
    this.assetRepository = options.assetRepository;
    this.rootDir =
      options.rootDir ??
      path.resolve(
        process.cwd(),
        ".local-data",
        "uploads",
        process.env.APP_ENV ?? "dev",
      );
    this.tableHitService = options.tableHitService ?? new EditorialRuleTableHitService();
    this.tablePatchPlanner =
      options.tablePatchPlanner ??
      new TableDocxPatchPlanner({
        tableHitService: this.tableHitService,
      });
  }

  async applyDeterministicRules(
    input: ApplyDeterministicDocxRulesInput,
  ): Promise<DeterministicDocxTransformResult> {
    const sourceAsset = await this.assetRepository.findById(input.sourceAssetId);
    if (!sourceAsset) {
      throw new EditorialDocxTransformSourceAssetNotFoundError(input.sourceAssetId);
    }

    const deterministicRules = selectDeterministicFormatRules(input.rules);
    const resolvedRules = resolveRulesForTableProcessing(input);
    const tableInspectionFindings = buildTableInspectionFindings({
      rules: input.rules,
      resolvedRules,
      tableSnapshots: input.tableSnapshots ?? [],
      tableHitService: this.tableHitService,
    });
    const tablePatchPlanBundle = this.tablePatchPlanner.plan({
      tableAutoApplyMode: input.tableAutoApplyMode,
      resolvedRules,
      tableSnapshots: input.tableSnapshots ?? [],
    });
    const aiReplacements = input.aiReplacements ?? [];
    const sourcePath = resolveStoragePath(this.rootDir, sourceAsset.storage_key);
    const outputPath = resolveStoragePath(this.rootDir, input.outputStorageKey);

    await this.ensureSourceDocxMaterialized(sourceAsset, sourcePath);
    await mkdir(path.dirname(outputPath), { recursive: true });

    if (
      deterministicRules.length === 0 &&
      aiReplacements.length === 0 &&
      tablePatchPlanBundle.plans.length === 0
    ) {
      await copyFile(sourcePath, outputPath);
      return {
        appliedRuleIds: [],
        appliedChanges: [],
        tableInspectionFindings,
        tablePatchPlans: tablePatchPlanBundle.plans,
        tablePatchResults: tablePatchPlanBundle.results,
        skippedAiReplacements: [],
      };
    }

    const workerResult = await runApplyRulesWorker({
      sourcePath,
      outputPath,
      rules: deterministicRules,
      aiReplacements,
      tableAutoApplyMode: input.tableAutoApplyMode,
      tablePatches: tablePatchPlanBundle.plans,
    });
    const reparsedOutputTables = tablePatchPlanBundle.plans.some(
      (plan) => plan.execution_path === "controlled_rebuild",
    )
      ? await runDocxStructureTableExtraction(outputPath)
      : [];
    const validatedTablePatchResults = attachTableRebuildValidationSnapshots({
      plans: tablePatchPlanBundle.plans,
      workerResults: workerResult.tablePatchResults,
      reparsedOutputTables,
    });

    return {
      ...workerResult,
      tableInspectionFindings,
      tablePatchPlans: tablePatchPlanBundle.plans,
      tablePatchResults: [
        ...tablePatchPlanBundle.results,
        ...validatedTablePatchResults,
      ],
    };
  }

  private async ensureSourceDocxMaterialized(
    sourceAsset: DocumentAssetRecord,
    sourcePath: string,
  ): Promise<void> {
    try {
      await readFile(sourcePath);
      return;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    await mkdir(path.dirname(sourcePath), { recursive: true });
    await runDocxMaterializer({
      outputPath: sourcePath,
      title: sourceAsset.file_name ?? sourceAsset.id,
      manuscriptId: sourceAsset.manuscript_id,
      assetType: sourceAsset.asset_type,
      sourcePath: await this.resolveNearestSourceDocxPath(sourceAsset),
    });
  }

  private async resolveNearestSourceDocxPath(
    sourceAsset: DocumentAssetRecord,
  ): Promise<string | undefined> {
    const manuscriptAssets = await this.assetRepository.listByManuscriptId(
      sourceAsset.manuscript_id,
    );
    const assetsById = new Map(manuscriptAssets.map((record) => [record.id, record]));
    const visited = new Set<string>();
    let current: DocumentAssetRecord | undefined = sourceAsset;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      current = current.parent_asset_id
        ? assetsById.get(current.parent_asset_id)
        : undefined;

      if (!current) {
        return undefined;
      }

      const candidatePath = resolveStoragePath(this.rootDir, current.storage_key);
      try {
        await readFile(candidatePath);
        return candidatePath;
      } catch (error) {
        if (!isMissingFileError(error)) {
          throw error;
        }
      }
    }

    return undefined;
  }
}

function attachTableRebuildValidationSnapshots(input: {
  plans: readonly TableDocxPatchPlan[];
  workerResults: readonly TableDocxPatchResult[];
  reparsedOutputTables?: readonly DocumentStructureTableSnapshot[];
}): TableDocxPatchResult[] {
  const planByPatchId = new Map(input.plans.map((plan) => [plan.patch_id, plan]));
  return input.workerResults.map((result) => {
    if (result.execution_path !== "controlled_rebuild") {
      return structuredClone(result);
    }

    const plan = planByPatchId.get(result.patch_id);
    if (!plan?.table_reconstruction_plan) {
      return {
        ...structuredClone(result),
        status: "validation_failed",
        reason:
          "Controlled table rebuild did not include a table reconstruction plan for validation.",
      };
    }

    const validationSnapshot = buildTableReconstructionValidationSnapshot(
      plan,
      result,
      input.reparsedOutputTables?.find((table) => table.table_id === plan.table_id),
    );
    if (validationSnapshot.status === "failed") {
      return {
        ...structuredClone(result),
        status: "validation_failed",
        reason:
          "Controlled table rebuild validation failed; completion must be blocked and routed to manual review.",
        validation_snapshot: validationSnapshot,
      };
    }

    return {
      ...structuredClone(result),
      validation_snapshot: validationSnapshot,
    };
  });
}

function buildTableReconstructionValidationSnapshot(
  plan: TableDocxPatchPlan,
  result: TableDocxPatchResult,
  reparsedOutputTable?: DocumentStructureTableSnapshot,
): TableReconstructionValidationSnapshot {
  const reconstructionPlan = plan.table_reconstruction_plan;
  const contentPreserved =
    reconstructionPlan?.content_preservation_map.every((entry) => entry.preserved) ??
    false;
  const operationsPlanned =
    reconstructionPlan?.operations.every((operation) => operation.status === "planned") ??
    false;
  const noDowngradeReasons =
    (reconstructionPlan?.downgrade_reasons.length ?? 1) === 0;
  const workerApplied = result.status === "applied";
  const idempotenceKey = buildTableRebuildIdempotenceKey(plan);
  const reparsedContentMatches = compareReparsedTableContent({
    plan,
    reparsedOutputTable,
  });
  const reparsedTopologyMatches = compareReparsedTableTopology({
    plan,
    reparsedOutputTable,
  });
  const reparsedBorderMatches = compareReparsedTableBorderSystem({
    reparsedOutputTable,
  });
  const checks: TableReconstructionValidationSnapshot["checks"] = [
    {
      check_kind: "content_preservation",
      passed: contentPreserved && reparsedContentMatches.passed,
      reason: contentPreserved && reparsedContentMatches.passed
        ? "Every source cell maps to a target cell with unchanged text after DOCX re-parse."
        : reparsedContentMatches.reason,
    },
    {
      check_kind: "topology_preservation",
      passed:
        operationsPlanned && noDowngradeReasons && reparsedTopologyMatches.passed,
      reason:
        operationsPlanned && noDowngradeReasons && reparsedTopologyMatches.passed
          ? "Re-parsed DOCX topology matches the reconstruction plan."
          : reparsedTopologyMatches.reason,
    },
    {
      check_kind: "target_border_system",
      passed:
        operationsPlanned && noDowngradeReasons && reparsedBorderMatches.passed,
      reason:
        operationsPlanned && noDowngradeReasons && reparsedBorderMatches.passed
          ? "Re-parsed DOCX table exposes the target three-line border system."
          : reparsedBorderMatches.reason,
    },
    {
      check_kind: "caption_note_placement",
      passed: operationsPlanned,
      reason: operationsPlanned
        ? "Caption and note-zone placement operations are present."
        : "Caption or note-zone placement is not fully planned.",
    },
    {
      check_kind: "rich_fragment_preservation",
      passed: operationsPlanned && noDowngradeReasons,
      reason: operationsPlanned && noDowngradeReasons
        ? "Rich fragment preservation operation is present and evidence is authoritative."
        : "Rich fragment preservation requires manual review.",
    },
    {
      check_kind: "object_policy",
      passed: operationsPlanned && noDowngradeReasons,
      reason: operationsPlanned && noDowngradeReasons
        ? "Object handling policy is represented in the reconstruction plan."
        : "Object handling policy cannot be validated from current evidence.",
    },
    {
      check_kind: "idempotence",
      passed: workerApplied && idempotenceKey.length > 0,
      reason: workerApplied
        ? "The same patch id, table id, and reconstruction plan create a stable idempotence key."
        : "Worker did not report the controlled rebuild as applied.",
    },
  ];

  return {
    snapshot_id: `${plan.patch_id}:validation`,
    patch_id: plan.patch_id,
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
    rollback_point: {
      source_table_id: plan.table_id,
      source_patch_id: plan.patch_id,
    },
    idempotence_key: idempotenceKey,
  };
}

function buildTableRebuildIdempotenceKey(plan: TableDocxPatchPlan): string {
  return JSON.stringify({
    patch_id: plan.patch_id,
    table_id: plan.table_id,
    execution_path: plan.execution_path,
    reconstruction_plan: plan.table_reconstruction_plan,
  });
}

function compareReparsedTableContent(input: {
  plan: TableDocxPatchPlan;
  reparsedOutputTable?: DocumentStructureTableSnapshot;
}): { passed: boolean; reason: string } {
  if (!input.reparsedOutputTable) {
    return {
      passed: false,
      reason: "Written DOCX could not be re-parsed for content validation.",
    };
  }

  const expectedTexts =
    input.plan.table_reconstruction_plan?.content_preservation_map.map(
      (entry) => entry.target_text,
    ) ?? [];
  const actualTexts = new Set(
    (input.reparsedOutputTable.grid_cells ?? [])
      .map((cell) => cell.text.trim())
      .filter((text) => text.length > 0),
  );
  const missingTexts = expectedTexts.filter(
    (text) => text.trim().length > 0 && !actualTexts.has(text.trim()),
  );
  return missingTexts.length === 0
    ? {
        passed: true,
        reason: "Re-parsed DOCX table contains every planned preserved cell text.",
      }
    : {
        passed: false,
        reason: `Re-parsed DOCX table is missing preserved cell text: ${missingTexts.join(", ")}.`,
      };
}

function compareReparsedTableTopology(input: {
  plan: TableDocxPatchPlan;
  reparsedOutputTable?: DocumentStructureTableSnapshot;
}): { passed: boolean; reason: string } {
  if (!input.reparsedOutputTable) {
    return {
      passed: false,
      reason: "Written DOCX could not be re-parsed for topology validation.",
    };
  }

  const expectedCells =
    input.plan.table_reconstruction_plan?.normalized_table_object.cells ?? [];
  const actualCellCount = input.reparsedOutputTable.grid_cells?.length ?? 0;
  const expectedRowCount =
    input.plan.table_reconstruction_plan?.normalized_table_object.row_count;
  const expectedColumnCount =
    input.plan.table_reconstruction_plan?.normalized_table_object.column_count;
  const rowCountMatches =
    expectedRowCount == null ||
    input.reparsedOutputTable.row_count === expectedRowCount;
  const columnCountMatches =
    expectedColumnCount == null ||
    input.reparsedOutputTable.column_count === expectedColumnCount;
  const cellCountMatches =
    expectedCells.length === 0 || actualCellCount >= expectedCells.length;

  if (rowCountMatches && columnCountMatches && cellCountMatches) {
    return {
      passed: true,
      reason: "Re-parsed DOCX table row, column, and cell topology is compatible with the reconstruction plan.",
    };
  }

  return {
    passed: false,
    reason: `Re-parsed DOCX table topology drifted: expected rows ${expectedRowCount ?? "any"}, columns ${expectedColumnCount ?? "any"}, cells >= ${expectedCells.length}; got rows ${input.reparsedOutputTable.row_count ?? "unknown"}, columns ${input.reparsedOutputTable.column_count ?? "unknown"}, cells ${actualCellCount}.`,
  };
}

function compareReparsedTableBorderSystem(input: {
  reparsedOutputTable?: DocumentStructureTableSnapshot;
}): { passed: boolean; reason: string } {
  const styleProfile = input.reparsedOutputTable?.style_profile;
  if (!styleProfile) {
    return {
      passed: false,
      reason: "Written DOCX table did not expose a re-parsed style profile.",
    };
  }

  const passed =
    styleProfile.has_top_rule &&
    styleProfile.has_header_rule &&
    styleProfile.has_bottom_rule &&
    !styleProfile.has_vertical_rules;
  return passed
    ? {
        passed: true,
        reason: "Re-parsed DOCX table matches the target three-line border system.",
      }
    : {
        passed: false,
        reason: "Re-parsed DOCX table border system does not match the target three-line model.",
      };
}

async function runApplyRulesWorker(input: {
  sourcePath: string;
  outputPath: string;
  rules: unknown[];
  aiReplacements?: unknown[];
  tableAutoApplyMode: ApplyDeterministicDocxRulesInput["tableAutoApplyMode"];
  tablePatches?: unknown[];
}): Promise<
  Pick<
    DeterministicDocxTransformResult,
    | "appliedRuleIds"
    | "appliedChanges"
    | "tablePatchResults"
    | "skippedAiReplacements"
  >
> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCommandCandidates()) {
    try {
      return await runPythonScript(pythonBin, input);
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
    new EditorialDocxTransformWorkerError(
      "No usable Python interpreter was found for deterministic DOCX transforms.",
    )
  );
}

async function runDocxStructureTableExtraction(
  sourcePath: string,
): Promise<DocumentStructureTableSnapshot[]> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCommandCandidates()) {
    try {
      const parsed = await runDocxStructurePythonScript(pythonBin, sourcePath);
      return normalizeReparsedTables(parsed);
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
    new EditorialDocxTransformWorkerError(
      "No usable Python interpreter was found for DOCX re-parse validation.",
    )
  );
}

function runDocxStructurePythonScript(
  pythonBin: string,
  sourcePath: string,
): Promise<unknown> {
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
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new EditorialDocxTransformWorkerError(
            `DOCX re-parse validation failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new EditorialDocxTransformWorkerError(
            `DOCX re-parse validation returned invalid JSON: ${stdout.trim() || String(error)}`,
          ),
        );
      }
    });
  });
}

function normalizeReparsedTables(value: unknown): DocumentStructureTableSnapshot[] {
  const record = isRecord(value) ? value : {};
  if (!Array.isArray(record.tables)) {
    return [];
  }

  return record.tables.flatMap((entry) => {
    const table = isRecord(entry) ? entry : {};
    const semantic = isRecord(table.semantic) ? table.semantic : table;
    const tableId = readOptionalString(semantic.table_id);
    if (!tableId) {
      return [];
    }

    return [
      {
        table_id: tableId,
        row_count: readOptionalNumber(semantic.row_count),
        column_count: readOptionalNumber(semantic.column_count),
        profile: {
          is_three_line_table: Boolean(
            isRecord(semantic.profile)
              ? semantic.profile.is_three_line_table
              : false,
          ),
          header_depth:
            readOptionalNumber(
              isRecord(semantic.profile) ? semantic.profile.header_depth : undefined,
            ) ?? 0,
          has_stub_column: Boolean(
            isRecord(semantic.profile) ? semantic.profile.has_stub_column : false,
          ),
          has_statistical_footnotes: Boolean(
            isRecord(semantic.profile)
              ? semantic.profile.has_statistical_footnotes
              : false,
          ),
          has_unit_markers: Boolean(
            isRecord(semantic.profile) ? semantic.profile.has_unit_markers : false,
          ),
        },
        style_profile: normalizeReparsedStyleProfile(semantic.style_profile, tableId),
        header_cells: [],
        data_cells: [],
        footnote_items: [],
        grid_cells: normalizeReparsedGridCells(semantic.grid_cells),
      } satisfies DocumentStructureTableSnapshot,
    ];
  });
}

function normalizeReparsedStyleProfile(
  value: unknown,
  tableId: string,
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
    coordinate: {
      table_id: tableId,
      target: "style_profile",
    },
  };
}

function normalizeReparsedGridCells(
  value: unknown,
): DocumentStructureTableSnapshot["grid_cells"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const record = isRecord(entry) ? entry : {};
    return [
      {
        id: readOptionalString(record.id) ?? `reparsed-cell-${index + 1}`,
        text: readOptionalString(record.text) ?? "",
        row_index: readOptionalNumber(record.row_index) ?? 0,
        column_index: readOptionalNumber(record.column_index) ?? 0,
        row_span: readOptionalNumber(record.row_span) ?? 1,
        column_span: readOptionalNumber(record.column_span) ?? 1,
        inferred_role: readReparsedCellRole(record.inferred_role),
        style_evidence: buildUnavailableCellStyleEvidence(),
        paragraphs: [],
      },
    ];
  });
}

function buildUnavailableCellStyleEvidence(): NonNullable<
  DocumentStructureTableSnapshot["grid_cells"]
>[number]["style_evidence"] {
  const unavailable = { availability: "unavailable" as const };
  return {
    font_family: unavailable,
    font_size_pt: unavailable,
    bold: unavailable,
    italic: unavailable,
    script_position: unavailable,
    alignment: unavailable,
    spacing_before_pt: unavailable,
    spacing_after_pt: unavailable,
    line_spacing: unavailable,
    line_spacing_mode: unavailable,
    left_indent_pt: unavailable,
    right_indent_pt: unavailable,
    first_line_indent_pt: unavailable,
    hanging_indent_pt: unavailable,
    vertical_alignment: unavailable,
    text_direction: unavailable,
  };
}

function readReparsedCellRole(
  value: unknown,
): NonNullable<DocumentStructureTableSnapshot["grid_cells"]>[number]["inferred_role"] {
  return value === "header" ||
    value === "stub" ||
    value === "data" ||
    value === "unknown"
    ? value
    : "unknown";
}

function runPythonScript(
  pythonBin: string,
  input: {
    sourcePath: string;
    outputPath: string;
    rules: unknown[];
    aiReplacements?: unknown[];
    tableAutoApplyMode: ApplyDeterministicDocxRulesInput["tableAutoApplyMode"];
    tablePatches?: unknown[];
  },
): Promise<
  Pick<
    DeterministicDocxTransformResult,
    | "appliedRuleIds"
    | "appliedChanges"
    | "tablePatchResults"
    | "skippedAiReplacements"
  >
> {
  return new Promise((resolve, reject) => {
    const args = [
      APPLY_EDITORIAL_RULES_SCRIPT,
      "--source-path",
      input.sourcePath,
      "--output-path",
      input.outputPath,
      "--rules-json",
      JSON.stringify(input.rules),
      "--ai-replacements-json",
      JSON.stringify(input.aiReplacements ?? []),
      "--table-auto-apply-mode",
      input.tableAutoApplyMode,
      "--table-patches-json",
      JSON.stringify(input.tablePatches ?? []),
    ];

    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: buildWorkspaceChildProcessEnv(),
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new EditorialDocxTransformWorkerError(
            `Deterministic DOCX transform failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
          ),
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as DeterministicDocxTransformResult;
        const parsedRecord = parsed as unknown as Record<string, unknown>;
        const appliedRuleIds = Array.isArray(parsed.appliedRuleIds)
          ? parsed.appliedRuleIds
          : Array.isArray(parsedRecord.applied_rule_ids)
            ? (parsedRecord.applied_rule_ids as string[])
            : [];
        const appliedChanges = Array.isArray(parsed.appliedChanges)
          ? parsed.appliedChanges
          : Array.isArray(parsedRecord.applied_changes)
            ? (parsedRecord.applied_changes as DeterministicDocxTransformResult["appliedChanges"])
            : [];
        const tablePatchResults = Array.isArray(parsed.tablePatchResults)
          ? parsed.tablePatchResults
          : Array.isArray(parsedRecord.table_patch_results)
            ? (parsedRecord.table_patch_results as DeterministicDocxTransformResult["tablePatchResults"])
            : [];
        const skippedAiReplacements = Array.isArray(parsed.skippedAiReplacements)
          ? parsed.skippedAiReplacements
          : Array.isArray(parsedRecord.skipped_ai_replacements)
            ? (parsedRecord.skipped_ai_replacements as DeterministicDocxTransformResult["skippedAiReplacements"])
            : [];
        resolve({
          appliedRuleIds: [...appliedRuleIds],
          appliedChanges: [...appliedChanges],
          tablePatchResults: tablePatchResults.map((entry) => structuredClone(entry)),
          skippedAiReplacements: skippedAiReplacements.map((entry) =>
            structuredClone(entry),
          ),
        });
      } catch (error) {
        reject(
          new EditorialDocxTransformWorkerError(
            `Deterministic DOCX transform returned invalid JSON: ${stdout.trim() || String(error)}`,
          ),
        );
      }
    });
  });
}

function resolveRulesForTableProcessing(
  input: ApplyDeterministicDocxRulesInput,
): ResolvedEditorialRule[] {
  if (input.resolvedRules && input.resolvedRules.length > 0) {
    return input.resolvedRules;
  }

  return input.rules
    .filter((rule) => rule.enabled)
    .map((rule) => createFallbackResolvedRule(rule));
}

function buildTableInspectionFindings(input: {
  rules: ApplyDeterministicDocxRulesInput["rules"];
  resolvedRules?: ResolvedEditorialRule[];
  tableSnapshots: NonNullable<ApplyDeterministicDocxRulesInput["tableSnapshots"]>;
  tableHitService: Pick<EditorialRuleTableHitService, "findMatches">;
}): TableRuleInspectionFinding[] {
  if (input.tableSnapshots.length === 0) {
    return [];
  }

  const resolvedRules =
    input.resolvedRules && input.resolvedRules.length > 0
      ? input.resolvedRules
      : input.rules
          .filter((rule) => rule.enabled)
          .map((rule) => createFallbackResolvedRule(rule));

  return resolvedRules.flatMap((entry) => {
    if (!entry.rule.enabled || entry.rule.rule_object !== "table") {
      return [];
    }

    return input.tableHitService
      .findMatches({
        rule: entry.rule,
        tableSnapshots: input.tableSnapshots,
      })
      .map((hit) => ({
        ruleId: entry.rule.id,
        reason: describeTableInspectionReason({
          matchReason: hit.reason,
          rule: entry.rule,
        }),
        semantic_hit: toSemanticHitEvidence(hit, entry.source_layer),
      }));
  });
}

function toSemanticHitEvidence(
  hit: EditorialRuleTableHit,
  sourceLayer: "base" | "journal",
): TableRuleInspectionFinding["semantic_hit"] {
  return {
    table_id: hit.table_id,
    semantic_target: hit.semantic_target,
    ...(hit.semantic_coordinate.header_path
      ? {
          header_path: [...hit.semantic_coordinate.header_path],
        }
      : {}),
    ...(hit.semantic_coordinate.row_key
      ? {
          row_key: hit.semantic_coordinate.row_key,
        }
      : {}),
    ...(hit.semantic_coordinate.column_key
      ? {
          column_key: hit.semantic_coordinate.column_key,
        }
      : {}),
    ...(hit.semantic_coordinate.footnote_anchor
      ? {
          footnote_anchor: hit.semantic_coordinate.footnote_anchor,
        }
      : {}),
    override_source: sourceLayer,
  };
}

function createFallbackResolvedRule(
  rule: ApplyDeterministicDocxRulesInput["rules"][number],
): ResolvedEditorialRule {
  return {
    rule,
    coverage_key: rule.id,
    source_layer: "base",
    overridden_rule_ids: [],
    resolution_reason: "runtime fallback",
    execution_posture: "guarded",
    activation_source: {
      kind: "template_family_rule_set",
      id: rule.rule_set_id,
    },
    overridden_sources: [],
  };
}

async function runDocxMaterializer(input: {
  outputPath: string;
  title: string;
  manuscriptId: string;
  assetType: string;
  sourcePath?: string;
}): Promise<void> {
  let lastError: Error | undefined;

  for (const pythonBin of buildPythonCommandCandidates()) {
    try {
      await runMaterializerScript(pythonBin, input);
      return;
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
    new EditorialDocxTransformWorkerError(
      "No usable Python interpreter was found for DOCX materialization.",
    )
  );
}

function runMaterializerScript(
  pythonBin: string,
  input: {
    outputPath: string;
    title: string;
    manuscriptId: string;
    assetType: string;
    sourcePath?: string;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      MATERIALIZE_DOCX_SCRIPT,
      "--output-path",
      input.outputPath,
      "--title",
      input.title,
      "--manuscript-id",
      input.manuscriptId,
      "--asset-type",
      input.assetType,
    ];

    if (input.sourcePath) {
      args.push("--source-path", input.sourcePath);
    }

    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "ignore", "pipe"],
      env: buildWorkspaceChildProcessEnv(),
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new EditorialDocxTransformWorkerError(
          `DOCX materialization failed with exit code ${code ?? "unknown"}: ${stderr.trim() || "No stderr output."}`,
        ),
      );
    });
  });
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
    throw new EditorialDocxTransformWorkerError(
      `Resolved asset path escaped the configured root: "${storageKey}".`,
    );
  }

  return absolutePath;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
