import { randomUUID } from "node:crypto";
import type {
  ManuscriptQualityIssue,
  ModuleExecutionMode,
} from "@medical/contracts";
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
import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type { ResolvedEditorialRule } from "../editorial-rules/editorial-rule-resolution-service.ts";
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
  ContentRuleCandidate,
  EditorialSourceBlockResolver,
  DeterministicDocxTransformResult,
  EditorialTextBlock,
  ManualReviewItem,
  TableRuleInspectionFinding,
} from "../editorial-execution/types.ts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type { ExecutionTrackingService } from "../execution-tracking/execution-tracking-service.ts";
import type { RecordKnowledgeHitInput } from "../execution-tracking/execution-tracking-service.ts";
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
import type {
  RecordExecutionGovernedHitInput,
  ReviewItemsService,
} from "../review-items/review-items-service.ts";
import type { SandboxProfileService } from "../sandbox-profiles/sandbox-profile-service.ts";
import {
  resolveBareModuleContext,
} from "../shared/bare-module-context-resolver.ts";
import {
  resolveGovernedAgentContext,
} from "../shared/governed-agent-context-resolver.ts";
import {
  dispatchGovernedOrchestrationBestEffort,
  type GovernedExecutionOrchestrationDispatcher,
  type ModuleExecutionResult,
  resolveModuleExecutionMode,
} from "../shared/module-run-support.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { ToolPermissionPolicyService } from "../tool-permission-policies/tool-permission-policy-service.ts";
import type { MainlineAiRuntimeExecutor } from "../shared/mainline-ai-runtime-executor.ts";
import {
  EditingAiPlanService,
  type EditingAiPlan,
} from "./editing-ai-plan-service.ts";

