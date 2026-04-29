import { randomUUID } from "node:crypto";
import path from "node:path";
import { buildConfirmedAiTablePackage } from "./table-evidence-package-builder.ts";
import { applyTableCorrectionPatch } from "./table-evidence-patch-service.ts";
import type {
  ConfirmedAiTablePackage,
  TableCorrectionPatch,
  TableEvidenceAsset,
  TableEvidenceBinding,
  TableEvidenceBindingRole,
  TableEvidenceBindingTargetType,
  TableEvidenceRevision,
  TableFidelityReport,
  TableSourceSnapshot,
} from "./table-evidence-record.ts";
import type { TableEvidenceRepository } from "./table-evidence-repository.ts";
import {
  LocalTableEvidenceSourceFileService,
  type CreateTableEvidenceSourceFileInput,
  type TableEvidenceSourceFileService,
} from "./table-evidence-source-file-service.ts";
import {
  PythonTableEvidenceWorkerAdapter,
  type TableEvidenceWorkerAdapter,
} from "./table-evidence-worker-adapter.ts";

export interface TableEvidenceServiceOptions {
  repository: TableEvidenceRepository;
  sourceRootDir?: string;
  sourceFileService?: TableEvidenceSourceFileService;
  workerAdapter?: TableEvidenceWorkerAdapter;
  createId?: () => string;
  now?: () => Date;
}

