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
import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type { ResolvedEditorialRule } from "../editorial-rules/editorial-rule-resolution-service.ts";
import {
  EditorialDocxTransformService,
} from "../document-pipeline/editorial-docx-transform-service.ts";
import type {
  DocumentStructureObjectEvidence,
  DocumentStructureService,
} from "../document-pipeline/document-structure-service.ts";
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
import {
  assembleInstructionTemplate,
} from "../editorial-execution/instruction-template-assembler.ts";
import type {
  EditorialTextBlock,
  ManualReviewItem,
  ProofreadingCheckResult,
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
import type { LearningCandidateRecord } from "../learning/learning-record.ts";
import type { LearningService } from "../learning/learning-service.ts";
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
import {
  compareReviewItems,
  mapResidualIssueToReviewItem,
} from "../review-items/review-item-mapper.ts";
import type { ResidualReviewItemRecord } from "../review-items/review-item-record.ts";
import type {
  ResidualIssueRecord,
  ResidualIssueSignalBreakdown,
} from "../residual-learning/residual-learning-record.ts";
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
  ModuleExecutionConcurrencyController,
  runControlledModuleJob,
} from "../shared/module-execution-concurrency-controller.ts";
import {
  createWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type {
  ProofreadingResidualHint,
  ObserveProofreadingResidualsInput,
  ProofreadingResidualSourceBlock,
  ResidualLearningService,
} from "../residual-learning/index.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { ToolPermissionPolicyService } from "../tool-permission-policies/tool-permission-policy-service.ts";
import type { ManuscriptQualityService } from "../manuscript-quality/manuscript-quality-service.ts";
import type { MainlineAiRuntimeExecutor } from "../shared/mainline-ai-runtime-executor.ts";
import type { AiGovernanceContext } from "../shared/ai-governance-context.ts";
import { materializeTextAsset } from "../shared/text-asset-materialization.ts";
import {
  ProofreadingAiPlanService,
} from "./proofreading-ai-plan-service.ts";
import type {
  ProofreadingAiPlan,
  ProofreadingIssue,
  ProofreadingIssueAnchor,
  ProofreadingIssueDocumentLocator,
  ProofreadingLegacyCorrection,
  ProofreadingSuggestionAction,
} from "./proofreading-issue-contract.ts";

export interface CreateProofreadingDraftInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: RoleKey;
  storageKey: string;
  fileName?: string;
  executionMode?: ModuleExecutionMode;
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
  confirmationDecisions?: ProofreadingConfirmationDecisionInput[];
}

export interface SaveProofreadingConfirmationDraftInput {
  manuscriptId: string;
  confirmationAssetId: string;
  requestedBy: string;
  actorRole: RoleKey;
  confirmationDecisions: ProofreadingConfirmationDecisionInput[];
}

export type ProofreadingConfirmationDecisionAction =
  | "accepted"
  | "accepted_with_manual_edit"
  | "rejected"
  | "accept"
  | "accept_and_edit"
  | "reject"
  | "manual_only"
  | "escalated"
  | "route_to_rule_candidate"
  | "route_to_knowledge_candidate";

export interface ProofreadingConfirmationDecisionInput {
  itemId: string;
  targetText: string;
  replacementText: string;
  action: ProofreadingConfirmationDecisionAction;
  editedReplacementText?: string;
  note?: string;
}

type ProofreadingResidualLearningService = Pick<
  ResidualLearningService,
  "observeProofreadingResiduals"
> &
  Partial<Pick<ResidualLearningService, "listIssues">>;