export interface RunEditingInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: RoleKey;
  storageKey: string;
  fileName?: string;
  executionMode?: ModuleExecutionMode;
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
  mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;
  editingAiPlanService?: Pick<EditingAiPlanService, "createPlan">;
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
  reviewItemsService?: Pick<ReviewItemsService, "recordExecutionGovernedHits">;
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
  private readonly editingAiPlanService: Pick<EditingAiPlanService, "createPlan">;
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
  private readonly reviewItemsService?: Pick<
    ReviewItemsService,
    "recordExecutionGovernedHits"
  >;
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
    this.editingAiPlanService =
      options.editingAiPlanService ??
      new EditingAiPlanService({
        mainlineAiRuntimeExecutor: options.mainlineAiRuntimeExecutor,
      });
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
    this.reviewItemsService = options.reviewItemsService;
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
    const executionMode = resolveModuleExecutionMode(input.executionMode);

    const committed = await this.transactionManager.withTransaction(async (context) => {
      const { jobRepository } = context;
      if (!jobRepository) {
        throw new Error("Editing runs require a job repository.");
      }
      const documentAssetService = this.documentAssetService.createScoped({
        manuscriptRepository: context.manuscriptRepository,
        assetRepository: context.assetRepository,
      });
      const manuscript = await context.manuscriptRepository.findById(
        input.manuscriptId,
      );
      if (!manuscript) {
        throw new Error(`Manuscript ${input.manuscriptId} was not found.`);
      }

      const timestamp = this.now().toISOString();
      const jobId = this.createId();
      let normalizedContext: {
        executionProfileId: string;
        templateId: string;
        moduleTemplateVersionNo: number;
        promptTemplateId: string;
        promptTemplateVersion: string;
        skillPackageIds: string[];
        skillPackageVersions: string[];
        knowledgeHits: RecordKnowledgeHitInput[];
        modelSelection: Awaited<ReturnType<AiGatewayService["resolveModelSelection"]>>;
        rules: EditorialRuleRecord[];
        resolvedRules: ResolvedEditorialRule[];
        instructionPayload?: ReturnType<typeof assembleInstructionTemplate>;
        verificationCheckProfileIds: string[];
        evaluationSuiteIds: string[];
        releaseCheckProfileId?: string;
        qualityPackageVersionIds?: string[];
        agentRuntimeId?: string;
        sandboxProfileId?: string;
        agentProfileId?: string;
        runtimeBindingId?: string;
        toolPermissionPolicyId?: string;
      };
      if (executionMode === "bare") {
        const bareContext = await resolveBareModuleContext({
          manuscriptId: input.manuscriptId,
          module: "editing",
          jobId,
          actorId: input.requestedBy,
          actorRole: input.actorRole,
          manuscriptRepository: this.manuscriptRepository,
          aiGatewayService: this.aiGatewayService,
        });
        normalizedContext = {
          executionProfileId: bareContext.executionProfileId,
          templateId: bareContext.moduleTemplateId,
          moduleTemplateVersionNo: bareContext.moduleTemplateVersionNo,
          promptTemplateId: bareContext.promptTemplateId,
          promptTemplateVersion: bareContext.promptTemplateVersion,
          skillPackageIds: bareContext.skillPackageIds,
          skillPackageVersions: bareContext.skillPackageVersions,
          knowledgeHits: bareContext.knowledgeHits,
          modelSelection: bareContext.modelSelection,
          rules: [],
          resolvedRules: [],
          verificationCheckProfileIds: bareContext.verificationCheckProfileIds,
          evaluationSuiteIds: bareContext.evaluationSuiteIds,
          qualityPackageVersionIds: bareContext.qualityPackageVersionIds,
        };
      } else {
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
        normalizedContext = {
          executionProfileId: governedContext.executionProfile.id,
          templateId: governedContext.moduleContext.moduleTemplate.id,
          moduleTemplateVersionNo:
            governedContext.moduleContext.moduleTemplate.version_no,
          promptTemplateId: governedContext.moduleContext.promptTemplate.id,
          promptTemplateVersion:
            governedContext.moduleContext.promptTemplate.version,
          skillPackageIds: governedContext.moduleContext.skillPackages.map(
            (record) => record.id,
          ),
          skillPackageVersions: governedContext.moduleContext.skillPackages.map(
            (record) => record.version,
          ),
          knowledgeHits: governedContext.moduleContext.knowledgeSelections.map(
            (selection) => ({
              knowledgeItemId: selection.knowledgeItem.id,
              matchSourceId: selection.matchSourceId,
              bindingRuleId: selection.bindingRuleId,
              matchSource: selection.matchSource,
              matchReasons: selection.matchReasons,
            }),
          ),
          modelSelection: governedContext.moduleContext.modelSelection,
          rules: governedContext.moduleContext.rules,
          resolvedRules: governedContext.moduleContext.resolvedRules,
          instructionPayload: assembleInstructionTemplate({
            promptTemplate: governedContext.moduleContext.promptTemplate,
            ruleSet: governedContext.moduleContext.ruleSet,
            rules: governedContext.moduleContext.rules,
            knowledgeSelections:
              governedContext.moduleContext.knowledgeSelections,
            manualReviewPolicy:
              governedContext.moduleContext.manualReviewPolicy,
          }),
          verificationCheckProfileIds:
            governedContext.verificationExpectations
              .verification_check_profile_ids,
          evaluationSuiteIds:
            governedContext.verificationExpectations.evaluation_suite_ids,
          releaseCheckProfileId:
            governedContext.verificationExpectations.release_check_profile_id,
          qualityPackageVersionIds:
            governedContext.runtimeBinding.quality_package_version_ids,
          agentRuntimeId: governedContext.runtime.id,
          sandboxProfileId: governedContext.sandboxProfile.id,
          agentProfileId: governedContext.agentProfile.id,
          runtimeBindingId: governedContext.runtimeBinding.id,
          toolPermissionPolicyId: governedContext.toolPolicy.id,
        };
      }
      const executionLog =
        executionMode === "bare"
          ? undefined
          : await this.agentExecutionService.createLog({
              manuscriptId: input.manuscriptId,
              module: "editing",
              triggeredBy: input.requestedBy,
              runtimeId: normalizedContext.agentRuntimeId!,
              sandboxProfileId: normalizedContext.sandboxProfileId!,
              agentProfileId: normalizedContext.agentProfileId!,
              runtimeBindingId: normalizedContext.runtimeBindingId!,
              toolPermissionPolicyId: normalizedContext.toolPermissionPolicyId!,
              routingPolicyVersionId:
                normalizedContext.modelSelection.policy_version_id,
              routingPolicyScopeKind:
                normalizedContext.modelSelection.policy_scope_kind,
              routingPolicyScopeValue:
                normalizedContext.modelSelection.policy_scope_value,
              resolvedModelId: normalizedContext.modelSelection.model.id,
              fallbackModelId:
                normalizedContext.modelSelection.fallback_chain[0]?.id,
              knowledgeItemIds: normalizedContext.knowledgeHits.map(
                (selection) => selection.knowledgeItemId,
              ),
              verificationCheckProfileIds:
                normalizedContext.verificationCheckProfileIds,
              evaluationSuiteIds: normalizedContext.evaluationSuiteIds,
              releaseCheckProfileId: normalizedContext.releaseCheckProfileId,
            });
      const sourceAsset = await context.assetRepository.findById(input.parentAssetId);
      const sourceBlocks = await this.manuscriptQualitySourceBlockResolver.resolveBlocks({
        manuscriptId: input.manuscriptId,
        assetId: input.parentAssetId,
      });
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
        sourceBlocks,
        tableSnapshots: documentStructureSnapshot?.tables ?? [],
        qualityPackageVersionIds: normalizedContext.qualityPackageVersionIds,
      });
      const editingPlan = structuredClone(
        await this.editingAiPlanService.createPlan({
          manuscriptId: input.manuscriptId,
          sourceFileName:
            sourceAsset?.file_name ?? input.fileName ?? input.parentAssetId,
          sourceBlocks,
          qualityIssues: qualityRun?.issues,
        }),
      ) as EditingAiPlan;

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "editing",
        job_type: "editing_run",
        status: "queued",
        requested_by: input.requestedBy,
        payload: {
          templateId: normalizedContext.templateId,
          executionProfileId: normalizedContext.executionProfileId,
          promptTemplateId: normalizedContext.promptTemplateId,
          skillPackageIds: normalizedContext.skillPackageIds,
          knowledgeItemIds: normalizedContext.knowledgeHits.map(
            (selection) => selection.knowledgeItemId,
          ),
          modelId: normalizedContext.modelSelection.model.id,
          ...(executionMode === "bare" ? { executionMode } : {}),
          ...(normalizedContext.agentRuntimeId
            ? {
                agentRuntimeId: normalizedContext.agentRuntimeId,
              }
            : {}),
          ...(normalizedContext.sandboxProfileId
            ? {
                sandboxProfileId: normalizedContext.sandboxProfileId,
              }
            : {}),
          ...(normalizedContext.agentProfileId
            ? {
                agentProfileId: normalizedContext.agentProfileId,
              }
            : {}),
          ...(normalizedContext.runtimeBindingId
            ? {
                runtimeBindingId: normalizedContext.runtimeBindingId,
              }
            : {}),
          ...(normalizedContext.toolPermissionPolicyId
            ? {
                toolPermissionPolicyId: normalizedContext.toolPermissionPolicyId,
              }
            : {}),
          ...(executionLog
            ? {
                agentExecutionLogId: executionLog.id,
              }
            : {}),
          parentAssetId: input.parentAssetId,
          ...(normalizedContext.instructionPayload
            ? {
                instructionTemplateId: normalizedContext.promptTemplateId,
                instructionPayload: {
                  ...normalizedContext.instructionPayload,
                  allowedContentOperations: [
                    ...normalizedContext.instructionPayload
                      .allowedContentOperations,
                  ],
                  forbiddenOperations: [
                    ...normalizedContext.instructionPayload.forbiddenOperations,
                  ],
                  promptSnippets: [
                    ...normalizedContext.instructionPayload.promptSnippets,
                  ],
                },
                manualReviewItems:
                  normalizedContext.instructionPayload.manualReviewItems.map(
                    (item) => ({
                      ...item,
                    }),
                  ),
                contentRuleCandidates:
                  normalizedContext.instructionPayload.contentRuleCandidates.map(
                    (candidate) => ({
                      ...candidate,
                    }),
                  ),
              }
            : {}),
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
          editingPlan,
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
          rules: normalizedContext.rules,
          resolvedRules: normalizedContext.resolvedRules,
          tableSnapshots: documentStructureSnapshot?.tables ?? [],
          aiReplacements: editingPlan.replacements,
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
        executionProfileId: normalizedContext.executionProfileId,
        moduleTemplateId: normalizedContext.templateId,
        moduleTemplateVersionNo: normalizedContext.moduleTemplateVersionNo,
        promptTemplateId: normalizedContext.promptTemplateId,
        promptTemplateVersion: normalizedContext.promptTemplateVersion,
        skillPackageIds: normalizedContext.skillPackageIds,
        skillPackageVersions: normalizedContext.skillPackageVersions,
        modelId: normalizedContext.modelSelection.model.id,
        modelVersion: normalizedContext.modelSelection.model.model_version,
        qualityPackages: qualityRun?.resolved_quality_packages,
        createdAssetIds: [asset.id],
        agentExecutionLogId: executionLog?.id,
        qualityFindingsSummary: qualityRun
          ? structuredClone(qualityRun.quality_findings_summary)
          : undefined,
        knowledgeHits: normalizedContext.knowledgeHits.map((selection) => ({
          knowledgeItemId: selection.knowledgeItemId,
          matchSourceId: selection.matchSourceId,
          bindingRuleId: selection.bindingRuleId,
          matchSource: selection.matchSource,
          matchReasons: selection.matchReasons,
        })),
      });
      if (executionLog) {
        await this.agentExecutionService.completeLog({
          logId: executionLog.id,
          executionSnapshotId: snapshot.id,
        });
      }
      const recordedExecutionGovernedHits = this.reviewItemsService
        ? await this.reviewItemsService.recordExecutionGovernedHits({
            manuscriptId: input.manuscriptId,
            manuscriptType: manuscript.manuscript_type,
            module: "editing",
            snapshotId: snapshot.id,
            sourceAssetId: input.parentAssetId,
            createdBy: input.requestedBy,
            items: buildEditingExecutionGovernedHitInputs({
              manualReviewItems:
                normalizedContext.instructionPayload?.manualReviewItems ?? [],
              contentRuleCandidates:
                normalizedContext.instructionPayload?.contentRuleCandidates ?? [],
              tableInspectionFindings:
                deterministicTransform.tableInspectionFindings ?? [],
              qualityFindings: qualityRun?.issues ?? [],
            }),
          })
        : [];
      const reviewItemIdBySourceKey = new Map(
        recordedExecutionGovernedHits.map((entry) => [
          entry.sourceKey,
          entry.item.id,
        ]),
      );
      const annotatedManualReviewItems = annotateEditingManualReviewItems(
        normalizedContext.instructionPayload?.manualReviewItems ?? [],
        reviewItemIdBySourceKey,
      );
      const annotatedContentRuleCandidates = annotateEditingContentRuleCandidates(
        normalizedContext.instructionPayload?.contentRuleCandidates ?? [],
        reviewItemIdBySourceKey,
      );
      const annotatedQualityFindings = annotateEditingQualityFindings(
        qualityRun?.issues ?? [],
        reviewItemIdBySourceKey,
      );
      const annotatedTableInspectionFindings = annotateEditingTableInspectionFindings(
        deterministicTransform.tableInspectionFindings ?? [],
        reviewItemIdBySourceKey,
      );

      const completedJob: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
          snapshotId: snapshot.id,
          outputAssetId: asset.id,
          outputAssetType: "edited_docx",
          ...(annotatedManualReviewItems.length > 0
            ? {
                manualReviewItems: annotatedManualReviewItems,
              }
            : {}),
          ...(annotatedContentRuleCandidates.length > 0
            ? {
                contentRuleCandidates: annotatedContentRuleCandidates,
              }
            : {}),
          ...(annotatedQualityFindings.length > 0
            ? {
                qualityFindings: annotatedQualityFindings,
              }
            : {}),
          editingPlan,
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
          tableInspectionFindings: annotatedTableInspectionFindings.map((finding) => ({
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
        agentExecutionLogId: executionLog?.id,
        response: {
          job: completedJob,
          asset,
          template_id: normalizedContext.templateId,
          execution_profile_id: normalizedContext.executionProfileId,
          prompt_template_id: normalizedContext.promptTemplateId,
          skill_package_ids: normalizedContext.skillPackageIds,
          snapshot_id: snapshot.id,
          knowledge_item_ids: normalizedContext.knowledgeHits.map(
            (selection) => selection.knowledgeItemId,
          ),
          model_id: normalizedContext.modelSelection.model.id,
          ...(normalizedContext.agentRuntimeId
            ? {
                agent_runtime_id: normalizedContext.agentRuntimeId,
              }
            : {}),
          ...(normalizedContext.agentProfileId
            ? {
                agent_profile_id: normalizedContext.agentProfileId,
              }
            : {}),
          ...(executionLog
            ? {
                agent_execution_log_id: executionLog.id,
              }
            : {}),
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
    sourceBlocks?: EditorialTextBlock[];
    tableSnapshots?: DocumentStructureTableSnapshot[];
    qualityPackageVersionIds?: string[];
  }) {
    if (!this.manuscriptQualityService) {
      return undefined;
    }

    const blocks =
      input.sourceBlocks ??
      (await this.manuscriptQualitySourceBlockResolver.resolveBlocks({
        manuscriptId: input.manuscriptId,
        assetId: input.assetId,
      }));

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

function buildEditingExecutionGovernedHitInputs(input: {
  manualReviewItems: readonly ManualReviewItem[];
  contentRuleCandidates: readonly ContentRuleCandidate[];
  tableInspectionFindings: readonly TableRuleInspectionFinding[];
  qualityFindings: readonly ManuscriptQualityIssue[];
}): RecordExecutionGovernedHitInput[] {
  return [
    ...input.manualReviewItems.map((item, index) => ({
      sourceKey: buildEditingManualReviewSourceKey(item, index),
      title: buildRuleReviewTitle(item.ruleId, "Editing manual review"),
      summary: item.reason,
      rationale: item.reason,
      candidate_posture: item.candidate_posture ?? "candidate_change",
      evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
        rationale: item.reason,
      },
      riskLevel: "high" as const,
      relatedRuleIds: [item.ruleId],
      originPayload: {
        source: "manual_review_item",
        ruleId: item.ruleId,
        reason: item.reason,
      },
    })),
    ...input.contentRuleCandidates.map((item, index) => ({
      sourceKey: buildEditingContentRuleCandidateSourceKey(item, index),
      title: buildRuleReviewTitle(item.ruleId, "Editing content candidate"),
      summary: item.reason,
      rationale: item.reason,
      candidate_posture: item.candidate_posture ?? "candidate_change",
      evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
        rationale: item.reason,
      },
      riskLevel: mapEditorialSeverityToReviewRisk(item.severity),
      relatedRuleIds: [item.ruleId],
      originPayload: {
        source: "content_rule_candidate",
        ruleId: item.ruleId,
        reason: item.reason,
        actionKind: item.actionKind,
      },
    })),
    ...input.tableInspectionFindings.map((item, index) => ({
      sourceKey: buildEditingTableInspectionSourceKey(item, index),
      title: buildRuleReviewTitle(item.ruleId, "Editing table inspection"),
      summary:
        "The matched table rule should be reviewed before governance routing.",
      excerpt: item.reason,
      location: cloneSemanticLocation(item.semantic_hit),
      rationale: item.reason,
      candidate_posture: item.candidate_posture ?? "inspect_only",
      evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
        location: cloneSemanticLocation(item.semantic_hit),
        excerpt: item.reason,
        rationale: item.reason,
      },
      riskLevel: "high" as const,
      relatedRuleIds: [item.ruleId],
      originPayload: {
        source: "table_inspection_finding",
        ruleId: item.ruleId,
        semantic_hit: cloneSemanticLocation(item.semantic_hit),
      },
    })),
    ...input.qualityFindings
      .filter(isHighRiskQualityIssue)
      .map((issue, index) => ({
        sourceKey: buildQualityFindingSourceKey("editing", issue, index),
        title: `Editing quality issue ${issue.issue_type} requires review`,
        summary: issue.explanation,
        excerpt: issue.text_excerpt,
        suggestion: issue.suggested_replacement,
        location: buildQualityFindingLocation(issue),
        rationale: issue.explanation,
        candidate_posture: "candidate_change" as const,
        evidence_pack: {
          ...(buildQualityFindingLocation(issue)
            ? {
                location: buildQualityFindingLocation(issue),
              }
            : {}),
          ...(issue.text_excerpt ? { excerpt: issue.text_excerpt } : {}),
          ...(issue.suggested_replacement
            ? { suggestion: issue.suggested_replacement }
            : {}),
          ...(issue.explanation ? { rationale: issue.explanation } : {}),
        },
        riskLevel: issue.severity,
        originPayload: {
          source: "quality_finding",
          issueId: issue.issue_id,
          issueType: issue.issue_type,
          action: issue.action,
        },
      })),
  ];
}

