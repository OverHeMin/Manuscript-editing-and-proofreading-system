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

export interface RunScreeningInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: RoleKey;
  storageKey: string;
  fileName?: string;
}

export interface ScreeningServiceOptions {
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

export type ScreeningRunResult = ModuleExecutionResult<
  JobRecord,
  DocumentAssetRecord
>;

export class ScreeningService {
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly jobRepository: JobRepository;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly documentAssetService: DocumentAssetService;
  private readonly aiGatewayService: AiGatewayService;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ScreeningServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
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

  async run(input: RunScreeningInput): Promise<ScreeningRunResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.screening");

    return this.transactionManager.withTransaction(async (context) => {
      const { jobRepository } = context;
      if (!jobRepository) {
        throw new Error("Screening runs require a job repository.");
      }

      const timestamp = this.now().toISOString();
      const jobId = this.createId();
      const prepared = await prepareModuleExecution({
        manuscriptId: input.manuscriptId,
        module: "screening",
        jobId,
        actorId: input.requestedBy,
        actorRole: input.actorRole,
        manuscriptRepository: this.manuscriptRepository,
        moduleTemplateRepository: this.moduleTemplateRepository,
        knowledgeRepository: this.knowledgeRepository,
        aiGatewayService: this.aiGatewayService,
      });

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "screening",
        job_type: "screening_run",
        status: "queued",
        requested_by: input.requestedBy,
        payload: {
          templateId: prepared.template.id,
          knowledgeItemIds: prepared.knowledgeItems.map((record) => record.id),
          modelId: prepared.modelSelection.model.id,
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
        assetType: "screening_report",
        storageKey: input.storageKey,
        mimeType: "text/markdown",
        createdBy: input.requestedBy,
        fileName: input.fileName,
        parentAssetId: input.parentAssetId,
        sourceModule: "screening",
        sourceJobId: jobId,
      });

      const completedJob: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
          outputAssetId: asset.id,
          outputAssetType: "screening_report",
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
        template_id: prepared.template.id,
        knowledge_item_ids: prepared.knowledgeItems.map((record) => record.id),
        model_id: prepared.modelSelection.model.id,
      };
    });
  }
}