export interface ProofreadingServiceOptions {
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
  textAssetRootDir?: string;
  textAssetMaterializer?: typeof materializeTextAsset;
  proofreadingAiPlanService?: Pick<ProofreadingAiPlanService, "createPlan">;
  editorialDocxTransformService?: Pick<
    EditorialDocxTransformService,
    "applyDeterministicRules"
  >;
  proofreadingSourceBlockResolver?: Pick<
    ProofreadingSourceBlockResolver,
    "resolveBlocks"
  >;
  manuscriptQualityService?: Pick<ManuscriptQualityService, "runChecks">;
  documentStructureService?: Pick<DocumentStructureService, "extract">;
  reviewItemsService?: Pick<
    ReviewItemsService,
    "listReviewItems" | "recordExecutionGovernedHits" | "submitGovernedHit" | "decideReviewItem"
  >;
  learningService?: Pick<
    LearningService,
    "listLearningCandidates" | "listLearningCandidateSourceLinksByCandidateId"
  >;
  residualLearningService?: ProofreadingResidualLearningService;
  moduleExecutionConcurrencyController?: ModuleExecutionConcurrencyController;
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

export interface ProofreadingConfirmationDraftSaveResult {
  job: JobRecord;
}

export interface ProofreadingGovernanceHandoff {
  residualReviewItems: ResidualReviewItemRecord[];
  ruleCandidates: LearningCandidateRecord[];
  knowledgeCandidates: LearningCandidateRecord[];
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

export class ProofreadingConfirmationAssetRequiredError extends Error {
  constructor(assetId: string) {
    super(
      `Asset ${assetId} is not a proofreading draft report or annotated confirmation asset.`,
    );
    this.name = "ProofreadingConfirmationAssetRequiredError";
  }
}

export class ProofreadingServiceDependencyRequiredError extends Error {
  constructor(dependency: string) {
    super(`Proofreading service requires the ${dependency} dependency.`);
    this.name = "ProofreadingServiceDependencyRequiredError";
  }
}

export class ProofreadingService {
  private readonly manuscriptRepository: ManuscriptRepository;
  private readonly assetRepository: DocumentAssetRepository;
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
  private readonly mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;
  private readonly textAssetRootDir?: string;
  private readonly textAssetMaterializer: typeof materializeTextAsset;
  private readonly proofreadingAiPlanService: Pick<
    ProofreadingAiPlanService,
    "createPlan"
  >;
  private readonly editorialDocxTransformService: Pick<
    EditorialDocxTransformService,
    "applyDeterministicRules"
  >;
  private readonly proofreadingSourceBlockResolver: Pick<
    ProofreadingSourceBlockResolver,
    "resolveBlocks"
  >;
  private readonly manuscriptQualityService?: Pick<
    ManuscriptQualityService,
    "runChecks"
  >;
  private readonly documentStructureService?: Pick<DocumentStructureService, "extract">;
  private readonly reviewItemsService?: Pick<
    ReviewItemsService,
    "listReviewItems" | "recordExecutionGovernedHits" | "submitGovernedHit" | "decideReviewItem"
  >;
  private readonly learningService?: Pick<
    LearningService,
    "listLearningCandidates" | "listLearningCandidateSourceLinksByCandidateId"
  >;
  private readonly residualLearningService?: ProofreadingResidualLearningService;
  private readonly moduleExecutionConcurrencyController: ModuleExecutionConcurrencyController;
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
    this.mainlineAiRuntimeExecutor = options.mainlineAiRuntimeExecutor;
    this.textAssetRootDir = options.textAssetRootDir;
    this.textAssetMaterializer =
      options.textAssetMaterializer ?? materializeTextAsset;
    this.proofreadingAiPlanService =
      options.proofreadingAiPlanService ??
      new ProofreadingAiPlanService({
        mainlineAiRuntimeExecutor: options.mainlineAiRuntimeExecutor,
      });
    this.editorialDocxTransformService =
      options.editorialDocxTransformService ??
      new EditorialDocxTransformService({
        assetRepository: options.assetRepository,
        rootDir: options.textAssetRootDir,
      });
    this.proofreadingSourceBlockResolver =
      options.proofreadingSourceBlockResolver ?? {
        async resolveBlocks() {
          return [];
        },
      };
    this.manuscriptQualityService = options.manuscriptQualityService;
    this.documentStructureService = options.documentStructureService;
    this.reviewItemsService = options.reviewItemsService;
    this.learningService = options.learningService;
    this.residualLearningService = options.residualLearningService;
    this.moduleExecutionConcurrencyController =
      options.moduleExecutionConcurrencyController ??
      new ModuleExecutionConcurrencyController();
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
      executionMode: input.executionMode,
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
    const draftJobPayload = asObject(draftJob?.payload);
    const sourceManuscriptAssetId =
      readOptionalString(draftJobPayload?.sourceManuscriptAssetId) ??
      readOptionalString(draftJobPayload?.parentAssetId) ??
      draftAsset.parent_asset_id;

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
      sourceManuscriptAssetId,
    });
  }

  async publishHumanFinal(
    input: PublishProofreadingHumanFinalInput,
  ): Promise<ProofreadingHumanFinalPublishResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.proofreading");

    const committed = await this.transactionManager.withTransaction(async (context) => {
      const { jobRepository, assetRepository, manuscriptRepository } = context;
      if (!jobRepository) {
        throw new Error("Human-final publication requires a job repository.");
      }

      const manuscript = await manuscriptRepository.findById(input.manuscriptId);
      const proofreadingAsset = await assetRepository.findById(input.finalAssetId);
      if (
        !proofreadingAsset ||
        proofreadingAsset.manuscript_id !== input.manuscriptId ||
        (
          proofreadingAsset.asset_type !== "final_proof_annotated_docx" &&
          proofreadingAsset.asset_type !== "proofreading_draft_report"
        )
      ) {
        throw new ProofreadingFinalAssetRequiredError(input.finalAssetId);
      }
      const finalJob =
        proofreadingAsset.source_job_id != null
          ? await jobRepository.findById(proofreadingAsset.source_job_id)
          : undefined;
      const finalJobPayload = asObject(finalJob?.payload);
      const parentDraftAssetId =
        proofreadingAsset.asset_type === "proofreading_draft_report"
          ? proofreadingAsset.id
          : (
              readOptionalString(finalJobPayload?.parentAssetId) ??
              proofreadingAsset.parent_asset_id
            );
      const parentDraftAsset =
        parentDraftAssetId != null
          ? await assetRepository.findById(parentDraftAssetId)
          : undefined;
      const parentDraftJob =
        parentDraftAsset?.source_job_id != null
          ? await jobRepository.findById(parentDraftAsset.source_job_id)
          : undefined;
      const parentDraftJobPayload = asObject(parentDraftJob?.payload);
      const sourceProofreadingPlan = extractProofreadingConfirmationSources({
        proofreadingPlan:
          finalJobPayload?.proofreadingPlan ??
          parentDraftJobPayload?.proofreadingPlan,
        proofreadingFindings:
          finalJobPayload?.proofreadingFindings ??
          parentDraftJobPayload?.proofreadingFindings,
      });
      const sourceManuscriptAssetId =
        readOptionalString(finalJobPayload?.sourceManuscriptAssetId) ??
        readOptionalString(parentDraftJobPayload?.sourceManuscriptAssetId) ??
        readOptionalString(parentDraftJobPayload?.parentAssetId) ??
        input.finalAssetId;
      const sourceSnapshotId =
        readOptionalString(finalJobPayload?.snapshotId) ??
        readOptionalString(parentDraftJobPayload?.snapshotId);
      const sourceExecutionMode =
        extractModuleExecutionMode(finalJob) ??
        extractModuleExecutionMode(parentDraftJob);
      const sourceExecutionProfileId =
        readOptionalString(finalJobPayload?.executionProfileId) ??
        readOptionalString(parentDraftJobPayload?.executionProfileId);
      const sourceRetrievalPresetId =
        readOptionalString(finalJobPayload?.retrievalPresetId) ??
        readOptionalString(parentDraftJobPayload?.retrievalPresetId);
      const sourceRuntimeBindingId =
        readOptionalString(finalJobPayload?.runtimeBindingId) ??
        readOptionalString(parentDraftJobPayload?.runtimeBindingId);
      const sourceRoutingPolicyVersionId =
        readOptionalString(finalJobPayload?.routingPolicyVersionId) ??
        readOptionalString(parentDraftJobPayload?.routingPolicyVersionId);
      const sourceModelId =
        readOptionalString(finalJobPayload?.modelId) ??
        readOptionalString(parentDraftJobPayload?.modelId);
      const sourceModelSource =
        readOptionalString(finalJobPayload?.modelSource) ??
        readOptionalString(parentDraftJobPayload?.modelSource);
      const sourceRuntimeBindingReadinessStatus =
        readRuntimeBindingReadinessStatus(
          finalJobPayload?.runtimeBindingReadinessStatus,
        ) ??
        readRuntimeBindingReadinessStatus(
          parentDraftJobPayload?.runtimeBindingReadinessStatus,
        );
      const knownKnowledgeItemIds = [
        ...new Set([
          ...readStringArray(finalJobPayload?.knowledgeItemIds),
          ...readStringArray(parentDraftJobPayload?.knowledgeItemIds),
        ]),
      ];
      const normalizedDecisions = normalizeProofreadingConfirmationDecisions({
        issues: sourceProofreadingPlan.issues,
        corrections: sourceProofreadingPlan.corrections,
        decisions: input.confirmationDecisions,
      });
      assertPublishableProofreadingDecisions(normalizedDecisions);
      const confirmationSummary = summarizeProofreadingConfirmationDecisions(
        normalizedDecisions,
      );

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
          ...(finalJob?.id ? { sourceProofreadingJobId: finalJob.id } : {}),
          sourceManuscriptAssetId,
          ...buildProofreadingExecutionTruthPayload({
            executionMode: sourceExecutionMode,
            executionProfileId: sourceExecutionProfileId,
            retrievalPresetId: sourceRetrievalPresetId,
            runtimeBindingId: sourceRuntimeBindingId,
            routingPolicyVersionId: sourceRoutingPolicyVersionId,
            modelId: sourceModelId,
            modelSource: sourceModelSource,
            runtimeBindingReadinessStatus:
              sourceRuntimeBindingReadinessStatus,
          }),
          ...(sourceSnapshotId ? { sourceSnapshotId } : {}),
          confirmationSummary,
          confirmationDecisions: serializeProofreadingConfirmationDecisions(
            normalizedDecisions,
          ),
          writebackLedger: buildProofreadingWritebackLedger(normalizedDecisions),
        },
        attempt_count: 0,
        started_at: undefined,
        finished_at: undefined,
        error_message: undefined,
        created_at: timestamp,
        updated_at: timestamp,
      };
      await jobRepository.save(queuedJob);

      await this.editorialDocxTransformService.applyDeterministicRules({
        manuscriptId: input.manuscriptId,
        sourceAssetId: sourceManuscriptAssetId,
        outputStorageKey: input.storageKey,
        outputFileName: input.fileName,
        tableAutoApplyMode: "editing_safe_apply",
        rules: [],
        resolvedRules: [],
        tableSnapshots: [],
        aiReplacements: buildHumanFinalAiReplacements(normalizedDecisions),
      });

      const asset = await documentAssetService.createAsset({
        manuscriptId: input.manuscriptId,
        assetType: "human_final_docx",
        storageKey: input.storageKey,
        mimeType: DOCX_MIME,
        createdBy: input.requestedBy,
        fileName: input.fileName,
        parentAssetId: proofreadingAsset.id,
        sourceModule: "manual",
        sourceJobId: jobId,
      });

      if (
        this.reviewItemsService &&
        manuscript &&
        sourceSnapshotId &&
        normalizedDecisions.some(
          (decision) =>
            decision.action === "route_to_rule_candidate" ||
            decision.action === "route_to_knowledge_candidate",
        )
      ) {
        for (const decision of normalizedDecisions) {
          if (
            decision.action !== "route_to_rule_candidate" &&
            decision.action !== "route_to_knowledge_candidate"
          ) {
            continue;
          }

          const governedHit = await this.reviewItemsService.submitGovernedHit({
            manuscriptId: input.manuscriptId,
            manuscriptType: manuscript.manuscript_type,
            module: "proofreading",
            snapshotId: sourceSnapshotId,
            sourceAssetId: sourceManuscriptAssetId,
            feedbackCategory:
              decision.action === "route_to_knowledge_candidate"
                ? "missing_knowledge"
                : "missed_hit",
            feedbackText:
              decision.note ??
              `Human confirmed proofreading issue for ${decision.targetText}.`,
            title: `Proofreading confirmation ${decision.itemId}`,
            excerpt: decision.targetText,
            suggestion: decision.finalReplacementText,
            rationale: `Confirmed from proofreading asset ${proofreadingAsset.id}.`,
            candidatePosture: "candidate_change",
            decisionSource: "manual_feedback",
            relatedKnowledgeItemIds: knownKnowledgeItemIds,
            originPayload: {
              source: "proofreading_confirmation",
              proofreadingJobId: finalJob?.id,
              finalAssetId: proofreadingAsset.id,
              action: decision.action,
              itemId: decision.itemId,
            },
            createdBy: input.requestedBy,
          });

          await this.reviewItemsService.decideReviewItem({
            sourceKind: "governed_hit",
            id: governedHit.item.id,
            action: decision.action,
            requestedBy: input.requestedBy,
            requestedByRole: input.actorRole,
            title: governedHit.item.title,
            proposalText: decision.finalReplacementText,
          });
        }
      }

      const residualSourceBlocks = buildHumanConfirmationResidualSourceBlocks(
        normalizedDecisions,
      );
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
        residualObservationInput:
          this.residualLearningService &&
          manuscript &&
          sourceSnapshotId &&
          residualSourceBlocks.length > 0
            ? {
                manuscriptId: input.manuscriptId,
                manuscriptType: manuscript.manuscript_type,
                executionSnapshotId: sourceSnapshotId,
                jobId,
                outputAssetId: asset.id,
                knownRuleIds: [],
                knownKnowledgeItemIds,
                sourceBlocks: residualSourceBlocks,
              }
            : undefined,
        response: {
          job,
          asset,
        },
      };
    });

    if (committed.residualObservationInput) {
      await this.residualLearningService!.observeProofreadingResiduals(
        committed.residualObservationInput,
      );
    }

    return committed.response;
  }

  async saveConfirmationDraft(
    input: SaveProofreadingConfirmationDraftInput,
  ): Promise<ProofreadingConfirmationDraftSaveResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.proofreading");

    return this.transactionManager.withTransaction(async (context) => {
      const { jobRepository, assetRepository } = context;
      if (!jobRepository || !assetRepository) {
        throw new Error(
          "Proofreading confirmation draft persistence requires asset and job repositories.",
        );
      }

      const confirmationAsset = await assetRepository.findById(input.confirmationAssetId);
      const isConfirmationDraftAsset =
        confirmationAsset?.asset_type === "proofreading_draft_report";
      const isConfirmationFinalAsset =
        confirmationAsset?.asset_type === "final_proof_annotated_docx";
      if (
        !confirmationAsset ||
        confirmationAsset.manuscript_id !== input.manuscriptId ||
        (!isConfirmationDraftAsset && !isConfirmationFinalAsset)
      ) {
        throw new ProofreadingConfirmationAssetRequiredError(
          input.confirmationAssetId,
        );
      }

      const confirmationJob =
        confirmationAsset.source_job_id != null
          ? await jobRepository.findById(confirmationAsset.source_job_id)
          : undefined;
      if (!confirmationJob) {
        throw new Error(
          `Proofreading confirmation asset ${input.confirmationAssetId} is missing its source proofreading job.`,
        );
      }

      const confirmationJobPayload = asObject(confirmationJob.payload);
      const parentDraftAssetId =
        isConfirmationDraftAsset
          ? confirmationAsset.id
          : (readOptionalString(confirmationJobPayload?.parentAssetId) ??
            confirmationAsset.parent_asset_id);
      const parentDraftAsset =
        parentDraftAssetId != null
          ? await assetRepository.findById(parentDraftAssetId)
          : undefined;
      const parentDraftJob =
        parentDraftAsset?.source_job_id != null
          ? await jobRepository.findById(parentDraftAsset.source_job_id)
          : undefined;
      const parentDraftJobPayload = asObject(parentDraftJob?.payload);
      const sourceProofreadingPlan = extractProofreadingConfirmationSources({
        proofreadingPlan:
          confirmationJobPayload?.proofreadingPlan ??
          parentDraftJobPayload?.proofreadingPlan,
        proofreadingFindings:
          confirmationJobPayload?.proofreadingFindings ??
          parentDraftJobPayload?.proofreadingFindings,
      });
      const normalizedDecisions = normalizeProofreadingConfirmationDecisions({
        issues: sourceProofreadingPlan.issues,
        corrections: sourceProofreadingPlan.corrections,
        decisions: input.confirmationDecisions,
      });
      const confirmationSummary = summarizeProofreadingConfirmationDecisions(
        normalizedDecisions,
      );
      const timestamp = this.now().toISOString();
      const totalItems =
        sourceProofreadingPlan.issues.length > 0
          ? sourceProofreadingPlan.issues.length
          : sourceProofreadingPlan.corrections.length;
      const updatedJob: JobRecord = {
        ...confirmationJob,
        payload: {
          ...(confirmationJob.payload ?? {}),
          confirmationDraft: {
            assetId: input.confirmationAssetId,
            ...(parentDraftJob?.id && parentDraftJob.id !== confirmationJob.id
              ? {
                  sourceProofreadingJobId: parentDraftJob.id,
                }
              : {}),
            totalItems,
            savedDecisionCount: normalizedDecisions.length,
            updatedAt: timestamp,
            confirmationSummary,
            confirmationDecisions: normalizedDecisions.map((decision) => ({
              itemId: decision.itemId,
              action: decision.action,
              targetText: decision.targetText,
              replacementText: decision.replacementText,
              finalReplacementText: decision.finalReplacementText,
              note: decision.note,
            })),
          },
        },
        updated_at: timestamp,
      };
      await jobRepository.save(updatedJob);

      return {
        job: updatedJob,
      };
    });
  }

  async getGovernanceHandoff(input: {
    manuscriptId: string;
    snapshotId?: string;
    actorRole: RoleKey;
  }): Promise<ProofreadingGovernanceHandoff> {
    this.permissionGuard.assert(input.actorRole, "workbench.proofreading");

    const manuscriptId = input.manuscriptId.trim();
    const snapshotId = input.snapshotId?.trim() ?? "";
    if (manuscriptId.length === 0) {
      return {
        residualReviewItems: [],
        ruleCandidates: [],
        knowledgeCandidates: [],
      };
    }

    if (!this.learningService) {
      throw new ProofreadingServiceDependencyRequiredError("learningService");
    }
    if (
      snapshotId.length > 0 &&
      typeof this.learningService.listLearningCandidateSourceLinksByCandidateId !==
        "function"
    ) {
      throw new ProofreadingServiceDependencyRequiredError(
        "learningService.listLearningCandidateSourceLinksByCandidateId",
      );
    }

    const residualLearningService = this.residualLearningService;
    if (!residualLearningService?.listIssues) {
      throw new ProofreadingServiceDependencyRequiredError("residualLearningService");
    }
    const learningService = this.learningService;

    const listScopedCandidates = async (
      type: "rule_candidate" | "knowledge_candidate",
    ): Promise<LearningCandidateRecord[]> => {
      const candidates = (
        await learningService.listLearningCandidates({
          manuscriptId,
          module: "proofreading",
          type,
          status: "pending_review",
          governedProvenanceKinds: ["residual_issue", "human_feedback"],
        })
      ).filter((candidate) => candidate.type === type);
      if (snapshotId.length === 0) {
        return candidates;
      }

      return (
        await Promise.all(
          candidates.map(async (candidate) => {
            const sourceLinks =
              await learningService.listLearningCandidateSourceLinksByCandidateId(
                candidate.id,
              );
            return sourceLinks.some(
              (sourceLink) =>
                sourceLink.snapshot_kind === "execution_snapshot" &&
                sourceLink.snapshot_id === snapshotId,
            )
              ? candidate
              : undefined;
          }),
        )
      ).filter((candidate): candidate is LearningCandidateRecord => !!candidate);
    };

    const [residualIssues, ruleCandidates, knowledgeCandidates] = await Promise.all([
      residualLearningService.listIssues(),
      listScopedCandidates("rule_candidate"),
      listScopedCandidates("knowledge_candidate"),
    ]);

    return {
      residualReviewItems: residualIssues
        .filter((issue) => issue.module === "proofreading")
        .filter((issue) => issue.manuscript_id === manuscriptId)
        .filter((issue) =>
          snapshotId.length > 0 ? issue.execution_snapshot_id === snapshotId : true,
        )
        .filter(shouldIncludeProofreadingGovernanceHandoffIssue)
        .map((issue) => mapResidualIssueToReviewItem(issue))
        .sort(compareReviewItems),
      ruleCandidates,
      knowledgeCandidates,
    };
  }

  private async runProofreadingJob(input: {
    manuscriptId: string;
    requestedBy: string;
    actorRole: RoleKey;
    storageKey: string;
    fileName?: string;
    parentAssetId: string;
    sourceManuscriptAssetId?: string;
    assetType: "proofreading_draft_report" | "final_proof_annotated_docx";
    mimeType: string;
    jobType: "proofreading_draft_run" | "proofreading_confirm";
    executionMode?: ModuleExecutionMode;
    pinnedContext?: ResolvedProofreadingExecutionContext;
  }): Promise<ProofreadingRunResult> {
    const queuedTimestamp = this.now().toISOString();
    const jobId = this.createId();
    const queuedJob: JobRecord = {
      id: jobId,
      manuscript_id: input.manuscriptId,
      module: "proofreading",
      job_type: input.jobType,
      status: "queued",
      requested_by: input.requestedBy,
      payload: {
        parentAssetId: input.parentAssetId,
        sourceManuscriptAssetId:
          input.sourceManuscriptAssetId ?? input.parentAssetId,
      },
      attempt_count: 0,
      started_at: undefined,
      finished_at: undefined,
      error_message: undefined,
      created_at: queuedTimestamp,
      updated_at: queuedTimestamp,
    };

    const committed = await runControlledModuleJob({
      controller: this.moduleExecutionConcurrencyController,
      module: "proofreading",
      jobRepository: this.jobRepository,
      queuedJob,
      now: this.now,
      run: (runningJob) =>
        this.transactionManager.withTransaction(async (context) => {
          const { jobRepository } = context;
          if (!jobRepository) {
            throw new Error("Proofreading runs require a job repository.");
          }
          const documentAssetService = this.documentAssetService.createScoped({
            manuscriptRepository: context.manuscriptRepository,
            assetRepository: context.assetRepository,
          });

      const manuscript = await context.manuscriptRepository.findById(
        input.manuscriptId,
      );
      const resolvedContext = input.pinnedContext
        ? input.pinnedContext
        : await this.resolveDraftExecutionContext({
            manuscriptId: input.manuscriptId,
            requestedBy: input.requestedBy,
            actorRole: input.actorRole,
            jobId,
            executionMode: input.executionMode,
          });
      const sourceAsset = await context.assetRepository.findById(input.parentAssetId);
      const proofreadingArtifacts =
        input.jobType === "proofreading_draft_run"
          ? await this.buildProofreadingFindings({
              manuscriptId: input.manuscriptId,
              parentAssetId: input.parentAssetId,
              resolvedContext,
            })
          : undefined;
      const proofreadingFindings = proofreadingArtifacts?.inspectionResult;
      const proofreadingPromptTemplate =
        input.jobType === "proofreading_draft_run"
          ? await this.promptSkillRegistryRepository.findPromptTemplateById(
              resolvedContext.promptTemplateId,
            )
          : undefined;
      const proofreadingKnowledgeHits =
        input.jobType === "proofreading_draft_run"
          ? await Promise.all(
              resolvedContext.knowledgeHits.map(async (hit) => {
                const knowledgeItem =
                  (await this.knowledgeRepository.findApprovedById(
                    hit.knowledgeItemId,
                  )) ??
                  (await this.knowledgeRepository.findById(hit.knowledgeItemId));
                return {
                  knowledgeItemId: hit.knowledgeItemId,
                  ...(knowledgeItem?.title
                    ? {
                        title: knowledgeItem.title,
                      }
                    : {}),
                  ...(knowledgeItem?.summary
                    ? {
                        summary: knowledgeItem.summary,
                      }
                    : {}),
                  ...(knowledgeItem?.canonical_text
                    ? {
                        canonicalText: knowledgeItem.canonical_text,
                      }
                    : {}),
                  ...(hit.matchReasons.length > 0
                    ? {
                        matchReasons: [...hit.matchReasons],
                      }
                    : {}),
                };
              }),
            )
          : [];
      const proofreadingPlan =
        input.jobType === "proofreading_draft_run"
          ? (structuredClone(
              await this.proofreadingAiPlanService.createPlan({
                manuscriptId: input.manuscriptId,
                sourceFileName:
                  sourceAsset?.file_name ?? input.fileName ?? input.parentAssetId,
                sourceBlocks: proofreadingArtifacts?.sourceBlocks,
                governedFailedChecks: proofreadingFindings?.failedChecks,
                governedManualReviewItems:
                  proofreadingFindings?.manualReviewItems,
                qualityIssues: proofreadingFindings?.qualityFindings,
                knowledgeHits: proofreadingKnowledgeHits,
                promptGuardrails: {
                  roleLabel: "医学稿件终校审校员",
                  systemInstructions:
                    proofreadingPromptTemplate?.system_instructions,
                  taskFrame: proofreadingPromptTemplate?.task_frame,
                  manualReviewPolicy:
                    proofreadingPromptTemplate?.manual_review_policy,
                  forbiddenOperations:
                    proofreadingPromptTemplate?.forbidden_operations,
                  outputContract: proofreadingPromptTemplate?.output_contract,
                },
                governanceContext: buildAiGovernanceContext({
                  hardRuleSummary:
                    resolvedContext.instructionPayload?.hardRuleSummary,
                  allowedContentOperations:
                    resolvedContext.instructionPayload?.allowedContentOperations,
                  forbiddenOperations:
                    resolvedContext.instructionPayload?.forbiddenOperations,
                  manualReviewPolicy:
                    resolvedContext.instructionPayload?.manualReviewPolicy,
                  promptSnippets:
                    resolvedContext.instructionPayload?.promptSnippets,
                  manualReviewItems:
                    resolvedContext.instructionPayload?.manualReviewItems.map(
                      (item) => `${item.ruleId}: ${item.reason}`,
                    ),
                  contentRuleCandidates:
                    resolvedContext.instructionPayload?.contentRuleCandidates.map(
                      (item) => `${item.ruleId}: ${item.actionKind}`,
                    ),
                  resolvedRules: resolvedContext.resolvedRules,
                  knowledgeHits: resolvedContext.knowledgeHits,
                }),
              }),
            ) as ProofreadingAiPlan)
          : undefined;
      const storedProofreadingPlan = proofreadingPlan
        ? buildStoredProofreadingPlan(proofreadingPlan)
        : undefined;
      const reportMarkdown =
        input.jobType === "proofreading_draft_run" && proofreadingFindings
          ? renderProofreadingReport(proofreadingFindings, storedProofreadingPlan)
          : undefined;

      if (
        input.assetType === "proofreading_draft_report" &&
        reportMarkdown &&
        this.textAssetRootDir
      ) {
        await this.textAssetMaterializer({
          rootDir: this.textAssetRootDir,
          storageKey: input.storageKey,
          content: reportMarkdown,
        });
      }

      const executionLog =
        resolvedContext.executionMode === "governed" &&
        !input.pinnedContext?.agentExecutionLogId
          ? await this.agentExecutionService.createLog({
              manuscriptId: input.manuscriptId,
              module: "proofreading",
              triggeredBy: input.requestedBy,
              runtimeId: resolvedContext.agentRuntimeId!,
              sandboxProfileId: resolvedContext.sandboxProfileId!,
              agentProfileId: resolvedContext.agentProfileId!,
              runtimeBindingId: resolvedContext.runtimeBindingId!,
              toolPermissionPolicyId: resolvedContext.toolPermissionPolicyId!,
              routingPolicyVersionId: resolvedContext.routingPolicyVersionId,
              routingPolicyScopeKind: resolvedContext.routingPolicyScopeKind,
              routingPolicyScopeValue: resolvedContext.routingPolicyScopeValue,
              resolvedModelId: resolvedContext.modelId,
              fallbackModelId: resolvedContext.fallbackModelId,
              knowledgeItemIds: resolvedContext.knowledgeHits.map(
                (hit) => hit.knowledgeItemId,
              ),
              verificationCheckProfileIds:
                resolvedContext.verificationCheckProfileIds,
              evaluationSuiteIds: resolvedContext.evaluationSuiteIds,
              releaseCheckProfileId: resolvedContext.releaseCheckProfileId,
            })
          : undefined;
      const agentExecutionLogId =
        input.pinnedContext?.agentExecutionLogId ?? executionLog?.id;

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
        qualityPackages: proofreadingFindings?.resolvedQualityPackages,
        createdAssetIds: [asset.id],
        agentExecutionLogId,
        draftSnapshotId: resolvedContext.draftSnapshotId,
        qualityFindingsSummary: proofreadingFindings?.qualityFindingSummary
          ? structuredClone(proofreadingFindings.qualityFindingSummary)
          : undefined,
        knowledgeHits: resolvedContext.knowledgeHits,
      });
      if (agentExecutionLogId) {
        await this.agentExecutionService.completeLog({
          logId: agentExecutionLogId,
          executionSnapshotId: snapshot.id,
        });
      }
      const recordedExecutionGovernedHits =
        this.reviewItemsService && proofreadingFindings
          ? await this.reviewItemsService.recordExecutionGovernedHits({
              manuscriptId: input.manuscriptId,
              manuscriptType: manuscript!.manuscript_type,
              module: "proofreading",
              snapshotId: snapshot.id,
              sourceAssetId: input.parentAssetId,
              createdBy: input.requestedBy,
              items: buildProofreadingExecutionGovernedHitInputs({
                failedChecks: proofreadingFindings.failedChecks,
                manualReviewItems: proofreadingFindings.manualReviewItems,
                qualityFindings: proofreadingFindings.qualityFindings ?? [],
              }),
            })
          : [];
      const reviewItemIdBySourceKey = new Map(
        recordedExecutionGovernedHits.map((entry) => [
          entry.sourceKey,
          entry.item.id,
        ]),
      );
      const completedProofreadingFindings = proofreadingFindings
        ? annotateProofreadingInspectionResult(
            proofreadingFindings,
            reviewItemIdBySourceKey,
          )
        : undefined;

      const finishedTimestamp = this.now().toISOString();
      const completedJob: JobRecord = {
        ...runningJob,
        status: "completed",
        payload: {
          ...runningJob.payload,
          ...buildProofreadingExecutionTruthPayload({
            executionMode: resolvedContext.executionMode,
            executionProfileId: resolvedContext.executionProfileId,
            retrievalPresetId: resolvedContext.retrievalPresetId,
            runtimeBindingId: resolvedContext.runtimeBindingId,
            routingPolicyVersionId: resolvedContext.routingPolicyVersionId,
            modelId: resolvedContext.modelId,
            modelSource: resolvedContext.modelSource,
            runtimeBindingReadinessStatus:
              resolvedContext.runtimeBindingReadinessStatus,
          }),
          templateId: resolvedContext.templateId,
          promptTemplateId: resolvedContext.promptTemplateId,
          skillPackageIds: resolvedContext.skillPackageIds,
          knowledgeItemIds: resolvedContext.knowledgeHits.map(
            (hit) => hit.knowledgeItemId,
          ),
          ...(resolvedContext.agentRuntimeId
            ? {
                agentRuntimeId: resolvedContext.agentRuntimeId,
              }
            : {}),
          ...(resolvedContext.sandboxProfileId
            ? {
                sandboxProfileId: resolvedContext.sandboxProfileId,
              }
            : {}),
          ...(resolvedContext.agentProfileId
            ? {
                agentProfileId: resolvedContext.agentProfileId,
              }
            : {}),
          ...(resolvedContext.runtimeBindingId
            ? {
                runtimeBindingId: resolvedContext.runtimeBindingId,
              }
            : {}),
          ...(resolvedContext.toolPermissionPolicyId
            ? {
                toolPermissionPolicyId: resolvedContext.toolPermissionPolicyId,
              }
            : {}),
          ...(agentExecutionLogId
            ? {
                agentExecutionLogId,
              }
            : {}),
          ...(resolvedContext.draftSnapshotId
            ? { draftSnapshotId: resolvedContext.draftSnapshotId }
            : {}),
          ...(resolvedContext.ruleSetId
            ? {
                ruleSetId: resolvedContext.ruleSetId,
              }
            : {}),
          ...(resolvedContext.rules && resolvedContext.rules.length > 0
            ? {
                rules: resolvedContext.rules.map((rule) => structuredClone(rule)),
              }
            : {}),
          ...(resolvedContext.resolvedRules && resolvedContext.resolvedRules.length > 0
            ? {
                resolvedRules: resolvedContext.resolvedRules.map((entry) =>
                  structuredClone(entry),
                ),
              }
            : {}),
          ...(resolvedContext.instructionPayload
            ? {
                instructionPayload: {
                  ...resolvedContext.instructionPayload,
                  allowedContentOperations: [
                    ...resolvedContext.instructionPayload.allowedContentOperations,
                  ],
                  forbiddenOperations: [
                    ...resolvedContext.instructionPayload.forbiddenOperations,
                  ],
                  promptSnippets: [
                    ...resolvedContext.instructionPayload.promptSnippets,
                  ],
                },
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
          ...(completedProofreadingFindings
            ? {
                proofreadingFindings: completedProofreadingFindings,
                manualReviewItems: completedProofreadingFindings.manualReviewItems.map(
                  (item) => ({
                    ...item,
                  }),
                ),
              }
            : {}),
          snapshotId: snapshot.id,
          outputAssetId: asset.id,
          outputAssetType: input.assetType,
          ...(storedProofreadingPlan
            ? {
                proofreadingPlan: storedProofreadingPlan,
                proofreadingSourceBlocks: proofreadingArtifacts?.sourceBlocks.map(
                  (block) => structuredClone(block),
                ),
              }
            : {}),
          sourceManuscriptAssetId:
            input.sourceManuscriptAssetId ?? input.parentAssetId,
        },
        attempt_count: 1,
        started_at: runningJob.started_at,
        finished_at: finishedTimestamp,
        updated_at: finishedTimestamp,
      };
      await jobRepository.save(completedJob);

      return {
        shouldDispatchOrchestration:
          resolvedContext.executionMode === "governed" &&
          input.jobType === "proofreading_confirm" &&
          !!agentExecutionLogId,
        agentExecutionLogId,
        residualObservationInput:
          shouldObserveProofreadingResiduals({
            residualLearningService: this.residualLearningService,
            executionMode: resolvedContext.executionMode,
            jobType: input.jobType,
            manuscriptType: manuscript?.manuscript_type,
            proofreadingArtifacts,
          })
            ? {
                manuscriptId: input.manuscriptId,
                manuscriptType: manuscript!.manuscript_type,
                executionSnapshotId: snapshot.id,
                jobId,
                ...(agentExecutionLogId
                  ? { agentExecutionLogId }
                  : {}),
                outputAssetId: asset.id,
                executionProfileId: resolvedContext.executionProfileId,
                ...(resolvedContext.runtimeBindingId
                  ? { runtimeBindingId: resolvedContext.runtimeBindingId }
                  : {}),
                promptTemplateId: resolvedContext.promptTemplateId,
                knownRuleIds: collectKnownRuleIds(resolvedContext),
                knownKnowledgeItemIds: resolvedContext.knowledgeHits.map(
                  (hit) => hit.knowledgeItemId,
                ),
                qualityIssues: completedProofreadingFindings?.qualityFindings,
                sourceBlocks: buildResidualObservationSourceBlocks({
                  sourceBlocks: proofreadingArtifacts!.sourceBlocks,
                  proofreadingPlan,
                }),
              }
            : undefined,
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
          ...(resolvedContext.agentRuntimeId
            ? {
                agent_runtime_id: resolvedContext.agentRuntimeId,
              }
            : {}),
          ...(resolvedContext.agentProfileId
            ? {
                agent_profile_id: resolvedContext.agentProfileId,
              }
            : {}),
          ...(agentExecutionLogId
            ? {
                agent_execution_log_id: agentExecutionLogId,
              }
            : {}),
        },
      };
        }),
    });

    if (committed.residualObservationInput) {
      await this.residualLearningService!.observeProofreadingResiduals(
        committed.residualObservationInput,
      );
    }

    if (committed.shouldDispatchOrchestration) {
      await dispatchGovernedOrchestrationBestEffort({
        orchestrationService: this.agentExecutionOrchestrationService,
        agentExecutionLogId: committed.agentExecutionLogId,
      });
    }

    return committed.response;
  }

  private async createProofreadingManuscriptAsset(input: {
    manuscriptId: string;
    requestedBy: string;
    sourceJobId: string;
    sourceAssetId: string;
    reportAssetId: string;
    reportStorageKey: string;
    reportFileName?: string;
    proofreadingPlan: ProofreadingAiPlan;
    documentAssetService: DocumentAssetService;
  }): Promise<DocumentAssetRecord> {
    const manuscriptTarget = deriveProofreadingManuscriptTarget({
      reportStorageKey: input.reportStorageKey,
      reportFileName: input.reportFileName,
    });

    await this.editorialDocxTransformService.applyDeterministicRules({
      manuscriptId: input.manuscriptId,
      sourceAssetId: input.sourceAssetId,
      outputStorageKey: manuscriptTarget.storageKey,
      outputFileName: manuscriptTarget.fileName,
      tableAutoApplyMode: "editing_safe_apply",
      rules: [],
      resolvedRules: [],
      tableSnapshots: [],
      aiReplacements: (input.proofreadingPlan.corrections ?? []).map(
        (correction: ProofreadingLegacyCorrection) => ({
          targetText: correction.targetText,
          replacementText: correction.replacementText,
          reason: correction.category ?? "proofreading_issue",
        }),
      ),
    });

    return input.documentAssetService.createAsset({
      manuscriptId: input.manuscriptId,
      assetType: "final_proof_annotated_docx",
      storageKey: manuscriptTarget.storageKey,
      mimeType: DOCX_MIME,
      createdBy: input.requestedBy,
      fileName: manuscriptTarget.fileName,
      parentAssetId: input.reportAssetId,
      sourceModule: "proofreading",
      sourceJobId: input.sourceJobId,
    });
  }

  private async resolveDraftExecutionContext(input: {
    manuscriptId: string;
    requestedBy: string;
    actorRole: RoleKey;
    jobId: string;
    executionMode?: ModuleExecutionMode;
  }): Promise<ResolvedProofreadingExecutionContext> {
    if (resolveModuleExecutionMode(input.executionMode) === "bare") {
      const bareContext = await resolveBareModuleContext({
        manuscriptId: input.manuscriptId,
        module: "proofreading",
        jobId: input.jobId,
        actorId: input.requestedBy,
        actorRole: input.actorRole,
        manuscriptRepository: this.manuscriptRepository,
        aiGatewayService: this.aiGatewayService,
      });

      return {
        executionMode: "bare",
        executionProfileId: bareContext.executionProfileId,
        templateId: bareContext.moduleTemplateId,
        moduleTemplateVersionNo: bareContext.moduleTemplateVersionNo,
        promptTemplateId: bareContext.promptTemplateId,
        promptTemplateVersion: bareContext.promptTemplateVersion,
        skillPackageIds: bareContext.skillPackageIds,
        skillPackageVersions: bareContext.skillPackageVersions,
        knowledgeHits: bareContext.knowledgeHits,
        modelId: bareContext.modelSelection.model.id,
        fallbackModelId: bareContext.modelSelection.fallback_chain[0]?.id,
        modelVersion: bareContext.modelSelection.model.model_version,
        modelSource: bareContext.modelSelection.layer,
        routingPolicyVersionId: bareContext.modelSelection.policy_version_id,
        routingPolicyScopeKind: bareContext.modelSelection.policy_scope_kind,
        routingPolicyScopeValue: bareContext.modelSelection.policy_scope_value,
        verificationCheckProfileIds: bareContext.verificationCheckProfileIds,
        evaluationSuiteIds: bareContext.evaluationSuiteIds,
        qualityPackageVersionIds: bareContext.qualityPackageVersionIds,
      };
    }

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

    return {
      executionMode: "governed",
      executionProfileId: governedContext.executionProfile.id,
      templateId: moduleContext.moduleTemplate.id,
      moduleTemplateVersionNo: moduleContext.moduleTemplate.version_no,
      promptTemplateId: moduleContext.promptTemplate.id,
      promptTemplateVersion: moduleContext.promptTemplate.version,
      skillPackageIds: moduleContext.skillPackages.map((record) => record.id),
      skillPackageVersions: moduleContext.skillPackages.map(
        (record) => record.version,
      ),
      instructionPayload: assembleInstructionTemplate({
        promptTemplate: moduleContext.promptTemplate,
        ruleSet: moduleContext.ruleSet,
        rules: moduleContext.rules,
        knowledgeSelections: moduleContext.knowledgeSelections,
        manualReviewPolicy: moduleContext.manualReviewPolicy,
      }),
      manualReviewPolicy: moduleContext.manualReviewPolicy,
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
      retrievalPresetId: moduleContext.retrievalPreset?.id,
      modelId: moduleContext.modelSelection.model.id,
      fallbackModelId: moduleContext.modelSelection.fallback_chain[0]?.id,
      modelVersion: moduleContext.modelSelection.model.model_version,
      modelSource: moduleContext.modelSelection.layer,
      routingPolicyVersionId: moduleContext.modelSelection.policy_version_id,
      routingPolicyScopeKind: moduleContext.modelSelection.policy_scope_kind,
      routingPolicyScopeValue: moduleContext.modelSelection.policy_scope_value,
      agentRuntimeId: governedContext.runtime.id,
      sandboxProfileId: governedContext.sandboxProfile.id,
      agentProfileId: governedContext.agentProfile.id,
      runtimeBindingId: governedContext.runtimeBinding.id,
      runtimeBindingReadinessStatus:
        governedContext.runtimeBindingReadiness.observation_status === "reported"
          ? governedContext.runtimeBindingReadiness.report?.status
          : undefined,
      toolPermissionPolicyId: governedContext.toolPolicy.id,
      verificationCheckProfileIds:
        governedContext.verificationExpectations.verification_check_profile_ids,
      evaluationSuiteIds:
        governedContext.verificationExpectations.evaluation_suite_ids,
      releaseCheckProfileId:
        governedContext.verificationExpectations.release_check_profile_id,
      qualityPackageVersionIds: [
        ...(governedContext.runtimeBinding.quality_package_version_ids ?? []),
      ],
    };
  }

  private async loadPinnedDraftExecutionContext(
    draftJob: JobRecord | undefined,
  ): Promise<ResolvedProofreadingExecutionContext | undefined> {
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
    const draftExecutionMode = extractModuleExecutionMode(draftJob);
    const draftJobPayload = asObject(draftJob?.payload);
    const draftExecutionLog = await this.loadDraftExecutionLog(draftJob);
    const draftRetrievalPresetId = readOptionalString(
      draftJobPayload?.retrievalPresetId,
    );
    const draftModelSource = readOptionalString(draftJobPayload?.modelSource);
    const draftRuntimeBindingReadinessStatus = readRuntimeBindingReadinessStatus(
      draftJobPayload?.runtimeBindingReadinessStatus,
    );

    if (!draftExecutionLog) {
      if (draftExecutionMode !== "bare") {
        return undefined;
      }

      return {
        executionMode: "bare",
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
        retrievalPresetId: draftRetrievalPresetId,
        modelSource: draftModelSource,
        draftSnapshotId: snapshot.id,
        verificationCheckProfileIds: [],
        evaluationSuiteIds: [],
        runtimeBindingReadinessStatus: draftRuntimeBindingReadinessStatus,
        qualityPackageVersionIds:
          snapshot.quality_packages?.map((entry) => entry.package_id) ?? [],
      };
    }

    // Final confirmation must stay pinned to the reviewed draft governance context.
    return {
      executionMode: "governed",
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
      fallbackModelId: draftExecutionLog.fallback_model_id,
      modelVersion: snapshot.model_version,
      retrievalPresetId: draftRetrievalPresetId,
      modelSource: draftModelSource,
      routingPolicyVersionId: draftExecutionLog.routing_policy_version_id,
      routingPolicyScopeKind: draftExecutionLog.routing_policy_scope_kind,
      routingPolicyScopeValue: draftExecutionLog.routing_policy_scope_value,
      draftSnapshotId: snapshot.id,
      agentRuntimeId: draftExecutionLog.runtime_id,
      sandboxProfileId: draftExecutionLog.sandbox_profile_id,
      agentProfileId: draftExecutionLog.agent_profile_id,
      runtimeBindingId: draftExecutionLog.runtime_binding_id,
      runtimeBindingReadinessStatus: draftRuntimeBindingReadinessStatus,
      toolPermissionPolicyId: draftExecutionLog.tool_permission_policy_id,
      verificationCheckProfileIds: [
        ...draftExecutionLog.verification_check_profile_ids,
      ],
      evaluationSuiteIds: [...draftExecutionLog.evaluation_suite_ids],
      releaseCheckProfileId: draftExecutionLog.release_check_profile_id,
      agentExecutionLogId: draftExecutionLog.id,
      qualityPackageVersionIds:
        snapshot.quality_packages?.map((entry) => entry.package_id) ?? [],
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
    resolvedContext: ResolvedProofreadingExecutionContext;
  }): Promise<ProofreadingRunArtifacts> {
    const blocks = await this.proofreadingSourceBlockResolver.resolveBlocks({
      manuscriptId: input.manuscriptId,
      assetId: input.parentAssetId,
    });
    const sourceBlocks = normalizeProofreadingSourceBlocks(blocks);
    const sourceAsset = await this.assetRepository.findById(input.parentAssetId);
    const documentStructureSnapshot = this.documentStructureService
      ? await this.documentStructureService.extract({
          manuscriptId: input.manuscriptId,
          assetId: input.parentAssetId,
          fileName: sourceAsset?.file_name ?? input.parentAssetId,
        })
      : undefined;
    const proofreadingFindings = inspectProofreadingRules({
      blocks: sourceBlocks,
      rules: input.resolvedContext.rules ?? [],
      resolvedRules: input.resolvedContext.resolvedRules,
      tableSnapshots: documentStructureSnapshot?.tables ?? [],
      manualReviewPolicy: input.resolvedContext.manualReviewPolicy,
    });
    const qualityRun = this.manuscriptQualityService
      ? await this.manuscriptQualityService.runChecks({
          blocks: blocks.map((block) => ({
            text: block.text,
            style: block.block_kind,
          })),
          requestedScopes: ["general_proofreading", "medical_specialized"],
          targetModule: "proofreading",
          tableSnapshots: documentStructureSnapshot?.tables ?? [],
          qualityPackageVersionIds: input.resolvedContext.qualityPackageVersionIds,
        })
      : undefined;
    const resolvedQualityPackages = qualityRun?.resolved_quality_packages?.map(
      (entry) => ({
        package_id: entry.package_id,
        package_name: entry.package_name,
        package_kind: entry.package_kind,
        target_scopes: [...entry.target_scopes],
        version: entry.version,
      }),
    );
    const objectRiskItems = buildProofreadingObjectRiskItems(
      documentStructureSnapshot?.objects ?? [],
    );

    return {
      inspectionResult: {
        ...proofreadingFindings,
        riskItems: [...proofreadingFindings.riskItems, ...objectRiskItems],
        ...(qualityRun
          ? {
              qualityFindings: qualityRun.issues.map((issue) =>
                structuredClone(issue),
              ),
              qualityFindingSummary: structuredClone(
                qualityRun.quality_findings_summary,
              ),
              ...(resolvedQualityPackages
                ? {
                    resolvedQualityPackages,
                  }
                : {}),
            }
          : {}),
      },
      sourceBlocks,
    };
  }
}