function annotateEditingManualReviewItems(
  items: readonly ManualReviewItem[],
  reviewItemIdBySourceKey: ReadonlyMap<string, string>,
): Array<ManualReviewItem & { reviewItemId?: string }> {
  return items.map((item, index) => ({
    ...ensureEditingManualReviewGovernedHit(item),
    ...item,
    ...(reviewItemIdBySourceKey.get(buildEditingManualReviewSourceKey(item, index))
      ? {
          reviewItemId: reviewItemIdBySourceKey.get(
            buildEditingManualReviewSourceKey(item, index),
          ),
        }
      : {}),
  }));
}

function annotateEditingContentRuleCandidates(
  items: readonly ContentRuleCandidate[],
  reviewItemIdBySourceKey: ReadonlyMap<string, string>,
): Array<ContentRuleCandidate & { reviewItemId?: string }> {
  return items.map((item, index) => ({
    ...ensureEditingContentRuleGovernedHit(item),
    ...item,
    ...(reviewItemIdBySourceKey.get(
      buildEditingContentRuleCandidateSourceKey(item, index),
    )
      ? {
          reviewItemId: reviewItemIdBySourceKey.get(
            buildEditingContentRuleCandidateSourceKey(item, index),
          ),
        }
      : {}),
  }));
}

function annotateEditingTableInspectionFindings(
  items: readonly TableRuleInspectionFinding[],
  reviewItemIdBySourceKey: ReadonlyMap<string, string>,
): Array<TableRuleInspectionFinding & { reviewItemId?: string }> {
  return items.map((item, index) => ({
    ...ensureEditingTableInspectionGovernedHit(item),
    ...item,
    ...(reviewItemIdBySourceKey.get(buildEditingTableInspectionSourceKey(item, index))
      ? {
          reviewItemId: reviewItemIdBySourceKey.get(
            buildEditingTableInspectionSourceKey(item, index),
          ),
        }
      : {}),
  }));
}

