import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { ManuscriptNotFoundError } from "../assets/document-asset-service.ts";
import type { ReviewedCaseSnapshotRepository } from "../learning/learning-repository.ts";
import {
  LearningHumanFinalAssetRequiredError,
  ReviewedCaseSnapshotNotFoundError,
} from "../learning/learning-service.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import {
  InMemoryHarnessDatasetRepository,
} from "./in-memory-harness-dataset-repository.ts";
import type {
  HarnessDatasetExportFormat,
  HarnessDatasetPublicationRecord,
  HarnessDatasetSourceKind,
  HarnessGoldSetFamilyRecord,
  HarnessGoldSetItemRecord,
  HarnessGoldSetVersionRecord,
  HarnessRubricDefinitionRecord,
  HarnessRubricDimensionRecord,
} from "./harness-dataset-record.ts";
import type { HarnessDatasetRepository } from "./harness-dataset-repository.ts";
import type { VerificationOpsRepository } from "../verification-ops/verification-ops-repository.ts";
import {
  EvaluationEvidencePackNotFoundError,
  EvaluationRunNotFoundError,
  EvaluationSampleSetNotFoundError,
} from "../verification-ops/verification-ops-service.ts";

export interface CreateGoldSetFamilyInput {
  name: string;
  description?: string;
  scope: {
    module: HarnessGoldSetFamilyRecord["scope"]["module"];
    manuscriptTypes: HarnessGoldSetFamilyRecord["scope"]["manuscript_types"];
    measureFocus: string;
    templateFamilyId?: string;
  };
}

export interface CreateRubricDefinitionInput {
  name: string;
  scope: {
    module: HarnessRubricDefinitionRecord["scope"]["module"];
    manuscriptTypes: HarnessRubricDefinitionRecord["scope"]["manuscript_types"];
  };
  scoringDimensions: HarnessRubricDimensionRecord[];
  hardGateRules?: string[];
  failureAnchors?: string[];
  borderlineExamples?: string[];
  judgePrompt?: string;
  createdBy: string;
}

export interface PublishRubricDefinitionInput {
  publishedBy: string;
}

export interface CreateGoldSetVersionInput {
  familyId: string;
  rubricDefinitionId?: string;
  items: Array<{
    sourceKind: HarnessGoldSetItemRecord["source_kind"];
    sourceId: string;
    manuscriptId: string;
    manuscriptType: HarnessGoldSetItemRecord["manuscript_type"];
    deidentificationPassed: boolean;
    humanReviewed: boolean;
    riskTags?: string[];
    expectedStructuredOutput?: Record<string, unknown>;
  }>;
  publicationNotes?: string;
  createdBy: string;
}

export interface UpdateGoldSetVersionDraftInput {
  rubricDefinitionId?: string;
  items?: Array<{
    sourceKind: HarnessGoldSetItemRecord["source_kind"];
    sourceId: string;
    manuscriptId: string;
    manuscriptType: HarnessGoldSetItemRecord["manuscript_type"];
    deidentificationPassed: boolean;
    humanReviewed: boolean;
    riskTags?: string[];
    expectedStructuredOutput?: Record<string, unknown>;
  }>;
  publicationNotes?: string;
}

export interface PublishGoldSetVersionInput {
  publishedBy: string;
}

export interface ArchiveGoldSetVersionInput {
  archivedBy: string;
}

export interface CreateHarnessDatasetDraftCandidateInput {
  familyName: string;
  description?: string;
  measureFocus: string;
  templateFamilyId?: string;
  publicationNotes?: string;
  createdBy: string;
}

export interface CreateHarnessDatasetDraftCandidateFromHumanFinalAssetInput
  extends CreateHarnessDatasetDraftCandidateInput {
  module: TemplateModule;
}

export interface HarnessDatasetDraftCandidateRecord {
  source_kind: HarnessDatasetSourceKind;
  source_id: string;
  draft_family_id: string;
  draft_version_id: string;
  status: HarnessGoldSetVersionRecord["status"];
  item_count: number;
  requires_manual_rubric_assignment: true;
}

export interface HarnessDatasetRubricAssignmentRecord {
  status: "missing" | HarnessRubricDefinitionRecord["status"];
  rubric_definition_id?: string;
  rubric_name?: string;
  rubric_version_no?: number;
}