interface ProofreadingPlanIssueSeed extends ProofreadingIssue {}

interface ProofreadingPlanCorrectionSeed {
  itemId: string;
  targetText: string;
  replacementText: string;
  category?: string;
}

interface NormalizedProofreadingConfirmationDecision {
  itemId: string;
  targetText: string;
  replacementText: string;
  finalReplacementText?: string;
  action:
    | "accepted"
    | "accepted_with_manual_edit"
    | "rejected"
    | "manual_only"
    | "escalated"
    | "route_to_rule_candidate"
    | "route_to_knowledge_candidate";
  category?: string;
  note?: string;
  severity: "critical" | "high" | "medium" | "low";
  issueType: string;
  source: string;
  blocksFinal: boolean;
  anchor?: ProofreadingIssueAnchor;
  suggestionAction?: ProofreadingSuggestionAction;
}

function extractProofreadingConfirmationSources(input: {
  proofreadingPlan: unknown;
  proofreadingFindings: unknown;
}): {
  issues: ProofreadingPlanIssueSeed[];
  corrections: ProofreadingPlanCorrectionSeed[];
} {
  const plan = extractProofreadingPlan(input.proofreadingPlan);
  const governedIssues = extractProofreadingGovernedConfirmationIssues(
    input.proofreadingFindings,
  );
  const issues = dedupeProofreadingConfirmationIssues([
    ...plan.issues,
    ...governedIssues,
  ]);

  return {
    issues,
    corrections: issuesToCorrectionSeeds(issues),
  };
}

