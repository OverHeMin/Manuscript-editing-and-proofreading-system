import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AgentExecutionService } from "../agent-execution/agent-execution-service.ts";
import type { AgentProfileService } from "../agent-profiles/agent-profile-service.ts";
import type { AgentRuntimeService } from "../agent-runtime/agent-runtime-service.ts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type { ExecutionTrackingService } from "../execution-tracking/execution-tracking-service.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { RuntimeBindingService } from "../runtime-bindings/runtime-binding-service.ts";
import type { SandboxProfileService } from "../sandbox-profiles/sandbox-profile-service.ts";
import {
  resolveGovernedAgentContext,
} from "../shared/governed-agent-context-resolver.ts";
import type { ModuleExecutionResult } from "../shared/module-run-support.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { ToolPermissionPolicyService } from "../tool-permission-policies/tool-permission-policy-service.ts";

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
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  knowledgeRepository: KnowledgeRepository;
  executionGovernanceService: ExecutionGovernanceService;
  executionTrackingService: ExecutionTrackingService;
  jobRepository: JobRepository;
  documentAssetService: DocumentAssetService;
  aiGatewayService: AiGatewayService;
  sandboxProfileService: SandboxProfileService;
  agentProfileService: AgentProfileService;
  agentRuntimeService: AgentRuntimeService;
  runtimeBindingService: RuntimeBindingService;
  toolPermissionPolicyService: ToolPermissionPolicyService;
  agentExecutionService: AgentExecutionService;
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
  private readonly promptSkillRegistryRepository: PromptSkillRegistryRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly executionGovernanceService: ExecutionGovernanceService;
  private readonly executionTrackingService: ExecutionTrackingService;
  private readonly documentAssetService: DocumentAssetService;
  private readonly aiGatewayService: AiGatewayService;
  private readonly sandboxProfileService: SandboxProfileService;
  private readonly agentProfileService: AgentProfileService;
  private readonly agentRuntimeService: AgentRuntimeService;
  private readonly runtimeBindingService: RuntimeBindingService;
  private readonly toolPermissionPolicyService: ToolPermissionPolicyService;
  private readonly agentExecutionService: AgentExecutionService;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ScreeningServiceOptions) {
    this.manuscriptRepository = options.manuscriptRepository;
    this.jobRepository = options.jobRepository;
    this.moduleTemplateRepository = options.moduleTemplateRepository;
    this.promptSkillRegistryRepository = options.promptSkillRegistryRepository;
    this.knowledgeRepository = options.knowledgeRepository;
    this.executionGovernanceService = options.executionGovernanceService;
    this.executionTrackingService = options.executionTrackingService;
    this.documentAssetService = options.documentAssetService;
    this.aiGatewayService = options.aiGatewayService;
    this.sandboxProfileService = options.sandboxProfileService;
    this.agentProfileService = options.agentProfileService;
    this.agentRuntimeService = options.agentRuntimeService;
    this.runtimeBindingService = options.runtimeBindingService;
    this.toolPermissionPolicyService = options.toolPermissionPolicyService;
    this.agentExecutionService = options.agentExecutionService;
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
      const documentAssetService = this.documentAssetService.createScoped({
        manuscriptRepository: context.manuscriptRepository,
        assetRepository: context.assetRepository,
      });

      const timestamp = this.now().toISOString();
      const jobId = this.createId();
      const governedContext = await resolveGovernedAgentContext({
        manuscriptId: input.manuscriptId,
        module: "screening",
        jobId,
        actorId: input.requestedBy,
        actorRole: input.actorRole,
        manuscriptRepository: this.manuscriptRepository,
        moduleTemplateRepository: this.moduleTemplateRepository,
        executionGovernanceService: this.executionGovernanceService,
        promptSkillRegistryRepository: this.promptSkillRegistryRepository,
        knowledgeRepository: this.knowledgeRepository,
        aiGatewayService: this.aiGatewayService,
        sandboxProfileService: this.sandboxProfileService,
        agentProfileService: this.agentProfileService,
        agentRuntimeService: this.agentRuntimeService,
        runtimeBindingService: this.runtimeBindingService,
        toolPermissionPolicyService: this.toolPermissionPolicyService,
      });
      const moduleContext = governedContext.moduleContext;
      const executionLog = await this.agentExecutionService.createLog({
        manuscriptId: input.manuscriptId,
        module: "screening",
        triggeredBy: input.requestedBy,
        runtimeId: governedContext.runtime.id,
        sandboxProfileId: governedContext.sandboxProfile.id,
        agentProfileId: governedContext.agentProfile.id,
        runtimeBindingId: governedContext.runtimeBinding.id,
        toolPermissionPolicyId: governedContext.toolPolicy.id,
        knowledgeItemIds: moduleContext.knowledgeSelections.map(
          (selection) => selection.knowledgeItem.id,
        ),
      });

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "screening",
        job_type: "screening_run",
        status: "queued",
        requested_by: input.requestedBy,
        payload: {
          templateId: moduleContext.moduleTemplate.id,
          executionProfileId: governedContext.executionProfile.id,
          promptTemplateId: moduleContext.promptTemplate.id,
          skillPackageIds: moduleContext.skillPackages.map((record) => record.id),
          knowledgeItemIds: moduleContext.knowledgeSelections.map(
            (selection) => selection.knowledgeItem.id,
          ),
          modelId: moduleContext.modelSelection.model.id,
          agentRuntimeId: governedContext.runtime.id,
          sandboxProfileId: governedContext.sandboxProfile.id,
          agentProfileId: governedContext.agentProfile.id,
          runtimeBindingId: governedContext.runtimeBinding.id,
          toolPermissionPolicyId: governedContext.toolPolicy.id,
          agentExecutionLogId: executionLog.id,
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

      const asset = await documentAssetService.createAsset({
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
      const snapshot = await this.executionTrackingService.recordSnapshot({
        manuscriptId: input.manuscriptId,
        module: "screening",
        jobId,
        executionProfileId: governedContext.executionProfile.id,
        moduleTemplateId: moduleContext.moduleTemplate.id,
        moduleTemplateVersionNo: moduleContext.moduleTemplate.version_no,
        promptTemplateId: moduleContext.promptTemplate.id,
        promptTemplateVersion: moduleContext.promptTemplate.version,
        skillPackageIds: moduleContext.skillPackages.map((record) => record.id),
        skillPackageVersions: moduleContext.skillPackages.map(
          (record) => record.version,
        ),
        modelId: moduleContext.modelSelection.model.id,
        modelVersion: moduleContext.modelSelection.model.model_version,
        createdAssetIds: [asset.id],
        knowledgeHits: moduleContext.knowledgeSelections.map((selection) => ({
          knowledgeItemId: selection.knowledgeItem.id,
          matchSourceId: selection.matchSourceId,
          bindingRuleId: selection.bindingRuleId,
          matchSource: selection.matchSource,
          matchReasons: selection.matchReasons,
        })),
      });
      await this.agentExecutionService.completeLog({
        logId: executionLog.id,
        executionSnapshotId: snapshot.id,
      });

      const completedJob: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
          snapshotId: snapshot.id,
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
        template_id: moduleContext.moduleTemplate.id,
        execution_profile_id: governedContext.executionProfile.id,
        prompt_template_id: moduleContext.promptTemplate.id,
        skill_package_ids: moduleContext.skillPackages.map((record) => record.id),
        snapshot_id: snapshot.id,
        knowledge_item_ids: moduleContext.knowledgeSelections.map(
          (selection) => selection.knowledgeItem.id,
        ),
        model_id: moduleContext.modelSelection.model.id,
        agent_runtime_id: governedContext.runtime.id,
        agent_profile_id: governedContext.agentProfile.id,
        agent_execution_log_id: executionLog.id,
      };
    });
  }
}
