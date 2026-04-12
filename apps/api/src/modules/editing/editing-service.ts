import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { DocumentAssetRepository } from "../assets/document-asset-repository.ts";
import { DocumentAssetService } from "../assets/document-asset-service.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import type { AgentExecutionService } from "../agent-execution/agent-execution-service.ts";
import type { AgentProfileService } from "../agent-profiles/agent-profile-service.ts";
import type { AgentRuntimeService } from "../agent-runtime/agent-runtime-service.ts";
import {
  EditorialDocxTransformService,
} from "../document-pipeline/editorial-docx-transform-service.ts";
import type {
  DocumentStructureService,
  DocumentStructureTableSnapshot,
} from "../document-pipeline/document-structure-service.ts";
import {
  assembleInstructionTemplate,
} from "../editorial-execution/instruction-template-assembler.ts";
import type {
  EditorialSourceBlockResolver,
  DeterministicDocxTransformResult,
} from "../editorial-execution/types.ts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type { ExecutionTrackingService } from "../execution-tracking/execution-tracking-service.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { JobRepository } from "../jobs/job-repository.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptQualityService } from "../manuscript-quality/manuscript-quality-service.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { ManualReviewPolicyService } from "../manual-review-policies/manual-review-policy-service.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { RetrievalPresetService } from "../retrieval-presets/retrieval-preset-service.ts";
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
  retrievalPresetService?: Pick<RetrievalPresetService, "getActivePresetForScope">;
  manualReviewPolicyService?: Pick<
    ManualReviewPolicyService,
    "getActivePolicyForScope"
  >;
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
  aiProviderRuntimeService?: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
  aiProviderRuntimeCutoverEnabled?: boolean;
  toolPermissionPolicyService: ToolPermissionPolicyService;
  agentExecutionService: AgentExecutionService;
  agentExecutionOrchestrationService: GovernedExecutionOrchestrationDispatcher;
  editorialDocxTransformService?: Pick<
    EditorialDocxTransformService,
    "applyDeterministicRules"
  >;
  manuscriptQualitySourceBlockResolver?: Pick<
    EditorialSourceBlockResolver,
    "resolveBlocks"
  >;
  manuscriptQualityService?: Pick<ManuscriptQualityService, "runChecks">;
  documentStructureService?: Pick<DocumentStructureService, "extract">;
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
  private readonly retrievalPresetService?: Pick<
    RetrievalPresetService,
    "getActivePresetForScope"
  >;
  private readonly manualReviewPolicyService?: Pick<
    ManualReviewPolicyService,
    "getActivePolicyForScope"
  >;
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
  private readonly aiProviderRuntimeService?: Pick<
    AiProviderRuntimeService,
    "resolveSelectionRuntime"
  >;
  private readonly aiProviderRuntimeCutoverEnabled: boolean;
  private readonly toolPermissionPolicyService: ToolPermissionPolicyService;
  private readonly agentExecutionService: AgentExecutionService;
  private readonly agentExecutionOrchestrationService: GovernedExecutionOrchestrationDispatcher;
  private readonly editorialDocxTransformService: Pick<
    EditorialDocxTransformService,
    "applyDeterministicRules"
  >;
  private readonly manuscriptQualitySourceBlockResolver: Pick<
    EditorialSourceBlockResolver,
    "resolveBlocks"
  >;
  private readonly manuscriptQualityService?: Pick<
    ManuscriptQualityService,
    "runChecks"
  >;
  private readonly documentStructureService?: Pick<DocumentStructureService, "extract">;
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
    this.retrievalPresetService = options.retrievalPresetService;
    this.manualReviewPolicyService = options.manualReviewPolicyService;
    this.executionGovernanceService = options.executionGovernanceService;
    this.executionTrackingService = options.executionTrackingService;
    this.documentAssetService = options.documentAssetService;
    this.aiGatewayService = options.aiGatewayService;
    this.sandboxProfileService = options.sandboxProfileService;
    this.agentProfileService = options.agentProfileService;
    this.agentRuntimeService = options.agentRuntimeService;
    this.runtimeBindingService = options.runtimeBindingService;
    this.runtimeBindingReadinessService = options.runtimeBindingReadinessService;
    this.aiProviderRuntimeService = options.aiProviderRuntimeService;
    this.aiProviderRuntimeCutoverEnabled =
      options.aiProviderRuntimeCutoverEnabled ?? false;
    this.toolPermissionPolicyService = options.toolPermissionPolicyService;
    this.agentExecutionService = options.agentExecutionService;
    this.agentExecutionOrchestrationService =
      options.agentExecutionOrchestrationService;
    this.editorialDocxTransformService =
      options.editorialDocxTransformService ??
      new EditorialDocxTransformService({
        assetRepository: options.assetRepository,
      });
    this.manuscriptQualitySourceBlockResolver =
      options.manuscriptQualitySourceBlockResolver ?? {
        async resolveBlocks() {
          return [];
        },
      };
    this.manuscriptQualityService = options.manuscriptQualityService;
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

  async run(input: RunEditingInput): Promise<EditingRunResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.editing");

    const committed = await this.transactionManager.withTransaction(async (context) => {
      const { jobRepository } = context;
      if (!jobRepository) {
        throw new Error("Editing runs require a job repository.");
      }
      const documentAssetService = this.documentAssetService.createScoped({
        manuscriptRepository: context.manuscriptRepository,
        assetRepository: context.assetRepository,
      });

      const timestamp = this.now().toISOString();
      const jobId = this.createId();
      const governedContext = await resolveGovernedAgentContext({
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
        retrievalPresetService: this.retrievalPresetService,
        manualReviewPolicyService: this.manualReviewPolicyService,
        sandboxProfileService: this.sandboxProfileService,
        agentProfileService: this.agentProfileService,
        agentRuntimeService: this.agentRuntimeService,
        runtimeBindingService: this.runtimeBindingService,
        runtimeBindingReadinessService: this.runtimeBindingReadinessService,
        aiProviderRuntimeService: this.aiProviderRuntimeService,
        aiProviderRuntimeCutoverEnabled: this.aiProviderRuntimeCutoverEnabled,
        toolPermissionPolicyService: this.toolPermissionPolicyService,
      });
      const moduleContext = governedContext.moduleContext;
      const instructionPayload = assembleInstructionTemplate({
        promptTemplate: moduleContext.promptTemplate,
        ruleSet: moduleContext.ruleSet,
        rules: moduleContext.rules,
        knowledgeSelections: moduleContext.knowledgeSelections,
        manualReviewPolicy: moduleContext.manualReviewPolicy,
      });
      const executionLog = await this.agentExecutionService.createLog({
        manuscriptId: input.manuscriptId,
        module: "editing",
        triggeredBy: input.requestedBy,
        runtimeId: governedContext.runtime.id,
        sandboxProfileId: governedContext.sandboxProfile.id,
        agentProfileId: governedContext.agentProfile.id,
        runtimeBindingId: governedContext.runtimeBinding.id,
        toolPermissionPolicyId: governedContext.toolPolicy.id,
        routingPolicyVersionId: moduleContext.modelSelection.policy_version_id,
        routingPolicyScopeKind: moduleContext.modelSelection.policy_scope_kind,
        routingPolicyScopeValue: moduleContext.modelSelection.policy_scope_value,
        resolvedModelId: moduleContext.modelSelection.model.id,
        knowledgeItemIds: moduleContext.knowledgeSelections.map(
          (selection) => selection.knowledgeItem.id,
        ),
        verificationCheckProfileIds:
          governedContext.verificationExpectations.verification_check_profile_ids,
        evaluationSuiteIds:
          governedContext.verificationExpectations.evaluation_suite_ids,
        releaseCheckProfileId:
          governedContext.verificationExpectations.release_check_profile_id,
      });
      const sourceAsset = await context.assetRepository.findById(input.parentAssetId);
      const documentStructureSnapshot = this.documentStructureService
        ? await this.documentStructureService.extract({
            manuscriptId: input.manuscriptId,
            assetId: input.parentAssetId,
            fileName:
              sourceAsset?.file_name ?? input.fileName ?? input.parentAssetId,
          })
        : undefined;
      const qualityRun = await this.runManuscriptQualityChecks({
        manuscriptId: input.manuscriptId,
        assetId: input.parentAssetId,
        tableSnapshots: documentStructureSnapshot?.tables ?? [],
        qualityPackageVersionIds:
          governedContext.runtimeBinding.quality_package_version_ids,
      });

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "editing",
        job_type: "editing_run",
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
          instructionTemplateId: moduleContext.promptTemplate.id,
          instructionPayload: {
            ...instructionPayload,
            allowedContentOperations: [...instructionPayload.allowedContentOperations],
            forbiddenOperations: [...instructionPayload.forbiddenOperations],
            promptSnippets: [...instructionPayload.promptSnippets],
          },
          manualReviewItems: instructionPayload.manualReviewItems.map((item) => ({
            ...item,
          })),
          contentRuleCandidates: instructionPayload.contentRuleCandidates.map(
            (candidate) => ({
              ...candidate,
            }),
          ),
          ...(qualityRun
            ? {
                qualityFindings: qualityRun.issues.map((issue) =>
                  structuredClone(issue),
                ),
                qualityFindingSummary: structuredClone(
                  qualityRun.quality_findings_summary,
                ),
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

      const deterministicTransform =
        await this.editorialDocxTransformService.applyDeterministicRules({
          manuscriptId: input.manuscriptId,
          sourceAssetId: input.parentAssetId,
          outputStorageKey: input.storageKey,
          outputFileName: input.fileName,
          rules: moduleContext.rules,
          resolvedRules: moduleContext.resolvedRules,
          tableSnapshots: documentStructureSnapshot?.tables ?? [],
        });

      const asset = await documentAssetService.createAsset({
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
        qualityPackages: qualityRun?.resolved_quality_packages,
        createdAssetIds: [asset.id],
        agentExecutionLogId: executionLog.id,
        qualityFindingsSummary: qualityRun
          ? structuredClone(qualityRun.quality_findings_summary)
          : undefined,
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
          outputAssetType: "edited_docx",
          appliedRuleIds: [...deterministicTransform.appliedRuleIds],
          appliedChanges: deterministicTransform.appliedChanges.map((change) => ({
            ...change,
            ...(change.semantic_hit
              ? {
                  semantic_hit: {
                    ...change.semantic_hit,
                    ...(change.semantic_hit.header_path
                      ? { header_path: [...change.semantic_hit.header_path] }
                      : {}),
                  },
                }
              : {}),
          })),
          tableInspectionFindings:
            (deterministicTransform.tableInspectionFindings ?? []).map((finding) => ({
              ...finding,
              semantic_hit: {
                ...finding.semantic_hit,
                ...(finding.semantic_hit.header_path
                  ? { header_path: [...finding.semantic_hit.header_path] }
                  : {}),
              },
            })),
        },
        attempt_count: 1,
        started_at: timestamp,
        finished_at: timestamp,
        updated_at: timestamp,
      };
      await jobRepository.save(completedJob);

      return {
        agentExecutionLogId: executionLog.id,
        response: {
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
        },
      };
    });

    await dispatchGovernedOrchestrationBestEffort({
      orchestrationService: this.agentExecutionOrchestrationService,
      agentExecutionLogId: committed.agentExecutionLogId,
    });

    return committed.response;
  }

  private async runManuscriptQualityChecks(input: {
    manuscriptId: string;
    assetId: string;
    tableSnapshots?: DocumentStructureTableSnapshot[];
    qualityPackageVersionIds?: string[];
  }) {
    if (!this.manuscriptQualityService) {
      return undefined;
    }

    const blocks = await this.manuscriptQualitySourceBlockResolver.resolveBlocks({
      manuscriptId: input.manuscriptId,
      assetId: input.assetId,
    });

    return this.manuscriptQualityService.runChecks({
      blocks: blocks.map((block) => ({
        text: block.text,
        style: block.block_kind,
      })),
      requestedScopes: ["general_proofreading", "medical_specialized"],
      targetModule: "editing",
      tableSnapshots: input.tableSnapshots,
      qualityPackageVersionIds: input.qualityPackageVersionIds,
    });
  }
}

export type { DeterministicDocxTransformResult };