function extractProofreadingPlan(value: unknown): {
  issues: ProofreadingPlanIssueSeed[];
  corrections: ProofreadingPlanCorrectionSeed[];
} {
  const payload = asObject(value);
  const issues = Array.isArray(payload?.issues)
    ? payload.issues
        .flatMap((entry, index) => {
          const issue = normalizeSerializedProofreadingIssue(entry, index);
          return issue ? [issue] : [];
        })
    : [];

  if (issues.length > 0) {
    return {
      issues,
      corrections: issuesToCorrectionSeeds(issues),
    };
  }

  const corrections = Array.isArray(payload?.corrections)
    ? payload.corrections
        .flatMap((entry, index) => {
          const correction = asObject(entry);
          const targetText = readOptionalString(correction?.targetText);
          const replacementText = readOptionalString(correction?.replacementText);
          if (!targetText || !replacementText) {
            return [];
          }

          return [
            {
              itemId: `correction-${index + 1}`,
              targetText,
              replacementText,
              category: readOptionalString(correction?.category),
            } satisfies ProofreadingPlanCorrectionSeed,
          ];
        })
    : [];

  return {
    issues: corrections.map((correction, index) => ({
      itemId: correction.itemId,
      title: correction.category
        ? `${correction.category} issue`
        : `Legacy proofreading issue ${index + 1}`,
      description: correction.targetText,
      severity: "medium",
      source: "legacy_correction",
      issueType: correction.category ?? "legacy_proofreading_correction",
      blocksFinal: false,
      anchor: {
        blockIndex: index,
        quote: correction.targetText,
      },
      suggestion: {
        action: "replace_text",
        replacementText: correction.replacementText,
      },
    })),
    corrections,
  };
}