export interface HarnessDatasetWorkbenchVersionRecord
  extends HarnessGoldSetVersionRecord {
  family_name: string;
  family_scope: HarnessGoldSetFamilyRecord["scope"];
  rubric_assignment: HarnessDatasetRubricAssignmentRecord;
  publications: HarnessDatasetPublicationRecord[];
}

export interface HarnessDatasetWorkbenchOverviewRecord {
  export_root_dir: string;
  versions: HarnessDatasetWorkbenchVersionRecord[];
  rubrics: HarnessRubricDefinitionRecord[];
}

export interface ExportHarnessGoldSetVersionInput {
  format: HarnessDatasetExportFormat;
  exportRootDir: string;
}

export interface HarnessDatasetExportResultRecord {
  publication: HarnessDatasetPublicationRecord;
  output_path: string;
}

interface HarnessDatasetWriteContext {
  repository: HarnessDatasetRepository;
}

export interface HarnessDatasetServiceOptions {
  repository: HarnessDatasetRepository;
  reviewedCaseSnapshotRepository?: ReviewedCaseSnapshotRepository;
  manuscriptRepository?: ManuscriptRepository;
  assetRepository?: DocumentAssetRepository;
  verificationOpsRepository?: VerificationOpsRepository;
  permissionGuard?: PermissionGuard;
  transactionManager?: WriteTransactionManager<HarnessDatasetWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export class HarnessGoldSetFamilyNotFoundError extends Error {
  constructor(familyId: string) {
    super(`Harness gold-set family ${familyId} was not found.`);
    this.name = "HarnessGoldSetFamilyNotFoundError";
  }
}

export class HarnessGoldSetVersionNotFoundError extends Error {
  constructor(versionId: string) {
    super(`Harness gold-set version ${versionId} was not found.`);
    this.name = "HarnessGoldSetVersionNotFoundError";
  }
}

export class HarnessGoldSetVersionNotEditableError extends Error {
  constructor(versionId: string, status: string) {
    super(
      `Harness gold-set version ${versionId} is ${status} and can no longer be edited as a draft.`,
    );
    this.name = "HarnessGoldSetVersionNotEditableError";
  }
}

export class HarnessGoldSetVersionPublishValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessGoldSetVersionPublishValidationError";
  }
}

export class HarnessRubricDefinitionNotFoundError extends Error {
  constructor(rubricDefinitionId: string) {
    super(`Harness rubric definition ${rubricDefinitionId} was not found.`);
    this.name = "HarnessRubricDefinitionNotFoundError";
  }
}

