import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type { ResolvedEditorialRule } from "../editorial-rules/editorial-rule-resolution-service.ts";
import type { DocumentStructureService } from "../document-pipeline/document-structure-service.ts";
import type { AgentExecutionLogRecord } from "../agent-execution/agent-execution-record.ts";
import {
  AgentExecutionLogNotFoundError,
  type AgentExecutionService,
} from "../agent-execution/agent-execution-service.ts";
import type { AgentProfileService } from "../agent-profiles/agent-profile-service.ts";
import type { AgentRuntimeService } from "../agent-runtime/agent-runtime-service.ts";
import {
  inspectProofreadingRules,
} from "../editorial-execution/proofreading-rule-checker.ts";
import type {
  ProofreadingInspectionResult,
  ProofreadingSourceBlockResolver,
} from "../editorial-execution/types.ts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type {
  ExecutionTrackingService,
  RecordKnowledgeHitInput,
} from "../execution-tracking/execution-tracking-service.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";
import type { RuntimeBindingService } from "../runtime-bindings/runtime-binding-service.ts";
import type { SandboxProfileService } from "../sandbox-profiles/sandbox-profile-service.ts";
import {
  resolveGovernedAgentContext,
} from "../shared/governed-agent-context-resolver.ts";
import {
  dispatchGovernedOrchestrationBestEffort,
  type GovernedExecutionOrchestrationDispatcher,
  type ModuleExecutionResult,
} from "../shared/module-run-support.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { ToolPermissionPolicyService } from "../tool-permission-policies/tool-permission-policy-service.ts";

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

export interface PublishProofreadingHumanFinalInput {
  manuscriptId: string;
  finalAssetId: string;
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
  sandboxProfileService: SandboxProfileService;
  agentProfileService: AgentProfileService;
  agentRuntimeService: AgentRuntimeService;
  runtimeBindingService: RuntimeBindingService;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >;
  toolPermissionPolicyService: ToolPermissionPolicyService;
  agentExecutionService: AgentExecutionService;
  agentExecutionOrchestrationService: GovernedExecutionOrchestrationDispatcher;
  proofreadingSourceBlockResolver?: Pick<
    ProofreadingSourceBlockResolver,
    "resolveBlocks"
  >;
  documentStructureService?: Pick<DocumentStructureService, "extract">;
  permissionGuard?: PermissionGuard;
  transactionManager?: WriteTransactionManager;
  createId?: () => string;
  now?: () => Date;
}

export type ProofreadingRunResult = ModuleExecutionResult<
  JobRecord,
  DocumentAssetRecord
>;

export interface ProofreadingHumanFinalPublishResult {
  job: JobRecord;
  asset: DocumentAssetRecord;
}

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