function extractProofreadingGovernedConfirmationIssues(
  value: unknown,
): ProofreadingPlanIssueSeed[] {
  const payload = asObject(value);
  if (!payload) {
    return [];
  }

  const qualityIssues = Array.isArray(payload.qualityFindings)
    ? payload.qualityFindings.flatMap((entry, index) => {
        const issue = normalizeSerializedQualityFindingConfirmationIssue(
          entry,
          index,
        );
        return issue ? [issue] : [];
      })
    : [];
  const failedCheckIssues = Array.isArray(payload.failedChecks)
    ? payload.failedChecks.flatMap((entry, index) => {
        const issue = normalizeSerializedFailedCheckConfirmationIssue(
          entry,
          index,
        );
        return issue ? [issue] : [];
      })
    : [];

  return [...qualityIssues, ...failedCheckIssues];
}

function dedupeProofreadingConfirmationIssues(
  issues: readonly ProofreadingPlanIssueSeed[],
): ProofreadingPlanIssueSeed[] {
  const deduped = new Map<string, ProofreadingPlanIssueSeed>();
  for (const issue of issues) {
    if (!deduped.has(issue.itemId)) {
      deduped.set(issue.itemId, issue);
    }
  }
  return [...deduped.values()];
}

function normalizeSerializedQualityFindingConfirmationIssue(
  value: unknown,
  index: number,
): ProofreadingPlanIssueSeed | undefined {
  const finding = asObject(value);
  if (!finding) {
    return undefined;
  }

  const evidencePack = asObject(finding.evidence_pack);
  const targetText =
    readOptionalString(finding.text_excerpt) ??
    readOptionalString(finding.excerpt) ??
    readOptionalString(evidencePack?.excerpt);
  if (!targetText) {
    return undefined;
  }

  const replacementText =
    readOptionalString(finding.suggested_replacement) ??
    readOptionalString(finding.suggestion) ??
    readOptionalString(evidencePack?.suggestion);
  const issueType =
    readOptionalString(finding.issueType) ??
    readOptionalString(finding.issue_type) ??
    "quality";
  const severity =
    normalizeProofreadingConfirmationSeverity(finding.severity) ?? "medium";
  const qualityAction = readOptionalString(finding.action);

  return {
    itemId: readOptionalString(finding.id) ?? `quality-${index + 1}`,
    title:
      readOptionalString(finding.title) ??
      `Proofreading quality issue ${issueType} requires review`,
    description:
      readOptionalString(finding.explanation) ??
      readOptionalString(finding.summary) ??
      readOptionalString(evidencePack?.rationale) ??
      targetText,
    severity,
    source: "quality_check",
    issueType,
    blocksFinal:
      Boolean(finding.blocksFinal) ||
      qualityAction === "manual_review" ||
      qualityAction === "block" ||
      severity === "high" ||
      severity === "critical",
    anchor: buildProofreadingGovernedIssueAnchor({
      location: asObject(finding.location) ?? asObject(evidencePack?.location),
      fallbackIndex: index,
      targetText,
    }),
    ...(replacementText
      ? {
          suggestion: {
            action: "replace_text",
            replacementText,
          },
        }
      : {}),
  };
}

function normalizeSerializedFailedCheckConfirmationIssue(
  value: unknown,
  index: number,
): ProofreadingPlanIssueSeed | undefined {
  const failedCheck = asObject(value);
  if (!failedCheck) {
    return undefined;
  }

  const targetText =
    readOptionalString(failedCheck.actual) ??
    readOptionalString(failedCheck.excerpt);
  if (!targetText) {
    return undefined;
  }

  const replacementText =
    readOptionalString(failedCheck.expected) ??
    readOptionalString(failedCheck.suggestion);
  const ruleId = readOptionalString(failedCheck.ruleId);
  const severity =
    normalizeProofreadingConfirmationSeverity(failedCheck.severity) ?? "medium";

  return {
    itemId: ruleId ?? `failed-check-${index + 1}`,
    title: ruleId
      ? `Rule ${ruleId} requires manual review`
      : "Proofreading governed hit requires manual review",
    description:
      readOptionalString(failedCheck.explanation) ??
      readOptionalString(failedCheck.reason) ??
      targetText,
    severity,
    source: "quality_check",
    issueType: "failed_check",
    blocksFinal:
      Boolean(failedCheck.blocksFinal) ||
      severity === "high" ||
      severity === "critical",
    anchor: buildProofreadingGovernedIssueAnchor({
      location: asObject(failedCheck.location) ?? asObject(failedCheck.semantic_hit),
      fallbackIndex: index,
      targetText,
      preferredBlockIndex:
        typeof failedCheck.blockIndex === "number" &&
        Number.isInteger(failedCheck.blockIndex)
          ? failedCheck.blockIndex
          : undefined,
    }),
    ...(replacementText
      ? {
          suggestion: {
            action: "replace_text",
            replacementText,
          },
        }
      : {}),
  };
}

function buildProofreadingGovernedIssueAnchor(input: {
  location: Record<string, unknown> | undefined;
  fallbackIndex: number;
  targetText: string;
  preferredBlockIndex?: number;
}): ProofreadingIssueAnchor {
  const location = input.location;
  const blockIndex =
    input.preferredBlockIndex ??
    (location && typeof location.blockIndex === "number" &&
    Number.isInteger(location.blockIndex)
      ? location.blockIndex
      : undefined) ??
    (location && typeof location.block_index === "number" &&
    Number.isInteger(location.block_index)
      ? location.block_index
      : undefined) ??
    (location && typeof location.paragraph_index === "number" &&
    Number.isInteger(location.paragraph_index)
      ? location.paragraph_index
      : undefined) ??
    input.fallbackIndex;

  return {
    blockIndex,
    quote: input.targetText,
    ...(location && readOptionalString(location.sectionLabel)
      ? {
          sectionLabel: readOptionalString(location.sectionLabel),
        }
      : {}),
    ...(location && readOptionalString(location.blockKind)
      ? {
          blockKind: readOptionalString(location.blockKind),
        }
      : {}),
  };
}

function normalizeSerializedProofreadingIssue(
  value: unknown,
  index: number,
): ProofreadingPlanIssueSeed | undefined {
  const issue = asObject(value);
  if (!issue) {
    return undefined;
  }

  const anchor = normalizeSerializedProofreadingAnchor(issue.anchor, index);
  if (!anchor) {
    return undefined;
  }

  const suggestionPayload = asObject(issue.suggestion);
  const suggestionAction = normalizeSerializedSuggestionAction(
    suggestionPayload?.action,
  );

  return {
    itemId: readOptionalString(issue.itemId) ?? `issue-${index + 1}`,
    title: readOptionalString(issue.title) ?? `Issue ${index + 1}`,
    description: readOptionalString(issue.description) ?? anchor.quote,
    severity: normalizeSeverity(issue.severity) ?? "medium",
    source: normalizeIssueSource(issue.source) ?? "residual_ai",
    issueType: readOptionalString(issue.issueType) ?? "style",
    blocksFinal: Boolean(issue.blocksFinal),
    anchor,
    ...(suggestionAction
      ? {
          suggestion: {
            action: suggestionAction,
            ...(readOptionalString(suggestionPayload?.replacementText)
              ? {
                  replacementText: readOptionalString(
                    suggestionPayload?.replacementText,
                  ),
                }
              : {}),
            ...(readOptionalString(suggestionPayload?.note)
              ? {
                  note: readOptionalString(suggestionPayload?.note),
                }
              : {}),
          },
        }
      : {}),
  };
}

function normalizeSerializedProofreadingAnchor(
  value: unknown,
  fallbackIndex: number,
): ProofreadingIssueAnchor | undefined {
  const anchor = asObject(value);
  if (!anchor) {
    return undefined;
  }

  const blockIndex =
    typeof anchor.blockIndex === "number" && Number.isInteger(anchor.blockIndex)
      ? anchor.blockIndex
      : fallbackIndex;
  const quote = readOptionalString(anchor.quote);
  if (!quote) {
    return undefined;
  }

  return {
    blockIndex,
    quote,
    ...(readOptionalString(anchor.sectionLabel)
      ? {
          sectionLabel: readOptionalString(anchor.sectionLabel),
        }
      : {}),
    ...(readOptionalString(anchor.blockKind)
      ? {
          blockKind: readOptionalString(anchor.blockKind),
        }
      : {}),
    ...(normalizeSerializedProofreadingDocumentLocator(anchor.documentLocator)
      ? {
          documentLocator: normalizeSerializedProofreadingDocumentLocator(
            anchor.documentLocator,
          ),
        }
      : {}),
  };
}

function normalizeSerializedProofreadingDocumentLocator(
  value: unknown,
): ProofreadingIssueDocumentLocator | undefined {
  const locator = asObject(value);
  if (!locator) {
    return undefined;
  }

  const anchorKind = readOptionalString(locator.anchorKind);
  const anchorKey = readOptionalString(locator.anchorKey);
  if (!anchorKind || !anchorKey) {
    return undefined;
  }

  return {
    anchorKind: anchorKind as ProofreadingIssueDocumentLocator["anchorKind"],
    anchorKey,
    ...(readOptionalString(locator.confidence)
      ? {
          confidence:
            readOptionalString(locator.confidence) as ProofreadingIssueDocumentLocator["confidence"],
        }
      : {}),
    ...(typeof locator.blockIndex === "number" && Number.isInteger(locator.blockIndex)
      ? {
          blockIndex: locator.blockIndex,
        }
      : {}),
    ...(readOptionalString(locator.sectionLabel)
      ? {
          sectionLabel: readOptionalString(locator.sectionLabel),
        }
      : {}),
    ...(typeof locator.ordinalWithinSection === "number" &&
    Number.isInteger(locator.ordinalWithinSection)
      ? {
          ordinalWithinSection: locator.ordinalWithinSection,
        }
      : {}),
    ...(readOptionalString(locator.tableId)
      ? {
          tableId: readOptionalString(locator.tableId),
        }
      : {}),
    ...(readOptionalString(locator.tableTarget)
      ? {
          tableTarget: readOptionalString(locator.tableTarget),
        }
      : {}),
    ...(readOptionalString(locator.rowKey)
      ? {
          rowKey: readOptionalString(locator.rowKey),
        }
      : {}),
    ...(readOptionalString(locator.columnKey)
      ? {
          columnKey: readOptionalString(locator.columnKey),
        }
      : {}),
    ...(readOptionalString(locator.footnoteAnchor)
      ? {
          footnoteAnchor: readOptionalString(locator.footnoteAnchor),
        }
      : {}),
  };
}

