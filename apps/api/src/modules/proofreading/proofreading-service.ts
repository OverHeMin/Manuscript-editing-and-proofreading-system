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
import type {
  ObserveProofreadingResidualsInput,
  ProofreadingResidualSourceBlock,
  ResidualLearningService,
} from "../residual-learning/index.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { ToolPermissionPolicyService } from "../tool-permission-policies/tool-permission-policy-service.ts";
import type { ManuscriptQualityService } from "../manuscript-quality/manuscript-quality-service.ts";
import type { MainlineAiRuntimeExecutor } from "../shared/mainline-ai-runtime-executor.ts";
import { materializeTextAsset } from "../shared/text-asset-materialization.ts";
import {
  ProofreadingAiPlanService,
  type ProofreadingAiPlan,
} from "./proofreading-ai-plan-service.ts";

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

export type ProofreadingConfirmationDecisionAction =
  | "accept"
  | "accept_and_edit"
  | "reject"
  | "manual_only"
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
    "recordExecutionGovernedHits" | "submitGovernedHit" | "decideReviewItem"
  >;
  residualLearningService?: Pick<
    ResidualLearningService,
    "observeProofreadingResiduals"
  >;
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
    "recordExecutionGovernedHits" | "submitGovernedHit" | "decideReviewItem"
  >;
  private readonly residualLearningService?: Pick<
    ResidualLearningService,
    "observeProofreadingResiduals"
  >;
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
    this.residualLearningService = options.residualLearningService;
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

    return this.transactionManager.withTransaction(async (context) => {
      const { jobRepository, assetRepository, manuscriptRepository } = context;
      if (!jobRepository) {
        throw new Error("Human-final publication requires a job repository.");
      }

      const manuscript = await manuscriptRepository.findById(input.manuscriptId);
      const finalAsset = await assetRepository.findById(input.finalAssetId);
      if (
        !finalAsset ||
        finalAsset.manuscript_id !== input.manuscriptId ||
        finalAsset.asset_type !== "final_proof_annotated_docx"
      ) {
        throw new ProofreadingFinalAssetRequiredError(input.finalAssetId);
      }
      const finalJob =
        finalAsset.source_job_id != null
          ? await jobRepository.findById(finalAsset.source_job_id)
          : undefined;
      const finalJobPayload = asObject(finalJob?.payload);
      const parentDraftAssetId =
        readOptionalString(finalJobPayload?.parentAssetId) ??
        finalAsset.parent_asset_id;
      const parentDraftAsset =
        parentDraftAssetId != null
          ? await assetRepository.findById(parentDraftAssetId)
          : undefined;
      const parentDraftJob =
        parentDraftAsset?.source_job_id != null
          ? await jobRepository.findById(parentDraftAsset.source_job_id)
          : undefined;
      const parentDraftJobPayload = asObject(parentDraftJob?.payload);
      const sourceProofreadingPlan = extractProofreadingPlan(
        finalJobPayload?.proofreadingPlan ??
          parentDraftJobPayload?.proofreadingPlan,
      );
      const sourceManuscriptAssetId =
        readOptionalString(finalJobPayload?.sourceManuscriptAssetId) ??
        readOptionalString(parentDraftJobPayload?.sourceManuscriptAssetId) ??
        readOptionalString(parentDraftJobPayload?.parentAssetId) ??
        input.finalAssetId;
      const sourceSnapshotId =
        readOptionalString(finalJobPayload?.snapshotId) ??
        readOptionalString(parentDraftJobPayload?.snapshotId);
      const knownKnowledgeItemIds = [
        ...new Set([
          ...readStringArray(finalJobPayload?.knowledgeItemIds),
          ...readStringArray(parentDraftJobPayload?.knowledgeItemIds),
        ]),
      ];
      const normalizedDecisions = normalizeProofreadingConfirmationDecisions({
        corrections: sourceProofreadingPlan.corrections,
        decisions: input.confirmationDecisions,
      });
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
          confirmationSummary,
          confirmationDecisions: serializeProofreadingConfirmationDecisions(
            normalizedDecisions,
          ),
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
        parentAssetId: input.finalAssetId,
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
              `Human confirmed proofreading correction for ${decision.targetText}.`,
            title: `Proofreading confirmation ${decision.itemId}`,
            excerpt: decision.targetText,
            suggestion: decision.finalReplacementText,
            rationale: `Confirmed from proofreading asset ${input.finalAssetId}.`,
            candidatePosture: "candidate_change",
            decisionSource: "manual_feedback",
            relatedKnowledgeItemIds: knownKnowledgeItemIds,
            originPayload: {
              source: "proofreading_confirmation",
              proofreadingJobId: finalJob?.id,
              finalAssetId: input.finalAssetId,
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
      if (
        this.residualLearningService &&
        manuscript &&
        sourceSnapshotId &&
        residualSourceBlocks.length > 0
      ) {
        await this.residualLearningService.observeProofreadingResiduals({
          manuscriptId: input.manuscriptId,
          manuscriptType: manuscript.manuscript_type,
          executionSnapshotId: sourceSnapshotId,
          jobId,
          outputAssetId: asset.id,
          knownRuleIds: [],
          knownKnowledgeItemIds,
          sourceBlocks: residualSourceBlocks,
        });
      }

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
    sourceManuscriptAssetId?: string;
    assetType: "proofreading_draft_report" | "final_proof_annotated_docx";
    mimeType: string;
    jobType: "proofreading_draft_run" | "proofreading_confirm";
    executionMode?: ModuleExecutionMode;
    pinnedContext?: ResolvedProofreadingExecutionContext;
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
      const proofreadingPlan =
        input.jobType === "proofreading_draft_run"
          ? (structuredClone(
              await this.proofreadingAiPlanService.createPlan({
                manuscriptId: input.manuscriptId,
                sourceFileName:
                  sourceAsset?.file_name ?? input.fileName ?? input.parentAssetId,
                sourceBlocks: proofreadingArtifacts?.sourceBlocks,
                qualityIssues: proofreadingFindings?.qualityFindings,
              }),
            ) as ProofreadingAiPlan)
          : undefined;
      const reportMarkdown =
        input.jobType === "proofreading_draft_run" && proofreadingFindings
          ? renderProofreadingReport(proofreadingFindings, proofreadingPlan)
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

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "proofreading",
        job_type: input.jobType,
        status: "queued",
        requested_by: input.requestedBy,
        payload: {
          ...(resolvedContext.executionMode === "bare"
            ? {
                executionMode: resolvedContext.executionMode,
              }
            : {}),
          templateId: resolvedContext.templateId,
          executionProfileId: resolvedContext.executionProfileId,
          promptTemplateId: resolvedContext.promptTemplateId,
          skillPackageIds: resolvedContext.skillPackageIds,
          knowledgeItemIds: resolvedContext.knowledgeHits.map(
            (hit) => hit.knowledgeItemId,
          ),
          modelId: resolvedContext.modelId,
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
          ...(proofreadingPlan
            ? {
                proofreadingPlan,
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
      const proofreadingManuscriptAsset =
        input.jobType === "proofreading_draft_run" && proofreadingPlan
          ? await this.createProofreadingManuscriptAsset({
              manuscriptId: input.manuscriptId,
              requestedBy: input.requestedBy,
              sourceJobId: jobId,
              sourceAssetId: input.parentAssetId,
              reportAssetId: asset.id,
              reportStorageKey: input.storageKey,
              reportFileName: input.fileName,
              proofreadingPlan,
              documentAssetService,
            })
          : undefined;
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
        createdAssetIds: [
          asset.id,
          ...(proofreadingManuscriptAsset ? [proofreadingManuscriptAsset.id] : []),
        ],
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

      const completedJob: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
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
          ...(proofreadingPlan
            ? {
                proofreadingPlan,
              }
            : {}),
          ...(proofreadingManuscriptAsset
            ? {
                proofreadingManuscriptAssetId: proofreadingManuscriptAsset.id,
                proofreadingManuscriptAssetType:
                  proofreadingManuscriptAsset.asset_type,
              }
            : {}),
          ...(input.sourceManuscriptAssetId
            ? {
                sourceManuscriptAssetId: input.sourceManuscriptAssetId,
              }
            : {}),
        },
        attempt_count: 1,
        started_at: timestamp,
        finished_at: timestamp,
        updated_at: timestamp,
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
                outputAssetId: proofreadingManuscriptAsset?.id ?? asset.id,
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
                sourceBlocks: proofreadingArtifacts!.sourceBlocks,
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
      rules: [],
      resolvedRules: [],
      tableSnapshots: [],
      aiReplacements: input.proofreadingPlan.corrections.map(
        (correction: ProofreadingAiPlan["corrections"][number]) => ({
        targetText: correction.targetText,
        replacementText: correction.replacementText,
        reason: correction.category,
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
        modelVersion: bareContext.modelSelection.model.model_version,
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
      modelId: moduleContext.modelSelection.model.id,
      fallbackModelId: moduleContext.modelSelection.fallback_chain[0]?.id,
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
    const draftExecutionLog = await this.loadDraftExecutionLog(draftJob);

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
        draftSnapshotId: snapshot.id,
        verificationCheckProfileIds: [],
        evaluationSuiteIds: [],
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

    return {
      inspectionResult: {
        ...proofreadingFindings,
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
  action: ProofreadingConfirmationDecisionAction;
  category?: string;
  note?: string;
}

function extractProofreadingPlan(value: unknown): {
  corrections: ProofreadingPlanCorrectionSeed[];
} {
  const payload = asObject(value);
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
    corrections,
  };
}

function normalizeProofreadingConfirmationDecisions(input: {
  corrections: readonly ProofreadingPlanCorrectionSeed[];
  decisions?: readonly ProofreadingConfirmationDecisionInput[];
}): NormalizedProofreadingConfirmationDecision[] {
  if (input.decisions && input.decisions.length > 0) {
    return input.decisions.map((decision, index) => {
      const matchingCorrection =
        input.corrections.find((correction) => correction.itemId === decision.itemId) ??
        input.corrections.find(
          (correction) =>
            correction.targetText === decision.targetText &&
            correction.replacementText === decision.replacementText,
        );
      const finalReplacementText =
        decision.action === "reject"
          ? undefined
          : normalizeOptionalDecisionText(decision.editedReplacementText) ??
            normalizeOptionalDecisionText(decision.replacementText);

      return {
        itemId: normalizeOptionalDecisionText(decision.itemId) ?? `decision-${index + 1}`,
        targetText:
          normalizeOptionalDecisionText(decision.targetText) ??
          matchingCorrection?.targetText ??
          "",
        replacementText:
          normalizeOptionalDecisionText(decision.replacementText) ??
          matchingCorrection?.replacementText ??
          "",
        finalReplacementText,
        action: decision.action,
        category: matchingCorrection?.category,
        note: normalizeOptionalDecisionText(decision.note),
      };
    });
  }

  return input.corrections.map((correction) => ({
    itemId: correction.itemId,
    targetText: correction.targetText,
    replacementText: correction.replacementText,
    finalReplacementText: correction.replacementText,
    action: "accept" as const,
    category: correction.category,
  }));
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
      decision.action === "accept" ||
      decision.action === "accept_and_edit" ||
      decision.action === "manual_only" ||
      decision.action === "route_to_rule_candidate" ||
      decision.action === "route_to_knowledge_candidate"
    ).length,
    rejectedCount: decisions.filter((decision) => decision.action === "reject").length,
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
  action: ProofreadingConfirmationDecisionAction;
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

function buildHumanFinalAiReplacements(
  decisions: readonly NormalizedProofreadingConfirmationDecision[],
): Array<{
  targetText: string;
  replacementText: string;
  reason: string;
}> {
  return decisions
    .filter((decision) =>
      decision.action !== "reject" && decision.finalReplacementText,
    )
    .map((decision) => ({
      targetText: decision.targetText,
      replacementText: decision.finalReplacementText!,
      reason: decision.category ?? "proofreading_confirmation",
    }));
}

function buildHumanConfirmationResidualSourceBlocks(
  decisions: readonly NormalizedProofreadingConfirmationDecision[],
): ProofreadingResidualSourceBlock[] {
  return decisions
    .flatMap((decision, index) => {
      const hint = buildHumanConfirmationResidualHint(decision);
      if (!hint) {
        return [];
      }

      return [
        {
          blockIndex: index,
          text: decision.targetText,
          residualHints: [hint],
        } satisfies ProofreadingResidualSourceBlock,
      ];
    });
}

function buildHumanConfirmationResidualHint(
  decision: NormalizedProofreadingConfirmationDecision,
): NonNullable<ProofreadingResidualSourceBlock["residualHints"]>[number] | undefined {
  if (decision.action === "reject") {
    return {
      issue_type: "ambiguous_reviewer_escalation",
      excerpt: decision.targetText,
      suggestion: decision.replacementText,
      rationale: decision.note ?? "Human rejected the proofreading correction.",
      source_stage: "model_residual",
    };
  }

  if (decision.action === "accept_and_edit") {
    return {
      issue_type: mapConfirmationDecisionToResidualIssueType(decision),
      excerpt: decision.targetText,
      suggestion: decision.finalReplacementText ?? decision.replacementText,
      rationale:
        decision.note ??
        "Human adjusted the proofreading correction before final publication.",
      source_stage: "model_residual",
    };
  }

  return undefined;
}

function mapConfirmationDecisionToResidualIssueType(
  decision: NormalizedProofreadingConfirmationDecision,
): string {
  if (decision.action === "route_to_knowledge_candidate" || decision.category === "terminology") {
    return "terminology_gap";
  }

  if (decision.category === "punctuation") {
    return "uncovered_local_language_issue";
  }

  return "style_consistency_gap";
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
  ruleSetId?: string;
  rules?: EditorialRuleRecord[];
  resolvedRules?: ResolvedEditorialRule[];
  skillPackageIds: string[];
  skillPackageVersions: string[];
  knowledgeHits: RecordKnowledgeHitInput[];
  manualReviewPolicy?: Parameters<typeof inspectProofreadingRules>[0]["manualReviewPolicy"];
  modelId: string;
  fallbackModelId?: string;
  modelVersion?: string;
  routingPolicyVersionId?: string;
  routingPolicyScopeKind?: AgentExecutionLogRecord["routing_policy_scope_kind"];
  routingPolicyScopeValue?: string;
  draftSnapshotId?: string;
  agentRuntimeId?: string;
  sandboxProfileId?: string;
  agentProfileId?: string;
  runtimeBindingId?: string;
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

function renderProofreadingReport(
  findings: ProofreadingInspectionResult,
  proofreadingPlan?: ProofreadingAiPlan,
): string {
  const lines = [
    "# Proofreading Rule Report",
    "",
    `Failed checks: ${findings.failedChecks.length}`,
    `Manual review items: ${findings.manualReviewItems.length}`,
    `Corrections: ${proofreadingPlan?.corrections.length ?? 0}`,
    "",
  ];

  if ((proofreadingPlan?.corrections.length ?? 0) > 0) {
    lines.push("## Corrections", "");
    for (const correction of proofreadingPlan?.corrections ?? []) {
      lines.push(
        `- [${correction.category}] ${correction.targetText} -> ${correction.replacementText}`,
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