export class ProofreadingFinalAssetRequiredError extends Error {
  constructor(assetId: string) {
    super(`Asset ${assetId} is not a proofreading final asset.`);
    this.name = "ProofreadingFinalAssetRequiredError";
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
  private readonly sandboxProfileService: SandboxProfileService;
  private readonly agentProfileService: AgentProfileService;
  private readonly agentRuntimeService: AgentRuntimeService;
  private readonly runtimeBindingService: RuntimeBindingService;
  private readonly runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >;
  private readonly toolPermissionPolicyService: ToolPermissionPolicyService;
  private readonly agentExecutionService: AgentExecutionService;
  private readonly agentExecutionOrchestrationService: GovernedExecutionOrchestrationDispatcher;
  private readonly proofreadingSourceBlockResolver: Pick<
    ProofreadingSourceBlockResolver,
    "resolveBlocks"
  >;
  private readonly documentStructureService?: Pick<DocumentStructureService, "extract">;
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
    this.sandboxProfileService = options.sandboxProfileService;
    this.agentProfileService = options.agentProfileService;
    this.agentRuntimeService = options.agentRuntimeService;
    this.runtimeBindingService = options.runtimeBindingService;
    this.runtimeBindingReadinessService = options.runtimeBindingReadinessService;
    this.toolPermissionPolicyService = options.toolPermissionPolicyService;
    this.agentExecutionService = options.agentExecutionService;
    this.agentExecutionOrchestrationService =
      options.agentExecutionOrchestrationService;
    this.proofreadingSourceBlockResolver =
      options.proofreadingSourceBlockResolver ?? {
        async resolveBlocks() {
          return [];
        },
      };
    this.documentStructureService = options.documentStructureService;
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

  async publishHumanFinal(
    input: PublishProofreadingHumanFinalInput,
  ): Promise<ProofreadingHumanFinalPublishResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.proofreading");

    return this.transactionManager.withTransaction(async (context) => {
      const { jobRepository, assetRepository, manuscriptRepository } = context;
      if (!jobRepository) {
        throw new Error("Human-final publication requires a job repository.");
      }

      const finalAsset = await assetRepository.findById(input.finalAssetId);
      if (
        !finalAsset ||
        finalAsset.manuscript_id !== input.manuscriptId ||
        finalAsset.asset_type !== "final_proof_annotated_docx"
      ) {
        throw new ProofreadingFinalAssetRequiredError(input.finalAssetId);
      }

      const documentAssetService = this.documentAssetService.createScoped({
        manuscriptRepository,
        assetRepository,
      });
      const timestamp = this.now().toISOString();
      const jobId = this.createId();

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "manual",
        job_type: "publish_human_final",
        status: "queued",
        requested_by: input.requestedBy,
        payload: {
          sourceAssetId: input.finalAssetId,
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
        assetType: "human_final_docx",
        storageKey: input.storageKey,
        mimeType: DOCX_MIME,
        createdBy: input.requestedBy,
        fileName: input.fileName,
        parentAssetId: input.finalAssetId,
        sourceModule: "manual",
        sourceJobId: jobId,
      });

      const job: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
          outputAssetId: asset.id,
          outputAssetType: asset.asset_type,
        },
        attempt_count: 1,
        started_at: timestamp,
        finished_at: timestamp,
        updated_at: timestamp,
      };
      await jobRepository.save(job);