function annotateEditingQualityFindings(
  items: readonly ManuscriptQualityIssue[],
  reviewItemIdBySourceKey: ReadonlyMap<string, string>,
): Array<
  ManuscriptQualityIssue & {
    reviewItemId?: string;
    candidate_posture?: "candidate_change";
    evidence_pack?: Record<string, unknown>;
  }
> {
  return items.map((item, index) => ({
    ...item,
    candidate_posture: "candidate_change",
    evidence_pack: {
      ...(buildQualityFindingLocation(item)
        ? {
            location: buildQualityFindingLocation(item),
          }
        : {}),
      ...(item.text_excerpt ? { excerpt: item.text_excerpt } : {}),
      ...(item.suggested_replacement
        ? { suggestion: item.suggested_replacement }
        : {}),
      ...(item.explanation ? { rationale: item.explanation } : {}),
    },
    ...(reviewItemIdBySourceKey.get(buildQualityFindingSourceKey("editing", item, index))
      ? {
          reviewItemId: reviewItemIdBySourceKey.get(
            buildQualityFindingSourceKey("editing", item, index),
          ),
        }
      : {}),
  }));
}

function ensureEditingManualReviewGovernedHit(
  item: ManualReviewItem,
): Pick<ManualReviewItem, "candidate_posture" | "evidence_pack"> {
  return {
    candidate_posture: item.candidate_posture ?? "candidate_change",
    evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
      rationale: item.reason,
    },
  };
}

