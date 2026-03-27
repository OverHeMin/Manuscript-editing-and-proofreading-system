import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type { ExecutionTrackingService } from "../execution-tracking/execution-tracking-service.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  type ModuleExecutionResult,
} from "../shared/module-run-support.ts";
import { resolveGovernedModuleContext } from "../shared/governed-module-context-resolver.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";

export interface CreateProofreadingDraftInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: RoleKey;
  storageKey: string;
  fileName?: string;
}

export interface ConfirmProofreadingFinalInput {
  manuscriptId: string;
  draftAssetId: string;
  requestedBy: string;
  actorRole: RoleKey;
  storageKey: string;
  fileName?: string;
}

export interface ProofreadingServiceOptions {
  manuscriptRepository: ManuscriptRepository;
  assetRepository: DocumentAssetRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  knowledgeRepository: KnowledgeRepository;
  executionGovernanceService: ExecutionGovernanceService;
  executionTrackingService: ExecutionTrackingService;
  jobRepository: JobRepository;
  documentAssetService: DocumentAssetService;
  aiGatewayService: AiGatewayService;
  permissionGuard?: PermissionGuard;
  transactionManager?: WriteTransactionManager;
  createId?: () => string;
  now?: () => Date;
}

export type ProofreadingRunResult = ModuleExecutionResult<
  JobRecord,
  DocumentAssetRecord
>;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class ProofreadingDraftAssetRequiredError extends Error {
  constructor(assetId: string) {
    super(`Asset ${assetId} is not a proofreading draft asset.`);
    this.name = "ProofreadingDraftAssetRequiredError";
  }
}