export class TableEvidenceService {
  private readonly repository: TableEvidenceRepository;
  private readonly sourceFileService: TableEvidenceSourceFileService;
  private readonly workerAdapter: TableEvidenceWorkerAdapter;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: TableEvidenceServiceOptions) {
    this.repository = options.repository;
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
    this.sourceFileService =
      options.sourceFileService ??
      new LocalTableEvidenceSourceFileService({
        repository: options.repository,
        rootDir: options.sourceRootDir ?? path.resolve(process.cwd(), "uploads"),
        createId: this.createId,
        now: this.now,
      });
    this.workerAdapter = options.workerAdapter ?? new PythonTableEvidenceWorkerAdapter();
  }

  async createAssetFromDocxUpload(input: CreateTableEvidenceSourceFileInput): Promise<{
    sourceFile: Awaited<ReturnType<TableEvidenceSourceFileService["createSourceFile"]>>;
    asset: TableEvidenceAsset;
    revisions: TableEvidenceRevision[];
    tables: TableSourceSnapshot[];
  }> {
    const sourceFile = await this.sourceFileService.createSourceFile(input);
    await this.repository.saveSourceFile(sourceFile);

    const sourcePath = await this.sourceFileService.resolveSourcePath(sourceFile);
    const workerResult = await this.workerAdapter.extractTables({
      sourcePath,
      sourceFileAssetId: sourceFile.id,
    });
    const tables = workerResult.tables.map((table) => ({
      ...structuredClone(table),
      source_file_asset_id: sourceFile.id,
      parser: workerResult.parser,
      parser_version: workerResult.parser_version,
      warnings: [...new Set([...table.warnings, ...workerResult.warnings])],
    }));
    if (tables.length === 0) {
      throw new Error("No extractable tables were found in the DOCX upload.");
    }

    const timestamp = this.now().toISOString();
    const asset: TableEvidenceAsset = {
      id: this.createId(),
      title: inferAssetTitle(sourceFile.file_name, tables[0]),
      source_file_asset_id: sourceFile.id,
      source_file_name: sourceFile.file_name,
      source_kind: "docx_upload",
      parser: workerResult.parser,
      parser_version: workerResult.parser_version,
      fidelity_status: "pending",
      created_by: input.actorId,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await this.repository.saveAsset(asset);

    const revision: TableEvidenceRevision = {
      id: this.createId(),
      table_evidence_asset_id: asset.id,
      revision_no: 1,
      source_snapshot: tables[0],
      correction_patch: { patch_id: this.createId(), operations: [] },
      fidelity_report: buildFidelityReport(tables[0], {
        invisibleCharsConfirmed: false,
        specialSymbolsConfirmed: false,
        hasConfirmedSnapshot: false,
        hasAiPackage: false,
      }),
      confirmation_status: "pending",
      created_at: timestamp,
    };
    await this.repository.saveRevision(revision);

    const activeAsset = {
      ...asset,
      active_revision_id: revision.id,
    };
    await this.repository.saveAsset(activeAsset);

    return {
      sourceFile,
      asset: activeAsset,
      revisions: [revision],
      tables,
    };
  }

  async saveCorrectionPatch(input: {
    revisionId: string;
    patch: TableCorrectionPatch;
  }): Promise<TableEvidenceRevision> {
    const revision = await this.requireRevision(input.revisionId);
    const {
      ai_table_package: _staleAiTablePackage,
      confirmed_by: _staleConfirmedBy,
      confirmed_at: _staleConfirmedAt,
      ...revisionWithoutConfirmationMetadata
    } = revision;
    const updated: TableEvidenceRevision = {
      ...revisionWithoutConfirmationMetadata,
      correction_patch: structuredClone(input.patch),
      confirmed_snapshot: applyTableCorrectionPatch({
        sourceSnapshot: revision.source_snapshot,
        patch: input.patch,
      }),
      confirmation_status: "needs_review",
      fidelity_report: buildFidelityReport(revision.source_snapshot, {
        invisibleCharsConfirmed: false,
        specialSymbolsConfirmed: false,
        hasConfirmedSnapshot: true,
        hasAiPackage: false,
      }),
    };
    await this.repository.saveRevision(updated);
    const asset = await this.repository.findAssetById(revision.table_evidence_asset_id);
    if (asset?.active_revision_id === revision.id) {
      await this.repository.saveAsset({
        ...asset,
        fidelity_status: "needs_review",
        updated_at: this.now().toISOString(),
      });
    }
    return updated;
  }

  async confirmRevision(input: {
    revisionId: string;
    actorId: string;
    confirmations: {
      invisibleCharsConfirmed?: boolean;
      specialSymbolsConfirmed?: boolean;
    };
  }): Promise<TableEvidenceRevision> {
    const revision = await this.requireRevision(input.revisionId);
    const asset = await this.requireAsset(revision.table_evidence_asset_id);
    const confirmedSnapshot = applyTableCorrectionPatch({
      sourceSnapshot: revision.source_snapshot,
      patch: revision.correction_patch,
    });
    const preliminaryReport = buildFidelityReport(revision.source_snapshot, {
      invisibleCharsConfirmed: input.confirmations.invisibleCharsConfirmed === true,
      specialSymbolsConfirmed: input.confirmations.specialSymbolsConfirmed === true,
      hasConfirmedSnapshot: true,
      hasAiPackage: true,
    });
    const timestamp = this.now().toISOString();
    const status =
      preliminaryReport.status === "confirmed" ? "confirmed" : "needs_review";
    const revisionForPackage: TableEvidenceRevision = {
      ...revision,
      confirmed_snapshot: confirmedSnapshot,
      fidelity_report: preliminaryReport,
      confirmation_status: status,
      ...(status === "confirmed"
        ? { confirmed_by: input.actorId, confirmed_at: timestamp }
        : {}),
    };
    const aiPackage = buildConfirmedAiTablePackage({
      packageId: this.createId(),
      asset,
      revision: revisionForPackage,
      sourceSnapshot: revision.source_snapshot,
      confirmedSnapshot,
      fidelityReport: preliminaryReport,
    });
    const updated: TableEvidenceRevision = {
      ...revisionForPackage,
      ai_table_package: aiPackage,
    };

    await this.repository.saveRevision(updated);
    await this.repository.saveAsset({
      ...asset,
      active_revision_id: updated.id,
      fidelity_status: preliminaryReport.status,
      updated_at: timestamp,
    });
    return updated;
  }

  async bindRevision(input: {
    revisionId: string;
    targetType: TableEvidenceBindingTargetType;
    targetId: string;
    bindingRole: TableEvidenceBindingRole;
  }): Promise<TableEvidenceBinding> {
    const revision = await this.assertConfirmedRevision(input.revisionId);
    const binding: TableEvidenceBinding = {
      id: this.createId(),
      table_evidence_asset_id: revision.table_evidence_asset_id,
      table_evidence_revision_id: revision.id,
      target_type: input.targetType,
      target_id: input.targetId,
      binding_role: input.bindingRole,
      created_at: this.now().toISOString(),
    };
    await this.repository.saveBinding(binding);
    return binding;
  }

  async assertConfirmedRevision(revisionId: string): Promise<TableEvidenceRevision> {
    const revision = await this.requireRevision(revisionId);
    if (
      revision.confirmation_status !== "confirmed" ||
      revision.fidelity_report.status !== "confirmed" ||
      !revision.ai_table_package
    ) {
      throw new Error(`Table evidence revision ${revisionId} is not confirmed.`);
    }
    return revision;
  }

  async resolveConfirmedPackagesForTarget(
    targetType: TableEvidenceBindingTargetType,
    targetId: string,
  ): Promise<ConfirmedAiTablePackage[]> {
    const bindings = await this.repository.listBindingsForTarget(targetType, targetId);
    const packages: ConfirmedAiTablePackage[] = [];

    for (const binding of bindings) {
      const revision = await this.repository.findRevisionById(
        binding.table_evidence_revision_id,
      );
      if (
        revision?.confirmation_status === "confirmed" &&
        revision.fidelity_report.status === "confirmed" &&
        revision.ai_table_package?.authority === "authoritative"
      ) {
        packages.push(revision.ai_table_package);
      }
    }

    return packages;
  }

  private async requireRevision(revisionId: string): Promise<TableEvidenceRevision> {
    const revision = await this.repository.findRevisionById(revisionId);
    if (!revision) {
      throw new Error(`Table evidence revision ${revisionId} was not found.`);
    }
    return revision;
  }

  private async requireAsset(assetId: string): Promise<TableEvidenceAsset> {
    const asset = await this.repository.findAssetById(assetId);
    if (!asset) {
      throw new Error(`Table evidence asset ${assetId} was not found.`);
    }
    return asset;
  }
}