function ensureEditingContentRuleGovernedHit(
  item: ContentRuleCandidate,
): Pick<ContentRuleCandidate, "candidate_posture" | "evidence_pack"> {
  return {
    candidate_posture: item.candidate_posture ?? "candidate_change",
    evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
      rationale: item.reason,
    },
  };
}

function ensureEditingTableInspectionGovernedHit(
  item: TableRuleInspectionFinding,
): Pick<TableRuleInspectionFinding, "candidate_posture" | "evidence_pack"> {
  return {
    candidate_posture: item.candidate_posture ?? "inspect_only",
    evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
      location: cloneSemanticLocation(item.semantic_hit),
      excerpt: item.reason,
      rationale: item.reason,
    },
  };
}

function buildEditingManualReviewSourceKey(
  item: ManualReviewItem,
  index: number,
): string {
  return `editing:manual:${item.ruleId}:${item.reason}:${index}`;
}

function buildEditingContentRuleCandidateSourceKey(
  item: ContentRuleCandidate,
  index: number,
): string {
  return `editing:content:${item.ruleId}:${item.reason}:${item.actionKind}:${index}`;
}

function buildEditingTableInspectionSourceKey(
  item: TableRuleInspectionFinding,
  index: number,
): string {
  return [
    "editing",
    "table",
    item.ruleId,
    item.semantic_hit.table_id,
    item.semantic_hit.semantic_target,
    item.semantic_hit.column_key ?? "",
    item.semantic_hit.header_path?.join(">") ?? "",
    String(index),
  ].join(":");
}

