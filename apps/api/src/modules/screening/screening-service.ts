import { randomUUID } from "node:crypto";
import type { ModuleExecutionMode } from "@medical/contracts";
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
import type {
  DocumentStructureService,
  DocumentStructureTableSnapshot,
} from "../document-pipeline/document-structure-service.ts";
import type {
  EditorialSourceBlockResolver,
  EditorialTextBlock,
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
import { materializeTextAsset } from "../shared/text-asset-materialization.ts";
import {
  ScreeningAiReportService,
  type ScreeningAiReport,
} from "./screening-ai-report-service.ts";
import type { AiGovernanceContext } from "../shared/ai-governance-context.ts";

export interface RunScreeningInput {
  manuscriptId: string;
  parentAssetId: string;
  requestedBy: string;
  actorRole: RoleKey;
  storageKey: string;
  fileName?: string;
  executionMode?: ModuleExecutionMode;
}

export interface ScreeningServiceOptions {
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
  screeningAiReportService?: Pick<ScreeningAiReportService, "createReport">;
  textAssetRootDir?: string;
  textAssetMaterializer?: typeof materializeTextAsset;
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
  private readonly screeningAiReportService: Pick<
    ScreeningAiReportService,
    "createReport"
  >;
  private readonly textAssetRootDir?: string;
  private readonly textAssetMaterializer: typeof materializeTextAsset;
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

  constructor(options: ScreeningServiceOptions) {
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
    this.screeningAiReportService =
      options.screeningAiReportService ??
      new ScreeningAiReportService({
        mainlineAiRuntimeExecutor: options.mainlineAiRuntimeExecutor,
      });
    this.textAssetRootDir = options.textAssetRootDir;
    this.textAssetMaterializer =
      options.textAssetMaterializer ?? materializeTextAsset;
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

  async run(input: RunScreeningInput): Promise<ScreeningRunResult> {
    this.permissionGuard.assert(input.actorRole, "workbench.screening");
    const executionMode = resolveModuleExecutionMode(input.executionMode);

    const committed = await this.transactionManager.withTransaction(async (context) => {
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
        verificationCheckProfileIds: string[];
        evaluationSuiteIds: string[];
        releaseCheckProfileId?: string;
        qualityPackageVersionIds?: string[];
        governanceContext?: AiGovernanceContext;
        agentRuntimeId?: string;
        sandboxProfileId?: string;
        agentProfileId?: string;
        runtimeBindingId?: string;
        toolPermissionPolicyId?: string;
      };
      if (executionMode === "bare") {
        const bareContext = await resolveBareModuleContext({
          manuscriptId: input.manuscriptId,
          module: "screening",
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
          verificationCheckProfileIds: bareContext.verificationCheckProfileIds,
          evaluationSuiteIds: bareContext.evaluationSuiteIds,
          qualityPackageVersionIds: bareContext.qualityPackageVersionIds,
        };
      } else {
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
          verificationCheckProfileIds:
            governedContext.verificationExpectations
              .verification_check_profile_ids,
          evaluationSuiteIds:
            governedContext.verificationExpectations.evaluation_suite_ids,
          releaseCheckProfileId:
            governedContext.verificationExpectations.release_check_profile_id,
          qualityPackageVersionIds:
            governedContext.runtimeBinding.quality_package_version_ids,
          governanceContext: buildScreeningGovernanceContext({
            promptHardRuleSummary:
              governedContext.moduleContext.promptTemplate.hard_rule_summary,
            ruleSetVersionNo: governedContext.moduleContext.ruleSet.version_no,
            rules: governedContext.moduleContext.rules,
            resolvedRules: governedContext.moduleContext.resolvedRules,
            knowledgeSelections: governedContext.moduleContext.knowledgeSelections.map(
              (selection) => ({
                knowledgeItemId: selection.knowledgeItem.id,
                matchSource: selection.matchSource,
                bindingRuleId: selection.bindingRuleId,
                matchSourceId: selection.matchSourceId,
                matchReasons: selection.matchReasons,
              }),
            ),
          }),
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
              module: "screening",
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

      const queuedJob: JobRecord = {
        id: jobId,
        manuscript_id: input.manuscriptId,
        module: "screening",
        job_type: "screening_run",
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
          ...(normalizedContext.governanceContext
            ? {
                governanceContext: normalizedContext.governanceContext,
              }
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
      const medicalReviewSignals = buildMedicalReviewSignals(qualityRun?.issues);
      const screeningReportResult = await this.screeningAiReportService.createReport({
        manuscriptId: input.manuscriptId,
        sourceFileName:
          sourceAsset?.file_name ?? input.fileName ?? input.parentAssetId,
        sourceBlocks: sourceBlocks.map((block) => ({
          text: block.text,
          blockKind: block.block_kind,
        })),
        tableCount: documentStructureSnapshot?.tables.length ?? 0,
        qualityIssues: qualityRun?.issues,
        qualitySummary: qualityRun?.quality_findings_summary,
        governanceContext: normalizedContext.governanceContext,
      });
      const screeningReport = structuredClone(
        screeningReportResult.report,
      ) as ScreeningAiReport;
      const screeningReportMarkdown = screeningReportResult.markdown;

      if (this.textAssetRootDir) {
        await this.textAssetMaterializer({
          rootDir: this.textAssetRootDir,
          storageKey: input.storageKey,
          content: screeningReportMarkdown,
        });
      }

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

      const completedJob: JobRecord = {
        ...queuedJob,
        status: "completed",
        payload: {
          ...queuedJob.payload,
          snapshotId: snapshot.id,
          outputAssetId: asset.id,
          outputAssetType: "screening_report",
          screeningReport,
          ...(qualityRun
            ? {
                qualityFindings: qualityRun.issues.map((issue) =>
                  structuredClone(issue),
                ),
                qualityFindingSummary: structuredClone(
                  qualityRun.quality_findings_summary,
                ),
                ...(medicalReviewSignals.length > 0
                  ? {
                      medicalReviewSignals: medicalReviewSignals.map((signal) => ({
                        ...signal,
                      })),
                    }
                  : {}),
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
      targetModule: "screening",
      tableSnapshots: input.tableSnapshots,
      qualityPackageVersionIds: input.qualityPackageVersionIds,
    });
  }
}

function buildScreeningGovernanceContext(input: {
  promptHardRuleSummary?: string;
  ruleSetVersionNo: number;
  rules: EditorialRuleRecord[];
  resolvedRules: ResolvedEditorialRule[];
  knowledgeSelections: Array<{
    knowledgeItemId: string;
    matchSource?: string;
    bindingRuleId?: string;
    matchSourceId?: string;
    matchReasons: string[];
  }>;
}): AiGovernanceContext | undefined {
  const enabledRules = input.rules
    .filter((rule) => rule.enabled)
    .sort((left, right) => left.order_no - right.order_no);
  const hardRuleSummaryLines = enabledRules.map((rule) => {
    const firstSection = Array.isArray(rule.scope.sections)
      ? rule.scope.sections.find((section): section is string => typeof section === "string")
      : undefined;
    return `- ${firstSection ?? "document"}: ${rule.action.kind} (${rule.severity})`;
  });
  const requiredChecks = enabledRules.map((rule) => {
    const firstSection = Array.isArray(rule.scope.sections)
      ? rule.scope.sections.find((section): section is string => typeof section === "string")
      : undefined;
    return `${rule.id}: ${firstSection ?? "document"} / ${rule.action.kind} / ${rule.severity}`;
  });
  const manualReviewItems = enabledRules
    .filter((rule) => rule.execution_mode === "inspect" || rule.confidence_policy === "manual_only")
    .map((rule) => `${rule.id}: ${deriveScreeningReviewReason(rule)}`);
  const resolvedRules = input.resolvedRules.map((entry) => ({
    ruleId: entry.rule.id,
    actionKind: entry.rule.action.kind,
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
  }));
  const context: AiGovernanceContext = {
    hardRuleSummary: [
      input.promptHardRuleSummary?.trim(),
      `Rule set v${input.ruleSetVersionNo}:`,
      ...hardRuleSummaryLines,
    ]
      .filter((line): line is string => !!line && line.length > 0)
      .join("\n"),
    ...(manualReviewItems.length > 0
      ? {
          manualReviewItems,
        }
      : {}),
    ...(requiredChecks.length > 0
      ? {
          requiredChecks,
        }
      : {}),
    ...(resolvedRules.length > 0
      ? {
          resolvedRules,
        }
      : {}),
    ...(input.knowledgeSelections.length > 0
      ? {
          knowledgeHits: input.knowledgeSelections.map((entry) => ({
            knowledgeItemId: entry.knowledgeItemId,
            matchSource: entry.matchSource,
            bindingRuleId: entry.bindingRuleId,
            matchSourceId: entry.matchSourceId,
            matchReasons: [...entry.matchReasons],
          })),
        }
      : {}),
  };

  return Object.keys(context).length > 0 ? context : undefined;
}

function deriveScreeningReviewReason(rule: EditorialRuleRecord): string {
  if (
    typeof rule.manual_review_reason_template === "string" &&
    rule.manual_review_reason_template.trim().length > 0
  ) {
    return rule.manual_review_reason_template.trim();
  }

  if (rule.confidence_policy === "manual_only") {
    return "manual_only_rule";
  }

  return `${rule.action.kind}_review`;
}

function buildMedicalReviewSignals(
  issues: Array<{
    issue_id: string;
    module_scope: string;
    issue_type: string;
    action: string;
    severity: string;
    explanation: string;
  }> | undefined,
) {
  if (!issues) {
    return [];
  }

  return issues
    .filter(
      (issue) =>
        issue.module_scope === "medical_specialized" &&
        issue.action !== "suggest_fix",
    )
    .map((issue) => ({
      issueId: issue.issue_id,
      issueType: issue.issue_type,
      action: issue.action,
      severity: issue.severity,
      explanation: issue.explanation,
    }));
}
