import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type { ExecutionTrackingService } from "../execution-tracking/execution-tracking-service.ts";
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

export interface RunEditingInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: RoleKey;
  storageKey: string;
  fileName?: string;
}

export interface EditingServiceOptions {
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

export type EditingRunResult = ModuleExecutionResult<JobRecord, DocumentAssetRecord>;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class EditingService {
  private readonly manuscriptRepository: ManuscriptRepository;
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

  constructor(options: EditingServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
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

  async run(input: RunEditingInput): Promise<EditingRunResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.editing");

    return this.transactionManager.withTransaction(async (context) => {
      const { jobRepository } = context;
      if (!jobRepository) {
        throw new Error("Editing runs require a job repository.");
      }

      const timestamp = this.now().toISOString();
      const jobId = this.createId();
      const governedContext = await resolveGovernedModuleContext({
        manuscriptId: input.manuscriptId,
        module: "editing",
        jobId,
        actorId: input.requestedBy,
        actorRole: input.actorRole,
        manuscriptRepository: this.manuscriptRepository,
        moduleTemplateRepository: this.moduleTemplateRepository,
        executionGovernanceService: this.executionGovernanceService,
        promptSkillRegistryRepository: this.promptSkillRegistryRepository,
        knowledgeRepository: this.knowledgeRepository,
        aiGatewayService: this.aiGatewayService,
      });

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "editing",
        job_type: "editing_run",
        status: "queued",
        requested_by: input.requestedBy,
        payload: {
          templateId: governedContext.moduleTemplate.id,
          executionProfileId: governedContext.executionProfile.id,
          promptTemplateId: governedContext.promptTemplate.id,
          skillPackageIds: governedContext.skillPackages.map((record) => record.id),
          knowledgeItemIds: governedContext.knowledgeSelections.map(
            (selection) => selection.knowledgeItem.id,
          ),
          modelId: governedContext.modelSelection.model.id,
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
        assetType: "edited_docx",
        storageKey: input.storageKey,
        mimeType: DOCX_MIME,
        createdBy: input.requestedBy,
        fileName: input.fileName,
        parentAssetId: input.parentAssetId,
        sourceModule: "editing",
        sourceJobId: jobId,
      });
      const snapshot = await this.executionTrackingService.recordSnapshot({
        manuscriptId: input.manuscriptId,
        module: "editing",
        jobId,
        executionProfileId: governedContext.executionProfile.id,
        moduleTemplateId: governedContext.moduleTemplate.id,
        moduleTemplateVersionNo: governedContext.moduleTemplate.version_no,
        promptTemplateId: governedContext.promptTemplate.id,
        promptTemplateVersion: governedContext.promptTemplate.version,
        skillPackageIds: governedContext.skillPackages.map((record) => record.id),
        skillPackageVersions: governedContext.skillPackages.map(
          (record) => record.version,
        ),
        modelId: governedContext.modelSelection.model.id,
        modelVersion: governedContext.modelSelection.model.model_version,
        createdAssetIds: [asset.id],
        knowledgeHits: governedContext.knowledgeSelections.map((selection) => ({
          knowledgeItemId: selection.knowledgeItem.id,
          matchSourceId: selection.matchSourceId,
          bindingRuleId: selection.bindingRuleId,
          matchSource: selection.matchSource,
          matchReasons: selection.matchReasons,
        })),
      });

      const completedJob: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
          snapshotId: snapshot.id,
          outputAssetId: asset.id,
          outputAssetType: "edited_docx",
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
        template_id: governedContext.moduleTemplate.id,
        execution_profile_id: governedContext.executionProfile.id,
        prompt_template_id: governedContext.promptTemplate.id,
        skill_package_ids: governedContext.skillPackages.map((record) => record.id),
        snapshot_id: snapshot.id,
        knowledge_item_ids: governedContext.knowledgeSelections.map(
          (selection) => selection.knowledgeItem.id,
        ),
        model_id: governedContext.modelSelection.model.id,
      };
    });
  }
}