function buildRuleReviewTitle(ruleId: string, fallback: string): string {
  const normalizedRuleId = ruleId.trim();
  return normalizedRuleId
    ? `Rule ${normalizedRuleId} requires manual review`
    : fallback;
}

function mapEditorialSeverityToReviewRisk(
  severity: string,
): "low" | "medium" | "high" | "critical" {
  if (severity === "critical") {
    return "critical";
  }
  if (severity === "error" || severity === "high") {
    return "high";
  }
  if (severity === "warning" || severity === "medium") {
    return "medium";
  }
  return "low";
}

function isHighRiskQualityIssue(issue: ManuscriptQualityIssue): boolean {
  return (
    issue.action === "manual_review" ||
    issue.action === "block" ||
    issue.severity === "high" ||
    issue.severity === "critical"
  );
}

function buildQualityFindingSourceKey(
  module: "editing" | "proofreading",
  issue: ManuscriptQualityIssue,
  index: number,
): string {
  return [
    module,
    "quality",
    issue.issue_id,
    issue.issue_type,
    issue.paragraph_index ?? "",
    issue.sentence_index ?? "",
    String(index),
  ].join(":");
}

function buildQualityFindingLocation(
  issue: ManuscriptQualityIssue,
): Record<string, unknown> | undefined {
  const location: Record<string, unknown> = {};
  if (typeof issue.paragraph_index === "number") {
    location.paragraph_index = issue.paragraph_index + 1;
  }
  if (typeof issue.sentence_index === "number") {
    location.sentence_index = issue.sentence_index + 1;
  }
  return Object.keys(location).length > 0 ? location : undefined;
}

