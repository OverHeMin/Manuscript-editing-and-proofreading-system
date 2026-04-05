import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import {
  AuthorizationError,
  PermissionGuard,
} from "../auth/permission-guard.ts";
import {
  AccountLockedError,
  InvalidCredentialsError,
} from "../auth/auth-service.ts";
import {
  AuthenticationRequiredError,
  createDemoHttpAuthRuntime,
  type HttpAuthRuntime,
  type HttpAuthenticatedSession,
} from "./demo-auth-runtime.ts";
import {
  createAlwaysReadyServiceHealthProvider,
  type HttpServiceHealthProvider,
} from "./service-health.ts";
import {
  InlineUploadPayloadInvalidError,
  InlineUploadPayloadTooLargeError,
  InlineUploadStorageReferenceRequiredError,
  storeInlineUpload,
} from "./local-upload-storage.ts";
import {
  DocumentAssetDownloadNotFoundError,
  DocumentAssetDownloadUnsupportedError,
  LocalAssetMaterializationService,
} from "./local-asset-materialization.ts";
import {
  AgentProfileNotFoundError,
  AgentProfileService,
  createAgentProfileApi,
  InMemoryAgentProfileRepository,
} from "../modules/agent-profiles/index.ts";
import {
  AgentExecutionOrchestrationService,
  AgentExecutionLogNotFoundError,
  AgentExecutionService,
  createAgentExecutionApi,
  InMemoryAgentExecutionRepository,
} from "../modules/agent-execution/index.ts";
import {
  AgentRuntimeNotFoundError,
  AgentRuntimeService,
  createAgentRuntimeApi,
  InMemoryAgentRuntimeRepository,
} from "../modules/agent-runtime/index.ts";
import {
  ActiveExecutionProfileNotFoundError,
  createExecutionGovernanceApi,
  ExecutionGovernanceService,
  ExecutionProfileCompatibilityError,
  ExecutionProfileKnowledgeItemNotApprovedError,
  ExecutionProfileModuleTemplateNotPublishedError,
  ExecutionProfilePromptTemplateNotPublishedError,
  ExecutionProfileSkillPackageNotPublishedError,
  InMemoryExecutionGovernanceRepository,
  KnowledgeBindingRuleNotFoundError,
  KnowledgeBindingRuleStatusTransitionError,
  ModuleExecutionProfileNotFoundError,
  ModuleExecutionProfileStatusTransitionError,
} from "../modules/execution-governance/index.ts";
import {
  createExecutionResolutionApi,
  ExecutionResolutionKnowledgeItemNotFoundError,
  ExecutionResolutionModelIncompatibleError,
  ExecutionResolutionModelNotFoundError,
  ExecutionResolutionProfileAssetNotFoundError,
  ExecutionResolutionService,
} from "../modules/execution-resolution/index.ts";
import {
  createExecutionTrackingApi,
  ExecutionTrackingService,
  ExecutionTrackingSkillPackageVersionMismatchError,
  InMemoryExecutionTrackingRepository,
} from "../modules/execution-tracking/index.ts";
import { InMemoryAuditService } from "../audit/index.ts";
import { AiGatewayService } from "../modules/ai-gateway/index.ts";
import {
  createHarnessDatasetApi,
  HarnessDatasetDependencyMissingError,
  HarnessGoldSetVersionExportValidationError,
  HarnessDatasetService,
  HarnessDatasetSourceResolutionError,
  InMemoryHarnessDatasetRepository,
} from "../modules/harness-datasets/index.ts";
import {
  createHarnessIntegrationApi,
  HarnessGovernedRunStateError,
  HarnessIntegrationService,
  HarnessIntegrationValidationError,
  InMemoryHarnessIntegrationRepository,
} from "../modules/harness-integrations/index.ts";
import {
  DocumentAssetService,
  InMemoryDocumentAssetRepository,
  ManuscriptNotFoundError,
  type DocumentAssetRecord,
} from "../modules/assets/index.ts";
import {
  DocumentExportAssetNotFoundError,
  DocumentExportService,
} from "../modules/document-pipeline/index.ts";
import {
  createEditingApi,
  EditingService,
} from "../modules/editing/index.ts";
import {
  FeedbackGovernanceService,
  FeedbackGovernanceReviewedSnapshotNotFoundError,
  FeedbackSourceAssetMismatchError,
  FeedbackSourceAssetNotFoundError,
  InMemoryFeedbackGovernanceRepository,
  type LearningCandidateSourceLinkRecord,
} from "../modules/feedback-governance/index.ts";
import {
  createKnowledgeApi,
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
  KnowledgeItemNotFoundError,
  KnowledgeService,
  KnowledgeStatusTransitionError,
  KnowledgeRetrievalSnapshotNotFoundError,
  type CreateKnowledgeDraftInput,
  type ResolveGovernedRetrievalContextInput,
  type KnowledgeRecord,
  type KnowledgeReviewActionRecord,
  type UpdateKnowledgeDraftInput,
} from "../modules/knowledge/index.ts";
import {
  InMemoryKnowledgeRetrievalRepository,
  KnowledgeRetrievalService,
} from "../modules/knowledge-retrieval/index.ts";
import {
  createLearningApi,
  InMemoryLearningCandidateRepository,
  InMemoryReviewedCaseSnapshotRepository,
  LearningCandidateGovernedProvenanceRequiredError,
  LearningCandidateNotFoundError,
  LearningDeidentificationRequiredError,
  LearningHumanFinalAssetRequiredError,
  LearningService,
  LearningSnapshotDeidentificationRequiredError,
  ReviewedCaseSnapshotNotFoundError,
  type CreateGovernedLearningCandidateInput,
  type CreateLearningCandidateInput,
  type CreateReviewedCaseSnapshotInput,
  type LearningCandidateRecord,
  type ReviewedCaseSnapshotRecord,
} from "../modules/learning/index.ts";
import {
  createLearningGovernanceApi,
  InMemoryLearningGovernanceRepository,
  LearningGovernanceConflictError,
  LearningGovernanceService,
  LearningWritebackNotFoundError,
  LearningWritebackStatusTransitionError,
  LearningWritebackTargetMismatchError,
} from "../modules/learning-governance/index.ts";
import {
  InMemoryJobRepository,
  type JobRecord,
} from "../modules/jobs/index.ts";
import {
  InMemoryManuscriptRepository,
  JobNotFoundError,
  createManuscriptApi,
  type ManuscriptRecord,
  ManuscriptLifecycleService,
} from "../modules/manuscripts/index.ts";
import {
  createModelRegistryApi,
  DuplicateModelRegistryEntryError,
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
  ModelRegistryEntryNotFoundError,
  ModelRegistryService,
  ModelRoutingPolicyValidationError,
  ModelRoutingReferenceNotFoundError,
} from "../modules/model-registry/index.ts";
import {
  createModelRoutingGovernanceApi,
  InMemoryModelRoutingGovernanceRepository,
  ModelRoutingGovernanceDraftNotEditableError,
  ModelRoutingGovernanceService,
  ModelRoutingGovernanceStatusTransitionError,
  ModelRoutingGovernanceValidationError,
  ModelRoutingPolicyNotFoundError,
  ModelRoutingPolicyScopeConflictError,
  ModelRoutingPolicyVersionNotFoundError,
} from "../modules/model-routing-governance/index.ts";
import {
  createPromptSkillRegistryApi,
  InMemoryPromptSkillRegistryRepository,
  PromptTemplateNotFoundError,
  PromptSkillRegistryService,
  PromptSkillRegistryStatusTransitionError,
  SkillPackageNotFoundError,
} from "../modules/prompt-skill-registry/index.ts";
import {
  createProofreadingApi,
  ProofreadingDraftAssetRequiredError,
  ProofreadingDraftContextNotFoundError,
  ProofreadingFinalAssetRequiredError,
  ProofreadingService,
} from "../modules/proofreading/index.ts";
import {
  createRuntimeBindingApi,
  InMemoryRuntimeBindingRepository,
  RuntimeBindingReadinessService,
  RuntimeBindingCompatibilityError,
  RuntimeBindingDependencyStateError,
  RuntimeBindingNotFoundError,
  RuntimeBindingService,
} from "../modules/runtime-bindings/index.ts";
import {
  createSandboxProfileApi,
  InMemorySandboxProfileRepository,
  SandboxProfileNotFoundError,
  SandboxProfileService,
} from "../modules/sandbox-profiles/index.ts";
import {
  createScreeningApi,
  ScreeningService,
} from "../modules/screening/index.ts";
import {
  createTemplateApi,
  TemplateFamilyActiveConflictError,
  ModuleTemplateDraftNotEditableError,
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
  ModuleTemplateNotFoundError,
  ModuleTemplateStatusTransitionError,
  TemplateRetrievalGoldSetVersionValidationError,
  TemplateRetrievalQualityRunNotFoundError,
  TemplateFamilyNotFoundError,
  TemplateFamilyManuscriptTypeMismatchError,
  TemplateGovernanceService,
} from "../modules/templates/index.ts";
import {
  createVerificationOpsApi,
  EvaluationEvidencePackNotFoundError,
  EvaluationEvidencePackRunMismatchError,
  EvaluationExperimentBindingError,
  EvaluationLearningCandidateTypeError,
  EvaluationLearningSnapshotNotInRunError,
  EvaluationRunItemNotFoundError,
  EvaluationRunNotFoundError,
  EvaluationSuiteModuleScopeMismatchError,
  EvaluationSampleSetNotFoundError,
  EvaluationSampleSetSourceEligibilityError,
  EvaluationSampleSetSourceSnapshotNotFoundError,
  EvaluationSuiteNotActiveError,
  EvaluationSuiteNotFoundError,
  InMemoryVerificationOpsRepository,
  ReleaseCheckProfileDependencyError,
  ReleaseCheckProfileNotFoundError,
  ReviewedCaseSnapshotRepositoryRequiredError,
  VerificationCheckProfileDependencyError,
  VerificationCheckProfileNotFoundError,
  VerificationEvidenceNotFoundError,
  VerificationOpsLearningServiceRequiredError,
  VerificationOpsService,
  VerificationRetrievalDependencyError,
  VerificationToolDependencyError,
} from "../modules/verification-ops/index.ts";
import {
  createToolGatewayApi,
  InMemoryToolGatewayRepository,
  ToolGatewayService,
  ToolGatewayToolNotFoundError,
} from "../modules/tool-gateway/index.ts";
import {
  createToolPermissionPolicyApi,
  InMemoryToolPermissionPolicyRepository,
  ToolPermissionPolicyHighRiskAllowlistError,
  ToolPermissionPolicyNotFoundError,
  ToolPermissionPolicyService,
  ToolPermissionPolicyUnknownToolError,
} from "../modules/tool-permission-policies/index.ts";

type RouteResponse<TBody> = {
  status: number;
  body: TBody;
  headers?: Record<string, string>;
  rawBody?: Buffer;
};

export type AppEnv = "local" | "test" | "development" | "staging" | "production";

type HttpRouteMatch =
  | {
      route: "healthz";
    }
  | {
      route: "readyz";
    }
  | {
      route: "auth-local-login";
    }
  | {
      route: "auth-session";
    }
  | {
      route: "auth-logout";
    }
  | {
      route: "manuscripts-upload";
    }
  | {
      route: "manuscripts-get";
      manuscriptId: string;
    }
  | {
      route: "manuscripts-list-assets";
      manuscriptId: string;
    }
  | {
      route: "jobs-get";
      jobId: string;
    }
  | {
      route: "document-pipeline-export-current-asset";
    }
  | {
      route: "document-assets-download";
      assetId: string;
    }
  | {
      route: "harness-datasets-workbench";
    }
  | {
      route: "harness-datasets-export-gold-set-version";
      goldSetVersionId: string;
    }
  | {
      route: "harness-integrations-list-adapters";
    }
  | {
      route: "harness-integrations-launch-governed-run";
    }
  | {
      route: "harness-integrations-list-adapter-executions";
      adapterId: string;
    }
  | {
      route: "modules-screening-run";
    }
  | {
      route: "modules-editing-run";
    }
  | {
      route: "modules-proofreading-draft";
    }
  | {
      route: "modules-proofreading-finalize";
    }
  | {
      route: "modules-proofreading-publish-human-final";
    }
  | {
      route: "agent-runtime-create";
    }
  | {
      route: "agent-runtime-list";
    }
  | {
      route: "agent-runtime-list-by-module";
      module: string;
      activeOnly: boolean;
    }
  | {
      route: "agent-runtime-get";
      runtimeId: string;
    }
  | {
      route: "agent-runtime-publish";
      runtimeId: string;
    }
  | {
      route: "agent-runtime-archive";
      runtimeId: string;
    }
  | {
      route: "tool-gateway-create";
    }
  | {
      route: "tool-gateway-list";
    }
  | {
      route: "tool-gateway-list-by-scope";
      scope: string;
    }
  | {
      route: "tool-gateway-get";
      toolId: string;
    }
  | {
      route: "tool-gateway-update";
      toolId: string;
    }
  | {
      route: "sandbox-profile-create";
    }
  | {
      route: "sandbox-profile-list";
    }
  | {
      route: "sandbox-profile-get";
      profileId: string;
    }
  | {
      route: "sandbox-profile-activate";
      profileId: string;
    }
  | {
      route: "sandbox-profile-archive";
      profileId: string;
    }
  | {
      route: "agent-profile-create";
    }
  | {
      route: "agent-profile-list";
    }
  | {
      route: "agent-profile-get";
      profileId: string;
    }
  | {
      route: "agent-profile-publish";
      profileId: string;
    }
  | {
      route: "agent-profile-archive";
      profileId: string;
    }
  | {
      route: "runtime-binding-create";
    }
  | {
      route: "runtime-binding-list";
    }
  | {
      route: "runtime-binding-list-by-scope";
      module: string;
      manuscriptType: string;
      templateFamilyId: string;
      activeOnly: boolean;
    }
  | {
      route: "runtime-binding-get";
      bindingId: string;
    }
  | {
      route: "runtime-binding-get-readiness";
      bindingId: string;
    }
  | {
      route: "runtime-binding-activate";
      bindingId: string;
    }
  | {
      route: "runtime-binding-active-readiness";
      module: string;
      manuscriptType: string;
      templateFamilyId: string;
    }
  | {
      route: "runtime-binding-archive";
      bindingId: string;
    }
  | {
      route: "tool-permission-policy-create";
    }
  | {
      route: "tool-permission-policy-list";
    }
  | {
      route: "tool-permission-policy-get";
      policyId: string;
    }
  | {
      route: "tool-permission-policy-activate";
      policyId: string;
    }
  | {
      route: "tool-permission-policy-archive";
      policyId: string;
    }
  | {
      route: "agent-execution-create";
    }
  | {
      route: "agent-execution-list";
    }
  | {
      route: "agent-execution-get";
      logId: string;
    }
  | {
      route: "agent-execution-complete";
      logId: string;
    }
  | {
      route: "knowledge-create-draft";
    }
  | {
      route: "templates-create-family";
    }
  | {
      route: "templates-list-families";
    }
  | {
      route: "templates-update-family";
      templateFamilyId: string;
    }
  | {
      route: "templates-create-module-draft";
    }
  | {
      route: "templates-update-module-draft";
      moduleTemplateId: string;
    }
  | {
      route: "templates-list-module-templates";
      templateFamilyId: string;
    }
  | {
      route: "templates-create-retrieval-quality-run";
      templateFamilyId: string;
    }
  | {
      route: "templates-get-latest-retrieval-quality-run";
      templateFamilyId: string;
    }
  | {
      route: "templates-publish-module-template";
      moduleTemplateId: string;
    }
  | {
      route: "prompt-skill-create-skill-package";
    }
  | {
      route: "prompt-skill-list-skill-packages";
    }
  | {
      route: "prompt-skill-publish-skill-package";
      skillPackageId: string;
    }
  | {
      route: "prompt-skill-create-prompt-template";
    }
  | {
      route: "prompt-skill-list-prompt-templates";
    }
  | {
      route: "prompt-skill-publish-prompt-template";
      promptTemplateId: string;
    }
  | {
      route: "execution-governance-create-profile";
    }
  | {
      route: "execution-governance-list-profiles";
    }
  | {
      route: "execution-governance-publish-profile";
      profileId: string;
    }
  | {
      route: "execution-governance-archive-profile";
      profileId: string;
    }
  | {
      route: "execution-governance-create-knowledge-binding-rule";
    }
  | {
      route: "execution-governance-list-knowledge-binding-rules";
    }
  | {
      route: "execution-governance-activate-knowledge-binding-rule";
      ruleId: string;
    }
  | {
      route: "execution-governance-resolve";
    }
  | {
      route: "execution-tracking-record-snapshot";
    }
  | {
      route: "execution-tracking-get-snapshot";
      snapshotId: string;
    }
  | {
      route: "execution-tracking-list-knowledge-hit-logs";
      snapshotId: string;
    }
  | {
      route: "model-registry-create-entry";
    }
  | {
      route: "model-registry-list-entries";
    }
  | {
      route: "model-registry-update-entry";
      modelId: string;
    }
  | {
      route: "model-registry-get-routing-policy";
    }
  | {
      route: "model-registry-update-routing-policy";
    }
  | {
      route: "model-routing-governance-list-policies";
    }
  | {
      route: "model-routing-governance-create-policy";
    }
  | {
      route: "model-routing-governance-create-draft-version";
      policyId: string;
    }
  | {
      route: "model-routing-governance-update-draft-version";
      versionId: string;
    }
  | {
      route: "model-routing-governance-submit-version";
      versionId: string;
    }
  | {
      route: "model-routing-governance-approve-version";
      versionId: string;
    }
  | {
      route: "model-routing-governance-activate-version";
      versionId: string;
    }
  | {
      route: "model-routing-governance-rollback-policy";
      policyId: string;
    }
  | {
      route: "knowledge-list";
    }
  | {
      route: "knowledge-review-queue";
    }
  | {
      route: "knowledge-submit";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-approve";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-reject";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-update-draft";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-review-actions";
      knowledgeItemId: string;
    }
  | {
      route: "knowledge-create-harness-dataset-candidate";
      humanFinalAssetId: string;
    }
  | {
      route: "knowledge-resolve-governed-retrieval-context";
    }
  | {
      route: "knowledge-get-retrieval-snapshot";
      snapshotId: string;
    }
  | {
      route: "knowledge-archive";
      knowledgeItemId: string;
    }
  | {
      route: "learning-list-candidates";
    }
  | {
      route: "learning-review-queue";
    }
  | {
      route: "learning-get-candidate";
      candidateId: string;
    }
  | {
      route: "learning-create-reviewed-case-snapshot";
    }
  | {
      route: "learning-create-candidate";
    }
  | {
      route: "learning-create-governed-candidate";
    }
  | {
      route: "learning-approve-candidate";
      candidateId: string;
    }
  | {
      route: "learning-governance-create-writeback";
    }
  | {
      route: "learning-governance-apply-writeback";
      writebackId: string;
    }
  | {
      route: "learning-governance-list-writebacks";
      candidateId: string;
    }
  | {
      route: "learning-governance-create-harness-dataset-candidate";
      reviewedCaseSnapshotId: string;
    }
  | {
      route: "verification-ops-create-check-profile";
    }
  | {
      route: "verification-ops-list-check-profiles";
    }
  | {
      route: "verification-ops-publish-check-profile";
      profileId: string;
    }
  | {
      route: "verification-ops-create-release-check-profile";
    }
  | {
      route: "verification-ops-list-release-check-profiles";
    }
  | {
      route: "verification-ops-publish-release-check-profile";
      profileId: string;
    }
  | {
      route: "verification-ops-create-evaluation-suite";
    }
  | {
      route: "verification-ops-list-evaluation-suites";
    }
  | {
      route: "verification-ops-activate-evaluation-suite";
      suiteId: string;
    }
  | {
      route: "verification-ops-list-suite-runs";
      suiteId: string;
    }
  | {
      route: "verification-ops-create-evaluation-sample-set";
    }
  | {
      route: "verification-ops-list-evaluation-sample-sets";
    }
  | {
      route: "verification-ops-publish-evaluation-sample-set";
      sampleSetId: string;
    }
  | {
      route: "verification-ops-list-evaluation-sample-set-items";
      sampleSetId: string;
    }
  | {
      route: "verification-ops-record-evidence";
    }
  | {
      route: "verification-ops-get-evidence";
      evidenceId: string;
    }
  | {
      route: "verification-ops-create-evaluation-run";
    }
  | {
      route: "verification-ops-complete-evaluation-run";
      runId: string;
    }
  | {
      route: "verification-ops-finalize-evaluation-run";
      runId: string;
    }
  | {
      route: "verification-ops-list-run-items";
      runId: string;
    }
  | {
      route: "verification-ops-list-run-evidence";
      runId: string;
    }
  | {
      route: "verification-ops-get-finalized-run-result";
      runId: string;
    }
  | {
      route: "verification-ops-list-suite-finalized-results";
      suiteId: string;
    }
  | {
      route: "verification-ops-record-run-item-result";
      runItemId: string;
    }
  | {
      route: "verification-ops-create-learning-candidate";
      runId: string;
    }
  | {
      route: "verification-ops-create-harness-dataset-candidate";
      evidencePackId: string;
    };