function normalizeProofreadingConfirmationDecisions(input: {
  issues: readonly ProofreadingPlanIssueSeed[];
  corrections: readonly ProofreadingPlanCorrectionSeed[];
  decisions?: readonly ProofreadingConfirmationDecisionInput[];
}): NormalizedProofreadingConfirmationDecision[] {
  if (input.decisions && input.decisions.length > 0) {
    return input.decisions.map((decision, index) => {
      const normalizedAction =
        normalizeProofreadingDecisionAction(decision.action) ?? "manual_only";
      const matchingIssue =
        input.issues.find((issue) => issue.itemId === decision.itemId) ??
        input.issues.find(
          (issue) =>
            issue.anchor.quote === decision.targetText &&
            issue.suggestion?.replacementText === decision.replacementText,
        );
      const matchingCorrection =
        input.corrections.find((correction) => correction.itemId === decision.itemId) ??
        input.corrections.find(
          (correction) =>
            correction.targetText === decision.targetText &&
            correction.replacementText === decision.replacementText,
        );
      const finalReplacementText =
        normalizedAction === "rejected" ||
        normalizedAction === "manual_only" ||
        normalizedAction === "escalated"
          ? undefined
          : normalizeOptionalDecisionText(decision.editedReplacementText) ??
            normalizeOptionalDecisionText(decision.replacementText) ??
            matchingIssue?.suggestion?.replacementText ??
            matchingCorrection?.replacementText;

      return {
        itemId: normalizeOptionalDecisionText(decision.itemId) ?? `decision-${index + 1}`,
        targetText:
          normalizeOptionalDecisionText(decision.targetText) ??
          matchingIssue?.anchor.quote ??
          matchingCorrection?.targetText ??
          "",
        replacementText:
          normalizeOptionalDecisionText(decision.replacementText) ??
          matchingIssue?.suggestion?.replacementText ??
          matchingCorrection?.replacementText ??
          "",
        finalReplacementText,
        action: normalizedAction,
        category: matchingIssue?.issueType ?? matchingCorrection?.category,
        note: normalizeOptionalDecisionText(decision.note),
        severity: matchingIssue?.severity ?? "medium",
        issueType:
          matchingIssue?.issueType ??
          matchingCorrection?.category ??
          "legacy_proofreading_correction",
        source: matchingIssue?.source ?? "legacy_correction",
        blocksFinal: matchingIssue?.blocksFinal ?? false,
        anchor: matchingIssue?.anchor,
        suggestionAction: matchingIssue?.suggestion?.action,
      };
    });
  }

  return input.issues.map((issue) => ({
    itemId: issue.itemId,
    targetText: issue.anchor.quote,
    replacementText: issue.suggestion?.replacementText ?? "",
    finalReplacementText: issue.suggestion?.replacementText,
    action:
      issue.suggestion?.replacementText &&
      isSupportedProofreadingAutoWriteback({
        issueType: issue.issueType,
        targetText: issue.anchor.quote,
        replacementText: issue.suggestion.replacementText,
        anchor: issue.anchor,
        suggestionAction: issue.suggestion.action,
      })
        ? "accepted"
        : "manual_only",
    category: issue.issueType,
    severity: issue.severity,
    issueType: issue.issueType,
    source: issue.source,
    blocksFinal: issue.blocksFinal,
    anchor: issue.anchor,
    suggestionAction: issue.suggestion?.action,
  }));
}

function normalizeProofreadingDecisionAction(
  value: ProofreadingConfirmationDecisionAction,
):
  | "accepted"
  | "accepted_with_manual_edit"
  | "rejected"
  | "manual_only"
  | "escalated"
  | "route_to_rule_candidate"
  | "route_to_knowledge_candidate"
  | undefined {
  switch (value) {
    case "accept":
      return "accepted";
    case "accept_and_edit":
      return "accepted_with_manual_edit";
    case "reject":
      return "rejected";
    case "accepted":
    case "accepted_with_manual_edit":
    case "rejected":
    case "manual_only":
    case "escalated":
    case "route_to_rule_candidate":
    case "route_to_knowledge_candidate":
      return value;
    default:
      return undefined;
  }
}

function summarizeProofreadingConfirmationDecisions(
  decisions: readonly NormalizedProofreadingConfirmationDecision[],
): {
  totalItems: number;
  acceptedIntoManuscriptCount: number;
  rejectedCount: number;
  routedRuleCandidateCount: number;
  routedKnowledgeCandidateCount: number;
  manualOnlyCount: number;
} {
  return {
    totalItems: decisions.length,
    acceptedIntoManuscriptCount: decisions.filter((decision) =>
      decision.action === "accepted" ||
      decision.action === "accepted_with_manual_edit" ||
      decision.action === "route_to_rule_candidate" ||
      decision.action === "route_to_knowledge_candidate"
    ).length,
    rejectedCount: decisions.filter((decision) => decision.action === "rejected").length,
    routedRuleCandidateCount: decisions.filter(
      (decision) => decision.action === "route_to_rule_candidate",
    ).length,
    routedKnowledgeCandidateCount: decisions.filter(
      (decision) => decision.action === "route_to_knowledge_candidate",
    ).length,
    manualOnlyCount: decisions.filter((decision) => decision.action === "manual_only")
      .length,
  };
}

function serializeProofreadingConfirmationDecisions(
  decisions: readonly NormalizedProofreadingConfirmationDecision[],
): Array<{
  itemId: string;
  action: string;
  targetText: string;
  replacementText: string;
  finalReplacementText?: string;
}> {
  return decisions.map((decision) => ({
    itemId: decision.itemId,
    action: decision.action,
    targetText: decision.targetText,
    replacementText: decision.replacementText,
    finalReplacementText: decision.finalReplacementText,
  }));
}

function assertPublishableProofreadingDecisions(
  decisions: readonly NormalizedProofreadingConfirmationDecision[],
): void {
  const escalatedDecision = decisions.find((decision) => decision.action === "escalated");
  if (escalatedDecision) {
    throw new Error(
      `Proofreading issue ${escalatedDecision.itemId} is escalated and must be resolved before publication.`,
    );
  }

  const blockedManualDecision = decisions.find(
    (decision) =>
      decision.action === "manual_only" &&
      (decision.blocksFinal ||
        decision.severity === "high" ||
        decision.severity === "critical"),
  );
  if (blockedManualDecision) {
    throw new Error(
      `Proofreading issue ${blockedManualDecision.itemId} still requires manual confirmation before publication.`,
    );
  }

  const unsupportedAutoWriteback = decisions.find((decision) =>
    (decision.action === "accepted" ||
      decision.action === "accepted_with_manual_edit" ||
      decision.action === "route_to_rule_candidate" ||
      decision.action === "route_to_knowledge_candidate") &&
    !isSupportedProofreadingAutoWriteback({
      issueType: decision.issueType,
      targetText: decision.targetText,
      replacementText:
        decision.finalReplacementText ?? decision.replacementText,
      anchor: decision.anchor,
      suggestionAction: decision.suggestionAction,
      manualOverride: isHumanEditedProofreadingDecision(decision),
    }),
  );
  if (unsupportedAutoWriteback) {
    throw new Error(
      `Proofreading issue ${unsupportedAutoWriteback.itemId} cannot be safely auto-written back to the manuscript.`,
    );
  }
}

function buildHumanFinalAiReplacements(
  decisions: readonly NormalizedProofreadingConfirmationDecision[],
): Array<{
  targetText: string;
  replacementText: string;
  reason: string;
}> {
  return decisions.flatMap((decision) => {
    if (
      decision.action !== "accepted" &&
      decision.action !== "accepted_with_manual_edit" &&
      decision.action !== "route_to_rule_candidate" &&
      decision.action !== "route_to_knowledge_candidate"
    ) {
      return [];
    }

    if (!decision.finalReplacementText) {
      return [];
    }

    if (
      !isSupportedProofreadingAutoWriteback({
        issueType: decision.issueType,
        targetText: decision.targetText,
        replacementText: decision.finalReplacementText,
        anchor: decision.anchor,
        suggestionAction: decision.suggestionAction,
        manualOverride: isHumanEditedProofreadingDecision(decision),
      })
    ) {
      return [];
    }

    return [
      {
        targetText: decision.targetText,
        replacementText: decision.finalReplacementText,
        reason: decision.category ?? "proofreading_confirmation",
      },
    ];
  });
}

function isSupportedProofreadingAutoWriteback(input: {
  issueType: string;
  targetText: string;
  replacementText: string;
  anchor?: ProofreadingIssueAnchor;
  suggestionAction?: ProofreadingSuggestionAction;
  manualOverride?: boolean;
}): boolean {
  if (
    input.issueType === "legacy_proofreading_correction" &&
    input.targetText.trim().length > 0 &&
    input.replacementText.trim().length > 0
  ) {
    return true;
  }

  if (!input.anchor) {
    return false;
  }

  if (input.targetText.trim().length === 0 || input.replacementText.trim().length === 0) {
    return false;
  }

  if (input.manualOverride) {
    return true;
  }

  return (
    input.suggestionAction === "replace_text" ||
    input.suggestionAction === "rewrite_manually"
  );
}

function isHumanEditedProofreadingDecision(
  decision: Pick<
    NormalizedProofreadingConfirmationDecision,
    "action" | "replacementText" | "finalReplacementText"
  >,
): boolean {
  if (decision.action === "accepted_with_manual_edit") {
    return true;
  }

  if (
    decision.action !== "route_to_rule_candidate" &&
    decision.action !== "route_to_knowledge_candidate"
  ) {
    return false;
  }

  const finalReplacementText = decision.finalReplacementText?.trim();
  if (!finalReplacementText) {
    return false;
  }

  return finalReplacementText !== decision.replacementText.trim();
}

function buildProofreadingWritebackLedger(
  decisions: readonly NormalizedProofreadingConfirmationDecision[],
): Array<{
  itemId: string;
  action: string;
  applied: boolean;
  disposition: string;
  anchorBlockIndex?: number;
}> {
  return decisions.map((decision) => {
    if (decision.action === "rejected") {
      return {
        itemId: decision.itemId,
        action: decision.action,
        applied: false,
        disposition: "rejected",
        anchorBlockIndex: decision.anchor?.blockIndex,
      };
    }

    if (decision.action === "manual_only") {
      return {
        itemId: decision.itemId,
        action: decision.action,
        applied: false,
        disposition: "manual_confirmation_required",
        anchorBlockIndex: decision.anchor?.blockIndex,
      };
    }

    if (decision.action === "escalated") {
      return {
        itemId: decision.itemId,
        action: decision.action,
        applied: false,
        disposition: "escalated",
        anchorBlockIndex: decision.anchor?.blockIndex,
      };
    }

    const applied =
      !!decision.finalReplacementText &&
      isSupportedProofreadingAutoWriteback({
        issueType: decision.issueType,
        targetText: decision.targetText,
        replacementText: decision.finalReplacementText,
        anchor: decision.anchor,
        suggestionAction: decision.suggestionAction,
        manualOverride: isHumanEditedProofreadingDecision(decision),
      });

    return {
      itemId: decision.itemId,
      action: decision.action,
      applied,
      disposition: applied ? "auto_writeback" : "skipped_unsafe_writeback",
      anchorBlockIndex: decision.anchor?.blockIndex,
    };
  });
}

function buildHumanConfirmationResidualSourceBlocks(
  decisions: readonly NormalizedProofreadingConfirmationDecision[],
): ProofreadingResidualSourceBlock[] {
  return decisions
    .flatMap((decision) => {
      const hint = buildHumanConfirmationResidualHint(decision);
      if (!hint) {
        return [];
      }

      return [
        {
          blockIndex: decision.anchor?.blockIndex ?? 0,
          text: decision.targetText,
          residualHints: [hint],
        } satisfies ProofreadingResidualSourceBlock,
      ];
    });
}

function buildHumanConfirmationResidualHint(
  decision: NormalizedProofreadingConfirmationDecision,
): NonNullable<ProofreadingResidualSourceBlock["residualHints"]>[number] | undefined {
  if (decision.action === "rejected") {
    return {
      issue_type: "unsupported_correction_proposal",
      excerpt: decision.targetText,
      suggestion: decision.replacementText,
      rationale: decision.note ?? "Human rejected the proofreading issue.",
      source_stage: "model_residual",
      signal_breakdown: buildProofreadingConfirmationSignalBreakdown(decision),
    };
  }

  if (decision.action === "accepted_with_manual_edit") {
    return {
      issue_type: mapConfirmationDecisionToResidualIssueType(decision),
      excerpt: decision.targetText,
      suggestion: decision.finalReplacementText ?? decision.replacementText,
      rationale:
        decision.note ??
        "Human adjusted the proofreading issue before final publication.",
      source_stage: "model_residual",
      signal_breakdown: buildProofreadingConfirmationSignalBreakdown(decision),
    };
  }

  if (decision.action === "manual_only") {
    return {
      issue_type: "manual_confirmation_required",
      excerpt: decision.targetText,
      suggestion: decision.replacementText,
      rationale:
        decision.note ?? "The issue still requires manual confirmation.",
      source_stage: "model_residual",
      signal_breakdown: buildProofreadingConfirmationSignalBreakdown(decision),
    };
  }

  return undefined;
}

function isResidualReviewItemRecord(
  item: Awaited<ReturnType<ReviewItemsService["listReviewItems"]>>[number],
): item is ResidualReviewItemRecord {
  return item.source_kind === "residual_issue";
}