      return {
        job,
        asset,
      };
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
    const committed = await this.transactionManager.withTransaction(async (context) => {
      const { jobRepository } = context;
      if (!jobRepository) {
        throw new Error("Proofreading runs require a job repository.");
      }
      const documentAssetService = this.documentAssetService.createScoped({
        manuscriptRepository: context.manuscriptRepository,
        assetRepository: context.assetRepository,
      });

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
      const proofreadingFindings =
        input.jobType === "proofreading_draft_run"
          ? await this.buildProofreadingFindings({
              manuscriptId: input.manuscriptId,
              parentAssetId: input.parentAssetId,
              resolvedContext,
            })
          : undefined;
      const reportMarkdown =
        input.jobType === "proofreading_draft_run" && proofreadingFindings
          ? renderProofreadingReport(proofreadingFindings)
          : undefined;

      const executionLog =
        input.pinnedContext?.agentExecutionLogId
          ? undefined
          : await this.agentExecutionService.createLog({
              manuscriptId: input.manuscriptId,
              module: "proofreading",
              triggeredBy: input.requestedBy,
              runtimeId: resolvedContext.agentRuntimeId,
              sandboxProfileId: resolvedContext.sandboxProfileId,
              agentProfileId: resolvedContext.agentProfileId,
              runtimeBindingId: resolvedContext.runtimeBindingId,
              toolPermissionPolicyId: resolvedContext.toolPermissionPolicyId,
              routingPolicyVersionId: resolvedContext.routingPolicyVersionId,
              routingPolicyScopeKind: resolvedContext.routingPolicyScopeKind,
              routingPolicyScopeValue: resolvedContext.routingPolicyScopeValue,
              resolvedModelId: resolvedContext.modelId,
              knowledgeItemIds: resolvedContext.knowledgeHits.map(
                (hit) => hit.knowledgeItemId,
              ),
              verificationCheckProfileIds:
                resolvedContext.verificationCheckProfileIds,
              evaluationSuiteIds: resolvedContext.evaluationSuiteIds,
              releaseCheckProfileId: resolvedContext.releaseCheckProfileId,
            });
      const agentExecutionLogId =
        input.pinnedContext?.agentExecutionLogId ?? executionLog?.id;

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
          agentRuntimeId: resolvedContext.agentRuntimeId,
          sandboxProfileId: resolvedContext.sandboxProfileId,
          agentProfileId: resolvedContext.agentProfileId,
          runtimeBindingId: resolvedContext.runtimeBindingId,
          toolPermissionPolicyId: resolvedContext.toolPermissionPolicyId,
          agentExecutionLogId,
          ...(resolvedContext.draftSnapshotId
            ? { draftSnapshotId: resolvedContext.draftSnapshotId }
            : {}),
          parentAssetId: input.parentAssetId,
          ...(resolvedContext.ruleSetId
            ? {
                ruleSetId: resolvedContext.ruleSetId,
              }
            : {}),
          ...(proofreadingFindings
            ? {
                proofreadingFindings,
                manualReviewItems: proofreadingFindings.manualReviewItems.map(
                  (item) => ({
                    ...item,
                  }),
                ),
              }
            : {}),
          ...(reportMarkdown
            ? {
                reportMarkdown,
              }
            : {}),
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
        agentExecutionLogId,
        draftSnapshotId: resolvedContext.draftSnapshotId,
        knowledgeHits: resolvedContext.knowledgeHits,
      });
      if (agentExecutionLogId) {
        await this.agentExecutionService.completeLog({
          logId: agentExecutionLogId,
          executionSnapshotId: snapshot.id,
        });
      }

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
        shouldDispatchOrchestration:
          input.jobType === "proofreading_confirm" && !!agentExecutionLogId,
        agentExecutionLogId,
        response: {
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
          agent_runtime_id: resolvedContext.agentRuntimeId,
          agent_profile_id: resolvedContext.agentProfileId,
          agent_execution_log_id: agentExecutionLogId,
        },
      };
    });

    if (committed.shouldDispatchOrchestration) {
      await dispatchGovernedOrchestrationBestEffort({
        orchestrationService: this.agentExecutionOrchestrationService,
        agentExecutionLogId: committed.agentExecutionLogId,
      });
    }

    return committed.response;
  }

  private async resolveDraftExecutionContext(input: {
    manuscriptId: string;
    requestedBy: string;
    actorRole: RoleKey;
    jobId: string;
  }): Promise<ResolvedProofreadingGovernedContext> {
    const governedContext = await resolveGovernedAgentContext({
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
      sandboxProfileService: this.sandboxProfileService,
      agentProfileService: this.agentProfileService,
      agentRuntimeService: this.agentRuntimeService,
      runtimeBindingService: this.runtimeBindingService,
      runtimeBindingReadinessService: this.runtimeBindingReadinessService,
      toolPermissionPolicyService: this.toolPermissionPolicyService,
    });
    const moduleContext = governedContext.moduleContext;

    return {
      executionProfileId: governedContext.executionProfile.id,
      templateId: moduleContext.moduleTemplate.id,
      moduleTemplateVersionNo: moduleContext.moduleTemplate.version_no,
      promptTemplateId: moduleContext.promptTemplate.id,
      promptTemplateVersion: moduleContext.promptTemplate.version,
      skillPackageIds: moduleContext.skillPackages.map((record) => record.id),
      skillPackageVersions: moduleContext.skillPackages.map(
        (record) => record.version,
      ),
      ruleSetId: moduleContext.ruleSet.id,
      rules: moduleContext.rules.map((rule) => ({
        ...rule,
        scope: { ...rule.scope },
        trigger: { ...rule.trigger },
        action: { ...rule.action },
      })),
      resolvedRules: moduleContext.resolvedRules.map((entry) => ({
        ...entry,
        rule: {
          ...entry.rule,
          scope: { ...entry.rule.scope },
          selector: { ...entry.rule.selector },
          trigger: { ...entry.rule.trigger },
          action: { ...entry.rule.action },
        },
      })),
      knowledgeHits: moduleContext.knowledgeSelections.map((selection) => ({
        knowledgeItemId: selection.knowledgeItem.id,
        matchSourceId: selection.matchSourceId,
        bindingRuleId: selection.bindingRuleId,
        matchSource: selection.matchSource,
        matchReasons: selection.matchReasons,
      })),
      modelId: moduleContext.modelSelection.model.id,
      modelVersion: moduleContext.modelSelection.model.model_version,
      routingPolicyVersionId: moduleContext.modelSelection.policy_version_id,
      routingPolicyScopeKind: moduleContext.modelSelection.policy_scope_kind,
      routingPolicyScopeValue: moduleContext.modelSelection.policy_scope_value,
      agentRuntimeId: governedContext.runtime.id,
      sandboxProfileId: governedContext.sandboxProfile.id,
      agentProfileId: governedContext.agentProfile.id,
      runtimeBindingId: governedContext.runtimeBinding.id,
      toolPermissionPolicyId: governedContext.toolPolicy.id,
      verificationCheckProfileIds:
        governedContext.verificationExpectations.verification_check_profile_ids,
      evaluationSuiteIds:
        governedContext.verificationExpectations.evaluation_suite_ids,
      releaseCheckProfileId:
        governedContext.verificationExpectations.release_check_profile_id,
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

    const draftExecutionLog = await this.loadDraftExecutionLog(draftJob);
    if (!draftExecutionLog) {
      return undefined;
    }

    const hitLogs =
      await this.executionTrackingService.listKnowledgeHitLogsBySnapshotId(snapshotId);

    // Final confirmation must stay pinned to the reviewed draft governance context.
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
      routingPolicyVersionId: draftExecutionLog.routing_policy_version_id,
      routingPolicyScopeKind: draftExecutionLog.routing_policy_scope_kind,
      routingPolicyScopeValue: draftExecutionLog.routing_policy_scope_value,
      draftSnapshotId: snapshot.id,
      agentRuntimeId: draftExecutionLog.runtime_id,
      sandboxProfileId: draftExecutionLog.sandbox_profile_id,
      agentProfileId: draftExecutionLog.agent_profile_id,
      runtimeBindingId: draftExecutionLog.runtime_binding_id,
      toolPermissionPolicyId: draftExecutionLog.tool_permission_policy_id,
      verificationCheckProfileIds: [
        ...draftExecutionLog.verification_check_profile_ids,
      ],
      evaluationSuiteIds: [...draftExecutionLog.evaluation_suite_ids],
      releaseCheckProfileId: draftExecutionLog.release_check_profile_id,
      agentExecutionLogId: draftExecutionLog.id,
    };
  }

  private async loadDraftExecutionLog(
    draftJob: JobRecord | undefined,
  ): Promise<AgentExecutionLogRecord | undefined> {
    const logId = extractStringPayloadValue(draftJob, "agentExecutionLogId");
    if (!logId) {
      return undefined;
    }

    try {
      return await this.agentExecutionService.getLog(logId);
    } catch (error) {
      if (error instanceof AgentExecutionLogNotFoundError) {
        return undefined;
      }

      throw error;
    }
  }

  private async buildProofreadingFindings(input: {
    manuscriptId: string;
    parentAssetId: string;
    resolvedContext: ResolvedProofreadingGovernedContext;
  }): Promise<ProofreadingInspectionResult> {
    const blocks = await this.proofreadingSourceBlockResolver.resolveBlocks({
      manuscriptId: input.manuscriptId,
      assetId: input.parentAssetId,
    });
    const sourceAsset = await this.assetRepository.findById(input.parentAssetId);
    const documentStructureSnapshot = this.documentStructureService
      ? await this.documentStructureService.extract({
          manuscriptId: input.manuscriptId,
          assetId: input.parentAssetId,
          fileName: sourceAsset?.file_name ?? input.parentAssetId,
        })
      : undefined;

    return inspectProofreadingRules({
      blocks,
      rules: input.resolvedContext.rules ?? [],
      resolvedRules: input.resolvedContext.resolvedRules,
      tableSnapshots: documentStructureSnapshot?.tables ?? [],
    });
  }
}