export interface CreateApiHttpServerOptions {
  appEnv?: AppEnv;
  allowedOrigins?: string[];
  seedDemoKnowledgeReviewData?: boolean;
  authRuntime?: HttpAuthRuntime;
  runtime?: ApiServerRuntime;
  serviceHealth?: HttpServiceHealthProvider;
  uploadRootDir?: string;
}

export type ApiHttpServer = Server;

export interface ApiServerRuntime {
  authRuntime: HttpAuthRuntime;
  agentExecutionApi: ReturnType<typeof createAgentExecutionApi>;
  agentProfileApi: ReturnType<typeof createAgentProfileApi>;
  agentRuntimeApi: ReturnType<typeof createAgentRuntimeApi>;
  editingApi: ReturnType<typeof createEditingApi>;
  manuscriptApi: ReturnType<typeof createManuscriptApi>;
  proofreadingApi: ReturnType<typeof createProofreadingApi>;
  screeningApi: ReturnType<typeof createScreeningApi>;
  documentPipelineApi: {
    exportCurrentAsset: (input: {
      manuscriptId: string;
      preferredAssetType?: DocumentAssetRecord["asset_type"];
    }) => Promise<
      RouteResponse<{
        manuscript_id: string;
        asset: DocumentAssetRecord;
        download: {
          storage_key: string;
          file_name?: string;
          mime_type: string;
          url: string;
        };
      }>
    >;
    downloadAsset: (input: {
      assetId: string;
      uploadRootDir: string;
    }) => Promise<
      RouteResponse<null> & {
        rawBody: Buffer;
        headers: Record<string, string>;
      }
    >;
  };
  executionGovernanceApi: ReturnType<typeof createExecutionGovernanceApi>;
  executionResolutionApi: ReturnType<typeof createExecutionResolutionApi>;
  executionTrackingApi: ReturnType<typeof createExecutionTrackingApi>;
  harnessDatasetApi: ReturnType<typeof createHarnessDatasetApi>;
  harnessIntegrationApi: ReturnType<typeof createHarnessIntegrationApi>;
  knowledgeApi: ReturnType<typeof createKnowledgeApi>;
  learningApi: ReturnType<typeof createLearningApi>;
  learningGovernanceApi: ReturnType<typeof createLearningGovernanceApi>;
  verificationOpsApi: ReturnType<typeof createVerificationOpsApi>;
  templateApi: ReturnType<typeof createTemplateApi>;
  modelRegistryApi: ReturnType<typeof createModelRegistryApi>;
  modelRoutingGovernanceApi: ReturnType<typeof createModelRoutingGovernanceApi>;
  promptSkillRegistryApi: ReturnType<typeof createPromptSkillRegistryApi>;
  runtimeBindingApi: ReturnType<typeof createRuntimeBindingApi>;
  sandboxProfileApi: ReturnType<typeof createSandboxProfileApi>;
  toolGatewayApi: ReturnType<typeof createToolGatewayApi>;
  toolPermissionPolicyApi: ReturnType<typeof createToolPermissionPolicyApi>;
  permissionGuard: PermissionGuard;
}

export function createApiHttpServer(
  options: CreateApiHttpServerOptions = {},
): ApiHttpServer {
  const appEnv = options.appEnv ?? "production";
  const runtime =
    options.runtime ??
    createInMemoryApiRuntime({
      appEnv,
      authRuntime: options.authRuntime,
      seedDemoData: options.seedDemoKnowledgeReviewData ?? appEnv === "local",
    });
  const allowedOrigins =
    options.allowedOrigins?.filter((origin) => origin.trim().length > 0) ?? [];
  const serviceHealth =
    options.serviceHealth ?? createAlwaysReadyServiceHealthProvider();
  const uploadRootDir = options.uploadRootDir ?? resolveDefaultUploadRootDir(appEnv);
  const harnessExportRootDir = resolveDefaultHarnessExportRootDir(appEnv);

  return createServer(async (req, res) => {
    const corsHeaders = createCorsHeaders(req, allowedOrigins);

    try {
      if (req.method === "OPTIONS") {
        writeResponse(res, 204, null, corsHeaders);
        return;
      }

      const routeMatch = matchRoute(req);
      if (!routeMatch) {
        writeResponse(
          res,
          404,
          {
            error: "not_found",
            method: req.method ?? "UNKNOWN",
            path: readRequestPath(req),
          },
          corsHeaders,
        );
        return;
      }

      const routeResponse = await handleRoute(
        routeMatch,
        req,
        runtime,
        uploadRootDir,
        harnessExportRootDir,
        serviceHealth,
      );
      writeResponse(res, routeResponse.status, routeResponse.body, {
        ...corsHeaders,
        ...(routeResponse.headers ?? {}),
      }, routeResponse.rawBody);
    } catch (error) {
      const [status, body, extraHeaders = {}] = mapErrorToHttpResponse(error);
      writeResponse(res, status, body, {
        ...corsHeaders,
        ...extraHeaders,
      });
    }
  });
}

export function createInMemoryApiRuntime(input: {
  appEnv: AppEnv;
  authRuntime?: HttpAuthRuntime;
  seedDemoData: boolean;
}): ApiServerRuntime {
  const authRuntime =
    input.authRuntime ??
    (input.appEnv === "local" ? createDemoHttpAuthRuntime() : undefined);
  if (!authRuntime) {
    throw new Error(
      `Persistent API runtime requires an explicit persistent auth runtime for APP_ENV="${input.appEnv}".`,
    );
  }

  const permissionGuard = new PermissionGuard();
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const reviewedCaseSnapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
  const learningCandidateRepository = new InMemoryLearningCandidateRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const knowledgeReviewActionRepository =
    new InMemoryKnowledgeReviewActionRepository();
  const feedbackGovernanceRepository = new InMemoryFeedbackGovernanceRepository();
  const agentExecutionRepository = new InMemoryAgentExecutionRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const learningGovernanceRepository = new InMemoryLearningGovernanceRepository();
  const harnessDatasetRepository = new InMemoryHarnessDatasetRepository();
  const harnessIntegrationRepository = new InMemoryHarnessIntegrationRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const modelRegistryRepository = new InMemoryModelRegistryRepository();
  const modelRoutingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const modelRoutingGovernanceRepository =
    new InMemoryModelRoutingGovernanceRepository();
  const runtimeBindingRepository = new InMemoryRuntimeBindingRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const promptSkillRegistryRepository =
    new InMemoryPromptSkillRegistryRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const knowledgeRetrievalRepository = new InMemoryKnowledgeRetrievalRepository();
  const auditService = new InMemoryAuditService();

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
  });
  const feedbackGovernanceService = new FeedbackGovernanceService({
    repository: feedbackGovernanceRepository,
    executionTrackingRepository,
    assetRepository,
    reviewedCaseSnapshotRepository,
  });
  const learningService = new LearningService({
    manuscriptRepository,
    assetRepository,
    snapshotRepository: reviewedCaseSnapshotRepository,
    candidateRepository: learningCandidateRepository,
    documentAssetService,
    feedbackGovernanceService,
  });
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    reviewedCaseSnapshotRepository,
    learningService,
    knowledgeRetrievalRepository,
    toolGatewayRepository,
  });
  const harnessDatasetService = new HarnessDatasetService({
    repository: harnessDatasetRepository,
    reviewedCaseSnapshotRepository,
    manuscriptRepository,
    assetRepository,
    verificationOpsRepository,
    permissionGuard,
  });
  const knowledgeRetrievalService = new KnowledgeRetrievalService({
    repository: knowledgeRetrievalRepository,
  });
  const templateService = new TemplateGovernanceService({
    templateFamilyRepository,
    moduleTemplateRepository,
    learningCandidateRepository,
    harnessDatasetRepository,
    knowledgeRetrievalRepository,
    knowledgeRetrievalService,
  });
  const toolGatewayService = new ToolGatewayService({
    repository: toolGatewayRepository,
  });
  const toolPermissionPolicyService = new ToolPermissionPolicyService({
    repository: toolPermissionPolicyRepository,
    toolGatewayRepository,
  });
  const sandboxProfileService = new SandboxProfileService({
    repository: sandboxProfileRepository,
  });
  const agentRuntimeService = new AgentRuntimeService({
    repository: agentRuntimeRepository,
  });
  const agentProfileService = new AgentProfileService({
    repository: agentProfileRepository,
  });
  const runtimeBindingService = new RuntimeBindingService({
    repository: runtimeBindingRepository,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    verificationOpsRepository,
  });
  const runtimeBindingReadinessService = new RuntimeBindingReadinessService({
    runtimeBindingService,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    executionGovernanceRepository,
    verificationOpsRepository,
  });
  const harnessIntegrationService = new HarnessIntegrationService({
    repository: harnessIntegrationRepository,
    governedRunRuntime: runtimeBindingService,
    verificationEvidenceRecorder: verificationOpsService,
  });
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
  });
  const executionTrackingService = new ExecutionTrackingService({
    repository: executionTrackingRepository,
  });
  const agentExecutionService = new AgentExecutionService({
    repository: agentExecutionRepository,
  });
  const agentExecutionOrchestrationService =
    new AgentExecutionOrchestrationService({
      agentExecutionService,
      executionTrackingService,
      verificationOpsService,
    });
  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    templateFamilyRepository,
  });
  const exportService = new DocumentExportService({
    assetRepository,
    manuscriptRepository,
  });
  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository: modelRoutingGovernanceRepository,
    modelRegistryRepository,
    permissionGuard,
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRegistryRepository,
    routingPolicyRepository: modelRoutingPolicyRepository,
    modelRoutingGovernanceService,
    auditService,
  });
  const modelRegistryService = new ModelRegistryService({
    repository: modelRegistryRepository,
    routingPolicyRepository: modelRoutingPolicyRepository,
  });
  const executionResolutionService = new ExecutionResolutionService({
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceService,
    runtimeBindingReadinessService,
  });
  const promptSkillRegistryService = new PromptSkillRegistryService({
    repository: promptSkillRegistryRepository,
    learningCandidateRepository,
  });
  const knowledgeService = new KnowledgeService({
    repository: knowledgeRepository,
    reviewActionRepository: knowledgeReviewActionRepository,
    learningCandidateRepository,
    knowledgeRetrievalRepository,
    knowledgeRetrievalService,
    governedRetrievalResolverDependencies: {
      manuscriptRepository,
      moduleTemplateRepository,
      executionGovernanceService,
      promptSkillRegistryRepository,
      aiGatewayService,
      sandboxProfileService,
      agentProfileService,
      agentRuntimeService,
      runtimeBindingService,
      runtimeBindingReadinessService,
      toolPermissionPolicyService,
    },
  });
  const learningGovernanceService = new LearningGovernanceService({
    repository: learningGovernanceRepository,
    learningCandidateRepository,
    knowledgeService,
    templateService,
    promptSkillRegistryService,
  });

  if (input.seedDemoData) {
    seedDemoKnowledgeReviewData({
      repository: knowledgeRepository,
      reviewActionRepository: knowledgeReviewActionRepository,
    });
    seedDemoLearningData({
      manuscriptRepository,
      assetRepository,
      snapshotRepository: reviewedCaseSnapshotRepository,
      candidateRepository: learningCandidateRepository,
      feedbackGovernanceRepository,
    });
    seedDemoWorkbenchData({
      manuscriptRepository,
      assetRepository,
      templateFamilyRepository,
      knowledgeRepository,
      moduleTemplateRepository,
      promptSkillRegistryRepository,
      executionGovernanceRepository,
      sandboxProfileRepository,
      agentProfileRepository,
      agentRuntimeRepository,
      runtimeBindingRepository,
      toolPermissionPolicyRepository,
      modelRegistryRepository,
      modelRoutingPolicyRepository,
    });
  }

  const screeningService = new ScreeningService({
    manuscriptRepository,
    assetRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceService,
    executionTrackingService,
    jobRepository,
    documentAssetService,
    aiGatewayService,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    runtimeBindingReadinessService,
    toolPermissionPolicyService,
    agentExecutionService,
    agentExecutionOrchestrationService,
  });
  const editingService = new EditingService({
    manuscriptRepository,
    assetRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceService,
    executionTrackingService,
    jobRepository,
    documentAssetService,
    aiGatewayService,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    runtimeBindingReadinessService,
    toolPermissionPolicyService,
    agentExecutionService,
    agentExecutionOrchestrationService,
  });
  const proofreadingService = new ProofreadingService({
    manuscriptRepository,
    assetRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceService,
    executionTrackingService,
    jobRepository,
    documentAssetService,
    aiGatewayService,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    runtimeBindingReadinessService,
    toolPermissionPolicyService,
    agentExecutionService,
    agentExecutionOrchestrationService,
  });

  return {
    authRuntime,
    agentExecutionApi: createAgentExecutionApi({
      agentExecutionService,
      runtimeBindingReadinessService,
    }),
    agentProfileApi: createAgentProfileApi({
      agentProfileService,
    }),
    agentRuntimeApi: createAgentRuntimeApi({
      agentRuntimeService,
    }),
    editingApi: createEditingApi({
      editingService,
    }),
    manuscriptApi: createManuscriptApi({
      manuscriptService,
      assetService: documentAssetService,
    }),
    proofreadingApi: createProofreadingApi({
      proofreadingService,
    }),
    screeningApi: createScreeningApi({
      screeningService,
    }),
    documentPipelineApi: {
      async exportCurrentAsset(input) {
        return {
          status: 200,
          body: await exportService.exportCurrentAsset(input),
        };
      },
      async downloadAsset(input) {
        const downloadService = new LocalAssetMaterializationService({
          assetRepository,
          manuscriptRepository,
          rootDir: input.uploadRootDir,
        });
        const download = await downloadService.downloadAsset(input.assetId);

        return {
          status: 200,
          body: null,
          rawBody: download.bytes,
          headers: buildDownloadHeaders(download.fileName, download.mimeType, download.bytes),
        };
      },
    },
    executionGovernanceApi: createExecutionGovernanceApi({
      executionGovernanceService,
    }),
    executionResolutionApi: createExecutionResolutionApi({
      executionResolutionService,
    }),
    executionTrackingApi: createExecutionTrackingApi({
      executionTrackingService,
    }),
    harnessDatasetApi: createHarnessDatasetApi({
      harnessDatasetService,
    }),
    harnessIntegrationApi: createHarnessIntegrationApi({
      harnessIntegrationService,
    }),
    knowledgeApi: createKnowledgeApi({
      knowledgeService,
      harnessDatasetService,
    }),
    learningApi: createLearningApi({ learningService }),
    learningGovernanceApi: createLearningGovernanceApi({
      learningGovernanceService,
      harnessDatasetService,
    }),
    verificationOpsApi: createVerificationOpsApi({
      verificationOpsService,
      harnessDatasetService,
    }),
    templateApi: createTemplateApi({ templateService }),
    modelRegistryApi: createModelRegistryApi({ modelRegistryService }),
    modelRoutingGovernanceApi: createModelRoutingGovernanceApi({
      modelRoutingGovernanceService,
    }),
    promptSkillRegistryApi: createPromptSkillRegistryApi({
      promptSkillRegistryService,
    }),
    runtimeBindingApi: createRuntimeBindingApi({
      runtimeBindingService,
      runtimeBindingReadinessService,
    }),
    sandboxProfileApi: createSandboxProfileApi({
      sandboxProfileService,
    }),
    toolGatewayApi: createToolGatewayApi({
      toolGatewayService,
    }),
    toolPermissionPolicyApi: createToolPermissionPolicyApi({
      toolPermissionPolicyService,
    }),
    permissionGuard,
  };
}