function shouldIncludeProofreadingGovernanceHandoffIssue(
  issue: ResidualIssueRecord,
): boolean {
  return (
    issue.status !== "candidate_created" &&
    issue.status !== "manual_only" &&
    issue.status !== "archived" &&
    issue.status !== "evidence_only"
  );
}

function mapConfirmationDecisionToResidualIssueType(
  decision: NormalizedProofreadingConfirmationDecision,
): string {
  if (decision.category === "terminology") {
    return "terminology_gap";
  }

  if (decision.category === "grammar") {
    return "uncovered_local_language_issue";
  }

  if (decision.category === "punctuation") {
    return "style_consistency_gap";
  }

  return "style_consistency_gap";
}

function buildProofreadingConfirmationSignalBreakdown(
  decision: NormalizedProofreadingConfirmationDecision,
): ResidualIssueSignalBreakdown {
  return {
    promotion_evidence: {
      source: "proofreading_confirmation",
      decision_action: mapProofreadingConfirmationPromotionAction(decision.action),
      correction_category:
        normalizeProofreadingCorrectionCategory(decision.category) ?? "style",
    },
  };
}

function mapProofreadingConfirmationPromotionAction(
  action: NormalizedProofreadingConfirmationDecision["action"],
): string {
  switch (action) {
    case "accepted":
      return "accept";
    case "accepted_with_manual_edit":
      return "accept_and_edit";
    case "rejected":
      return "reject";
    case "manual_only":
      return "manual_only";
    case "escalated":
      return "escalated";
    case "route_to_rule_candidate":
      return "route_to_rule_candidate";
    case "route_to_knowledge_candidate":
      return "route_to_knowledge_candidate";
    default:
      return action;
  }
}