interface ResolvedProofreadingGovernedContext {
  executionProfileId: string;
  templateId: string;
  moduleTemplateVersionNo: number;
  promptTemplateId: string;
  promptTemplateVersion: string;
  ruleSetId?: string;
  rules?: EditorialRuleRecord[];
  resolvedRules?: ResolvedEditorialRule[];
  skillPackageIds: string[];
  skillPackageVersions: string[];
  knowledgeHits: RecordKnowledgeHitInput[];
  modelId: string;
  modelVersion?: string;
  routingPolicyVersionId?: string;
  routingPolicyScopeKind?: AgentExecutionLogRecord["routing_policy_scope_kind"];
  routingPolicyScopeValue?: string;
  draftSnapshotId?: string;
  agentRuntimeId: string;
  sandboxProfileId: string;
  agentProfileId: string;
  runtimeBindingId: string;
  toolPermissionPolicyId: string;
  verificationCheckProfileIds: string[];
  evaluationSuiteIds: string[];
  releaseCheckProfileId?: string;
  agentExecutionLogId?: string;
}

function extractDraftSnapshotId(draftJob: JobRecord | undefined): string | undefined {
  return extractStringPayloadValue(draftJob, "snapshotId");
}

function extractStringPayloadValue(
  job: JobRecord | undefined,
  key: string,
): string | undefined {
  const value = job?.payload?.[key];
  return typeof value === "string" ? value : undefined;
}