function seedDemoKnowledgeReviewData(input: {
  repository: InMemoryKnowledgeRepository;
  reviewActionRepository: InMemoryKnowledgeReviewActionRepository;
}): void {
  const records: KnowledgeRecord[] = [
    {
      id: "knowledge-demo-1",
      title: "Clinical study endpoint rule",
      canonical_text:
        "Clinical study submissions must state the primary endpoint and analysis method.",
      summary:
        "Used by screening reviewers to verify endpoint and statistics coverage.",
      knowledge_kind: "rule",
      status: "pending_review",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        sections: ["methods"],
        risk_tags: ["statistics"],
        discipline_tags: ["cardiology"],
      },
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.org/guideline",
      aliases: ["endpoint-statistics rule"],
      template_bindings: ["clinical-study-screening-core"],
    },
    {
      id: "knowledge-demo-2",
      title: "Case report privacy checklist",
      canonical_text:
        "Case report submissions must remove direct patient identifiers before proofreading.",
      summary: "Used by proofreading reviewers to confirm privacy coverage.",
      knowledge_kind: "checklist",
      status: "pending_review",
      routing: {
        module_scope: "proofreading",
        manuscript_types: ["case_report"],
        sections: ["appendix"],
        risk_tags: ["privacy"],
        discipline_tags: ["general"],
      },
      evidence_level: "medium",
      source_type: "guideline",
      source_link: "https://example.org/privacy",
      aliases: ["case privacy checklist"],
      template_bindings: ["case-report-proofreading-core"],
    },
  ];

  const reviewActions: KnowledgeReviewActionRecord[] = [
    {
      id: "knowledge-demo-action-1",
      knowledge_item_id: "knowledge-demo-1",
      action: "submitted_for_review",
      actor_role: "user",
      created_at: "2026-03-28T08:00:00.000Z",
    },
    {
      id: "knowledge-demo-action-2",
      knowledge_item_id: "knowledge-demo-2",
      action: "submitted_for_review",
      actor_role: "user",
      created_at: "2026-03-28T09:00:00.000Z",
    },
  ];

  for (const record of records) {
    void input.repository.save(record);
  }

  for (const action of reviewActions) {
    void input.reviewActionRepository.save(action);
  }
}

function seedDemoLearningData(input: {
  manuscriptRepository: InMemoryManuscriptRepository;
  assetRepository: InMemoryDocumentAssetRepository;
  snapshotRepository: InMemoryReviewedCaseSnapshotRepository;
  candidateRepository: InMemoryLearningCandidateRepository;
  feedbackGovernanceRepository: InMemoryFeedbackGovernanceRepository;
}): void {
  const manuscript: ManuscriptRecord = {
    id: "manuscript-demo-1",
    title: "Learning Demo Manuscript",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-demo-1",
    created_at: "2026-03-28T07:30:00.000Z",
    updated_at: "2026-03-28T07:30:00.000Z",
  };
  const assets: DocumentAssetRecord[] = [
    {
      id: "original-demo-1",
      manuscript_id: "manuscript-demo-1",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-demo-1/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parent_asset_id: undefined,
      source_module: "upload",
      source_job_id: undefined,
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-03-28T07:31:00.000Z",
      updated_at: "2026-03-28T07:31:00.000Z",
    },
    {
      id: "human-final-demo-1",
      manuscript_id: "manuscript-demo-1",
      asset_type: "human_final_docx",
      status: "active",
      storage_key: "learning/manuscript-demo-1/human-final.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parent_asset_id: "original-demo-1",
      source_module: "manual",
      source_job_id: undefined,
      created_by: "editor-1",
      version_no: 1,
      is_current: true,
      file_name: "human-final.docx",
      created_at: "2026-03-28T07:32:00.000Z",
      updated_at: "2026-03-28T07:32:00.000Z",
    },
    {
      id: "learning-snapshot-demo-1",
      manuscript_id: "manuscript-demo-1",
      asset_type: "learning_snapshot_attachment",
      status: "active",
      storage_key: "learning/manuscript-demo-1/existing-snapshot.bin",
      mime_type: "application/octet-stream",
      parent_asset_id: "human-final-demo-1",
      source_module: "learning",
      source_job_id: undefined,
      created_by: "editor-1",
      version_no: 1,
      is_current: true,
      file_name: "snapshot.bin",
      created_at: "2026-03-28T07:33:00.000Z",
      updated_at: "2026-03-28T07:33:00.000Z",
    },
  ];
  const candidates: LearningCandidateRecord[] = [
    {
      id: "learning-approved-demo-1",
      type: "rule_candidate",
      status: "approved",
      module: "screening",
      manuscript_type: "clinical_study",
      governed_provenance_kind: "evaluation_experiment",
      governed_evaluation_run_id: "eval-demo-approved-1",
      governed_evidence_pack_id: "evidence-demo-approved-1",
      human_final_asset_id: "human-final-demo-1",
      snapshot_asset_id: "learning-snapshot-demo-1",
      title: "Approved learning candidate demo",
      proposal_text: "Promote reviewed endpoint guidance into the governed registry.",
      created_by: "editor-1",
      created_at: "2026-03-28T07:34:00.000Z",
      updated_at: "2026-03-28T07:35:00.000Z",
    },
    {
      id: "learning-pending-demo-1",
      type: "prompt_optimization_candidate",
      status: "pending_review",
      module: "editing",
      manuscript_type: "clinical_study",
      governed_provenance_kind: "evaluation_experiment",
      governed_evaluation_run_id: "eval-demo-pending-1",
      governed_evidence_pack_id: "evidence-demo-pending-1",
      human_final_asset_id: "human-final-demo-1",
      snapshot_asset_id: "learning-snapshot-demo-1",
      title: "Pending terminology normalization",
      proposal_text: "Tighten terminology normalization and endpoint wording for editing runs.",
      created_by: "editor-1",
      created_at: "2026-03-28T07:36:00.000Z",
      updated_at: "2026-03-28T07:40:00.000Z",
    },
    {
      id: "learning-pending-demo-2",
      type: "checklist_update_candidate",
      status: "pending_review",
      module: "proofreading",
      manuscript_type: "clinical_study",
      governed_provenance_kind: "evaluation_experiment",
      governed_evaluation_run_id: "eval-demo-pending-2",
      governed_evidence_pack_id: "evidence-demo-pending-2",
      human_final_asset_id: "human-final-demo-1",
      snapshot_asset_id: "learning-snapshot-demo-1",
      title: "Pending checklist update",
      proposal_text: "Add a final privacy and consistency checklist before proof handoff.",
      created_by: "editor-1",
      created_at: "2026-03-28T07:37:00.000Z",
      updated_at: "2026-03-28T07:39:00.000Z",
    },
  ];
  const reviewedSnapshots: ReviewedCaseSnapshotRecord[] = [
    {
      id: "reviewed-case-snapshot-demo-1",
      manuscript_id: "manuscript-demo-1",
      module: "editing",
      manuscript_type: "clinical_study",
      human_final_asset_id: "human-final-demo-1",
      deidentification_passed: true,
      snapshot_asset_id: "learning-snapshot-demo-1",
      created_by: "editor-1",
      created_at: "2026-03-28T07:33:30.000Z",
    },
  ];
  const sourceLinks: LearningCandidateSourceLinkRecord[] = [
    {
      id: "learning-source-approved-demo-1",
      learning_candidate_id: "learning-approved-demo-1",
      source_kind: "evaluation_experiment",
      snapshot_kind: "reviewed_case_snapshot",
      snapshot_id: "reviewed-case-snapshot-demo-1",
      evaluation_run_id: "eval-demo-approved-1",
      evidence_pack_id: "evidence-demo-approved-1",
      source_asset_id: "human-final-demo-1",
      created_at: "2026-03-28T07:34:30.000Z",
    },
    {
      id: "learning-source-pending-demo-1",
      learning_candidate_id: "learning-pending-demo-1",
      source_kind: "evaluation_experiment",
      snapshot_kind: "reviewed_case_snapshot",
      snapshot_id: "reviewed-case-snapshot-demo-1",
      evaluation_run_id: "eval-demo-pending-1",
      evidence_pack_id: "evidence-demo-pending-1",
      source_asset_id: "human-final-demo-1",
      created_at: "2026-03-28T07:36:30.000Z",
    },
    {
      id: "learning-source-pending-demo-2",
      learning_candidate_id: "learning-pending-demo-2",
      source_kind: "evaluation_experiment",
      snapshot_kind: "reviewed_case_snapshot",
      snapshot_id: "reviewed-case-snapshot-demo-1",
      evaluation_run_id: "eval-demo-pending-2",
      evidence_pack_id: "evidence-demo-pending-2",
      source_asset_id: "human-final-demo-1",
      created_at: "2026-03-28T07:37:30.000Z",
    },
  ];

  void input.manuscriptRepository.save(manuscript);
  for (const asset of assets) {
    void input.assetRepository.save(asset);
  }
  for (const snapshot of reviewedSnapshots) {
    void input.snapshotRepository.save(snapshot);
  }
  for (const candidate of candidates) {
    void input.candidateRepository.save(candidate);
  }
  for (const sourceLink of sourceLinks) {
    void input.feedbackGovernanceRepository.saveLearningCandidateSourceLink(
      sourceLink,
    );
  }
}