export class ProofreadingDraftContextNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Proofreading draft asset ${assetId} does not have a reusable draft context.`);
    this.name = "ProofreadingDraftContextNotFoundError";
  }
}

export class ProofreadingService {
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly assetRepository: DocumentAssetRepository;
  private readonly jobRepository: JobRepository;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly promptSkillRegistryRepository: PromptSkillRegistryRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly executionGovernanceService: ExecutionGovernanceService;
  private readonly executionTrackingService: ExecutionTrackingService;
  private readonly documentAssetService: DocumentAssetService;
  private readonly aiGatewayService: AiGatewayService;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ProofreadingServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
    this.assetRepository = options.assetRepository;
    this.jobRepository = options.jobRepository;
    this.moduleTemplateRepository = options.moduleTemplateRepository;
    this.promptSkillRegistryRepository = options.promptSkillRegistryRepository;
    this.knowledgeRepository = options.knowledgeRepository;
    this.executionGovernanceService = options.executionGovernanceService;
    this.executionTrackingService = options.executionTrackingService;
    this.documentAssetService = options.documentAssetService;
    this.aiGatewayService = options.aiGatewayService;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.transactionManager =
      options.transactionManager ??
      createWriteTransactionManager({
        manuscriptRepository: options.manuscriptRepository,
        assetRepository: options.assetRepository,
        jobRepository: options.jobRepository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createDraft(
    input: CreateProofreadingDraftInput,
  ): Promise<ProofreadingRunResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.proofreading");

    return this.runProofreadingJob({
      manuscriptId: input.manuscriptId,
      requestedBy: input.requestedBy,
      actorRole: input.actorRole,
      storageKey: input.storageKey,
      fileName: input.fileName,
      parentAssetId: input.parentAssetId,
      assetType: "proofreading_draft_report",
      mimeType: "text/markdown",
      jobType: "proofreading_draft_run",
    });
  }

  async confirmFinal(
    input: ConfirmProofreadingFinalInput,
  ): Promise<ProofreadingRunResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.proofreading");

    const draftAsset = await this.assetRepository.findById(input.draftAssetId);

    if (
      !draftAsset ||
      draftAsset.manuscript_id !== input.manuscriptId ||
      draftAsset.asset_type !== "proofreading_draft_report"
    ) {
      throw new ProofreadingDraftAssetRequiredError(input.draftAssetId);
    }

    const draftJob =
      draftAsset.source_job_id
        ? await this.jobRepository.findById(draftAsset.source_job_id)
        : undefined;
    const pinnedContext = await this.loadPinnedDraftExecutionContext(draftJob);

    if (!pinnedContext) {
      throw new ProofreadingDraftContextNotFoundError(input.draftAssetId);
    }

    return this.runProofreadingJob({
      manuscriptId: input.manuscriptId,
      requestedBy: input.requestedBy,
      actorRole: input.actorRole,
      storageKey: input.storageKey,
      fileName: input.fileName,
      parentAssetId: input.draftAssetId,
      assetType: "final_proof_annotated_docx",
      mimeType: DOCX_MIME,
      jobType: "proofreading_confirm",
      pinnedContext,
    });
  }

  private async runProofreadingJob(input: {
    manuscriptId: string;
    requestedBy: string;
    actorRole: RoleKey;
    storageKey: string;
    fileName?: string;
    parentAssetId: string;
    assetType: "proofreading_draft_report" | "final_proof_annotated_docx";
    mimeType: string;
    jobType: "proofreading_draft_run" | "proofreading_confirm";
    pinnedContext?: ResolvedProofreadingGovernedContext;
  }): Promise<ProofreadingRunResult> {
    return this.transactionManager.withTransaction(async (context) => {
      const { jobRepository } = context;
      if (!jobRepository) {
        throw new Error("Proofreading runs require a job repository.");
      }

      const timestamp = this.now().toISOString();
      const jobId = this.createId();
      const resolvedContext = input.pinnedContext
        ? input.pinnedContext
        : await this.resolveDraftExecutionContext({
            manuscriptId: input.manuscriptId,
            requestedBy: input.requestedBy,
            actorRole: input.actorRole,
            jobId,
          });

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "proofreading",
        job_type: input.jobType,
        status: "queued",
        requested_by: input.requestedBy,
        payload: {
          templateId: resolvedContext.templateId,
          executionProfileId: resolvedContext.executionProfileId,
          promptTemplateId: resolvedContext.promptTemplateId,
          skillPackageIds: resolvedContext.skillPackageIds,
          knowledgeItemIds: resolvedContext.knowledgeHits.map(
            (hit) => hit.knowledgeItemId,
          ),
          modelId: resolvedContext.modelId,
          ...(resolvedContext.draftSnapshotId
            ? { draftSnapshotId: resolvedContext.draftSnapshotId }
            : {}),
          parentAssetId: input.parentAssetId,
        },
        attempt_count: 0,
        started_at: undefined,
        finished_at: undefined,
        error_message: undefined,
        created_at: timestamp,
        updated_at: timestamp,
      };
      await jobRepository.save(queuedJob);

      const asset = await this.documentAssetService.createAsset({
        manuscriptId: input.manuscriptId,
        assetType: input.assetType,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        createdBy: input.requestedBy,
        fileName: input.fileName,
        parentAssetId: input.parentAssetId,
        sourceModule: "proofreading",
        sourceJobId: jobId,
      });
      const snapshot = await this.executionTrackingService.recordSnapshot({
        manuscriptId: input.manuscriptId,
        module: "proofreading",
        jobId,
        executionProfileId: resolvedContext.executionProfileId,
        moduleTemplateId: resolvedContext.templateId,
        moduleTemplateVersionNo: resolvedContext.moduleTemplateVersionNo,
        promptTemplateId: resolvedContext.promptTemplateId,
        promptTemplateVersion: resolvedContext.promptTemplateVersion,
        skillPackageIds: resolvedContext.skillPackageIds,
        skillPackageVersions: resolvedContext.skillPackageVersions,
        modelId: resolvedContext.modelId,
        modelVersion: resolvedContext.modelVersion,
        createdAssetIds: [asset.id],
        draftSnapshotId: resolvedContext.draftSnapshotId,
        knowledgeHits: resolvedContext.knowledgeHits,
      });

      const completedJob: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
          snapshotId: snapshot.id,
          outputAssetId: asset.id,
          outputAssetType: input.assetType,
        },
        attempt_count: 1,
        started_at: timestamp,
        finished_at: timestamp,
        updated_at: timestamp,
      };
      await jobRepository.save(completedJob);

      return {
        job: completedJob,
        asset,
        template_id: resolvedContext.templateId,
        execution_profile_id: resolvedContext.executionProfileId,
        prompt_template_id: resolvedContext.promptTemplateId,
        skill_package_ids: resolvedContext.skillPackageIds,
        snapshot_id: snapshot.id,
        knowledge_item_ids: resolvedContext.knowledgeHits.map(
          (hit) => hit.knowledgeItemId,
        ),
        model_id: resolvedContext.modelId,
      };
    });
  }

  private async resolveDraftExecutionContext(input: {
    manuscriptId: string;
    requestedBy: string;
    actorRole: RoleKey;
    jobId: string;
  }): Promise<ResolvedProofreadingGovernedContext> {
    const governedContext = await resolveGovernedModuleContext({
      manuscriptId: input.manuscriptId,
      module: "proofreading",
      jobId: input.jobId,
      actorId: input.requestedBy,
      actorRole: input.actorRole,
      manuscriptRepository: this.manuscriptRepository,
      moduleTemplateRepository: this.moduleTemplateRepository,
      executionGovernanceService: this.executionGovernanceService,
      promptSkillRegistryRepository: this.promptSkillRegistryRepository,
      knowledgeRepository: this.knowledgeRepository,
      aiGatewayService: this.aiGatewayService,
    });

    return {
      executionProfileId: governedContext.executionProfile.id,
      templateId: governedContext.moduleTemplate.id,
      moduleTemplateVersionNo: governedContext.moduleTemplate.version_no,
      promptTemplateId: governedContext.promptTemplate.id,
      promptTemplateVersion: governedContext.promptTemplate.version,
      skillPackageIds: governedContext.skillPackages.map((record) => record.id),
      skillPackageVersions: governedContext.skillPackages.map(
        (record) => record.version,
      ),
      knowledgeHits: governedContext.knowledgeSelections.map((selection) => ({
        knowledgeItemId: selection.knowledgeItem.id,
        matchSourceId: selection.matchSourceId,
        bindingRuleId: selection.bindingRuleId,
        matchSource: selection.matchSource,
        matchReasons: selection.matchReasons,
      })),
      modelId: governedContext.modelSelection.model.id,
      modelVersion: governedContext.modelSelection.model.model_version,
    };
  }

  private async loadPinnedDraftExecutionContext(
    draftJob: JobRecord | undefined,
  ): Promise<ResolvedProofreadingGovernedContext | undefined> {
    const snapshotId = extractDraftSnapshotId(draftJob);
    if (!snapshotId) {
      return undefined;
    }

    const snapshot = await this.executionTrackingService.getSnapshot(snapshotId);
    if (!snapshot) {
      return undefined;
    }

    const hitLogs =
      await this.executionTrackingService.listKnowledgeHitLogsBySnapshotId(snapshotId);

    return {
      executionProfileId: snapshot.execution_profile_id,
      templateId: snapshot.module_template_id,
      moduleTemplateVersionNo: snapshot.module_template_version_no,
      promptTemplateId: snapshot.prompt_template_id,
      promptTemplateVersion: snapshot.prompt_template_version,
      skillPackageIds: [...snapshot.skill_package_ids],
      skillPackageVersions: [...snapshot.skill_package_versions],
      knowledgeHits: hitLogs.map((hit) => ({
        knowledgeItemId: hit.knowledge_item_id,
        matchSourceId: hit.match_source_id,
        bindingRuleId: hit.binding_rule_id,
        matchSource: hit.match_source,
        matchReasons: [...hit.match_reasons],
      })),
      modelId: snapshot.model_id,
      modelVersion: snapshot.model_version,
      draftSnapshotId: snapshot.id,
    };
  }
}

interface ResolvedProofreadingGovernedContext {
  executionProfileId: string;
  templateId: string;
  moduleTemplateVersionNo: number;
  promptTemplateId: string;
  promptTemplateVersion: string;
  skillPackageIds: string[];
  skillPackageVersions: string[];
  knowledgeHits: Array<{
    knowledgeItemId: string;
    matchSourceId?: string;
    bindingRuleId?: string;
    matchSource: "binding_rule" | "template_binding" | "dynamic_routing";
    matchReasons: string[];
  }>;
  modelId: string;
  modelVersion?: string;
  draftSnapshotId?: string;
}

function extractDraftSnapshotId(draftJob: JobRecord | undefined): string | undefined {
  const snapshotId = draftJob?.payload?.snapshotId;
  return typeof snapshotId === "string" ? snapshotId : undefined;
}