function renderProofreadingReport(
  findings: ProofreadingInspectionResult,
): string {
  const lines = [
    "# Proofreading Rule Report",
    "",
    `Failed checks: ${findings.failedChecks.length}`,
    `Manual review items: ${findings.manualReviewItems.length}`,
    "",
  ];

  if (findings.failedChecks.length > 0) {
    lines.push("## Failed Checks", "");
    for (const check of findings.failedChecks) {
      lines.push(
        `- ${check.ruleId}: expected ${check.expected}; found ${formatReportActual(check)}.`,
      );
    }
    lines.push("");
  }

  if (findings.manualReviewItems.length > 0) {
    lines.push("## Manual Review", "");
    for (const item of findings.manualReviewItems) {
      lines.push(`- ${item.ruleId}: ${item.reason}`);
    }
    lines.push("");
  }

  if (findings.riskItems.length > 0) {
    lines.push("## Risk Items", "");
    for (const item of findings.riskItems) {
      lines.push(`- ${item.ruleId ?? "system"}: ${item.reason}`);
    }
  }

  return lines.join("\n").trim();
}

function formatReportActual(
  check: ProofreadingInspectionResult["failedChecks"][number],
): string {
  if (!check.semantic_hit) {
    return check.actual;
  }

  const segments = [
    check.semantic_hit.table_id,
    ...(check.semantic_hit.header_path ?? []),
  ];

  if (segments.length > 1) {
    return segments.join(" > ");
  }

  if (check.semantic_hit.column_key) {
    return `${check.semantic_hit.table_id} > ${check.semantic_hit.column_key}`;
  }

  if (check.semantic_hit.footnote_anchor) {
    return `${check.semantic_hit.table_id} > ${check.semantic_hit.footnote_anchor}`;
  }

  return check.actual;
}