export class HarnessRubricDefinitionStatusTransitionError extends Error {
  constructor(rubricDefinitionId: string, fromStatus: string, toStatus: string) {
    super(
      `Harness rubric definition ${rubricDefinitionId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "HarnessRubricDefinitionStatusTransitionError";
  }
}

export class HarnessDatasetDependencyMissingError extends Error {
  constructor(dependencyName: string) {
    super(`Harness dataset service requires ${dependencyName} for this operation.`);
    this.name = "HarnessDatasetDependencyMissingError";
  }
}

export class HarnessDatasetSourceResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessDatasetSourceResolutionError";
  }
}

export class HarnessGoldSetVersionExportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessGoldSetVersionExportValidationError";
  }
}

export class HarnessDatasetService {
  private readonly repository: HarnessDatasetRepository;
  private readonly reviewedCaseSnapshotRepository?: ReviewedCaseSnapshotRepository;
  private readonly manuscriptRepository?: ManuscriptRepository;
  private readonly assetRepository?: DocumentAssetRepository;
  private readonly verificationOpsRepository?: VerificationOpsRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager<HarnessDatasetWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: HarnessDatasetServiceOptions) {
    this.repository = options.repository;
    this.reviewedCaseSnapshotRepository = options.reviewedCaseSnapshotRepository;
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.verificationOpsRepository = options.verificationOpsRepository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.transactionManager =
      options.transactionManager ??
      createHarnessDatasetTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createDraftCandidateFromReviewedCaseSnapshot(
    actorRole: RoleKey,
    reviewedCaseSnapshotId: string,
    input: CreateHarnessDatasetDraftCandidateInput,
  ): Promise<HarnessDatasetDraftCandidateRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const repository = this.requireReviewedCaseSnapshotRepository();
    const snapshot = await repository.findById(reviewedCaseSnapshotId);
    if (!snapshot) {
      throw new ReviewedCaseSnapshotNotFoundError(reviewedCaseSnapshotId);
    }

    return this.createDraftCandidateFromSource(actorRole, {
      sourceKind: "reviewed_case_snapshot",
      sourceId: snapshot.id,
      familyScope: {
        module: assertHarnessTemplateModule(
          snapshot.module,
          `reviewed case snapshot ${reviewedCaseSnapshotId}`,
        ),
        manuscriptTypes: [snapshot.manuscript_type],
        measureFocus: input.measureFocus,
        templateFamilyId: input.templateFamilyId,
      },
      familyName: input.familyName,
      description: input.description,
      publicationNotes: input.publicationNotes,
      createdBy: input.createdBy,
      items: [
        {
          sourceKind: "reviewed_case_snapshot",
          sourceId: snapshot.id,
          manuscriptId: snapshot.manuscript_id,
          manuscriptType: snapshot.manuscript_type,
          deidentificationPassed: snapshot.deidentification_passed,
          humanReviewed: true,
        },
      ],
    });
  }

  async createDraftCandidateFromHumanFinalAsset(
    actorRole: RoleKey,
    humanFinalAssetId: string,
    input: CreateHarnessDatasetDraftCandidateFromHumanFinalAssetInput,
  ): Promise<HarnessDatasetDraftCandidateRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const assetRepository = this.requireAssetRepository();
    const manuscriptRepository = this.requireManuscriptRepository();
    const asset = await assetRepository.findById(humanFinalAssetId);
    if (!asset || asset.asset_type !== "human_final_docx") {
      throw new LearningHumanFinalAssetRequiredError(humanFinalAssetId);
    }

    const manuscript = await manuscriptRepository.findById(asset.manuscript_id);
    if (!manuscript) {
      throw new ManuscriptNotFoundError(asset.manuscript_id);
    }

    return this.createDraftCandidateFromSource(actorRole, {
      sourceKind: "human_final_asset",
      sourceId: asset.id,
      familyScope: {
        module: input.module,
        manuscriptTypes: [manuscript.manuscript_type],
        measureFocus: input.measureFocus,
        templateFamilyId: input.templateFamilyId,
      },
      familyName: input.familyName,
      description: input.description,
      publicationNotes: input.publicationNotes,
      createdBy: input.createdBy,
      items: [
        {
          sourceKind: "human_final_asset",
          sourceId: asset.id,
          manuscriptId: asset.manuscript_id,
          manuscriptType: manuscript.manuscript_type,
          deidentificationPassed: false,
          humanReviewed: true,
        },
      ],
    });
  }

  async createDraftCandidateFromEvaluationEvidencePack(
    actorRole: RoleKey,
    evidencePackId: string,
    input: CreateHarnessDatasetDraftCandidateInput,
  ): Promise<HarnessDatasetDraftCandidateRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const verificationOpsRepository = this.requireVerificationOpsRepository();
    const manuscriptRepository = this.requireManuscriptRepository();
    const evidencePack = await verificationOpsRepository.findEvaluationEvidencePackById(
      evidencePackId,
    );
    if (!evidencePack) {
      throw new EvaluationEvidencePackNotFoundError(evidencePackId);
    }

    const run = await verificationOpsRepository.findEvaluationRunById(
      evidencePack.experiment_run_id,
    );
    if (!run) {
      throw new EvaluationRunNotFoundError(evidencePack.experiment_run_id);
    }

    if (run.sample_set_id) {
      const sampleSet = await verificationOpsRepository.findEvaluationSampleSetById(
        run.sample_set_id,
      );
      if (!sampleSet) {
        throw new EvaluationSampleSetNotFoundError(run.sample_set_id);
      }

      const sampleSetItems =
        await verificationOpsRepository.listEvaluationSampleSetItemsBySampleSetId(
          run.sample_set_id,
        );

      return this.createDraftCandidateFromSource(actorRole, {
        sourceKind: "evaluation_evidence_pack",
        sourceId: evidencePack.id,
        familyScope: {
          module: sampleSet.module,
          manuscriptTypes: sampleSetItems.map((item) => item.manuscript_type),
          measureFocus: input.measureFocus,
          templateFamilyId: input.templateFamilyId,
        },
        familyName: input.familyName,
        description: input.description,
        publicationNotes: input.publicationNotes,
        createdBy: input.createdBy,
        items: sampleSetItems.map((item) => ({
          sourceKind: "evaluation_evidence_pack",
          sourceId: evidencePack.id,
          manuscriptId: item.manuscript_id,
          manuscriptType: item.manuscript_type,
          deidentificationPassed:
            sampleSet.source_policy.requires_deidentification_pass,
          humanReviewed: true,
          riskTags: item.risk_tags,
          expectedStructuredOutput: {
            reviewed_case_snapshot_id: item.reviewed_case_snapshot_id,
          },
        })),
      });
    }

    if (run.governed_source) {
      const manuscript = await manuscriptRepository.findById(
        run.governed_source.manuscript_id,
      );
      if (!manuscript) {
        throw new ManuscriptNotFoundError(run.governed_source.manuscript_id);
      }

      return this.createDraftCandidateFromSource(actorRole, {
        sourceKind: "evaluation_evidence_pack",
        sourceId: evidencePack.id,
        familyScope: {
          module: run.governed_source.source_module,
          manuscriptTypes: [manuscript.manuscript_type],
          measureFocus: input.measureFocus,
          templateFamilyId: input.templateFamilyId,
        },
        familyName: input.familyName,
        description: input.description,
        publicationNotes: input.publicationNotes,
        createdBy: input.createdBy,
        items: [
          {
            sourceKind: "evaluation_evidence_pack",
            sourceId: evidencePack.id,
            manuscriptId: run.governed_source.manuscript_id,
            manuscriptType: manuscript.manuscript_type,
            deidentificationPassed: false,
            humanReviewed: false,
            expectedStructuredOutput: {
              governed_output_asset_id: run.governed_source.output_asset_id,
            },
          },
        ],
      });
    }

    throw new HarnessDatasetSourceResolutionError(
      `Evaluation evidence pack ${evidencePackId} does not resolve to a supported governed source.`,
    );
  }

  async createGoldSetFamily(
    actorRole: RoleKey,
    input: CreateGoldSetFamilyInput,
  ): Promise<HarnessGoldSetFamilyRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const timestamp = this.now().toISOString();
    const record: HarnessGoldSetFamilyRecord = {
      id: this.createId(),
      name: input.name.trim(),
      ...(input.description ? { description: input.description } : {}),
      scope: {
        module: input.scope.module,
        manuscript_types: normalizeStringArray(input.scope.manuscriptTypes),
        measure_focus: input.scope.measureFocus.trim(),
        ...(input.scope.templateFamilyId
          ? { template_family_id: input.scope.templateFamilyId }
          : {}),
      },
      admin_only: true,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.repository.saveGoldSetFamily(record);
    return record;
  }

  async listWorkbenchOverview(
    actorRole: RoleKey,
    input: {
      exportRootDir: string;
    },
  ): Promise<HarnessDatasetWorkbenchOverviewRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const families = await this.repository.listGoldSetFamilies();
    const rubrics = await this.repository.listRubricDefinitions();
    const rubricById = new Map(rubrics.map((record) => [record.id, record] as const));
    const versions: HarnessDatasetWorkbenchVersionRecord[] = [];

    for (const family of families) {
      const familyVersions = await this.repository.listGoldSetVersionsByFamilyId(family.id);
      for (const version of familyVersions) {
        const publications = await this.repository.listDatasetPublicationsByVersionId(
          version.id,
        );
        versions.push({
          ...cloneGoldSetVersion(version),
          family_name: family.name,
          family_scope: cloneGoldSetFamilyScope(family.scope),
          rubric_assignment: createRubricAssignmentRecord(
            version.rubric_definition_id,
            rubricById,
          ),
          publications: publications.map(cloneDatasetPublication),
        });
      }
    }

    versions.sort(compareWorkbenchVersionAsc);

    return {
      export_root_dir: path.resolve(input.exportRootDir),
      versions,
      rubrics: rubrics.map(cloneRubricDefinition),
    };
  }

  async createRubricDefinition(
    actorRole: RoleKey,
    input: CreateRubricDefinitionInput,
  ): Promise<HarnessRubricDefinitionRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.repository.listRubricDefinitionsByName(
      input.name.trim(),
    );
    const record: HarnessRubricDefinitionRecord = {
      id: this.createId(),
      name: input.name.trim(),
      version_no:
        existing.reduce(
          (highestVersion, record) => Math.max(highestVersion, record.version_no),
          0,
        ) + 1,
      status: "draft",
      scope: {
        module: input.scope.module,
        manuscript_types: normalizeStringArray(input.scope.manuscriptTypes),
      },
      scoring_dimensions: input.scoringDimensions.map(cloneRubricDimensionInput),
      hard_gate_rules: normalizeOptionalStringArray(input.hardGateRules),
      failure_anchors: normalizeOptionalStringArray(input.failureAnchors),
      borderline_examples: normalizeOptionalStringArray(input.borderlineExamples),
      ...(input.judgePrompt ? { judge_prompt: input.judgePrompt } : {}),
      created_by: input.createdBy,
      created_at: this.now().toISOString(),
    };

    await this.repository.saveRubricDefinition(record);
    return record;
  }

  async publishRubricDefinition(
    actorRole: RoleKey,
    rubricDefinitionId: string,
    input: PublishRubricDefinitionInput,
  ): Promise<HarnessRubricDefinitionRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const existing = await this.requireRubricDefinition(rubricDefinitionId);
    if (existing.status !== "draft") {
      throw new HarnessRubricDefinitionStatusTransitionError(
        rubricDefinitionId,
        existing.status,
        "published",
      );
    }

    const published: HarnessRubricDefinitionRecord = {
      ...cloneRubricDefinition(existing),
      status: "published",
      published_by: input.publishedBy,
      published_at: this.now().toISOString(),
    };
    await this.repository.saveRubricDefinition(published);
    return published;
  }

  async createGoldSetVersion(
    actorRole: RoleKey,
    input: CreateGoldSetVersionInput,
  ): Promise<HarnessGoldSetVersionRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    await this.requireGoldSetFamily(input.familyId);
    if (input.rubricDefinitionId) {
      await this.requireRubricDefinition(input.rubricDefinitionId);
    }

    const existing = await this.repository.listGoldSetVersionsByFamilyId(input.familyId);
    const normalizedItems = input.items.map(normalizeGoldSetItemInput);
    const record: HarnessGoldSetVersionRecord = {
      id: this.createId(),
      family_id: input.familyId,
      version_no:
        existing.reduce(
          (highestVersion, record) => Math.max(highestVersion, record.version_no),
          0,
        ) + 1,
      status: "draft",
      ...(input.rubricDefinitionId
        ? { rubric_definition_id: input.rubricDefinitionId }
        : {}),
      item_count: normalizedItems.length,
      deidentification_gate_passed: normalizedItems.every(
        (record) => record.deidentification_passed,
      ),
      human_review_gate_passed: normalizedItems.every(
        (record) => record.human_reviewed,
      ),
      items: normalizedItems,
      ...(input.publicationNotes ? { publication_notes: input.publicationNotes } : {}),
      created_by: input.createdBy,
      created_at: this.now().toISOString(),
    };

    await this.repository.saveGoldSetVersion(record);
    return record;
  }

  async updateGoldSetVersionDraft(
    actorRole: RoleKey,
    goldSetVersionId: string,
    input: UpdateGoldSetVersionDraftInput,
  ): Promise<HarnessGoldSetVersionRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await this.requireGoldSetVersionFrom(repository, goldSetVersionId);
      if (existing.status !== "draft") {
        throw new HarnessGoldSetVersionNotEditableError(
          goldSetVersionId,
          existing.status,
        );
      }

      if (input.rubricDefinitionId) {
        await this.requireRubricDefinition(input.rubricDefinitionId);
      }

      const normalizedItems = input.items?.map(normalizeGoldSetItemInput);
      const nextItems = normalizedItems ?? existing.items.map(cloneGoldSetItem);
      const updated: HarnessGoldSetVersionRecord = {
        ...cloneGoldSetVersion(existing),
        ...(input.rubricDefinitionId !== undefined
          ? { rubric_definition_id: input.rubricDefinitionId }
          : {}),
        items: nextItems,
        item_count: nextItems.length,
        deidentification_gate_passed: nextItems.every(
          (record) => record.deidentification_passed,
        ),
        human_review_gate_passed: nextItems.every(
          (record) => record.human_reviewed,
        ),
        ...(input.publicationNotes !== undefined
          ? { publication_notes: input.publicationNotes }
          : {}),
      };

      await repository.saveGoldSetVersion(updated);
      return updated;
    });
  }

  async publishGoldSetVersion(
    actorRole: RoleKey,
    goldSetVersionId: string,
    input: PublishGoldSetVersionInput,
  ): Promise<HarnessGoldSetVersionRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await this.requireGoldSetVersionFrom(repository, goldSetVersionId);
      if (existing.status !== "draft") {
        throw new HarnessGoldSetVersionNotEditableError(
          goldSetVersionId,
          existing.status,
        );
      }

      if (existing.items.length === 0) {
        throw new HarnessGoldSetVersionPublishValidationError(
          `Harness gold-set version ${goldSetVersionId} requires at least one curated item before publication.`,
        );
      }

      if (
        !existing.deidentification_gate_passed ||
        !existing.human_review_gate_passed
      ) {
        throw new HarnessGoldSetVersionPublishValidationError(
          `Harness gold-set version ${goldSetVersionId} can only be published after every item is de-identified and human-reviewed.`,
        );
      }

      if (!existing.rubric_definition_id) {
        throw new HarnessGoldSetVersionPublishValidationError(
          `Harness gold-set version ${goldSetVersionId} requires an assigned rubric before publication.`,
        );
      }

      const rubric = await this.requireRubricDefinition(existing.rubric_definition_id);
      if (rubric.status !== "published") {
        throw new HarnessGoldSetVersionPublishValidationError(
          `Harness gold-set version ${goldSetVersionId} requires a published rubric before publication.`,
        );
      }

      const published: HarnessGoldSetVersionRecord = {
        ...cloneGoldSetVersion(existing),
        status: "published",
        published_by: input.publishedBy,
        published_at: this.now().toISOString(),
      };
      await repository.saveGoldSetVersion(published);
      return published;
    });
  }

  async archiveGoldSetVersion(
    actorRole: RoleKey,
    goldSetVersionId: string,
    input: ArchiveGoldSetVersionInput,
  ): Promise<HarnessGoldSetVersionRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = await this.requireGoldSetVersionFrom(repository, goldSetVersionId);
      if (existing.status === "archived") {
        return existing;
      }

      const archived: HarnessGoldSetVersionRecord = {
        ...cloneGoldSetVersion(existing),
        status: "archived",
        archived_by: input.archivedBy,
        archived_at: this.now().toISOString(),
      };
      await repository.saveGoldSetVersion(archived);
      return archived;
    });
  }

  async exportGoldSetVersion(
    actorRole: RoleKey,
    goldSetVersionId: string,
    input: ExportHarnessGoldSetVersionInput,
  ): Promise<HarnessDatasetExportResultRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const version = await this.requireGoldSetVersionFrom(this.repository, goldSetVersionId);
    if (version.status !== "published") {
      throw new HarnessGoldSetVersionExportValidationError(
        `Harness gold-set version ${goldSetVersionId} must be published before export.`,
      );
    }

    const family = await this.requireGoldSetFamily(version.family_id);
    const rubric = version.rubric_definition_id
      ? await this.requireRubricDefinition(version.rubric_definition_id)
      : undefined;
    const exportRootDir = path.resolve(input.exportRootDir);
    const outputPath = path.join(
      exportRootDir,
      `gold-set-${goldSetVersionId}-v${version.version_no}.${input.format}`,
    );
    const publicationBase = {
      id: this.createId(),
      gold_set_version_id: version.id,
      export_format: input.format,
      deidentification_gate_passed: version.deidentification_gate_passed,
      created_at: this.now().toISOString(),
    } as const;

    try {
      await mkdir(exportRootDir, { recursive: true });
      await writeFile(
        outputPath,
        input.format === "json"
          ? `${JSON.stringify(buildGoldSetExportDocument(family, version, rubric), null, 2)}\n`
          : buildGoldSetJsonl(version.items),
        "utf8",
      );

      const publication: HarnessDatasetPublicationRecord = {
        ...publicationBase,
        status: "succeeded",
        output_uri: outputPath,
      };
      await this.repository.saveDatasetPublication(publication);

      return {
        publication,
        output_path: outputPath,
      };
    } catch (error) {
      await this.repository
        .saveDatasetPublication({
          ...publicationBase,
          status: "failed",
          output_uri: outputPath,
        })
        .catch(() => undefined);
      throw error;
    }
  }

  private async requireGoldSetFamily(
    familyId: string,
  ): Promise<HarnessGoldSetFamilyRecord> {
    const record = await this.repository.findGoldSetFamilyById(familyId);
    if (!record) {
      throw new HarnessGoldSetFamilyNotFoundError(familyId);
    }

    return record;
  }

  private async requireGoldSetVersionFrom(
    repository: HarnessDatasetRepository,
    goldSetVersionId: string,
  ): Promise<HarnessGoldSetVersionRecord> {
    const record = await repository.findGoldSetVersionById(goldSetVersionId);
    if (!record) {
      throw new HarnessGoldSetVersionNotFoundError(goldSetVersionId);
    }

    return record;
  }

  private async requireRubricDefinition(
    rubricDefinitionId: string,
  ): Promise<HarnessRubricDefinitionRecord> {
    const record = await this.repository.findRubricDefinitionById(rubricDefinitionId);
    if (!record) {
      throw new HarnessRubricDefinitionNotFoundError(rubricDefinitionId);
    }

    return record;
  }

  private async createDraftCandidateFromSource(
    actorRole: RoleKey,
    input: {
      sourceKind: HarnessDatasetSourceKind;
      sourceId: string;
      familyName: string;
      description?: string;
      familyScope: {
        module: HarnessGoldSetFamilyRecord["scope"]["module"];
        manuscriptTypes: HarnessGoldSetFamilyRecord["scope"]["manuscript_types"];
        measureFocus: string;
        templateFamilyId?: string;
      };
      publicationNotes?: string;
      createdBy: string;
      items: CreateGoldSetVersionInput["items"];
    },
  ): Promise<HarnessDatasetDraftCandidateRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const timestamp = this.now().toISOString();
      const family: HarnessGoldSetFamilyRecord = {
        id: this.createId(),
        name: input.familyName.trim(),
        ...(input.description ? { description: input.description } : {}),
        scope: {
          module: input.familyScope.module,
          manuscript_types: normalizeStringArray(input.familyScope.manuscriptTypes),
          measure_focus: input.familyScope.measureFocus.trim(),
          ...(input.familyScope.templateFamilyId
            ? { template_family_id: input.familyScope.templateFamilyId }
            : {}),
        },
        admin_only: true,
        created_at: timestamp,
        updated_at: timestamp,
      };
      await repository.saveGoldSetFamily(family);

      const items = input.items.map(normalizeGoldSetItemInput);
      const version: HarnessGoldSetVersionRecord = {
        id: this.createId(),
        family_id: family.id,
        version_no: 1,
        status: "draft",
        item_count: items.length,
        deidentification_gate_passed: items.every(
          (record) => record.deidentification_passed,
        ),
        human_review_gate_passed: items.every((record) => record.human_reviewed),
        items,
        ...(input.publicationNotes
          ? { publication_notes: input.publicationNotes }
          : {}),
        created_by: input.createdBy,
        created_at: timestamp,
      };
      await repository.saveGoldSetVersion(version);

      return {
        source_kind: input.sourceKind,
        source_id: input.sourceId,
        draft_family_id: family.id,
        draft_version_id: version.id,
        status: version.status,
        item_count: version.item_count,
        requires_manual_rubric_assignment: true,
      };
    });
  }

  private requireReviewedCaseSnapshotRepository(): ReviewedCaseSnapshotRepository {
    if (!this.reviewedCaseSnapshotRepository) {
      throw new HarnessDatasetDependencyMissingError(
        "reviewedCaseSnapshotRepository",
      );
    }

    return this.reviewedCaseSnapshotRepository;
  }

  private requireManuscriptRepository(): ManuscriptRepository {
    if (!this.manuscriptRepository) {
      throw new HarnessDatasetDependencyMissingError("manuscriptRepository");
    }

    return this.manuscriptRepository;
  }

  private requireAssetRepository(): DocumentAssetRepository {
    if (!this.assetRepository) {
      throw new HarnessDatasetDependencyMissingError("assetRepository");
    }

    return this.assetRepository;
  }

  private requireVerificationOpsRepository(): VerificationOpsRepository {
    if (!this.verificationOpsRepository) {
      throw new HarnessDatasetDependencyMissingError("verificationOpsRepository");
    }

    return this.verificationOpsRepository;
  }
}

function createHarnessDatasetTransactionManager(
  context: HarnessDatasetWriteContext,
): WriteTransactionManager<HarnessDatasetWriteContext> {
  if (context.repository instanceof InMemoryHarnessDatasetRepository) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository],
    });
  }

  return createDirectWriteTransactionManager(context);
}

function normalizeStringArray<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeOptionalStringArray<T extends string>(
  values?: T[],
): T[] | undefined {
  return values && values.length > 0 ? normalizeStringArray(values) : undefined;
}

function assertHarnessTemplateModule(
  module: string,
  sourceLabel: string,
): TemplateModule {
  if (
    module === "screening" ||
    module === "editing" ||
    module === "proofreading"
  ) {
    return module;
  }

  throw new HarnessDatasetSourceResolutionError(
    `Harness dataset handoff from ${sourceLabel} requires a template module, but received ${module}.`,
  );
}

function normalizeGoldSetItemInput(
  input: CreateGoldSetVersionInput["items"][number],
): HarnessGoldSetItemRecord {
  return {
    source_kind: input.sourceKind,
    source_id: input.sourceId,
    manuscript_id: input.manuscriptId,
    manuscript_type: input.manuscriptType,
    deidentification_passed: input.deidentificationPassed,
    human_reviewed: input.humanReviewed,
    risk_tags: normalizeOptionalStringArray(input.riskTags),
    expected_structured_output: input.expectedStructuredOutput
      ? JSON.parse(JSON.stringify(input.expectedStructuredOutput))
      : undefined,
  };
}

function cloneGoldSetItem(record: HarnessGoldSetItemRecord): HarnessGoldSetItemRecord {
  return {
    ...record,
    risk_tags: record.risk_tags ? [...record.risk_tags] : undefined,
    expected_structured_output: record.expected_structured_output
      ? JSON.parse(JSON.stringify(record.expected_structured_output))
      : undefined,
  };
}

function cloneGoldSetVersion(
  record: HarnessGoldSetVersionRecord,
): HarnessGoldSetVersionRecord {
  return {
    ...record,
    items: record.items.map(cloneGoldSetItem),
  };
}

function cloneGoldSetFamilyScope(
  scope: HarnessGoldSetFamilyRecord["scope"],
): HarnessGoldSetFamilyRecord["scope"] {
  return {
    ...scope,
    manuscript_types: [...scope.manuscript_types],
  };
}

function cloneDatasetPublication(
  record: HarnessDatasetPublicationRecord,
): HarnessDatasetPublicationRecord {
  return {
    ...record,
  };
}

function cloneRubricDefinition(
  record: HarnessRubricDefinitionRecord,
): HarnessRubricDefinitionRecord {
  return {
    ...record,
    scope: {
      ...record.scope,
      manuscript_types: [...record.scope.manuscript_types],
    },
    scoring_dimensions: record.scoring_dimensions.map((dimension) => ({
      ...dimension,
    })),
    hard_gate_rules: record.hard_gate_rules ? [...record.hard_gate_rules] : undefined,
    failure_anchors: record.failure_anchors
      ? [...record.failure_anchors]
      : undefined,
    borderline_examples: record.borderline_examples
      ? [...record.borderline_examples]
      : undefined,
  };
}

function cloneRubricDimensionInput(
  input: HarnessRubricDimensionRecord,
): HarnessRubricDimensionRecord {
  return {
    ...input,
  };
}

function createRubricAssignmentRecord(
  rubricDefinitionId: string | undefined,
  rubricById: ReadonlyMap<string, HarnessRubricDefinitionRecord>,
): HarnessDatasetRubricAssignmentRecord {
  if (!rubricDefinitionId) {
    return {
      status: "missing",
    };
  }

  const rubric = rubricById.get(rubricDefinitionId);
  if (!rubric) {
    return {
      status: "missing",
      rubric_definition_id: rubricDefinitionId,
    };
  }

  return {
    status: rubric.status,
    rubric_definition_id: rubric.id,
    rubric_name: rubric.name,
    rubric_version_no: rubric.version_no,
  };
}

function compareWorkbenchVersionAsc(
  left: HarnessDatasetWorkbenchVersionRecord,
  right: HarnessDatasetWorkbenchVersionRecord,
): number {
  return (
    left.created_at.localeCompare(right.created_at) ||
    left.family_name.localeCompare(right.family_name) ||
    left.id.localeCompare(right.id)
  );
}

function buildGoldSetExportDocument(
  family: HarnessGoldSetFamilyRecord,
  version: HarnessGoldSetVersionRecord,
  rubric: HarnessRubricDefinitionRecord | undefined,
) {
  return {
    family: {
      id: family.id,
      name: family.name,
      description: family.description,
      scope: cloneGoldSetFamilyScope(family.scope),
    },
    gold_set_version: cloneGoldSetVersion(version),
    rubric: rubric ? cloneRubricDefinition(rubric) : null,
  };
}

function buildGoldSetJsonl(items: HarnessGoldSetItemRecord[]): string {
  return `${items.map((item) => JSON.stringify(cloneGoldSetItem(item))).join("\n")}\n`;
}