function cloneEvidencePack(
  evidencePack:
    | {
        location?: Record<string, unknown>;
        excerpt?: string;
        suggestion?: string;
        rationale?: string;
      }
    | undefined,
): {
  location?: Record<string, unknown>;
  excerpt?: string;
  suggestion?: string;
  rationale?: string;
} | undefined {
  if (!evidencePack) {
    return undefined;
  }

  return {
    ...(evidencePack.location
      ? {
          location: cloneLocationRecord(evidencePack.location),
        }
      : {}),
    ...(typeof evidencePack.excerpt === "string"
      ? { excerpt: evidencePack.excerpt }
      : {}),
    ...(typeof evidencePack.suggestion === "string"
      ? { suggestion: evidencePack.suggestion }
      : {}),
    ...(typeof evidencePack.rationale === "string"
      ? { rationale: evidencePack.rationale }
      : {}),
  };
}

function cloneLocationRecord(
  location: Record<string, unknown>,
): Record<string, unknown> {
  return structuredClone(location);
}

function cloneSemanticLocation(
  value: TableRuleInspectionFinding["semantic_hit"],
): Record<string, unknown> {
  return {
    ...value,
    ...(value.header_path ? { header_path: [...value.header_path] } : {}),
  };
}

export type { DeterministicDocxTransformResult };