function seedDemoWorkbenchData(input: {
  manuscriptRepository: InMemoryManuscriptRepository;
  assetRepository: InMemoryDocumentAssetRepository;
  templateFamilyRepository: InMemoryTemplateFamilyRepository;
  knowledgeRepository: InMemoryKnowledgeRepository;
  moduleTemplateRepository: InMemoryModuleTemplateRepository;
  promptSkillRegistryRepository: InMemoryPromptSkillRegistryRepository;
  executionGovernanceRepository: InMemoryExecutionGovernanceRepository;
  sandboxProfileRepository: InMemorySandboxProfileRepository;
  agentProfileRepository: InMemoryAgentProfileRepository;
  agentRuntimeRepository: InMemoryAgentRuntimeRepository;
  runtimeBindingRepository: InMemoryRuntimeBindingRepository;
  toolPermissionPolicyRepository: InMemoryToolPermissionPolicyRepository;
  modelRegistryRepository: InMemoryModelRegistryRepository;
  modelRoutingPolicyRepository: InMemoryModelRoutingPolicyRepository;
}): void {
  void input.manuscriptRepository.save({
    id: "manuscript-seeded-1",
    title: "Seeded Workbench Manuscript",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "seed-user",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-seeded-1",
    created_at: "2026-03-31T07:55:00.000Z",
    updated_at: "2026-03-31T07:55:00.000Z",
  });
  void input.assetRepository.save({
    id: "original-seeded-1",
    manuscript_id: "manuscript-seeded-1",
    asset_type: "original",
    status: "active",
    storage_key: "uploads/seeded/original.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: undefined,
    source_module: "upload",
    source_job_id: undefined,
    created_by: "seed-user",
    version_no: 1,
    is_current: true,
    file_name: "seeded-original.docx",
    created_at: "2026-03-31T07:56:00.000Z",
    updated_at: "2026-03-31T07:56:00.000Z",
  });
  void input.templateFamilyRepository.save({
    id: "family-seeded-1",
    manuscript_type: "clinical_study",
    name: "Seeded Clinical Study Family",
    status: "active",
  });

  void input.moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-seeded-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Seeded screening prompt",
  });
  void input.moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-seeded-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Seeded editing prompt",
  });
  void input.moduleTemplateRepository.save({
    id: "template-proofreading-1",
    template_family_id: "family-seeded-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Seeded proofreading prompt",
  });

  void input.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  void input.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  void input.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-proofreading-1",
    name: "proofreading_mainline",
    version: "1.0.0",
    status: "published",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
  });
  void input.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-screening-1",
    name: "screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["screening"],
  });
  void input.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  void input.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-proofreading-1",
    name: "proofreading_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["proofreading"],
  });

  void input.knowledgeRepository.save({
    id: "knowledge-screening-1",
    title: "Screening knowledge",
    canonical_text: "Check endpoint definitions.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-screening-1"],
  });
  void input.knowledgeRepository.save({
    id: "knowledge-editing-1",
    title: "Editing knowledge",
    canonical_text: "Normalize manuscript terminology.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-editing-1"],
  });
  void input.knowledgeRepository.save({
    id: "knowledge-proofreading-1",
    title: "Proofreading knowledge",
    canonical_text: "Confirm punctuation consistency.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-proofreading-1"],
  });

  void input.executionGovernanceRepository.saveProfile({
    id: "profile-screening-1",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    module_template_id: "template-screening-1",
    prompt_template_id: "prompt-screening-1",
    skill_package_ids: ["skill-screening-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  void input.executionGovernanceRepository.saveProfile({
    id: "profile-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    module_template_id: "template-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  void input.executionGovernanceRepository.saveProfile({
    id: "profile-proofreading-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    module_template_id: "template-proofreading-1",
    prompt_template_id: "prompt-proofreading-1",
    skill_package_ids: ["skill-proofreading-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });

  void input.sandboxProfileRepository.save({
    id: "sandbox-screening-1",
    name: "Screening Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });
  void input.sandboxProfileRepository.save({
    id: "sandbox-editing-1",
    name: "Editing Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });
  void input.sandboxProfileRepository.save({
    id: "sandbox-proofreading-1",
    name: "Proofreading Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });

  void input.agentRuntimeRepository.save({
    id: "runtime-screening-1",
    name: "Screening Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "sandbox-screening-1",
    allowed_modules: ["screening"],
    runtime_slot: "screening",
    admin_only: true,
  });
  void input.agentRuntimeRepository.save({
    id: "runtime-editing-1",
    name: "Editing Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "sandbox-editing-1",
    allowed_modules: ["editing"],
    runtime_slot: "editing",
    admin_only: true,
  });
  void input.agentRuntimeRepository.save({
    id: "runtime-proofreading-1",
    name: "Proofreading Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "sandbox-proofreading-1",
    allowed_modules: ["proofreading"],
    runtime_slot: "proofreading",
    admin_only: true,
  });

  void input.agentProfileRepository.save({
    id: "agent-profile-screening-1",
    name: "Screening Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["screening"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });
  void input.agentProfileRepository.save({
    id: "agent-profile-editing-1",
    name: "Editing Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["editing"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });
  void input.agentProfileRepository.save({
    id: "agent-profile-proofreading-1",
    name: "Proofreading Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["proofreading"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });

  void input.toolPermissionPolicyRepository.save({
    id: "policy-screening-1",
    name: "Screening Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });
  void input.toolPermissionPolicyRepository.save({
    id: "policy-editing-1",
    name: "Editing Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });
  void input.toolPermissionPolicyRepository.save({
    id: "policy-proofreading-1",
    name: "Proofreading Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });

  void input.runtimeBindingRepository.save({
    id: "binding-screening-1",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    runtime_id: "runtime-screening-1",
    sandbox_profile_id: "sandbox-screening-1",
    agent_profile_id: "agent-profile-screening-1",
    tool_permission_policy_id: "policy-screening-1",
    prompt_template_id: "prompt-screening-1",
    skill_package_ids: ["skill-screening-1"],
    execution_profile_id: "profile-screening-1",
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    release_check_profile_id: undefined,
    status: "active",
    version: 1,
  });
  void input.runtimeBindingRepository.save({
    id: "binding-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    runtime_id: "runtime-editing-1",
    sandbox_profile_id: "sandbox-editing-1",
    agent_profile_id: "agent-profile-editing-1",
    tool_permission_policy_id: "policy-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    execution_profile_id: "profile-editing-1",
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    release_check_profile_id: undefined,
    status: "active",
    version: 1,
  });
  void input.runtimeBindingRepository.save({
    id: "binding-proofreading-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "family-seeded-1",
    runtime_id: "runtime-proofreading-1",
    sandbox_profile_id: "sandbox-proofreading-1",
    agent_profile_id: "agent-profile-proofreading-1",
    tool_permission_policy_id: "policy-proofreading-1",
    prompt_template_id: "prompt-proofreading-1",
    skill_package_ids: ["skill-proofreading-1"],
    execution_profile_id: "profile-proofreading-1",
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    release_check_profile_id: undefined,
    status: "active",
    version: 1,
  });

  void input.modelRegistryRepository.save({
    id: "model-screening-1",
    provider: "openai",
    model_name: "screening-model",
    model_version: "2026-03-31",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  void input.modelRegistryRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "editing-model",
    model_version: "2026-03-31",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
  });
  void input.modelRegistryRepository.save({
    id: "model-proofreading-1",
    provider: "openai",
    model_name: "proofreading-model",
    model_version: "2026-03-31",
    allowed_modules: ["proofreading"],
    is_prod_allowed: true,
  });
  void input.modelRoutingPolicyRepository.save({
    system_default_model_id: undefined,
    module_defaults: {
      screening: "model-screening-1",
      editing: "model-editing-1",
      proofreading: "model-proofreading-1",
    },
    template_overrides: {},
  });
}

async function handleRoute(
  routeMatch: HttpRouteMatch,
  req: IncomingMessage,
  runtime: ApiServerRuntime,
  uploadRootDir: string,
  harnessExportRootDir: string,
  serviceHealth: HttpServiceHealthProvider,
): Promise<RouteResponse<unknown>> {
  switch (routeMatch.route) {
    case "healthz":
      return {
        status: 200,
        body: serviceHealth.getLiveness(),
      };
    case "readyz": {
      const readiness = await serviceHealth.getReadiness();
      return {
        status: readiness.status === "ready" ? 200 : 503,
        body: readiness,
      };
    }
    case "auth-local-login": {
      const body = (await readJsonBody(req)) as {
        username: string;
        password: string;
      };
      const session = await runtime.authRuntime.authenticateLocal({
        username: body.username,
        password: body.password,
        ipAddress: readRemoteAddress(req),
        userAgent: readSingleHeader(req.headers["user-agent"]),
      });

      return {
        status: 200,
        body: {
          provider: session.provider,
          user: session.user,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
          refreshAt: session.refreshAt,
        },
        headers: {
          "Set-Cookie": runtime.authRuntime.createSessionCookieHeader(session),
        },
      };
    }
    case "auth-session": {
      const session = await runtime.authRuntime.requireSession(req);

      return {
        status: 200,
        body: {
          provider: session.provider,
          user: session.user,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
          refreshAt: session.refreshAt,
        },
      };
    }
    case "auth-logout":
      await runtime.authRuntime.clearSession(req);
      return {
        status: 204,
        body: null,
        headers: {
          "Set-Cookie": runtime.authRuntime.createClearedSessionCookieHeader(),
        },
      };
    case "manuscripts-upload": {
      const session = await requirePermission(req, runtime, "manuscripts.submit");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.manuscriptApi.upload
      >[0] & {
        fileContentBase64?: string;
        storageKey?: string;
      };
      const {
        fileContentBase64,
        storageKey: requestedStorageKey,
        ...uploadBody
      } = body;
      const storageKey = await resolveUploadStorageKey({
        fileName: uploadBody.fileName,
        fileContentBase64,
        requestedStorageKey,
        uploadRootDir,
      });

      return runtime.manuscriptApi.upload({
        ...uploadBody,
        createdBy: session.user.id,
        storageKey,
      });
    }
    case "manuscripts-get":
      await runtime.authRuntime.requireSession(req);
      return runtime.manuscriptApi.getManuscript({
        manuscriptId: routeMatch.manuscriptId,
      });
    case "manuscripts-list-assets":
      await runtime.authRuntime.requireSession(req);
      return runtime.manuscriptApi.listAssets({
        manuscriptId: routeMatch.manuscriptId,
      });
    case "jobs-get":
      await runtime.authRuntime.requireSession(req);
      return runtime.manuscriptApi.getJob({
        jobId: routeMatch.jobId,
      });
    case "document-pipeline-export-current-asset": {
      await runtime.authRuntime.requireSession(req);
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.documentPipelineApi.exportCurrentAsset
      >[0];
      return runtime.documentPipelineApi.exportCurrentAsset(body);
    }
    case "document-assets-download":
      await runtime.authRuntime.requireSession(req);
      return runtime.documentPipelineApi.downloadAsset({
        assetId: routeMatch.assetId,
        uploadRootDir,
      });
    case "harness-datasets-workbench": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.harnessDatasetApi.listWorkbenchOverview({
        actorRole: session.user.role,
        exportRootDir: harnessExportRootDir,
      });
    }
    case "harness-datasets-export-gold-set-version": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        format: "json" | "jsonl";
      };

      return runtime.harnessDatasetApi.exportGoldSetVersion({
        actorRole: session.user.role,
        goldSetVersionId: routeMatch.goldSetVersionId,
        input: {
          format: body.format,
          exportRootDir: harnessExportRootDir,
        },
      });
    }
    case "harness-integrations-list-adapters":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.harnessIntegrationApi.listAdapters();
    case "harness-integrations-launch-governed-run": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.harnessIntegrationApi.launchGovernedRun
      >[0];

      return runtime.harnessIntegrationApi.launchGovernedRun({
        ...body,
        actorRole: session.user.role,
      });
    }
    case "harness-integrations-list-adapter-executions":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.harnessIntegrationApi.listExecutionAuditsByAdapterId({
        adapterId: routeMatch.adapterId,
      });
    case "modules-screening-run": {
      const session = await requirePermission(req, runtime, "workbench.screening");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.screeningApi.runScreening
      >[0];

      return runtime.screeningApi.runScreening({
        ...body,
        requestedBy: session.user.id,
        actorRole: session.user.role,
      });
    }
    case "modules-editing-run": {
      const session = await requirePermission(req, runtime, "workbench.editing");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.editingApi.runEditing
      >[0];

      return runtime.editingApi.runEditing({
        ...body,
        requestedBy: session.user.id,
        actorRole: session.user.role,
      });
    }
    case "modules-proofreading-draft": {
      const session = await requirePermission(req, runtime, "workbench.proofreading");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.proofreadingApi.createDraft
      >[0];

      return runtime.proofreadingApi.createDraft({
        ...body,
        requestedBy: session.user.id,
        actorRole: session.user.role,
      });
    }
    case "modules-proofreading-finalize": {
      const session = await requirePermission(req, runtime, "workbench.proofreading");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.proofreadingApi.confirmFinal
      >[0];

      return runtime.proofreadingApi.confirmFinal({
        ...body,
        requestedBy: session.user.id,
        actorRole: session.user.role,
      });
    }
    case "modules-proofreading-publish-human-final": {
      const session = await requirePermission(req, runtime, "workbench.proofreading");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.proofreadingApi.publishHumanFinal
      >[0];

      return runtime.proofreadingApi.publishHumanFinal({
        ...body,
        requestedBy: session.user.id,
        actorRole: session.user.role,
      });
    }
    case "agent-runtime-create": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<typeof runtime.agentRuntimeApi.createRuntime>[0]["input"];
      };

      return runtime.agentRuntimeApi.createRuntime({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "agent-runtime-list":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentRuntimeApi.listRuntimes();
    case "agent-runtime-list-by-module":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentRuntimeApi.listRuntimesByModule({
        module: routeMatch.module as Parameters<
          typeof runtime.agentRuntimeApi.listRuntimesByModule
        >[0]["module"],
        activeOnly: routeMatch.activeOnly,
      });
    case "agent-runtime-get":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentRuntimeApi.getRuntime({
        runtimeId: routeMatch.runtimeId,
      });
    case "agent-runtime-publish": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentRuntimeApi.publishRuntime({
        actorRole: session.user.role,
        runtimeId: routeMatch.runtimeId,
      });
    }
    case "agent-runtime-archive": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentRuntimeApi.archiveRuntime({
        actorRole: session.user.role,
        runtimeId: routeMatch.runtimeId,
      });
    }
    case "tool-gateway-create": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<typeof runtime.toolGatewayApi.createTool>[0]["input"];
      };

      return runtime.toolGatewayApi.createTool({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "tool-gateway-list":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.toolGatewayApi.listTools();
    case "tool-gateway-list-by-scope":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.toolGatewayApi.listToolsByScope({
        scope: routeMatch.scope as Parameters<
          typeof runtime.toolGatewayApi.listToolsByScope
        >[0]["scope"],
      });
    case "tool-gateway-get":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.toolGatewayApi.getTool({
        toolId: routeMatch.toolId,
      });
    case "tool-gateway-update": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<typeof runtime.toolGatewayApi.updateTool>[0]["input"];
      };

      return runtime.toolGatewayApi.updateTool({
        actorRole: session.user.role,
        toolId: routeMatch.toolId,
        input: body.input,
      });
    }
    case "sandbox-profile-create": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<typeof runtime.sandboxProfileApi.createProfile>[0]["input"];
      };

      return runtime.sandboxProfileApi.createProfile({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "sandbox-profile-list":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.sandboxProfileApi.listProfiles();
    case "sandbox-profile-get":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.sandboxProfileApi.getProfile({
        profileId: routeMatch.profileId,
      });
    case "sandbox-profile-activate": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.sandboxProfileApi.activateProfile({
        actorRole: session.user.role,
        profileId: routeMatch.profileId,
      });
    }
    case "sandbox-profile-archive": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.sandboxProfileApi.archiveProfile({
        actorRole: session.user.role,
        profileId: routeMatch.profileId,
      });
    }
    case "agent-profile-create": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<typeof runtime.agentProfileApi.createProfile>[0]["input"];
      };

      return runtime.agentProfileApi.createProfile({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "agent-profile-list":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentProfileApi.listProfiles();
    case "agent-profile-get":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentProfileApi.getProfile({
        profileId: routeMatch.profileId,
      });
    case "agent-profile-publish": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentProfileApi.publishProfile({
        actorRole: session.user.role,
        profileId: routeMatch.profileId,
      });
    }
    case "agent-profile-archive": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentProfileApi.archiveProfile({
        actorRole: session.user.role,
        profileId: routeMatch.profileId,
      });
    }
    case "runtime-binding-create": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<typeof runtime.runtimeBindingApi.createBinding>[0]["input"];
      };

      return runtime.runtimeBindingApi.createBinding({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "runtime-binding-list":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.runtimeBindingApi.listBindings();
    case "runtime-binding-list-by-scope":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.runtimeBindingApi.listBindingsForScope({
        module: routeMatch.module as Parameters<
          typeof runtime.runtimeBindingApi.listBindingsForScope
        >[0]["module"],
        manuscriptType: routeMatch.manuscriptType as Parameters<
          typeof runtime.runtimeBindingApi.listBindingsForScope
        >[0]["manuscriptType"],
        templateFamilyId: routeMatch.templateFamilyId,
        activeOnly: routeMatch.activeOnly,
      });
    case "runtime-binding-get":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.runtimeBindingApi.getBinding({
        bindingId: routeMatch.bindingId,
      });
    case "runtime-binding-get-readiness":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.runtimeBindingApi.getBindingReadiness({
        bindingId: routeMatch.bindingId,
      });
    case "runtime-binding-activate": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.runtimeBindingApi.activateBinding({
        actorRole: session.user.role,
        bindingId: routeMatch.bindingId,
      });
    }
    case "runtime-binding-active-readiness":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.runtimeBindingApi.getActiveBindingReadinessForScope({
        module: routeMatch.module as Parameters<
          typeof runtime.runtimeBindingApi.getActiveBindingReadinessForScope
        >[0]["module"],
        manuscriptType: routeMatch.manuscriptType as Parameters<
          typeof runtime.runtimeBindingApi.getActiveBindingReadinessForScope
        >[0]["manuscriptType"],
        templateFamilyId: routeMatch.templateFamilyId,
      });
    case "runtime-binding-archive": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.runtimeBindingApi.archiveBinding({
        actorRole: session.user.role,
        bindingId: routeMatch.bindingId,
      });
    }
    case "tool-permission-policy-create": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<
          typeof runtime.toolPermissionPolicyApi.createPolicy
        >[0]["input"];
      };

      return runtime.toolPermissionPolicyApi.createPolicy({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "tool-permission-policy-list":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.toolPermissionPolicyApi.listPolicies();
    case "tool-permission-policy-get":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.toolPermissionPolicyApi.getPolicy({
        policyId: routeMatch.policyId,
      });
    case "tool-permission-policy-activate": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.toolPermissionPolicyApi.activatePolicy({
        actorRole: session.user.role,
        policyId: routeMatch.policyId,
      });
    }
    case "tool-permission-policy-archive": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.toolPermissionPolicyApi.archivePolicy({
        actorRole: session.user.role,
        policyId: routeMatch.policyId,
      });
    }
    case "agent-execution-create":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentExecutionApi.createLog(
        (await readJsonBody(req)) as Parameters<
          typeof runtime.agentExecutionApi.createLog
        >[0],
      );
    case "agent-execution-list":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentExecutionApi.listLogs();
    case "agent-execution-get":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentExecutionApi.getLog({
        logId: routeMatch.logId,
      });
    case "agent-execution-complete":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.agentExecutionApi.completeLog({
        logId: routeMatch.logId,
        ...((await readJsonBody(req)) as Omit<
          Parameters<typeof runtime.agentExecutionApi.completeLog>[0],
          "logId"
        >),
      });
    case "execution-governance-create-profile": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<typeof runtime.executionGovernanceApi.createProfile>[0]["input"];
      };

      return runtime.executionGovernanceApi.createProfile({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "execution-governance-list-profiles":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionGovernanceApi.listProfiles();
    case "execution-governance-publish-profile": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionGovernanceApi.publishProfile({
        actorRole: session.user.role,
        profileId: routeMatch.profileId,
      });
    }
    case "execution-governance-archive-profile": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionGovernanceApi.archiveProfile({
        actorRole: session.user.role,
        profileId: routeMatch.profileId,
      });
    }
    case "execution-governance-create-knowledge-binding-rule": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<
          typeof runtime.executionGovernanceApi.createKnowledgeBindingRule
        >[0]["input"];
      };

      return runtime.executionGovernanceApi.createKnowledgeBindingRule({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "execution-governance-list-knowledge-binding-rules":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionGovernanceApi.listKnowledgeBindingRules();
    case "execution-governance-activate-knowledge-binding-rule": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionGovernanceApi.activateKnowledgeBindingRule({
        actorRole: session.user.role,
        ruleId: routeMatch.ruleId,
      });
    }
    case "execution-governance-resolve":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionResolutionApi.resolveBundle({
        input: (await readJsonBody(req)) as Parameters<
          typeof runtime.executionResolutionApi.resolveBundle
        >[0]["input"],
      });
    case "execution-tracking-record-snapshot":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionTrackingApi.recordSnapshot({
        input: ((await readJsonBody(req)) as {
          input: Parameters<typeof runtime.executionTrackingApi.recordSnapshot>[0]["input"];
        }).input,
      });
    case "execution-tracking-get-snapshot":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionTrackingApi.getSnapshot({
        snapshotId: routeMatch.snapshotId,
      });
    case "execution-tracking-list-knowledge-hit-logs":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.executionTrackingApi.listKnowledgeHitLogsBySnapshotId({
        snapshotId: routeMatch.snapshotId,
      });
    case "templates-create-family":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.createTemplateFamily(
        (await readJsonBody(req)) as Parameters<typeof runtime.templateApi.createTemplateFamily>[0],
      );
    case "templates-list-families":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.listTemplateFamilies();
    case "templates-update-family":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.updateTemplateFamily({
        templateFamilyId: routeMatch.templateFamilyId,
        input: (await readJsonBody(req)) as Parameters<
          typeof runtime.templateApi.updateTemplateFamily
        >[0]["input"],
      });
    case "templates-create-module-draft":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.createModuleTemplateDraft(
        (await readJsonBody(req)) as Parameters<
          typeof runtime.templateApi.createModuleTemplateDraft
        >[0],
      );
    case "templates-update-module-draft":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.updateModuleTemplateDraft({
        moduleTemplateId: routeMatch.moduleTemplateId,
        input: (await readJsonBody(req)) as Parameters<
          typeof runtime.templateApi.updateModuleTemplateDraft
        >[0]["input"],
      });
    case "templates-list-module-templates":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.templateApi.listModuleTemplatesByTemplateFamilyId({
        templateFamilyId: routeMatch.templateFamilyId,
      });
    case "templates-create-retrieval-quality-run": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<typeof runtime.templateApi.createRetrievalQualityRun>[0]["input"],
          "createdBy"
        >;
      };

      return runtime.templateApi.createRetrievalQualityRun({
        templateFamilyId: routeMatch.templateFamilyId,
        actorRole: session.user.role,
        input: {
          ...body.input,
          createdBy: session.user.id,
        },
      });
    }
    case "templates-publish-module-template": {
      const session = await requirePermission(req, runtime, "templates.publish");
      return runtime.templateApi.publishModuleTemplate({
        moduleTemplateId: routeMatch.moduleTemplateId,
        actorRole: session.user.role,
      });
    }
    case "prompt-skill-create-skill-package": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        name: string;
        version: string;
        appliesToModules: string[];
        dependencyTools?: string[];
      };

      return runtime.promptSkillRegistryApi.createSkillPackage({
        actorRole: session.user.role,
        input: {
          name: body.name,
          version: body.version,
          appliesToModules: body.appliesToModules as Parameters<
            typeof runtime.promptSkillRegistryApi.createSkillPackage
          >[0]["input"]["appliesToModules"],
          dependencyTools: body.dependencyTools,
        },
      });
    }
    case "prompt-skill-list-skill-packages":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.promptSkillRegistryApi.listSkillPackages();
    case "prompt-skill-publish-skill-package": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.promptSkillRegistryApi.publishSkillPackage({
        actorRole: session.user.role,
        skillPackageId: routeMatch.skillPackageId,
      });
    }
    case "prompt-skill-create-prompt-template": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        name: string;
        version: string;
        module: string;
        manuscriptTypes: string[] | "any";
        rollbackTargetVersion?: string;
      };

      return runtime.promptSkillRegistryApi.createPromptTemplate({
        actorRole: session.user.role,
        input: {
          name: body.name,
          version: body.version,
          module: body.module as Parameters<
            typeof runtime.promptSkillRegistryApi.createPromptTemplate
          >[0]["input"]["module"],
          manuscriptTypes: body.manuscriptTypes as Parameters<
            typeof runtime.promptSkillRegistryApi.createPromptTemplate
          >[0]["input"]["manuscriptTypes"],
          rollbackTargetVersion: coalesceOptionalString(body.rollbackTargetVersion),
        },
      });
    }
    case "prompt-skill-list-prompt-templates":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.promptSkillRegistryApi.listPromptTemplates();
    case "prompt-skill-publish-prompt-template": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.promptSkillRegistryApi.publishPromptTemplate({
        actorRole: session.user.role,
        promptTemplateId: routeMatch.promptTemplateId,
      });
    }
    case "model-registry-create-entry": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        provider: string;
        modelName: string;
        modelVersion?: string;
        allowedModules: string[];
        isProdAllowed: boolean;
        costProfile?: Parameters<
          typeof runtime.modelRegistryApi.createModelEntry
        >[0]["input"]["costProfile"];
        rateLimit?: Parameters<
          typeof runtime.modelRegistryApi.createModelEntry
        >[0]["input"]["rateLimit"];
        fallbackModelId?: string | null;
      };

      return runtime.modelRegistryApi.createModelEntry({
        actorRole: session.user.role,
        input: {
          provider: body.provider as Parameters<
            typeof runtime.modelRegistryApi.createModelEntry
          >[0]["input"]["provider"],
          modelName: body.modelName,
          modelVersion: coalesceOptionalString(body.modelVersion),
          allowedModules: body.allowedModules as Parameters<
            typeof runtime.modelRegistryApi.createModelEntry
          >[0]["input"]["allowedModules"],
          isProdAllowed: body.isProdAllowed,
          costProfile: body.costProfile,
          rateLimit: body.rateLimit,
          fallbackModelId:
            typeof body.fallbackModelId === "string"
              ? coalesceOptionalString(body.fallbackModelId)
              : undefined,
        },
      });
    }
    case "model-registry-list-entries":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.modelRegistryApi.listModelEntries();
    case "model-registry-update-entry": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        allowedModules?: string[];
        isProdAllowed?: boolean;
        costProfile?: Parameters<
          typeof runtime.modelRegistryApi.updateModelEntry
        >[0]["input"]["costProfile"];
        rateLimit?: Parameters<
          typeof runtime.modelRegistryApi.updateModelEntry
        >[0]["input"]["rateLimit"];
        fallbackModelId?: string | null;
      };

      return runtime.modelRegistryApi.updateModelEntry({
        actorRole: session.user.role,
        modelId: routeMatch.modelId,
        input: {
          allowedModules: body.allowedModules as Parameters<
            typeof runtime.modelRegistryApi.updateModelEntry
          >[0]["input"]["allowedModules"],
          isProdAllowed: body.isProdAllowed,
          costProfile: body.costProfile,
          rateLimit: body.rateLimit,
          fallbackModelId:
            typeof body.fallbackModelId === "string"
              ? coalesceOptionalString(body.fallbackModelId)
              : body.fallbackModelId === null
                ? null
                : undefined,
        },
      });
    }
    case "model-registry-get-routing-policy":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.modelRegistryApi.getRoutingPolicy();
    case "model-registry-update-routing-policy": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        systemDefaultModelId?: string | null;
        moduleDefaults?: Record<string, string | null>;
        templateOverrides?: Record<string, string | null>;
      };

      return runtime.modelRegistryApi.updateRoutingPolicy({
        actorRole: session.user.role,
        input: {
          systemDefaultModelId:
            typeof body.systemDefaultModelId === "string"
              ? coalesceOptionalString(body.systemDefaultModelId)
              : body.systemDefaultModelId === null
                ? null
                : undefined,
          moduleDefaults: body.moduleDefaults as Parameters<
            typeof runtime.modelRegistryApi.updateRoutingPolicy
          >[0]["input"]["moduleDefaults"],
          templateOverrides: body.templateOverrides,
        },
      });
    }
    case "model-routing-governance-list-policies":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.modelRoutingGovernanceApi.listPolicies();
    case "model-routing-governance-create-policy": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<typeof runtime.modelRoutingGovernanceApi.createPolicy>[0]["input"];
      };

      return runtime.modelRoutingGovernanceApi.createPolicy({
        actorRole: session.user.role,
        input: body.input,
      });
    }
    case "model-routing-governance-create-draft-version": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<
          typeof runtime.modelRoutingGovernanceApi.createDraftVersion
        >[0]["input"];
      };

      return runtime.modelRoutingGovernanceApi.createDraftVersion({
        actorRole: session.user.role,
        policyId: routeMatch.policyId,
        input: body.input,
      });
    }
    case "model-routing-governance-update-draft-version": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        input: Parameters<
          typeof runtime.modelRoutingGovernanceApi.updateDraftVersion
        >[0]["input"];
      };

      return runtime.modelRoutingGovernanceApi.updateDraftVersion({
        actorRole: session.user.role,
        versionId: routeMatch.versionId,
        input: body.input,
      });
    }
    case "model-routing-governance-submit-version": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        actorId?: string;
        reason?: string;
      };

      return runtime.modelRoutingGovernanceApi.submitVersion({
        actorRole: session.user.role,
        versionId: routeMatch.versionId,
        input: {
          actorId: coalesceOptionalString(body.actorId),
          reason: coalesceOptionalString(body.reason),
        },
      });
    }
    case "model-routing-governance-approve-version": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        actorId?: string;
        reason?: string;
      };

      return runtime.modelRoutingGovernanceApi.approveVersion({
        actorRole: session.user.role,
        versionId: routeMatch.versionId,
        input: {
          actorId: coalesceOptionalString(body.actorId),
          reason: coalesceOptionalString(body.reason),
        },
      });
    }
    case "model-routing-governance-activate-version": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        actorId?: string;
        reason?: string;
      };

      return runtime.modelRoutingGovernanceApi.activateVersion({
        actorRole: session.user.role,
        versionId: routeMatch.versionId,
        input: {
          actorId: coalesceOptionalString(body.actorId),
          reason: coalesceOptionalString(body.reason),
        },
      });
    }
    case "model-routing-governance-rollback-policy": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        actorRole?: string;
        actorId?: string;
        reason?: string;
      };

      return runtime.modelRoutingGovernanceApi.rollbackPolicy({
        actorRole: session.user.role,
        policyId: routeMatch.policyId,
        input: {
          actorId: coalesceOptionalString(body.actorId),
          reason: coalesceOptionalString(body.reason),
        },
      });
    }
    case "knowledge-create-draft":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.createDraft(
        (await readJsonBody(req)) as CreateKnowledgeDraftInput,
      );
    case "knowledge-list":
      await requirePermission(req, runtime, "knowledge.review");
      return runtime.knowledgeApi.listKnowledgeItems();
    case "knowledge-review-queue":
      await requirePermission(req, runtime, "knowledge.review");
      return runtime.knowledgeApi.listPendingReviewItems();
    case "knowledge-submit":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.submitForReview({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "knowledge-approve": {
      const session = await requirePermission(req, runtime, "knowledge.review");
      const body = (await readJsonBody(req)) as {
        reviewNote?: string;
      };

      return runtime.knowledgeApi.approve({
        knowledgeItemId: routeMatch.knowledgeItemId,
        actorRole: session.user.role,
        reviewNote: coalesceOptionalString(body.reviewNote),
      });
    }
    case "knowledge-reject": {
      const session = await requirePermission(req, runtime, "knowledge.review");
      const body = (await readJsonBody(req)) as {
        reviewNote?: string;
      };

      return runtime.knowledgeApi.reject({
        knowledgeItemId: routeMatch.knowledgeItemId,
        actorRole: session.user.role,
        reviewNote: coalesceOptionalString(body.reviewNote),
      });
    }
    case "knowledge-update-draft":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.updateDraft({
        knowledgeItemId: routeMatch.knowledgeItemId,
        input: (await readJsonBody(req)) as UpdateKnowledgeDraftInput,
      });
    case "knowledge-review-actions":
      await requirePermission(req, runtime, "knowledge.review");
      return runtime.knowledgeApi.listReviewActions({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "knowledge-create-harness-dataset-candidate": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<
            typeof runtime.knowledgeApi.createHarnessDatasetCandidateFromHumanFinalAsset
          >[0]["input"],
          "createdBy"
        >;
      };

      return runtime.knowledgeApi.createHarnessDatasetCandidateFromHumanFinalAsset({
        actorRole: session.user.role,
        humanFinalAssetId: routeMatch.humanFinalAssetId,
        input: {
          ...body.input,
          createdBy: session.user.id,
        },
      });
    }
    case "templates-get-latest-retrieval-quality-run": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.templateApi.getLatestRetrievalQualityRun({
        templateFamilyId: routeMatch.templateFamilyId,
        actorRole: session.user.role,
      });
    }
    case "knowledge-resolve-governed-retrieval-context": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as Omit<
        ResolveGovernedRetrievalContextInput,
        "actorId" | "actorRole"
      >;

      return runtime.knowledgeApi.resolveGovernedRetrievalContext({
        input: {
          ...body,
          actorId: session.user.id,
          actorRole: session.user.role,
        },
      });
    }
    case "knowledge-get-retrieval-snapshot": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.getRetrievalSnapshot({
        actorRole: session.user.role,
        snapshotId: routeMatch.snapshotId,
      });
    }
    case "knowledge-archive":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.knowledgeApi.archive({
        knowledgeItemId: routeMatch.knowledgeItemId,
      });
    case "learning-create-reviewed-case-snapshot": {
      const session = await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.createReviewedCaseSnapshot(
        {
          ...((await readJsonBody(req)) as Omit<
            CreateReviewedCaseSnapshotInput,
            "requestedBy"
          >),
          requestedBy: session.user.id,
        },
      );
    }
    case "learning-list-candidates":
      await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.listLearningCandidates();
    case "learning-review-queue":
      await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.listPendingReviewCandidates();
    case "learning-get-candidate":
      await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.getLearningCandidate({
        candidateId: routeMatch.candidateId,
      });
    case "learning-create-candidate": {
      const session = await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.createLearningCandidate(
        {
          ...((await readJsonBody(req)) as Omit<
            CreateLearningCandidateInput,
            "requestedBy"
          >),
          requestedBy: session.user.id,
        },
      );
    }
    case "learning-create-governed-candidate": {
      const session = await requirePermission(req, runtime, "learning.review");
      return runtime.learningApi.createGovernedLearningCandidate(
        {
          ...((await readJsonBody(req)) as Omit<
            CreateGovernedLearningCandidateInput,
            "requestedBy"
          >),
          requestedBy: session.user.id,
        },
      );
    }
    case "learning-approve-candidate": {
      const session = await requirePermission(req, runtime, "learning.review");

      return runtime.learningApi.approveLearningCandidate({
        candidateId: routeMatch.candidateId,
        actorRole: session.user.role,
      });
    }
    case "learning-governance-create-writeback": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<typeof runtime.learningGovernanceApi.createWriteback>[0]["input"],
          "createdBy"
        >;
      };

      return runtime.learningGovernanceApi.createWriteback({
        actorRole: session.user.role,
        input: {
          ...body.input,
          createdBy: session.user.id,
        },
      });
    }
    case "learning-governance-apply-writeback": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<typeof runtime.learningGovernanceApi.applyWriteback>[0]["input"],
          "writebackId" | "appliedBy"
        >;
      };

      return runtime.learningGovernanceApi.applyWriteback({
        actorRole: session.user.role,
        input: {
          ...body.input,
          writebackId: routeMatch.writebackId,
          appliedBy: session.user.id,
        } as Parameters<typeof runtime.learningGovernanceApi.applyWriteback>[0]["input"],
      });
    }
    case "learning-governance-list-writebacks":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.learningGovernanceApi.listWritebacksByCandidate({
        learningCandidateId: routeMatch.candidateId,
      });
    case "learning-governance-create-harness-dataset-candidate": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<
            typeof runtime.learningGovernanceApi.createHarnessDatasetCandidateFromReviewedSnapshot
          >[0]["input"],
          "createdBy"
        >;
      };

      return runtime.learningGovernanceApi.createHarnessDatasetCandidateFromReviewedSnapshot(
        {
          actorRole: session.user.role,
          reviewedCaseSnapshotId: routeMatch.reviewedCaseSnapshotId,
          input: {
            ...body.input,
            createdBy: session.user.id,
          },
        },
      );
    }
    case "verification-ops-create-check-profile": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.verificationOpsApi.createVerificationCheckProfile
      >[0];

      return runtime.verificationOpsApi.createVerificationCheckProfile({
        ...body,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-list-check-profiles":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.verificationOpsApi.listVerificationCheckProfiles();
    case "verification-ops-publish-check-profile": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.verificationOpsApi.publishVerificationCheckProfile({
        profileId: routeMatch.profileId,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-create-release-check-profile": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.verificationOpsApi.createReleaseCheckProfile
      >[0];

      return runtime.verificationOpsApi.createReleaseCheckProfile({
        ...body,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-list-release-check-profiles":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.verificationOpsApi.listReleaseCheckProfiles();
    case "verification-ops-publish-release-check-profile": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.verificationOpsApi.publishReleaseCheckProfile({
        profileId: routeMatch.profileId,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-create-evaluation-suite": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.verificationOpsApi.createEvaluationSuite
      >[0];

      return runtime.verificationOpsApi.createEvaluationSuite({
        ...body,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-list-evaluation-suites":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.verificationOpsApi.listEvaluationSuites();
    case "verification-ops-activate-evaluation-suite": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.verificationOpsApi.activateEvaluationSuite({
        suiteId: routeMatch.suiteId,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-list-suite-runs":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.verificationOpsApi.listEvaluationRunsBySuiteId({
        suiteId: routeMatch.suiteId,
      });
    case "verification-ops-create-evaluation-sample-set": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.verificationOpsApi.createEvaluationSampleSet
      >[0];

      return runtime.verificationOpsApi.createEvaluationSampleSet({
        ...body,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-list-evaluation-sample-sets":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.verificationOpsApi.listEvaluationSampleSets();
    case "verification-ops-publish-evaluation-sample-set": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.verificationOpsApi.publishEvaluationSampleSet({
        sampleSetId: routeMatch.sampleSetId,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-list-evaluation-sample-set-items":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.verificationOpsApi.listEvaluationSampleSetItems({
        sampleSetId: routeMatch.sampleSetId,
      });
    case "verification-ops-record-evidence": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.verificationOpsApi.recordVerificationEvidence
      >[0];

      return runtime.verificationOpsApi.recordVerificationEvidence({
        ...body,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-get-evidence": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.verificationOpsApi.getVerificationEvidence({
        evidenceId: routeMatch.evidenceId,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-create-evaluation-run": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as Parameters<
        typeof runtime.verificationOpsApi.createEvaluationRun
      >[0];

      return runtime.verificationOpsApi.createEvaluationRun({
        ...body,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-complete-evaluation-run": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        status: Parameters<typeof runtime.verificationOpsApi.completeEvaluationRun>[0]["status"];
        evidenceIds: string[];
      };

      return runtime.verificationOpsApi.completeEvaluationRun({
        runId: routeMatch.runId,
        actorRole: session.user.role,
        status: body.status,
        evidenceIds: body.evidenceIds,
      });
    }
    case "verification-ops-finalize-evaluation-run": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.verificationOpsApi.finalizeEvaluationRun({
        runId: routeMatch.runId,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-list-run-items":
      await requirePermission(req, runtime, "permissions.manage");
      return runtime.verificationOpsApi.listEvaluationRunItemsByRunId({
        runId: routeMatch.runId,
      });
    case "verification-ops-list-run-evidence": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.verificationOpsApi.listEvaluationRunEvidence({
        runId: routeMatch.runId,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-get-finalized-run-result": {
      const session = await requirePermission(req, runtime, "permissions.manage");

      return runtime.verificationOpsApi.getEvaluationRunFinalization({
        runId: routeMatch.runId,
        actorRole: session.user.role,
      });
    }
    case "verification-ops-list-suite-finalized-results": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const historyWindow = readRequestUrl(req).searchParams.get("history_window");

      return runtime.verificationOpsApi.listEvaluationSuiteFinalizations({
        suiteId: routeMatch.suiteId,
        actorRole: session.user.role,
        historyWindowPreset: isEvaluationSuiteHistoryWindowPreset(historyWindow)
          ? historyWindow
          : undefined,
      });
    }
    case "verification-ops-record-run-item-result": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<typeof runtime.verificationOpsApi.recordEvaluationRunItemResult>[0]["input"],
          "runItemId"
        >;
      };

      return runtime.verificationOpsApi.recordEvaluationRunItemResult({
        actorRole: session.user.role,
        input: {
          ...body.input,
          runItemId: routeMatch.runItemId,
        },
      });
    }
    case "verification-ops-create-learning-candidate": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<
            typeof runtime.verificationOpsApi.createLearningCandidateFromEvaluation
          >[0]["input"],
          "runId" | "createdBy"
        >;
      };

      return runtime.verificationOpsApi.createLearningCandidateFromEvaluation({
        actorRole: session.user.role,
        input: {
          ...body.input,
          runId: routeMatch.runId,
          createdBy: session.user.id,
        },
      });
    }
    case "verification-ops-create-harness-dataset-candidate": {
      const session = await requirePermission(req, runtime, "permissions.manage");
      const body = (await readJsonBody(req)) as {
        input: Omit<
          Parameters<
            typeof runtime.verificationOpsApi.createHarnessDatasetCandidateFromEvaluationEvidencePack
          >[0]["input"],
          "createdBy"
        >;
      };

      return runtime.verificationOpsApi.createHarnessDatasetCandidateFromEvaluationEvidencePack(
        {
          actorRole: session.user.role,
          evidencePackId: routeMatch.evidencePackId,
          input: {
            ...body.input,
            createdBy: session.user.id,
          },
        },
      );
    }
  }
}

function matchRoute(req: IncomingMessage): HttpRouteMatch | null {
  const method = req.method ?? "GET";
  const url = readRequestUrl(req);
  const path = url.pathname;

  if (method === "GET" && path === "/healthz") {
    return { route: "healthz" };
  }

  if (method === "GET" && path === "/readyz") {
    return { route: "readyz" };
  }

  if (method === "POST" && path === "/api/v1/auth/local/login") {
    return { route: "auth-local-login" };
  }

  if (method === "GET" && path === "/api/v1/auth/session") {
    return { route: "auth-session" };
  }

  if (method === "POST" && path === "/api/v1/auth/logout") {
    return { route: "auth-logout" };
  }

  if (method === "POST" && path === "/api/v1/manuscripts/upload") {
    return { route: "manuscripts-upload" };
  }

  if (method === "POST" && path === "/api/v1/document-pipeline/export-current-asset") {
    return { route: "document-pipeline-export-current-asset" };
  }

  const documentAssetDownloadMatch = path.match(
    /^\/api\/v1\/document-assets\/([^/]+)\/download$/,
  );
  if (method === "GET" && documentAssetDownloadMatch) {
    return {
      route: "document-assets-download",
      assetId: documentAssetDownloadMatch[1],
    };
  }

  if (method === "GET" && path === "/api/v1/harness-datasets/workbench") {
    return { route: "harness-datasets-workbench" };
  }

  const exportHarnessGoldSetVersionMatch = path.match(
    /^\/api\/v1\/harness-datasets\/gold-set-versions\/([^/]+)\/export$/,
  );
  if (method === "POST" && exportHarnessGoldSetVersionMatch) {
    return {
      route: "harness-datasets-export-gold-set-version",
      goldSetVersionId: exportHarnessGoldSetVersionMatch[1],
    };
  }

  if (method === "GET" && path === "/api/v1/harness-integrations/adapters") {
    return { route: "harness-integrations-list-adapters" };
  }

  if (method === "POST" && path === "/api/v1/harness-integrations/governed-runs") {
    return { route: "harness-integrations-launch-governed-run" };
  }

  const listHarnessAdapterExecutionsMatch = path.match(
    /^\/api\/v1\/harness-integrations\/adapters\/([^/]+)\/executions$/,
  );
  if (method === "GET" && listHarnessAdapterExecutionsMatch) {
    return {
      route: "harness-integrations-list-adapter-executions",
      adapterId: listHarnessAdapterExecutionsMatch[1],
    };
  }

  if (method === "POST" && path === "/api/v1/modules/screening/run") {
    return { route: "modules-screening-run" };
  }

  if (method === "POST" && path === "/api/v1/modules/editing/run") {
    return { route: "modules-editing-run" };
  }

  if (method === "POST" && path === "/api/v1/modules/proofreading/draft") {
    return { route: "modules-proofreading-draft" };
  }

  if (method === "POST" && path === "/api/v1/modules/proofreading/finalize") {
    return { route: "modules-proofreading-finalize" };
  }

  if (method === "POST" && path === "/api/v1/modules/proofreading/publish-human-final") {
    return { route: "modules-proofreading-publish-human-final" };
  }

  if (method === "POST" && path === "/api/v1/agent-runtime") {
    return { route: "agent-runtime-create" };
  }

  if (method === "GET" && path === "/api/v1/agent-runtime") {
    return { route: "agent-runtime-list" };
  }

  if (method === "POST" && path === "/api/v1/tool-gateway") {
    return { route: "tool-gateway-create" };
  }

  if (method === "GET" && path === "/api/v1/tool-gateway") {
    return { route: "tool-gateway-list" };
  }

  if (method === "POST" && path === "/api/v1/sandbox-profiles") {
    return { route: "sandbox-profile-create" };
  }

  if (method === "GET" && path === "/api/v1/sandbox-profiles") {
    return { route: "sandbox-profile-list" };
  }

  if (method === "POST" && path === "/api/v1/agent-profiles") {
    return { route: "agent-profile-create" };
  }

  if (method === "GET" && path === "/api/v1/agent-profiles") {
    return { route: "agent-profile-list" };
  }

  if (method === "POST" && path === "/api/v1/runtime-bindings") {
    return { route: "runtime-binding-create" };
  }

  if (method === "GET" && path === "/api/v1/runtime-bindings") {
    return { route: "runtime-binding-list" };
  }

  if (method === "POST" && path === "/api/v1/tool-permission-policies") {
    return { route: "tool-permission-policy-create" };
  }

  if (method === "GET" && path === "/api/v1/tool-permission-policies") {
    return { route: "tool-permission-policy-list" };
  }

  if (method === "POST" && path === "/api/v1/agent-execution") {
    return { route: "agent-execution-create" };
  }

  if (method === "GET" && path === "/api/v1/agent-execution") {
    return { route: "agent-execution-list" };
  }

  if (method === "POST" && path === "/api/v1/templates/families") {
    return { route: "templates-create-family" };
  }

  if (method === "GET" && path === "/api/v1/templates/families") {
    return { route: "templates-list-families" };
  }

  if (method === "POST" && path === "/api/v1/templates/module-drafts") {
    return { route: "templates-create-module-draft" };
  }

  if (method === "POST" && path === "/api/v1/prompt-skill-registry/skill-packages") {
    return { route: "prompt-skill-create-skill-package" };
  }

  if (method === "GET" && path === "/api/v1/prompt-skill-registry/skill-packages") {
    return { route: "prompt-skill-list-skill-packages" };
  }

  if (method === "POST" && path === "/api/v1/prompt-skill-registry/prompt-templates") {
    return { route: "prompt-skill-create-prompt-template" };
  }

  if (method === "GET" && path === "/api/v1/prompt-skill-registry/prompt-templates") {
    return { route: "prompt-skill-list-prompt-templates" };
  }

  if (method === "POST" && path === "/api/v1/execution-governance/profiles") {
    return { route: "execution-governance-create-profile" };
  }

  if (method === "GET" && path === "/api/v1/execution-governance/profiles") {
    return { route: "execution-governance-list-profiles" };
  }

  if (
    method === "POST" &&
    path === "/api/v1/execution-governance/knowledge-binding-rules"
  ) {
    return { route: "execution-governance-create-knowledge-binding-rule" };
  }

  if (
    method === "GET" &&
    path === "/api/v1/execution-governance/knowledge-binding-rules"
  ) {
    return { route: "execution-governance-list-knowledge-binding-rules" };
  }

  if (method === "POST" && path === "/api/v1/execution-governance/resolve") {
    return { route: "execution-governance-resolve" };
  }

  if (method === "POST" && path === "/api/v1/execution-tracking/snapshots") {
    return { route: "execution-tracking-record-snapshot" };
  }

  if (method === "POST" && path === "/api/v1/model-registry") {
    return { route: "model-registry-create-entry" };
  }

  if (method === "GET" && path === "/api/v1/model-registry") {
    return { route: "model-registry-list-entries" };
  }

  if (method === "GET" && path === "/api/v1/model-registry/routing-policy") {
    return { route: "model-registry-get-routing-policy" };
  }

  if (method === "POST" && path === "/api/v1/model-registry/routing-policy") {
    return { route: "model-registry-update-routing-policy" };
  }

  if (method === "GET" && path === "/api/v1/model-routing-governance/policies") {
    return { route: "model-routing-governance-list-policies" };
  }

  if (method === "POST" && path === "/api/v1/model-routing-governance/policies") {
    return { route: "model-routing-governance-create-policy" };
  }

  const createModelRoutingDraftVersionMatch = path.match(
    /^\/api\/v1\/model-routing-governance\/policies\/([^/]+)\/versions$/,
  );
  if (method === "POST" && createModelRoutingDraftVersionMatch) {
    return {
      route: "model-routing-governance-create-draft-version",
      policyId: createModelRoutingDraftVersionMatch[1],
    };
  }

  const updateModelRoutingDraftVersionMatch = path.match(
    /^\/api\/v1\/model-routing-governance\/versions\/([^/]+)\/draft$/,
  );
  if (method === "POST" && updateModelRoutingDraftVersionMatch) {
    return {
      route: "model-routing-governance-update-draft-version",
      versionId: updateModelRoutingDraftVersionMatch[1],
    };
  }

  const submitModelRoutingVersionMatch = path.match(
    /^\/api\/v1\/model-routing-governance\/versions\/([^/]+)\/submit$/,
  );
  if (method === "POST" && submitModelRoutingVersionMatch) {
    return {
      route: "model-routing-governance-submit-version",
      versionId: submitModelRoutingVersionMatch[1],
    };
  }

  const approveModelRoutingVersionMatch = path.match(
    /^\/api\/v1\/model-routing-governance\/versions\/([^/]+)\/approve$/,
  );
  if (method === "POST" && approveModelRoutingVersionMatch) {
    return {
      route: "model-routing-governance-approve-version",
      versionId: approveModelRoutingVersionMatch[1],
    };
  }

  const activateModelRoutingVersionMatch = path.match(
    /^\/api\/v1\/model-routing-governance\/versions\/([^/]+)\/activate$/,
  );
  if (method === "POST" && activateModelRoutingVersionMatch) {
    return {
      route: "model-routing-governance-activate-version",
      versionId: activateModelRoutingVersionMatch[1],
    };
  }

  const rollbackModelRoutingPolicyMatch = path.match(
    /^\/api\/v1\/model-routing-governance\/policies\/([^/]+)\/rollback$/,
  );
  if (method === "POST" && rollbackModelRoutingPolicyMatch) {
    return {
      route: "model-routing-governance-rollback-policy",
      policyId: rollbackModelRoutingPolicyMatch[1],
    };
  }

  if (method === "POST" && path === "/api/v1/knowledge/drafts") {
    return { route: "knowledge-create-draft" };
  }

  if (method === "POST" && path === "/api/v1/knowledge/retrieval-context") {
    return { route: "knowledge-resolve-governed-retrieval-context" };
  }

  const getKnowledgeRetrievalSnapshotMatch = path.match(
    /^\/api\/v1\/knowledge\/retrieval-snapshots\/([^/]+)$/,
  );
  if (method === "GET" && getKnowledgeRetrievalSnapshotMatch) {
    return {
      route: "knowledge-get-retrieval-snapshot",
      snapshotId: getKnowledgeRetrievalSnapshotMatch[1],
    };
  }

  const manuscriptAssetListMatch = path.match(
    /^\/api\/v1\/manuscripts\/([^/]+)\/assets$/,
  );
  if (method === "GET" && manuscriptAssetListMatch) {
    return {
      route: "manuscripts-list-assets",
      manuscriptId: manuscriptAssetListMatch[1],
    };
  }

  const manuscriptGetMatch = path.match(/^\/api\/v1\/manuscripts\/([^/]+)$/);
  if (method === "GET" && manuscriptGetMatch) {
    return {
      route: "manuscripts-get",
      manuscriptId: manuscriptGetMatch[1],
    };
  }

  const jobGetMatch = path.match(/^\/api\/v1\/jobs\/([^/]+)$/);
  if (method === "GET" && jobGetMatch) {
    return {
      route: "jobs-get",
      jobId: jobGetMatch[1],
    };
  }

  const agentRuntimeByModuleMatch = path.match(
    /^\/api\/v1\/agent-runtime\/by-module\/([^/]+)$/,
  );
  if (method === "GET" && agentRuntimeByModuleMatch) {
    return {
      route: "agent-runtime-list-by-module",
      module: agentRuntimeByModuleMatch[1],
      activeOnly: url.searchParams.get("activeOnly") === "true",
    };
  }

  const toolGatewayByScopeMatch = path.match(
    /^\/api\/v1\/tool-gateway\/by-scope\/([^/]+)$/,
  );
  if (method === "GET" && toolGatewayByScopeMatch) {
    return {
      route: "tool-gateway-list-by-scope",
      scope: toolGatewayByScopeMatch[1],
    };
  }

  const runtimeBindingByScopeMatch = path.match(
    /^\/api\/v1\/runtime-bindings\/by-scope\/([^/]+)\/([^/]+)\/([^/]+)$/,
  );
  if (method === "GET" && runtimeBindingByScopeMatch) {
    return {
      route: "runtime-binding-list-by-scope",
      module: runtimeBindingByScopeMatch[1],
      manuscriptType: runtimeBindingByScopeMatch[2],
      templateFamilyId: runtimeBindingByScopeMatch[3],
      activeOnly: url.searchParams.get("activeOnly") === "true",
    };
  }

  const runtimeBindingActiveReadinessByScopeMatch = path.match(
    /^\/api\/v1\/runtime-bindings\/by-scope\/([^/]+)\/([^/]+)\/([^/]+)\/active-readiness$/,
  );
  if (method === "GET" && runtimeBindingActiveReadinessByScopeMatch) {
    return {
      route: "runtime-binding-active-readiness",
      module: runtimeBindingActiveReadinessByScopeMatch[1],
      manuscriptType: runtimeBindingActiveReadinessByScopeMatch[2],
      templateFamilyId: runtimeBindingActiveReadinessByScopeMatch[3],
    };
  }

  const templateFamilyUpdateMatch = path.match(/^\/api\/v1\/templates\/families\/([^/]+)$/);
  if (method === "POST" && templateFamilyUpdateMatch) {
    return {
      route: "templates-update-family",
      templateFamilyId: templateFamilyUpdateMatch[1],
    };
  }

  const moduleTemplateListMatch = path.match(
    /^\/api\/v1\/templates\/families\/([^/]+)\/module-templates$/,
  );
  if (method === "GET" && moduleTemplateListMatch) {
    return {
      route: "templates-list-module-templates",
      templateFamilyId: moduleTemplateListMatch[1],
    };
  }

  const createTemplateRetrievalQualityRunMatch = path.match(
    /^\/api\/v1\/templates\/families\/([^/]+)\/retrieval-quality-runs$/,
  );
  if (method === "POST" && createTemplateRetrievalQualityRunMatch) {
    return {
      route: "templates-create-retrieval-quality-run",
      templateFamilyId: createTemplateRetrievalQualityRunMatch[1],
    };
  }

  const latestTemplateRetrievalQualityRunMatch = path.match(
    /^\/api\/v1\/templates\/families\/([^/]+)\/retrieval-quality-runs\/latest$/,
  );
  if (method === "GET" && latestTemplateRetrievalQualityRunMatch) {
    return {
      route: "templates-get-latest-retrieval-quality-run",
      templateFamilyId: latestTemplateRetrievalQualityRunMatch[1],
    };
  }

  const updateModuleTemplateDraftMatch = path.match(
    /^\/api\/v1\/templates\/module-templates\/([^/]+)\/draft$/,
  );
  if (method === "POST" && updateModuleTemplateDraftMatch) {
    return {
      route: "templates-update-module-draft",
      moduleTemplateId: updateModuleTemplateDraftMatch[1],
    };
  }

  const publishModuleTemplateMatch = path.match(
    /^\/api\/v1\/templates\/module-templates\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishModuleTemplateMatch) {
    return {
      route: "templates-publish-module-template",
      moduleTemplateId: publishModuleTemplateMatch[1],
    };
  }

  const publishSkillPackageMatch = path.match(
    /^\/api\/v1\/prompt-skill-registry\/skill-packages\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishSkillPackageMatch) {
    return {
      route: "prompt-skill-publish-skill-package",
      skillPackageId: publishSkillPackageMatch[1],
    };
  }

  const publishPromptTemplateMatch = path.match(
    /^\/api\/v1\/prompt-skill-registry\/prompt-templates\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishPromptTemplateMatch) {
    return {
      route: "prompt-skill-publish-prompt-template",
      promptTemplateId: publishPromptTemplateMatch[1],
    };
  }

  const publishExecutionProfileMatch = path.match(
    /^\/api\/v1\/execution-governance\/profiles\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishExecutionProfileMatch) {
    return {
      route: "execution-governance-publish-profile",
      profileId: publishExecutionProfileMatch[1],
    };
  }

  const archiveExecutionProfileMatch = path.match(
    /^\/api\/v1\/execution-governance\/profiles\/([^/]+)\/archive$/,
  );
  if (method === "POST" && archiveExecutionProfileMatch) {
    return {
      route: "execution-governance-archive-profile",
      profileId: archiveExecutionProfileMatch[1],
    };
  }

  const activateKnowledgeBindingRuleMatch = path.match(
    /^\/api\/v1\/execution-governance\/knowledge-binding-rules\/([^/]+)\/activate$/,
  );
  if (method === "POST" && activateKnowledgeBindingRuleMatch) {
    return {
      route: "execution-governance-activate-knowledge-binding-rule",
      ruleId: activateKnowledgeBindingRuleMatch[1],
    };
  }

  const updateModelRegistryEntryMatch = path.match(/^\/api\/v1\/model-registry\/([^/]+)$/);
  if (method === "POST" && updateModelRegistryEntryMatch) {
    return {
      route: "model-registry-update-entry",
      modelId: updateModelRegistryEntryMatch[1],
    };
  }

  const agentRuntimePublishMatch = path.match(
    /^\/api\/v1\/agent-runtime\/([^/]+)\/publish$/,
  );
  if (method === "POST" && agentRuntimePublishMatch) {
    return {
      route: "agent-runtime-publish",
      runtimeId: agentRuntimePublishMatch[1],
    };
  }

  const agentRuntimeArchiveMatch = path.match(
    /^\/api\/v1\/agent-runtime\/([^/]+)\/archive$/,
  );
  if (method === "POST" && agentRuntimeArchiveMatch) {
    return {
      route: "agent-runtime-archive",
      runtimeId: agentRuntimeArchiveMatch[1],
    };
  }

  const agentRuntimeGetMatch = path.match(/^\/api\/v1\/agent-runtime\/([^/]+)$/);
  if (method === "GET" && agentRuntimeGetMatch) {
    return {
      route: "agent-runtime-get",
      runtimeId: agentRuntimeGetMatch[1],
    };
  }

  const toolGatewayUpdateMatch = path.match(/^\/api\/v1\/tool-gateway\/([^/]+)$/);
  if (method === "POST" && toolGatewayUpdateMatch) {
    return {
      route: "tool-gateway-update",
      toolId: toolGatewayUpdateMatch[1],
    };
  }

  const toolGatewayGetMatch = path.match(/^\/api\/v1\/tool-gateway\/([^/]+)$/);
  if (method === "GET" && toolGatewayGetMatch) {
    return {
      route: "tool-gateway-get",
      toolId: toolGatewayGetMatch[1],
    };
  }

  const sandboxActivateMatch = path.match(
    /^\/api\/v1\/sandbox-profiles\/([^/]+)\/activate$/,
  );
  if (method === "POST" && sandboxActivateMatch) {
    return {
      route: "sandbox-profile-activate",
      profileId: sandboxActivateMatch[1],
    };
  }

  const sandboxArchiveMatch = path.match(
    /^\/api\/v1\/sandbox-profiles\/([^/]+)\/archive$/,
  );
  if (method === "POST" && sandboxArchiveMatch) {
    return {
      route: "sandbox-profile-archive",
      profileId: sandboxArchiveMatch[1],
    };
  }

  const sandboxGetMatch = path.match(/^\/api\/v1\/sandbox-profiles\/([^/]+)$/);
  if (method === "GET" && sandboxGetMatch) {
    return {
      route: "sandbox-profile-get",
      profileId: sandboxGetMatch[1],
    };
  }

  const agentProfilePublishMatch = path.match(
    /^\/api\/v1\/agent-profiles\/([^/]+)\/publish$/,
  );
  if (method === "POST" && agentProfilePublishMatch) {
    return {
      route: "agent-profile-publish",
      profileId: agentProfilePublishMatch[1],
    };
  }

  const agentProfileArchiveMatch = path.match(
    /^\/api\/v1\/agent-profiles\/([^/]+)\/archive$/,
  );
  if (method === "POST" && agentProfileArchiveMatch) {
    return {
      route: "agent-profile-archive",
      profileId: agentProfileArchiveMatch[1],
    };
  }

  const agentProfileGetMatch = path.match(/^\/api\/v1\/agent-profiles\/([^/]+)$/);
  if (method === "GET" && agentProfileGetMatch) {
    return {
      route: "agent-profile-get",
      profileId: agentProfileGetMatch[1],
    };
  }

  const runtimeBindingActivateMatch = path.match(
    /^\/api\/v1\/runtime-bindings\/([^/]+)\/activate$/,
  );
  if (method === "POST" && runtimeBindingActivateMatch) {
    return {
      route: "runtime-binding-activate",
      bindingId: runtimeBindingActivateMatch[1],
    };
  }

  const runtimeBindingArchiveMatch = path.match(
    /^\/api\/v1\/runtime-bindings\/([^/]+)\/archive$/,
  );
  if (method === "POST" && runtimeBindingArchiveMatch) {
    return {
      route: "runtime-binding-archive",
      bindingId: runtimeBindingArchiveMatch[1],
    };
  }

  const runtimeBindingGetMatch = path.match(
    /^\/api\/v1\/runtime-bindings\/([^/]+)$/,
  );
  if (method === "GET" && runtimeBindingGetMatch) {
    return {
      route: "runtime-binding-get",
      bindingId: runtimeBindingGetMatch[1],
    };
  }

  const runtimeBindingReadinessMatch = path.match(
    /^\/api\/v1\/runtime-bindings\/([^/]+)\/readiness$/,
  );
  if (method === "GET" && runtimeBindingReadinessMatch) {
    return {
      route: "runtime-binding-get-readiness",
      bindingId: runtimeBindingReadinessMatch[1],
    };
  }

  const toolPermissionPolicyActivateMatch = path.match(
    /^\/api\/v1\/tool-permission-policies\/([^/]+)\/activate$/,
  );
  if (method === "POST" && toolPermissionPolicyActivateMatch) {
    return {
      route: "tool-permission-policy-activate",
      policyId: toolPermissionPolicyActivateMatch[1],
    };
  }

  const toolPermissionPolicyArchiveMatch = path.match(
    /^\/api\/v1\/tool-permission-policies\/([^/]+)\/archive$/,
  );
  if (method === "POST" && toolPermissionPolicyArchiveMatch) {
    return {
      route: "tool-permission-policy-archive",
      policyId: toolPermissionPolicyArchiveMatch[1],
    };
  }

  const toolPermissionPolicyGetMatch = path.match(
    /^\/api\/v1\/tool-permission-policies\/([^/]+)$/,
  );
  if (method === "GET" && toolPermissionPolicyGetMatch) {
    return {
      route: "tool-permission-policy-get",
      policyId: toolPermissionPolicyGetMatch[1],
    };
  }

  const agentExecutionCompleteMatch = path.match(
    /^\/api\/v1\/agent-execution\/([^/]+)\/complete$/,
  );
  if (method === "POST" && agentExecutionCompleteMatch) {
    return {
      route: "agent-execution-complete",
      logId: agentExecutionCompleteMatch[1],
    };
  }

  const agentExecutionGetMatch = path.match(/^\/api\/v1\/agent-execution\/([^/]+)$/);
  if (method === "GET" && agentExecutionGetMatch) {
    return {
      route: "agent-execution-get",
      logId: agentExecutionGetMatch[1],
    };
  }

  const executionSnapshotMatch = path.match(
    /^\/api\/v1\/execution-tracking\/snapshots\/([^/]+)$/,
  );
  if (method === "GET" && executionSnapshotMatch) {
    return {
      route: "execution-tracking-get-snapshot",
      snapshotId: executionSnapshotMatch[1],
    };
  }

  const executionHitLogsMatch = path.match(
    /^\/api\/v1\/execution-tracking\/snapshots\/([^/]+)\/knowledge-hit-logs$/,
  );
  if (method === "GET" && executionHitLogsMatch) {
    return {
      route: "execution-tracking-list-knowledge-hit-logs",
      snapshotId: executionHitLogsMatch[1],
    };
  }

  if (method === "POST" && path === "/api/v1/verification-ops/check-profiles") {
    return { route: "verification-ops-create-check-profile" };
  }

  if (method === "GET" && path === "/api/v1/verification-ops/check-profiles") {
    return { route: "verification-ops-list-check-profiles" };
  }

  const publishVerificationCheckProfileMatch = path.match(
    /^\/api\/v1\/verification-ops\/check-profiles\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishVerificationCheckProfileMatch) {
    return {
      route: "verification-ops-publish-check-profile",
      profileId: publishVerificationCheckProfileMatch[1],
    };
  }

  if (
    method === "POST" &&
    path === "/api/v1/verification-ops/release-check-profiles"
  ) {
    return { route: "verification-ops-create-release-check-profile" };
  }

  if (
    method === "GET" &&
    path === "/api/v1/verification-ops/release-check-profiles"
  ) {
    return { route: "verification-ops-list-release-check-profiles" };
  }

  const publishReleaseCheckProfileMatch = path.match(
    /^\/api\/v1\/verification-ops\/release-check-profiles\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishReleaseCheckProfileMatch) {
    return {
      route: "verification-ops-publish-release-check-profile",
      profileId: publishReleaseCheckProfileMatch[1],
    };
  }

  if (method === "POST" && path === "/api/v1/verification-ops/evaluation-suites") {
    return { route: "verification-ops-create-evaluation-suite" };
  }

  if (method === "GET" && path === "/api/v1/verification-ops/evaluation-suites") {
    return { route: "verification-ops-list-evaluation-suites" };
  }

  const activateEvaluationSuiteMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-suites\/([^/]+)\/activate$/,
  );
  if (method === "POST" && activateEvaluationSuiteMatch) {
    return {
      route: "verification-ops-activate-evaluation-suite",
      suiteId: activateEvaluationSuiteMatch[1],
    };
  }

  const listSuiteRunsMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-suites\/([^/]+)\/runs$/,
  );
  if (method === "GET" && listSuiteRunsMatch) {
    return {
      route: "verification-ops-list-suite-runs",
      suiteId: listSuiteRunsMatch[1],
    };
  }

  const listSuiteFinalizedResultsMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-suites\/([^/]+)\/finalized-results$/,
  );
  if (method === "GET" && listSuiteFinalizedResultsMatch) {
    return {
      route: "verification-ops-list-suite-finalized-results",
      suiteId: listSuiteFinalizedResultsMatch[1],
    };
  }

  if (
    method === "POST" &&
    path === "/api/v1/verification-ops/evaluation-sample-sets"
  ) {
    return { route: "verification-ops-create-evaluation-sample-set" };
  }

  if (
    method === "GET" &&
    path === "/api/v1/verification-ops/evaluation-sample-sets"
  ) {
    return { route: "verification-ops-list-evaluation-sample-sets" };
  }

  const publishEvaluationSampleSetMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-sample-sets\/([^/]+)\/publish$/,
  );
  if (method === "POST" && publishEvaluationSampleSetMatch) {
    return {
      route: "verification-ops-publish-evaluation-sample-set",
      sampleSetId: publishEvaluationSampleSetMatch[1],
    };
  }

  const listEvaluationSampleSetItemsMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-sample-sets\/([^/]+)\/items$/,
  );
  if (method === "GET" && listEvaluationSampleSetItemsMatch) {
    return {
      route: "verification-ops-list-evaluation-sample-set-items",
      sampleSetId: listEvaluationSampleSetItemsMatch[1],
    };
  }

  if (method === "POST" && path === "/api/v1/verification-ops/evidence") {
    return { route: "verification-ops-record-evidence" };
  }

  const getVerificationEvidenceMatch = path.match(
    /^\/api\/v1\/verification-ops\/evidence\/([^/]+)$/,
  );
  if (method === "GET" && getVerificationEvidenceMatch) {
    return {
      route: "verification-ops-get-evidence",
      evidenceId: getVerificationEvidenceMatch[1],
    };
  }

  if (method === "POST" && path === "/api/v1/verification-ops/evaluation-runs") {
    return { route: "verification-ops-create-evaluation-run" };
  }

  const completeEvaluationRunMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-runs\/([^/]+)\/complete$/,
  );
  if (method === "POST" && completeEvaluationRunMatch) {
    return {
      route: "verification-ops-complete-evaluation-run",
      runId: completeEvaluationRunMatch[1],
    };
  }

  const finalizeEvaluationRunMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-runs\/([^/]+)\/finalize$/,
  );
  if (method === "POST" && finalizeEvaluationRunMatch) {
    return {
      route: "verification-ops-finalize-evaluation-run",
      runId: finalizeEvaluationRunMatch[1],
    };
  }

  const listEvaluationRunItemsMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-runs\/([^/]+)\/items$/,
  );
  if (method === "GET" && listEvaluationRunItemsMatch) {
    return {
      route: "verification-ops-list-run-items",
      runId: listEvaluationRunItemsMatch[1],
    };
  }

  const listEvaluationRunEvidenceMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-runs\/([^/]+)\/evidence$/,
  );
  if (method === "GET" && listEvaluationRunEvidenceMatch) {
    return {
      route: "verification-ops-list-run-evidence",
      runId: listEvaluationRunEvidenceMatch[1],
    };
  }

  const getFinalizedEvaluationRunMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-runs\/([^/]+)\/finalized-result$/,
  );
  if (method === "GET" && getFinalizedEvaluationRunMatch) {
    return {
      route: "verification-ops-get-finalized-run-result",
      runId: getFinalizedEvaluationRunMatch[1],
    };
  }

  const recordEvaluationRunItemResultMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-run-items\/([^/]+)\/result$/,
  );
  if (method === "POST" && recordEvaluationRunItemResultMatch) {
    return {
      route: "verification-ops-record-run-item-result",
      runItemId: recordEvaluationRunItemResultMatch[1],
    };
  }

  const createEvaluationLearningCandidateMatch = path.match(
    /^\/api\/v1\/verification-ops\/evaluation-runs\/([^/]+)\/learning-candidates$/,
  );
  if (method === "POST" && createEvaluationLearningCandidateMatch) {
    return {
      route: "verification-ops-create-learning-candidate",
      runId: createEvaluationLearningCandidateMatch[1],
    };
  }

  const createEvidencePackHarnessDatasetCandidateMatch = path.match(
    /^\/api\/v1\/verification-ops\/evidence-packs\/([^/]+)\/harness-dataset-candidates$/,
  );
  if (method === "POST" && createEvidencePackHarnessDatasetCandidateMatch) {
    return {
      route: "verification-ops-create-harness-dataset-candidate",
      evidencePackId: createEvidencePackHarnessDatasetCandidateMatch[1],
    };
  }

  if (method === "GET" && path === "/api/v1/knowledge") {
    return { route: "knowledge-list" };
  }

  if (method === "GET" && path === "/api/v1/knowledge/review-queue") {
    return { route: "knowledge-review-queue" };
  }

  if (method === "POST" && path === "/api/v1/learning/reviewed-case-snapshots") {
    return { route: "learning-create-reviewed-case-snapshot" };
  }

  if (method === "GET" && path === "/api/v1/learning/candidates") {
    return { route: "learning-list-candidates" };
  }

  if (method === "GET" && path === "/api/v1/learning/candidates/review-queue") {
    return { route: "learning-review-queue" };
  }

  if (method === "POST" && path === "/api/v1/learning/candidates") {
    return { route: "learning-create-candidate" };
  }

  if (method === "POST" && path === "/api/v1/learning/candidates/governed") {
    return { route: "learning-create-governed-candidate" };
  }

  const learningApproveMatch = path.match(
    /^\/api\/v1\/learning\/candidates\/([^/]+)\/approve$/,
  );
  if (method === "POST" && learningApproveMatch) {
    return {
      route: "learning-approve-candidate",
      candidateId: learningApproveMatch[1],
    };
  }

  const learningCandidateMatch = path.match(
    /^\/api\/v1\/learning\/candidates\/([^/]+)$/,
  );
  if (method === "GET" && learningCandidateMatch) {
    return {
      route: "learning-get-candidate",
      candidateId: learningCandidateMatch[1],
    };
  }

  if (method === "POST" && path === "/api/v1/learning-governance/writebacks") {
    return { route: "learning-governance-create-writeback" };
  }

  const createReviewedSnapshotHarnessDatasetCandidateMatch = path.match(
    /^\/api\/v1\/learning-governance\/reviewed-case-snapshots\/([^/]+)\/harness-dataset-candidates$/,
  );
  if (method === "POST" && createReviewedSnapshotHarnessDatasetCandidateMatch) {
    return {
      route: "learning-governance-create-harness-dataset-candidate",
      reviewedCaseSnapshotId: createReviewedSnapshotHarnessDatasetCandidateMatch[1],
    };
  }

  const learningApplyWritebackMatch = path.match(
    /^\/api\/v1\/learning-governance\/writebacks\/([^/]+)\/apply$/,
  );
  if (method === "POST" && learningApplyWritebackMatch) {
    return {
      route: "learning-governance-apply-writeback",
      writebackId: learningApplyWritebackMatch[1],
    };
  }

  const learningListWritebacksMatch = path.match(
    /^\/api\/v1\/learning-governance\/candidates\/([^/]+)\/writebacks$/,
  );
  if (method === "GET" && learningListWritebacksMatch) {
    return {
      route: "learning-governance-list-writebacks",
      candidateId: learningListWritebacksMatch[1],
    };
  }

  const reviewActionsMatch = path.match(
    /^\/api\/v1\/knowledge\/([^/]+)\/review-actions$/,
  );
  if (method === "GET" && reviewActionsMatch) {
    return {
      route: "knowledge-review-actions",
      knowledgeItemId: reviewActionsMatch[1],
    };
  }

  const createHumanFinalHarnessDatasetCandidateMatch = path.match(
    /^\/api\/v1\/knowledge\/human-final-assets\/([^/]+)\/harness-dataset-candidates$/,
  );
  if (method === "POST" && createHumanFinalHarnessDatasetCandidateMatch) {
    return {
      route: "knowledge-create-harness-dataset-candidate",
      humanFinalAssetId: createHumanFinalHarnessDatasetCandidateMatch[1],
    };
  }

  const submitMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/submit$/);
  if (method === "POST" && submitMatch) {
    return {
      route: "knowledge-submit",
      knowledgeItemId: submitMatch[1],
    };
  }

  const approveMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/approve$/);
  if (method === "POST" && approveMatch) {
    return {
      route: "knowledge-approve",
      knowledgeItemId: approveMatch[1],
    };
  }

  const rejectMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/reject$/);
  if (method === "POST" && rejectMatch) {
    return {
      route: "knowledge-reject",
      knowledgeItemId: rejectMatch[1],
    };
  }

  const draftMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/draft$/);
  if (method === "POST" && draftMatch) {
    return {
      route: "knowledge-update-draft",
      knowledgeItemId: draftMatch[1],
    };
  }

  const archiveMatch = path.match(/^\/api\/v1\/knowledge\/([^/]+)\/archive$/);
  if (method === "POST" && archiveMatch) {
    return {
      route: "knowledge-archive",
      knowledgeItemId: archiveMatch[1],
    };
  }

  return null;
}