function buildFidelityReport(
  sourceSnapshot: TableSourceSnapshot,
  input: {
    invisibleCharsConfirmed: boolean;
    specialSymbolsConfirmed: boolean;
    hasConfirmedSnapshot: boolean;
    hasAiPackage: boolean;
  },
): TableFidelityReport {
  const unsupportedFactGroups = normalizeUnsupportedFactGroups(sourceSnapshot);
  const failureCodes = [
    ...sourceSnapshot.warnings.filter(isFidelityFailureWarning),
    ...(unsupportedFactGroups.length ? ["unsupported_fact_groups"] : []),
  ];
  const missingConfirmations = [
    ...(input.invisibleCharsConfirmed ? [] : ["invisible_chars"]),
    ...(input.specialSymbolsConfirmed ? [] : ["special_symbols"]),
  ];
  const status =
    input.hasConfirmedSnapshot &&
    input.hasAiPackage &&
    missingConfirmations.length === 0 &&
    failureCodes.length === 0
      ? "confirmed"
      : input.hasConfirmedSnapshot || missingConfirmations.length > 0 || failureCodes.length > 0
        ? "needs_review"
        : "pending";

  return {
    status,
    failure_codes: failureCodes,
    unsupported_fact_groups: unsupportedFactGroups,
    required_confirmations: status === "confirmed" ? [] : missingConfirmations,
    invisible_chars_confirmed: input.invisibleCharsConfirmed,
    special_symbols_confirmed: input.specialSymbolsConfirmed,
  };
}

function isFidelityFailureWarning(warning: string): boolean {
  return (
    warning.includes("unknown_symbol_mapping") ||
    warning === "image_only_table" ||
    warning === "nested_table_unsupported" ||
    warning === "text_box_table_unsupported" ||
    warning.startsWith("worker_payload_invalid:")
  );
}

function normalizeUnsupportedFactGroups(sourceSnapshot: TableSourceSnapshot): string[] {
  const value = (sourceSnapshot as TableSourceSnapshot & {
    unsupported_fact_groups?: unknown;
  }).unsupported_fact_groups;
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function inferAssetTitle(fileName: string, sourceSnapshot: TableSourceSnapshot): string {
  return (
    sourceSnapshot.caption?.text ||
    sourceSnapshot.grid_cells.find((cell) => cell.role === "header")?.text ||
    path.basename(fileName, path.extname(fileName)) ||
    sourceSnapshot.table_id
  );
}
