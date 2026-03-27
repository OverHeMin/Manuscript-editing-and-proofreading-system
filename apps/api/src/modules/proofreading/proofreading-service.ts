import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  prepareModuleExecution,
  type ModuleExecutionResult,
} from "../shared/module-run-support.ts";
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
  knowledgeRepository: KnowledgeRepository;
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
  private readonly knowledgeRepository: KnowledgeRepository;
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
    this.knowledgeRepository = options.knowledgeRepository;
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
    const pinnedContext = extractPinnedDraftContext(draftJob);

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
    pinnedContext?: {
      templateId: string;
      knowledgeItemIds: string[];
      modelId: string;
    };
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
          knowledgeItemIds: resolvedContext.knowledgeItemIds,
          modelId: resolvedContext.modelId,
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

      const completedJob: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
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
        knowledge_item_ids: resolvedContext.knowledgeItemIds,
        model_id: resolvedContext.modelId,
      };
    });
  }

  private async resolveDraftExecutionContext(input: {
    manuscriptId: string;
    requestedBy: string;
    actorRole: RoleKey;
    jobId: string;
  }): Promise<{
    templateId: string;
    knowledgeItemIds: string[];
    modelId: string;
  }> {
    const prepared = await prepareModuleExecution({
      manuscriptId: input.manuscriptId,
      module: "proofreading",
      jobId: input.jobId,
      actorId: input.requestedBy,
      actorRole: input.actorRole,
      manuscriptRepository: this.manuscriptRepository,
      moduleTemplateRepository: this.moduleTemplateRepository,
      knowledgeRepository: this.knowledgeRepository,
      aiGatewayService: this.aiGatewayService,
    });

    return {
      templateId: prepared.template.id,
      knowledgeItemIds: prepared.knowledgeItems.map((record) => record.id),
      modelId: prepared.modelSelection.model.id,
    };
  }
}

function extractPinnedDraftContext(
  draftJob: JobRecord | undefined,
): {
  templateId: string;
  knowledgeItemIds: string[];
  modelId: string;
} | undefined {
  const payload = draftJob?.payload;

  if (!payload) {
    return undefined;
  }

  const templateId = payload.templateId;
  const modelId = payload.modelId;
  const knowledgeItemIds = payload.knowledgeItemIds;

  if (
    typeof templateId !== "string" ||
    typeof modelId !== "string" ||
    !Array.isArray(knowledgeItemIds) ||
    !knowledgeItemIds.every((value) => typeof value === "string")
  ) {
    return undefined;
  }

  return {
    templateId,
    knowledgeItemIds,
    modelId,
  };
}