function normalizeProofreadingCorrectionCategory(
  value: string | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function buildStoredProofreadingPlan(
  plan: ProofreadingAiPlan,
): ProofreadingAiPlan {
  return {
    role: plan.role,
    summary: plan.summary,
    issues: plan.issues.map((issue) => structuredClone(issue)),
    corrections: issuesToCorrectionSeeds(plan.issues).map((correction) => ({
      targetText: correction.targetText,
      replacementText: correction.replacementText,
      ...(correction.category ? { category: correction.category } : {}),
    })),
    manualReviewItems: [...plan.manualReviewItems],
  };
}

function issuesToCorrectionSeeds(
  issues: readonly ProofreadingIssue[],
): ProofreadingPlanCorrectionSeed[] {
  return issues.flatMap((issue) => {
    const replacementText = readOptionalString(issue.suggestion?.replacementText);
    if (!replacementText) {
      return [];
    }

    return [
      {
        itemId: issue.itemId,
        targetText: issue.anchor.quote,
        replacementText,
        category: issue.issueType,
      },
    ];
  });
}

function normalizeSerializedSuggestionAction(
  value: unknown,
): ProofreadingSuggestionAction | undefined {
  return value === "replace_text" ||
    value === "rewrite_manually" ||
    value === "verify_fact" ||
    value === "explain_only"
    ? value
    : undefined;
}

function normalizeSeverity(
  value: unknown,
): "critical" | "high" | "medium" | "low" | undefined {
  return value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
    ? value
    : undefined;
}

function normalizeProofreadingConfirmationSeverity(
  value: unknown,
): "critical" | "high" | "medium" | "low" | undefined {
  if (value === "error") {
    return "high";
  }
  if (value === "warning") {
    return "medium";
  }
  if (value === "info") {
    return "low";
  }
  return normalizeSeverity(value);
}

function normalizeIssueSource(
  value: unknown,
): ProofreadingIssue["source"] | undefined {
  return value === "governed_rule" ||
    value === "knowledge_base" ||
    value === "quality_check" ||
    value === "residual_ai" ||
    value === "legacy_correction"
    ? value
    : undefined;
}

function normalizeOptionalDecisionText(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRuntimeBindingReadinessStatus(
  value: unknown,
): "ready" | "degraded" | "missing" | undefined {
  return value === "ready" || value === "degraded" || value === "missing"
    ? value
    : undefined;
}

function buildProofreadingExecutionTruthPayload(input: {
  executionMode?: ModuleExecutionMode;
  executionProfileId?: string;
  retrievalPresetId?: string;
  runtimeBindingId?: string;
  routingPolicyVersionId?: string;
  modelId?: string;
  modelSource?: string;
  runtimeBindingReadinessStatus?: "ready" | "degraded" | "missing";
}): Record<string, unknown> {
  return {
    ...(input.executionMode ? { executionMode: input.executionMode } : {}),
    ...(input.executionProfileId
      ? { executionProfileId: input.executionProfileId }
      : {}),
    ...(input.retrievalPresetId ? { retrievalPresetId: input.retrievalPresetId } : {}),
    ...(input.runtimeBindingId ? { runtimeBindingId: input.runtimeBindingId } : {}),
    ...(input.routingPolicyVersionId
      ? { routingPolicyVersionId: input.routingPolicyVersionId }
      : {}),
    ...(input.modelId ? { modelId: input.modelId } : {}),
    ...(input.modelSource ? { modelSource: input.modelSource } : {}),
    ...(input.runtimeBindingReadinessStatus
      ? {
          runtimeBindingReadinessStatus: input.runtimeBindingReadinessStatus,
        }
      : {}),
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
}

function buildProofreadingExecutionGovernedHitInputs(input: {
  failedChecks: readonly ProofreadingCheckResult[];
  manualReviewItems: readonly ManualReviewItem[];
  qualityFindings: readonly ManuscriptQualityIssue[];
}): RecordExecutionGovernedHitInput[] {
  return [
    ...input.failedChecks.map((item, index) => ({
      sourceKey: buildProofreadingFailedCheckSourceKey(item, index),
      title: buildProofreadingRuleReviewTitle(item.ruleId),
      summary:
        "The governed proofreading check should be reviewed before governance routing.",
      excerpt: item.actual,
      suggestion: item.expected,
      location: buildProofreadingFailedCheckLocation(item),
      rationale: item.actual,
      candidate_posture: item.candidate_posture ?? "inspect_only",
      evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
        ...(buildProofreadingFailedCheckLocation(item)
          ? {
              location: buildProofreadingFailedCheckLocation(item),
            }
          : {}),
        excerpt: item.actual,
        suggestion: item.expected,
        rationale: item.actual,
      },
      riskLevel: mapProofreadingSeverityToReviewRisk(item.severity),
      relatedRuleIds: [item.ruleId],
      originPayload: {
        source: "failed_check",
        ruleId: item.ruleId,
      },
    })),
    ...input.manualReviewItems.map((item, index) => ({
      sourceKey: buildProofreadingManualReviewSourceKey(item, index),
      title: buildProofreadingRuleReviewTitle(item.ruleId),
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
    ...input.qualityFindings
      .filter(isProofreadingHighRiskQualityIssue)
      .map((issue, index) => ({
        sourceKey: buildProofreadingQualityFindingSourceKey(issue, index),
        title: `Proofreading quality issue ${issue.issue_type} requires review`,
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

function annotateProofreadingInspectionResult(
  findings: ProofreadingInspectionResult,
  reviewItemIdBySourceKey: ReadonlyMap<string, string>,
): ProofreadingInspectionResult {
  return {
    ...findings,
    failedChecks: findings.failedChecks.map((item, index) => ({
      ...ensureProofreadingFailedCheckGovernedHit(item),
      ...item,
      ...(reviewItemIdBySourceKey.get(
        buildProofreadingFailedCheckSourceKey(item, index),
      )
        ? {
            reviewItemId: reviewItemIdBySourceKey.get(
              buildProofreadingFailedCheckSourceKey(item, index),
            ),
          }
        : {}),
    })),
    manualReviewItems: findings.manualReviewItems.map((item, index) => ({
      ...ensureProofreadingManualReviewGovernedHit(item),
      ...item,
      ...(reviewItemIdBySourceKey.get(
        buildProofreadingManualReviewSourceKey(item, index),
      )
        ? {
            reviewItemId: reviewItemIdBySourceKey.get(
              buildProofreadingManualReviewSourceKey(item, index),
            ),
          }
        : {}),
    })),
    ...(findings.qualityFindings
      ? {
          qualityFindings: findings.qualityFindings.map((item, index) => ({
            ...item,
            candidate_posture: "candidate_change" as const,
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
            ...(reviewItemIdBySourceKey.get(
              buildProofreadingQualityFindingSourceKey(item, index),
            )
              ? {
                  reviewItemId: reviewItemIdBySourceKey.get(
                    buildProofreadingQualityFindingSourceKey(item, index),
                  ),
                }
              : {}),
          })),
        }
      : {}),
  };
}

function ensureProofreadingFailedCheckGovernedHit(
  item: ProofreadingCheckResult,
): Pick<ProofreadingCheckResult, "candidate_posture" | "evidence_pack"> {
  return {
    candidate_posture: item.candidate_posture ?? "inspect_only",
    evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
      ...(buildProofreadingFailedCheckLocation(item)
        ? {
            location: buildProofreadingFailedCheckLocation(item),
          }
        : {}),
      excerpt: item.actual,
      suggestion: item.expected,
      rationale: item.actual,
    },
  };
}

function ensureProofreadingManualReviewGovernedHit(
  item: ManualReviewItem,
): Pick<ManualReviewItem, "candidate_posture" | "evidence_pack"> {
  return {
    candidate_posture: item.candidate_posture ?? "candidate_change",
    evidence_pack: cloneEvidencePack(item.evidence_pack) ?? {
      rationale: item.reason,
    },
  };
}

function buildProofreadingRuleReviewTitle(ruleId: string): string {
  return ruleId.trim()
    ? `Rule ${ruleId.trim()} requires manual review`
    : "Proofreading governed hit requires manual review";
}

function buildProofreadingFailedCheckSourceKey(
  item: ProofreadingCheckResult,
  index: number,
): string {
  return [
    "proofreading",
    "failed-check",
    item.ruleId,
    item.actual,
    item.expected,
    item.blockIndex ?? "",
    item.semantic_hit?.table_id ?? "",
    item.semantic_hit?.column_key ?? "",
    item.semantic_hit?.header_path?.join(">") ?? "",
    String(index),
  ].join(":");
}

function buildProofreadingManualReviewSourceKey(
  item: ManualReviewItem,
  index: number,
): string {
  return `proofreading:manual:${item.ruleId}:${item.reason}:${index}`;
}

function buildProofreadingQualityFindingSourceKey(
  issue: ManuscriptQualityIssue,
  index: number,
): string {
  return [
    "proofreading",
    "quality",
    issue.issue_id,
    issue.issue_type,
    issue.paragraph_index ?? "",
    issue.sentence_index ?? "",
    String(index),
  ].join(":");
}

function buildProofreadingFailedCheckLocation(
  item: ProofreadingCheckResult,
): Record<string, unknown> | undefined {
  const location: Record<string, unknown> = item.evidence_pack?.location
    ? structuredClone(item.evidence_pack.location)
    : {};
  if (item.semantic_hit) {
    Object.assign(location, {
      ...item.semantic_hit,
      ...(item.semantic_hit.header_path
        ? { header_path: [...item.semantic_hit.header_path] }
        : {}),
    });
  }
  if (typeof item.blockIndex === "number") {
    location.block_index = item.blockIndex;
    location.paragraph_index = item.blockIndex + 1;
  }
  return Object.keys(location).length > 0 ? location : undefined;
}

function mapProofreadingSeverityToReviewRisk(
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

function isProofreadingHighRiskQualityIssue(
  issue: ManuscriptQualityIssue,
): boolean {
  return (
    issue.action === "manual_review" ||
    issue.action === "block" ||
    issue.severity === "high" ||
    issue.severity === "critical"
  );
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
          location: structuredClone(evidencePack.location),
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

interface ProofreadingRunArtifacts {
  inspectionResult: ProofreadingInspectionResult;
  sourceBlocks: ProofreadingResidualSourceBlock[];
}

interface ResolvedProofreadingExecutionContext {
  executionMode: ModuleExecutionMode;
  executionProfileId: string;
  templateId: string;
  moduleTemplateVersionNo: number;
  promptTemplateId: string;
  promptTemplateVersion: string;
  instructionPayload?: ReturnType<typeof assembleInstructionTemplate>;
  ruleSetId?: string;
  rules?: EditorialRuleRecord[];
  resolvedRules?: ResolvedEditorialRule[];
  skillPackageIds: string[];
  skillPackageVersions: string[];
  knowledgeHits: RecordKnowledgeHitInput[];
  manualReviewPolicy?: Parameters<typeof inspectProofreadingRules>[0]["manualReviewPolicy"];
  retrievalPresetId?: string;
  modelId: string;
  fallbackModelId?: string;
  modelVersion?: string;
  modelSource?: string;
  routingPolicyVersionId?: string;
  routingPolicyScopeKind?: AgentExecutionLogRecord["routing_policy_scope_kind"];
  routingPolicyScopeValue?: string;
  draftSnapshotId?: string;
  agentRuntimeId?: string;
  sandboxProfileId?: string;
  agentProfileId?: string;
  runtimeBindingId?: string;
  runtimeBindingReadinessStatus?: "ready" | "degraded" | "missing";
  toolPermissionPolicyId?: string;
  verificationCheckProfileIds: string[];
  evaluationSuiteIds: string[];
  releaseCheckProfileId?: string;
  agentExecutionLogId?: string;
  qualityPackageVersionIds: string[];
}

function extractDraftSnapshotId(draftJob: JobRecord | undefined): string | undefined {
  return extractStringPayloadValue(draftJob, "snapshotId");
}

function shouldObserveProofreadingResiduals(input: {
  residualLearningService: Pick<
    ResidualLearningService,
    "observeProofreadingResiduals"
  > | undefined;
  executionMode: ModuleExecutionMode;
  jobType: "proofreading_draft_run" | "proofreading_confirm";
  manuscriptType: ObserveProofreadingResidualsInput["manuscriptType"] | undefined;
  proofreadingArtifacts: ProofreadingRunArtifacts | undefined;
}): input is {
  residualLearningService: Pick<
    ResidualLearningService,
    "observeProofreadingResiduals"
  >;
  executionMode: "governed";
  jobType: "proofreading_draft_run";
  manuscriptType: ObserveProofreadingResidualsInput["manuscriptType"];
  proofreadingArtifacts: ProofreadingRunArtifacts;
} {
  return (
    !!input.residualLearningService &&
    input.executionMode === "governed" &&
    input.jobType === "proofreading_draft_run" &&
    typeof input.manuscriptType === "string" &&
    input.proofreadingArtifacts !== undefined
  );
}

function collectKnownRuleIds(
  resolvedContext: ResolvedProofreadingExecutionContext,
): string[] {
  return [...new Set([
    ...(resolvedContext.rules ?? []).map((rule) => rule.id),
    ...(resolvedContext.resolvedRules ?? []).map((entry) => entry.rule.id),
  ])];
}

function normalizeProofreadingSourceBlocks(
  blocks: EditorialTextBlock[],
): ProofreadingResidualSourceBlock[] {
  return blocks.map((block, blockIndex) => ({
    ...structuredClone(block),
    text: block.text,
    ...(block.section != null ? { section: block.section } : {}),
    blockIndex,
  })) as ProofreadingResidualSourceBlock[];
}

function buildResidualObservationSourceBlocks(input: {
  sourceBlocks: ProofreadingResidualSourceBlock[];
  proofreadingPlan?: ProofreadingAiPlan;
}): ProofreadingResidualSourceBlock[] {
  const blocks = input.sourceBlocks.map((block) =>
    structuredClone(block),
  );

  for (const issue of input.proofreadingPlan?.issues ?? []) {
    if (issue.source !== "residual_ai") {
      continue;
    }

    const hint = convertProofreadingPlanIssueToResidualHint(issue);
    if (!hint) {
      continue;
    }

    const blockIndex = resolveResidualObservationBlockIndex(blocks, issue);
    if (blockIndex >= 0) {
      const existing = blocks[blockIndex];
      blocks[blockIndex] = {
        ...existing,
        residualHints: [...(existing.residualHints ?? []), hint],
      };
      continue;
    }

    blocks.push({
      text: issue.anchor.quote,
      ...(issue.anchor.sectionLabel
        ? { section: issue.anchor.sectionLabel }
        : {}),
      ...(typeof issue.anchor.blockIndex === "number"
        ? { blockIndex: issue.anchor.blockIndex }
        : {}),
      residualHints: [hint],
    });
  }

  return blocks;
}

function resolveResidualObservationBlockIndex(
  blocks: ProofreadingResidualSourceBlock[],
  issue: ProofreadingIssue,
): number {
  if (
    Number.isInteger(issue.anchor.blockIndex) &&
    issue.anchor.blockIndex >= 0 &&
    issue.anchor.blockIndex < blocks.length
  ) {
    return issue.anchor.blockIndex;
  }

  if (issue.anchor.sectionLabel) {
    return blocks.findIndex((block) => block.section === issue.anchor.sectionLabel);
  }

  return -1;
}

function convertProofreadingPlanIssueToResidualHint(
  issue: ProofreadingIssue,
): ProofreadingResidualHint | undefined {
  const excerpt = issue.anchor.quote.trim();
  if (excerpt.length === 0) {
    return undefined;
  }

  const suggestion = readResidualHintSuggestion(issue);
  if (!suggestion) {
    return undefined;
  }

  return {
    issue_type: issue.issueType,
    excerpt,
    suggestion,
    rationale: issue.description.trim() || issue.title.trim(),
    source_stage: "model_residual",
    risk_level: mapProofreadingIssueSeverityToResidualRisk(issue.severity),
    location: {
      ...(issue.anchor.sectionLabel
        ? { section: issue.anchor.sectionLabel }
        : {}),
      block_index: issue.anchor.blockIndex,
    },
  };
}

function readResidualHintSuggestion(issue: ProofreadingIssue): string | undefined {
  const replacementText = issue.suggestion?.replacementText?.trim();
  if (replacementText) {
    return replacementText;
  }

  const note = issue.suggestion?.note?.trim();
  if (note) {
    return note;
  }

  const description = issue.description.trim();
  if (description) {
    return description;
  }

  const title = issue.title.trim();
  return title.length > 0 ? title : undefined;
}

function mapProofreadingIssueSeverityToResidualRisk(
  severity: ProofreadingIssue["severity"],
): "low" | "medium" | "high" | "critical" {
  switch (severity) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
    default:
      return "low";
  }
}

function extractModuleExecutionMode(
  job: JobRecord | undefined,
): ModuleExecutionMode | undefined {
  const executionMode = job?.payload?.executionMode;
  return executionMode === "bare" || executionMode === "governed"
    ? executionMode
    : undefined;
}

function extractStringPayloadValue(
  job: JobRecord | undefined,
  key: string,
): string | undefined {
  const value = job?.payload?.[key];
  return typeof value === "string" ? value : undefined;
}

function buildAiGovernanceContext(input: {
  hardRuleSummary?: string;
  allowedContentOperations?: string[];
  forbiddenOperations?: string[];
  manualReviewPolicy?: string;
  promptSnippets?: string[];
  manualReviewItems?: string[];
  contentRuleCandidates?: string[];
  resolvedRules?: ResolvedEditorialRule[];
  knowledgeHits?: RecordKnowledgeHitInput[];
}): AiGovernanceContext | undefined {
  const resolvedRules = (input.resolvedRules ?? []).map((entry) => ({
    ruleId: entry.rule.id,
    actionKind: entry.rule.action.kind,
    ruleDomain: entry.rule.rule_domain,
    structuredActionKind: entry.rule.structured_action?.kind,
    automationGrade: entry.rule.automation_grade,
    scopeLayer: entry.rule.scope_layer,
    governanceExplanation: entry.governance_explanation,
    ruleType: entry.rule.rule_type,
    severity: entry.rule.severity,
    confidencePolicy: entry.rule.confidence_policy,
    executionMode: entry.rule.execution_mode,
    sections: Array.isArray(entry.rule.scope.sections)
      ? entry.rule.scope.sections.filter(
          (section): section is string => typeof section === "string",
        )
      : [],
    sourceLayer: entry.source_layer,
    evidencePackageIds: entry.rule.linkage_payload?.evidence_package_ids
      ? [...entry.rule.linkage_payload.evidence_package_ids]
      : undefined,
    targetModelBlockIds: entry.rule.linkage_payload?.target_model_block_ids
      ? [...entry.rule.linkage_payload.target_model_block_ids]
      : undefined,
  }));
  const knowledgeHits = (input.knowledgeHits ?? []).map((entry) => ({
    knowledgeItemId: entry.knowledgeItemId,
    matchSource: entry.matchSource,
    bindingRuleId: entry.bindingRuleId,
    matchSourceId: entry.matchSourceId,
    matchReasons: [...entry.matchReasons],
  }));
  const context: AiGovernanceContext = {
    ...(input.hardRuleSummary
      ? {
          hardRuleSummary: input.hardRuleSummary,
        }
      : {}),
    ...(input.allowedContentOperations && input.allowedContentOperations.length > 0
      ? {
          allowedContentOperations: [...input.allowedContentOperations],
        }
      : {}),
    ...(input.forbiddenOperations && input.forbiddenOperations.length > 0
      ? {
          forbiddenOperations: [...input.forbiddenOperations],
        }
      : {}),
    ...(input.manualReviewPolicy
      ? {
          manualReviewPolicy: input.manualReviewPolicy,
        }
      : {}),
    ...(input.promptSnippets && input.promptSnippets.length > 0
      ? {
          promptSnippets: [...input.promptSnippets],
        }
      : {}),
    ...(input.manualReviewItems && input.manualReviewItems.length > 0
      ? {
          manualReviewItems: [...input.manualReviewItems],
        }
      : {}),
    ...(input.contentRuleCandidates && input.contentRuleCandidates.length > 0
      ? {
          contentRuleCandidates: [...input.contentRuleCandidates],
        }
      : {}),
    ...(resolvedRules.length > 0
      ? {
          resolvedRules,
        }
      : {}),
    ...(knowledgeHits.length > 0
      ? {
          knowledgeHits,
        }
      : {}),
  };

  return Object.keys(context).length > 0 ? context : undefined;
}

function deriveProofreadingManuscriptTarget(input: {
  reportStorageKey: string;
  reportFileName?: string;
}): {
  storageKey: string;
  fileName: string;
} {
  const normalizedStorageKey = input.reportStorageKey.replaceAll("\\", "/");
  const directoryPrefix = normalizedStorageKey.includes("/")
    ? normalizedStorageKey.slice(0, normalizedStorageKey.lastIndexOf("/") + 1)
    : "";
  const fileName = deriveProofreadingManuscriptFileName(input.reportFileName);

  return {
    storageKey: `${directoryPrefix}${fileName}`,
    fileName,
  };
}

function deriveProofreadingManuscriptFileName(
  reportFileName: string | undefined,
): string {
  const normalizedFileName = (reportFileName ?? "proofreading-report.md")
    .replaceAll("\\", "/")
    .split("/")
    .pop() ?? "proofreading-report.md";
  const strippedExtension = normalizedFileName.replace(/\.[^.]+$/u, "");
  const stem = strippedExtension.length > 0 ? strippedExtension : "proofreading-report";
  const manuscriptStem = /report/iu.test(stem)
    ? stem.replace(/report/giu, "manuscript")
    : `${stem}-manuscript`;

  return `${manuscriptStem}.docx`;
}

function buildProofreadingObjectRiskItems(
  objects: readonly DocumentStructureObjectEvidence[],
): ProofreadingInspectionResult["riskItems"] {
  return objects.map((item) => ({
    reason: [
      `高风险对象待人工核对：${formatProofreadingObjectKind(item.object_kind)}`,
      `原始对象=${buildProofreadingObjectLabel(item)}`,
      item.evidence_text ? `提取证据=${item.evidence_text}` : undefined,
      item.surrounding_text ? `临近文本=${item.surrounding_text}` : undefined,
      `意图目标=${item.intended_target ?? "未明确"}`,
      "降级原因=object_type_not_safe",
      `定位=${item.source_locator}`,
    ]
      .filter((value): value is string => Boolean(value))
      .join("；"),
    severity: "error",
  }));
}

function buildProofreadingObjectLabel(
  item: DocumentStructureObjectEvidence,
): string {
  const parts = [formatProofreadingObjectKind(item.object_kind), item.original_tag];
  if (item.relationship_id) {
    parts.push(item.relationship_id);
  }
  return parts.join("/");
}

function formatProofreadingObjectKind(
  kind: DocumentStructureObjectEvidence["object_kind"],
): string {
  switch (kind) {
    case "image":
      return "图片对象";
    case "equation":
      return "公式对象";
    case "embedded_object":
      return "嵌入对象";
    case "drawing":
      return "绘图对象";
    case "chart":
      return "图表对象";
    default:
      return "未知对象";
  }
}

function renderProofreadingReport(
  findings: ProofreadingInspectionResult,
  proofreadingPlan?: ProofreadingAiPlan,
): string {
  const lines = [
    "# Proofreading Issue Report",
    "",
    `Role: ${proofreadingPlan?.role ?? "医学稿件终校审校员"}`,
    `Failed checks: ${findings.failedChecks.length}`,
    `Manual review items: ${findings.manualReviewItems.length}`,
    `Residual issues: ${proofreadingPlan?.issues.length ?? 0}`,
    "",
  ];

  if ((proofreadingPlan?.issues.length ?? 0) > 0) {
    lines.push("## Issue Queue", "");
    for (const issue of proofreadingPlan?.issues ?? []) {
      lines.push(
        `- [${issue.severity}] (${issue.source}) ${issue.title}: ${issue.anchor.quote}`,
      );
    }
    lines.push("");
  }

  if ((proofreadingPlan?.manualReviewItems.length ?? 0) > 0) {
    lines.push("## AI Manual Review", "");
    for (const item of proofreadingPlan?.manualReviewItems ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

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

  if ((findings.qualityFindings?.length ?? 0) > 0) {
    lines.push("## Quality Findings", "");
    for (const issue of findings.qualityFindings ?? []) {
      lines.push(
        `- [${issue.action}] ${issue.issue_type}: ${issue.explanation}`,
      );
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