function readRequestPath(req: IncomingMessage): string {
  return readRequestUrl(req).pathname;
}

function readRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url || "/", "http://127.0.0.1");
}

function readRemoteAddress(req: IncomingMessage): string | undefined {
  return req.socket.remoteAddress ?? undefined;
}

async function requirePermission(
  req: IncomingMessage,
  runtime: ApiServerRuntime,
  permission: Parameters<PermissionGuard["assert"]>[1],
): Promise<HttpAuthenticatedSession> {
  const session = await runtime.authRuntime.requireSession(req);
  runtime.permissionGuard.assert(session.user.role, permission);
  return session;
}

function createCorsHeaders(
  req: IncomingMessage,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const requestOrigin = readSingleHeader(req.headers.origin);
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (rawBody.trim().length === 0) {
    return {};
  }

  return JSON.parse(rawBody);
}

function writeResponse(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
  rawBody?: Buffer,
): void {
  if (status === 204) {
    res.writeHead(status, extraHeaders);
    res.end();
    return;
  }

  if (rawBody) {
    res.writeHead(status, extraHeaders);
    res.end(rawBody);
    return;
  }

  res.writeHead(status, {
    ...extraHeaders,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

function mapErrorToHttpResponse(
  error: unknown,
): [number, unknown, Record<string, string>?] {
  if (
    error instanceof AgentExecutionLogNotFoundError ||
    error instanceof AgentProfileNotFoundError ||
    error instanceof AgentRuntimeNotFoundError ||
    error instanceof JobNotFoundError ||
    error instanceof KnowledgeItemNotFoundError ||
    error instanceof LearningCandidateNotFoundError ||
    error instanceof ReviewedCaseSnapshotNotFoundError ||
    error instanceof LearningWritebackNotFoundError ||
    error instanceof FeedbackGovernanceReviewedSnapshotNotFoundError ||
    error instanceof ManuscriptNotFoundError ||
    error instanceof DocumentExportAssetNotFoundError ||
    error instanceof DocumentAssetDownloadNotFoundError ||
    error instanceof TemplateFamilyNotFoundError ||
    error instanceof TemplateRetrievalQualityRunNotFoundError ||
    error instanceof ModuleTemplateNotFoundError ||
    error instanceof ModelRegistryEntryNotFoundError ||
    error instanceof ModelRoutingReferenceNotFoundError ||
    error instanceof ModelRoutingPolicyNotFoundError ||
    error instanceof ModelRoutingPolicyVersionNotFoundError ||
    error instanceof SkillPackageNotFoundError ||
    error instanceof PromptTemplateNotFoundError ||
    error instanceof RuntimeBindingNotFoundError ||
    error instanceof SandboxProfileNotFoundError ||
    error instanceof ToolGatewayToolNotFoundError ||
    error instanceof ToolPermissionPolicyNotFoundError ||
    error instanceof ModuleExecutionProfileNotFoundError ||
    error instanceof KnowledgeBindingRuleNotFoundError ||
    error instanceof ActiveExecutionProfileNotFoundError ||
    error instanceof ExecutionResolutionProfileAssetNotFoundError ||
    error instanceof ExecutionResolutionKnowledgeItemNotFoundError ||
    error instanceof ProofreadingDraftContextNotFoundError ||
    error instanceof VerificationCheckProfileNotFoundError ||
    error instanceof ReleaseCheckProfileNotFoundError ||
    error instanceof EvaluationSuiteNotFoundError ||
    error instanceof EvaluationSampleSetNotFoundError ||
    error instanceof EvaluationRunNotFoundError ||
    error instanceof EvaluationRunItemNotFoundError ||
    error instanceof VerificationEvidenceNotFoundError ||
    error instanceof EvaluationEvidencePackNotFoundError ||
    error instanceof EvaluationSampleSetSourceSnapshotNotFoundError ||
    error instanceof KnowledgeRetrievalSnapshotNotFoundError
  ) {
    return [404, { error: "not_found", message: error.message }];
  }

  if (
    error instanceof KnowledgeStatusTransitionError ||
    error instanceof LearningCandidateGovernedProvenanceRequiredError ||
    error instanceof LearningWritebackTargetMismatchError ||
    error instanceof LearningWritebackStatusTransitionError ||
    error instanceof LearningGovernanceConflictError ||
    error instanceof TemplateFamilyActiveConflictError ||
    error instanceof TemplateFamilyManuscriptTypeMismatchError ||
    error instanceof ModuleTemplateDraftNotEditableError ||
    error instanceof ModuleTemplateStatusTransitionError ||
    error instanceof DuplicateModelRegistryEntryError ||
    error instanceof ModelRoutingPolicyScopeConflictError ||
    error instanceof ModelRoutingGovernanceDraftNotEditableError ||
    error instanceof ModelRoutingGovernanceStatusTransitionError ||
    error instanceof PromptSkillRegistryStatusTransitionError ||
    error instanceof RuntimeBindingCompatibilityError ||
    error instanceof RuntimeBindingDependencyStateError ||
    error instanceof ModuleExecutionProfileStatusTransitionError ||
    error instanceof KnowledgeBindingRuleStatusTransitionError ||
    error instanceof ExecutionProfileModuleTemplateNotPublishedError ||
    error instanceof ExecutionProfilePromptTemplateNotPublishedError ||
    error instanceof ExecutionProfileSkillPackageNotPublishedError ||
    error instanceof ExecutionProfileKnowledgeItemNotApprovedError ||
    error instanceof ExecutionProfileCompatibilityError ||
    error instanceof ExecutionResolutionModelNotFoundError ||
    error instanceof ExecutionResolutionModelIncompatibleError ||
    error instanceof VerificationCheckProfileDependencyError ||
    error instanceof ReleaseCheckProfileDependencyError ||
    error instanceof EvaluationSuiteNotActiveError ||
    error instanceof EvaluationSuiteModuleScopeMismatchError ||
    error instanceof EvaluationEvidencePackRunMismatchError ||
    error instanceof EvaluationLearningSnapshotNotInRunError ||
    error instanceof EvaluationExperimentBindingError ||
    error instanceof HarnessDatasetSourceResolutionError ||
    error instanceof HarnessGoldSetVersionExportValidationError ||
    error instanceof HarnessGovernedRunStateError ||
    error instanceof TemplateRetrievalGoldSetVersionValidationError
  ) {
    return [409, { error: "state_conflict", message: error.message }];
  }

  if (
    error instanceof LearningHumanFinalAssetRequiredError ||
    error instanceof LearningDeidentificationRequiredError ||
    error instanceof LearningSnapshotDeidentificationRequiredError ||
    error instanceof FeedbackSourceAssetNotFoundError ||
    error instanceof FeedbackSourceAssetMismatchError ||
    error instanceof ModelRoutingPolicyValidationError ||
    error instanceof ModelRoutingGovernanceValidationError ||
    error instanceof ExecutionTrackingSkillPackageVersionMismatchError ||
    error instanceof ToolPermissionPolicyHighRiskAllowlistError ||
    error instanceof ToolPermissionPolicyUnknownToolError ||
    error instanceof ProofreadingDraftAssetRequiredError ||
    error instanceof ProofreadingFinalAssetRequiredError ||
    error instanceof InlineUploadStorageReferenceRequiredError ||
    error instanceof InlineUploadPayloadInvalidError ||
    error instanceof DocumentAssetDownloadUnsupportedError ||
    error instanceof VerificationToolDependencyError ||
    error instanceof EvaluationLearningCandidateTypeError ||
    error instanceof VerificationOpsLearningServiceRequiredError ||
    error instanceof ReviewedCaseSnapshotRepositoryRequiredError ||
    error instanceof EvaluationSampleSetSourceEligibilityError ||
    error instanceof VerificationRetrievalDependencyError ||
    error instanceof HarnessIntegrationValidationError
  ) {
    return [400, { error: "invalid_request", message: error.message }];
  }

  if (error instanceof InlineUploadPayloadTooLargeError) {
    return [413, { error: "payload_too_large", message: error.message }];
  }

  if (error instanceof AuthorizationError) {
    return [403, { error: "forbidden", message: error.message }];
  }

  if (error instanceof InvalidCredentialsError) {
    return [401, { error: "invalid_credentials", message: error.message }];
  }

  if (error instanceof AccountLockedError) {
    return [423, { error: "account_locked", message: error.message }];
  }

  if (error instanceof AuthenticationRequiredError) {
    return [401, { error: "unauthorized", message: error.message }];
  }

  if (error instanceof SyntaxError) {
    return [400, { error: "invalid_json", message: error.message }];
  }

  if (error instanceof HarnessDatasetDependencyMissingError) {
    return [500, { error: "internal_error", message: error.message }];
  }

  if (error instanceof Error) {
    return [500, { error: "internal_error", message: error.message }];
  }

  return [500, { error: "internal_error", message: "Unknown server error." }];
}

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isEvaluationSuiteHistoryWindowPreset(
  value: string | null,
): value is "latest_10" | "last_7_days" | "last_30_days" | "all_suite" {
  return (
    value === "latest_10" ||
    value === "last_7_days" ||
    value === "last_30_days" ||
    value === "all_suite"
  );
}

function coalesceOptionalString(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

async function resolveUploadStorageKey(input: {
  fileName: string;
  fileContentBase64?: string;
  requestedStorageKey?: string;
  uploadRootDir: string;
}): Promise<string> {
  if (input.fileContentBase64?.trim().length) {
    const storedUpload = await storeInlineUpload({
      rootDir: input.uploadRootDir,
      fileName: input.fileName,
      fileContentBase64: input.fileContentBase64,
      storageKey: input.requestedStorageKey,
    });
    return storedUpload.storageKey;
  }

  if (input.requestedStorageKey?.trim().length) {
    return input.requestedStorageKey;
  }

  throw new InlineUploadStorageReferenceRequiredError();
}

function resolveDefaultUploadRootDir(appEnv: AppEnv): string {
  return path.resolve(process.cwd(), ".local-data", "uploads", appEnv);
}

function resolveDefaultHarnessExportRootDir(appEnv: AppEnv): string {
  return path.resolve(process.cwd(), ".local-data", "harness-exports", appEnv);
}

function buildDownloadHeaders(
  fileName: string,
  mimeType: string,
  bytes: Buffer,
): Record<string, string> {
  return {
    "Content-Type": mimeType,
    "Content-Length": String(bytes.byteLength),
    "Content-Disposition": `attachment; filename="${sanitizeDownloadFileName(fileName)}"`,
    "Cache-Control": "no-store",
  };
}

function sanitizeDownloadFileName(fileName: string): string {
  return fileName.replace(/["\\]/g, "-");
}
