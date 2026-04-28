import path from "node:path";
import { PermissionGuard } from "../auth/permission-guard.ts";
import { BcryptPasswordHasher } from "../auth/password-hasher.ts";
import { PostgresAuthSessionRepository } from "../auth/postgres-auth-session-repository.ts";
import { PostgresLoginAttemptStore } from "../auth/postgres-login-attempt-store.ts";
import { PostgresAuditService } from "../audit/index.ts";
import type { HttpAuthRuntime } from "./demo-auth-runtime.ts";
import type { ApiServerRuntime } from "./api-http-server.ts";
import { buildDownloadContentDispositionHeader } from "./download-content-disposition.ts";
import { LocalAssetMaterializationService } from "./local-asset-materialization.ts";
import {
  AgentProfileService,
  createAgentProfileApi,
  PostgresAgentProfileRepository,
} from "../modules/agent-profiles/index.ts";
import {
  AgentExecutionOrchestrationService,
  AgentExecutionService,
  createAgentExecutionApi,
  PostgresAgentExecutionRepository,
} from "../modules/agent-execution/index.ts";
import {
  AgentRuntimeService,
  createAgentRuntimeApi,
  PostgresAgentRuntimeRepository,
} from "../modules/agent-runtime/index.ts";
import { AiGatewayService } from "../modules/ai-gateway/index.ts";
import {
  AiProviderAutoConfigurationService,
  type AiProviderConnectivityProbe,
  AiProviderCredentialCrypto,
  createAiProviderConnectionApi,
  createAiProviderConnectionService,
  OpenAiChatCompatibleConnectivityProbe,
  PostgresAiProviderConnectionRepository,
} from "../modules/ai-provider-connections/index.ts";
import { createAiProviderRuntimeService } from "../modules/ai-provider-runtime/index.ts";
import {
  DocumentAssetService,
  PostgresDocumentAssetRepository,
} from "../modules/assets/index.ts";
import {
  DocumentStructureService,
  DocumentExportService,
  EditorialDocxTransformService,
  OnlyOfficeSaveBackService,
  PythonDocxSourceBlockResolver,
  PythonDocxStructureWorkerAdapter,
} from "../modules/document-pipeline/index.ts";
import {
  DocumentPreviewService,
} from "../modules/document-pipeline/document-preview-service.ts";
import {
  OnlyOfficeSessionService,
} from "../modules/document-pipeline/onlyoffice-session-service.ts";
import {
  createEditorialRuleApi,
  EditorialRuleActivationMetricsService,
  EditorialRulePackageService,
  EditorialRuleProjectionService,
  EditorialRuleResolutionService,
  EditorialRuleService,
  ExtractionTaskService,
  ExampleSourceSessionService,
  OpenAiRuleAiIntakeGenerator,
  OpenAiRuleAiParsingGenerator,
  PostgresEditorialRuleActivationMetricsRepository,
  PostgresExtractionTaskRepository,
  ReviewedCaseRulePackageSourceService,
  createRuleAiSimilarityLedgerResolver,
  RuleAiIntakeService,
  RuleAiParsingService,
  RulePackageCompileService,
  PostgresEditorialRuleRepository,
} from "../modules/editorial-rules/index.ts";
import {
  createEditingApi,
  EditingService,
} from "../modules/editing/index.ts";
import {
  createFeedbackGovernanceApi,
  FeedbackGovernanceService,
  PostgresFeedbackGovernanceRepository,
} from "../modules/feedback-governance/index.ts";
import {
  createHumanReviewApi,
  HumanReviewDiffService,
  HumanReviewService,
  PostgresHumanReviewRepository,
} from "../modules/human-review/index.ts";
import {
  createExecutionGovernanceApi,
  ExecutionGovernanceService,
  PostgresExecutionGovernanceRepository,
} from "../modules/execution-governance/index.ts";
import {
  createExecutionResolutionApi,
  ExecutionResolutionService,
} from "../modules/execution-resolution/index.ts";
import {
  createHarnessControlPlaneApi,
  HarnessControlPlaneService,
  PostgresHarnessControlPlaneRollbackRepository,
} from "../modules/harness-control-plane/index.ts";
import {
  createExecutionTrackingApi,
  ExecutionTrackingService,
  PostgresExecutionTrackingRepository,
} from "../modules/execution-tracking/index.ts";
import {
  createHarnessDatasetApi,
  HarnessDatasetService,
  PostgresHarnessDatasetRepository,
} from "../modules/harness-datasets/index.ts";
import {
  createHarnessIntegrationApi,
  HarnessIntegrationService,
  PostgresHarnessIntegrationRepository,
} from "../modules/harness-integrations/index.ts";
import {
  createKnowledgeApi,
  KnowledgeAiAssistService,
  KnowledgeService,
  OpenAiKnowledgeAiAssistGenerator,
  KnowledgeSemanticLayerService,
  KnowledgeUploadService,
  PostgresKnowledgeRepository,
  PostgresKnowledgeReviewActionRepository,
} from "../modules/knowledge/index.ts";
import {
  KnowledgeRetrievalService,
  PostgresKnowledgeRetrievalRepository,
} from "../modules/knowledge-retrieval/index.ts";
import {
  createLearningApi,
  LearningService,
  PostgresLearningCandidateRepository,
  PostgresReviewedCaseSnapshotRepository,
} from "../modules/learning/index.ts";
import {
  createLearningGovernanceApi,
  LearningGovernanceService,
  PostgresLearningGovernanceRepository,
} from "../modules/learning-governance/index.ts";
import {
  createManualReviewPolicyApi,
  ManualReviewPolicyService,
  PostgresManualReviewPolicyRepository,
} from "../modules/manual-review-policies/index.ts";
import {
  PostgresJobRepository,
} from "../modules/jobs/index.ts";
import {
  createModelRegistryApi,
  ModelRegistryService,
  PostgresModelRegistryRepository,
  PostgresModelRoutingPolicyRepository,
} from "../modules/model-registry/index.ts";
import {
  createModelRoutingGovernanceApi,
  ModelRoutingGovernanceService,
  PostgresModelRoutingGovernanceRepository,
} from "../modules/model-routing-governance/index.ts";
import {
  createManuscriptApi,
  ManuscriptLifecycleService,
  PostgresManuscriptRepository,
} from "../modules/manuscripts/index.ts";
import {
  createManuscriptQualityPackageApi,
  ManuscriptQualityPackageService,
  PostgresManuscriptQualityPackageRepository,
} from "../modules/manuscript-quality-packages/index.ts";
import {
  createPromptSkillRegistryApi,
  PostgresPromptSkillRegistryRepository,
  PromptSkillRegistryService,
} from "../modules/prompt-skill-registry/index.ts";
import {
  createProofreadingApi,
  PostgresProofreadingPassRunRepository,
  ProofreadingService,
} from "../modules/proofreading/index.ts";
import {
  createResidualLearningApi,
  PostgresResidualIssueRepository,
  ResidualLearningService,
} from "../modules/residual-learning/index.ts";
import {
  createReviewItemsApi,
  PostgresReviewItemsRepository,
  ReviewItemsService,
} from "../modules/review-items/index.ts";
import {
  createRetrievalPresetApi,
  PostgresRetrievalPresetRepository,
  RetrievalPresetService,
} from "../modules/retrieval-presets/index.ts";
import {
  createRuntimeBindingApi,
  PostgresRuntimeBindingRepository,
  RuntimeBindingReadinessService,
  RuntimeBindingService,
} from "../modules/runtime-bindings/index.ts";
import {
  createScreeningApi,
  ScreeningService,
} from "../modules/screening/index.ts";
import {
  createSandboxProfileApi,
  PostgresSandboxProfileRepository,
  SandboxProfileService,
} from "../modules/sandbox-profiles/index.ts";
import { createPostgresWriteTransactionManager } from "../modules/shared/write-transaction-manager.ts";
import {
  createTemplateApi,
  PostgresModuleTemplateRepository,
  PostgresTemplateFamilyRepository,
  TemplateGovernanceService,
} from "../modules/templates/index.ts";
import {
  createVerificationOpsApi,
  PostgresVerificationOpsRepository,
  VerificationOpsService,
} from "../modules/verification-ops/index.ts";
import {
  createToolGatewayApi,
  PostgresToolGatewayRepository,
  ToolGatewayService,
} from "../modules/tool-gateway/index.ts";
import {
  createToolPermissionPolicyApi,
  PostgresToolPermissionPolicyRepository,
  ToolPermissionPolicyService,
} from "../modules/tool-permission-policies/index.ts";
import {
  OpenAiMainlineAiRuntimeExecutor,
  type MainlineAiRuntimeExecutor,
} from "../modules/shared/mainline-ai-runtime-executor.ts";
import {
  createUserAdminApi,
  PostgresUserAdminRepository,
  UserAdminService,
} from "../users/index.ts";
import { ensurePersistentWorkbenchReviewBaseline } from "./persistent-workbench-review-baseline.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

type PoolLikeClient = QueryableClient & {
  connect: () => Promise<QueryableClient & { release?: () => void }>;
};

export interface CreatePersistentGovernanceRuntimeOptions {
  authRuntime: HttpAuthRuntime;
  client: PoolLikeClient;
  uploadRootDir?: string;
  aiProviderConnectivityProbe?: AiProviderConnectivityProbe;
  aiProviderCredentialCrypto?: AiProviderCredentialCrypto;
  aiProviderRuntimeCutoverEnabled?: boolean;
  seedPersistentWorkbenchReviewBaseline?: boolean;
  mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;
}

export function createPersistentGovernanceRuntime(
  options: CreatePersistentGovernanceRuntimeOptions,
): ApiServerRuntime {
  const uploadRootDir =
    options.uploadRootDir ??
    path.resolve(
      process.cwd(),
      ".local-data",
      "uploads",
      process.env.APP_ENV ?? "development",
    );
  const aiProviderCredentialCrypto =
    options.aiProviderCredentialCrypto ?? new AiProviderCredentialCrypto();
  const aiProviderRuntimeCutoverEnabled =
    options.aiProviderRuntimeCutoverEnabled ?? false;
  const permissionGuard = new PermissionGuard();

  const manuscriptRepository = new PostgresManuscriptRepository({
    client: options.client,
  });
  const assetRepository = new PostgresDocumentAssetRepository({
    client: options.client,
  });
  const jobRepository = new PostgresJobRepository({
    client: options.client,
  });
  const proofreadingPassRunRepository = new PostgresProofreadingPassRunRepository({
    client: options.client,
  });
  const reviewedCaseSnapshotRepository = new PostgresReviewedCaseSnapshotRepository({
    client: options.client,
  });
  const feedbackGovernanceRepository = new PostgresFeedbackGovernanceRepository({
    client: options.client,
  });
  const humanReviewRepository = new PostgresHumanReviewRepository({
    client: options.client,
  });

  const agentExecutionRepository = new PostgresAgentExecutionRepository({
    client: options.client,
  });
  const agentProfileRepository = new PostgresAgentProfileRepository({
    client: options.client,
  });
  const agentRuntimeRepository = new PostgresAgentRuntimeRepository({
    client: options.client,
  });
  const learningCandidateRepository = new PostgresLearningCandidateRepository({
    client: options.client,
  });
  const knowledgeRepository = new PostgresKnowledgeRepository({
    client: options.client,
  });
  const knowledgeRetrievalRepository = new PostgresKnowledgeRetrievalRepository({
    client: options.client,
  });
  const knowledgeReviewActionRepository =
    new PostgresKnowledgeReviewActionRepository({
      client: options.client,
    });
  const templateFamilyRepository = new PostgresTemplateFamilyRepository({
    client: options.client,
  });
  const moduleTemplateRepository = new PostgresModuleTemplateRepository({
    client: options.client,
  });
  const editorialRuleRepository = new PostgresEditorialRuleRepository({
    client: options.client,
  });
  const editorialRuleActivationMetricsRepository =
    new PostgresEditorialRuleActivationMetricsRepository({
      client: options.client,
    });
  const extractionTaskRepository = new PostgresExtractionTaskRepository({
    client: options.client,
  });
  const learningGovernanceRepository = new PostgresLearningGovernanceRepository({
    client: options.client,
  });
  const executionGovernanceRepository = new PostgresExecutionGovernanceRepository({
    client: options.client,
  });
  const executionTrackingRepository = new PostgresExecutionTrackingRepository({
    client: options.client,
  });
  const residualIssueRepository = new PostgresResidualIssueRepository({
    client: options.client,
  });
  const reviewItemsRepository = new PostgresReviewItemsRepository({
    client: options.client,
  });
  const modelRegistryRepository = new PostgresModelRegistryRepository({
    client: options.client,
  });
  const modelRoutingPolicyRepository = new PostgresModelRoutingPolicyRepository({
    client: options.client,
  });
  const modelRoutingGovernanceRepository =
    new PostgresModelRoutingGovernanceRepository({
      client: options.client,
    });
  const runtimeBindingRepository = new PostgresRuntimeBindingRepository({
    client: options.client,
  });
  const retrievalPresetRepository = new PostgresRetrievalPresetRepository({
    client: options.client,
  });
  const manualReviewPolicyRepository = new PostgresManualReviewPolicyRepository({
    client: options.client,
  });
  const harnessControlPlaneRollbackRepository =
    new PostgresHarnessControlPlaneRollbackRepository({
      client: options.client,
    });
  const sandboxProfileRepository = new PostgresSandboxProfileRepository({
    client: options.client,
  });
  const toolGatewayRepository = new PostgresToolGatewayRepository({
    client: options.client,
  });
  const toolPermissionPolicyRepository =
    new PostgresToolPermissionPolicyRepository({
      client: options.client,
    });
  const promptSkillRegistryRepository =
    new PostgresPromptSkillRegistryRepository({
      client: options.client,
    });
  const runtimeBootstrap = options.seedPersistentWorkbenchReviewBaseline
    ? ensurePersistentWorkbenchReviewBaseline({
        templateFamilyRepository,
        moduleTemplateRepository,
        promptSkillRegistryRepository,
        editorialRuleRepository,
        executionGovernanceRepository,
        sandboxProfileRepository,
        agentRuntimeRepository,
        agentProfileRepository,
        runtimeBindingRepository,
        toolPermissionPolicyRepository,
        modelRegistryRepository,
        modelRoutingPolicyRepository,
        retrievalPresetRepository,
        manualReviewPolicyRepository,
      })
    : Promise.resolve();
  const manuscriptQualityPackageRepository =
    new PostgresManuscriptQualityPackageRepository({
      client: options.client,
    });
  const verificationOpsRepository = new PostgresVerificationOpsRepository({
    client: options.client,
  });
  const harnessDatasetRepository = new PostgresHarnessDatasetRepository({
    client: options.client,
  });
  const harnessIntegrationRepository = new PostgresHarnessIntegrationRepository({
    client: options.client,
  });
  const userAdminRepository = new PostgresUserAdminRepository({
    client: options.client,
  });
  const authSessionRepository = new PostgresAuthSessionRepository({
    client: options.client,
  });
  const loginAttemptStore = new PostgresLoginAttemptStore({
    client: options.client,
  });
  const auditService = new PostgresAuditService({
    client: options.client,
  });
  const aiProviderConnectionRepository = new PostgresAiProviderConnectionRepository({
    client: options.client,
  });
  const aiProviderRuntimeService = createAiProviderRuntimeService({
    repository: aiProviderConnectionRepository,
    credentialCrypto: aiProviderCredentialCrypto,
  });

  const workbenchTransactionManager = createPostgresWriteTransactionManager({
    getClient: async () => options.client.connect(),
    createContext: (client) => ({
      manuscriptRepository: new PostgresManuscriptRepository({ client }),
      assetRepository: new PostgresDocumentAssetRepository({ client }),
      jobRepository: new PostgresJobRepository({ client }),
    }),
  });
  const learningTransactionManager = createPostgresWriteTransactionManager({
    getClient: async () => options.client.connect(),
    createContext: (client) => ({
      manuscriptRepository: new PostgresManuscriptRepository({ client }),
      assetRepository: new PostgresDocumentAssetRepository({ client }),
      snapshotRepository: new PostgresReviewedCaseSnapshotRepository({ client }),
      candidateRepository: new PostgresLearningCandidateRepository({ client }),
    }),
  });
  const feedbackGovernanceTransactionManager = createPostgresWriteTransactionManager({
    getClient: async () => options.client.connect(),
    createContext: (client) => ({
      repository: new PostgresFeedbackGovernanceRepository({ client }),
    }),
  });
  const verificationOpsTransactionManager = createPostgresWriteTransactionManager({
    getClient: async () => options.client.connect(),
    createContext: (client) => ({
      repository: new PostgresVerificationOpsRepository({ client }),
    }),
  });
  const harnessDatasetTransactionManager = createPostgresWriteTransactionManager({
    getClient: async () => options.client.connect(),
    createContext: (client) => ({
      repository: new PostgresHarnessDatasetRepository({ client }),
    }),
  });

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
  });
  const documentStructureService = new DocumentStructureService({
    adapter: new PythonDocxStructureWorkerAdapter({
      assetRepository,
      rootDir: uploadRootDir,
    }),
  });
  const editorialDocxTransformService = new EditorialDocxTransformService({
    assetRepository,
    rootDir: uploadRootDir,
  });
  const docxSourceBlockResolver = new PythonDocxSourceBlockResolver({
    assetRepository,
    rootDir: uploadRootDir,
  });
  const exportService = new DocumentExportService({
    assetRepository,
    manuscriptRepository,
  });
  const previewService = new DocumentPreviewService({
    assetRepository,
    sessionService: new OnlyOfficeSessionService(),
  });
  const saveBackService = new OnlyOfficeSaveBackService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    assetService: documentAssetService,
    uploadRootDir,
    transactionManager: workbenchTransactionManager,
    humanReviewRepository,
    humanReviewDiffService: new HumanReviewDiffService(),
    sourceBlockResolver: docxSourceBlockResolver,
  });
  const feedbackGovernanceService = new FeedbackGovernanceService({
    repository: feedbackGovernanceRepository,
    executionTrackingRepository,
    assetRepository,
    reviewedCaseSnapshotRepository,
    transactionManager: feedbackGovernanceTransactionManager,
  });
  const learningService = new LearningService({
    manuscriptRepository,
    assetRepository,
    snapshotRepository: reviewedCaseSnapshotRepository,
    candidateRepository: learningCandidateRepository,
    documentAssetService,
    feedbackGovernanceService,
    transactionManager: learningTransactionManager,
  });
  const residualLearningService = new ResidualLearningService({
    residualIssueRepository,
    learningService,
  });
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    reviewedCaseSnapshotRepository,
    learningService,
    residualLearningService,
    knowledgeRetrievalRepository,
    toolGatewayRepository,
    transactionManager: verificationOpsTransactionManager,
  });
  const learningApi = createLearningApi({ learningService });
  const residualLearningApi = createResidualLearningApi({
    residualLearningService,
    verificationOpsService,
  });
  const editorialRuleActivationMetricsService =
    new EditorialRuleActivationMetricsService({
      repository: editorialRuleActivationMetricsRepository,
      editorialRuleRepository,
    });
  const reviewItemsService = new ReviewItemsService({
    reviewItemsRepository,
    residualLearningService,
    learningService,
    feedbackGovernanceService,
    activationMetricsService: editorialRuleActivationMetricsService,
    residualReviewCoordinator: {
      async validateIssue(input) {
        return (await residualLearningApi.validateIssue(input)).body;
      },
      async createLearningCandidate(input) {
        return (await residualLearningApi.createLearningCandidate(input)).body;
      },
      async resolveIssueDecision(input) {
        return (await residualLearningApi.resolveIssueDecision(input)).body;
      },
    },
  });
  const reviewItemsApi = createReviewItemsApi({
    reviewItemsService,
  });
  const humanReviewService = new HumanReviewService({
    repository: humanReviewRepository,
    manuscriptRepository,
    assetRepository,
    jobRepository,
    documentAssetService,
    editorialDocxTransformService,
    reviewItemsService,
  });
  const harnessDatasetService = new HarnessDatasetService({
    repository: harnessDatasetRepository,
    reviewedCaseSnapshotRepository,
    manuscriptRepository,
    assetRepository,
    verificationOpsRepository,
    permissionGuard,
    transactionManager: harnessDatasetTransactionManager,
  });
  const knowledgeRetrievalService = new KnowledgeRetrievalService({
    repository: knowledgeRetrievalRepository,
  });
  const knowledgeServiceTransactionManager = createPostgresWriteTransactionManager({
    getClient: async () => options.client.connect(),
    createContext: (client) => ({
      repository: new PostgresKnowledgeRepository({ client }),
      reviewActionRepository: new PostgresKnowledgeReviewActionRepository({
        client,
      }),
    }),
  });
  const templateService = new TemplateGovernanceService({
    templateFamilyRepository,
    moduleTemplateRepository,
    contentModuleRepository: templateFamilyRepository,
    templateCompositionRepository: templateFamilyRepository,
    extractionTaskRepository,
    learningCandidateRepository,
    harnessDatasetRepository,
    knowledgeRetrievalRepository,
    knowledgeRetrievalService,
    transactionManager: createPostgresWriteTransactionManager({
      getClient: async () => options.client.connect(),
      createContext: (client) => ({
        templateFamilyRepository: new PostgresTemplateFamilyRepository({
          client,
        }),
        moduleTemplateRepository: new PostgresModuleTemplateRepository({
          client,
        }),
        contentModuleRepository: new PostgresTemplateFamilyRepository({
          client,
        }),
        templateCompositionRepository: new PostgresTemplateFamilyRepository({
          client,
        }),
      }),
    }),
  });
  const editorialRuleProjectionService = new EditorialRuleProjectionService({
    editorialRuleRepository,
    knowledgeRepository,
    templateFamilyRepository,
  });
  const editorialRuleService = new EditorialRuleService({
    repository: editorialRuleRepository,
    templateFamilyRepository,
    verificationOpsRepository,
    projectionService: editorialRuleProjectionService,
    activationMetricsService: editorialRuleActivationMetricsService,
  });
  const editorialRuleResolutionService = new EditorialRuleResolutionService({
    repository: editorialRuleRepository,
  });
  const rulePackageExampleSourceSessionService = new ExampleSourceSessionService({
    uploadRootDir,
  });
  const editorialRulePackageService = new EditorialRulePackageService({
    exampleSourceSessionService: rulePackageExampleSourceSessionService,
    reviewedCaseSourceService: new ReviewedCaseRulePackageSourceService({
      snapshotRepository: reviewedCaseSnapshotRepository,
      assetRepository,
      rootDir: uploadRootDir,
    }),
  });
  const extractionTaskService = new ExtractionTaskService({
    repository: extractionTaskRepository,
    rulePackageService: editorialRulePackageService,
  });
  const rulePackageCompileService = new RulePackageCompileService({
    repository: editorialRuleRepository,
    resolutionService: editorialRuleResolutionService,
    editorialRuleService,
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
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    transactionManager: createPostgresWriteTransactionManager({
      getClient: async () => options.client.connect(),
      createContext: (client) => ({
        repository: new PostgresExecutionGovernanceRepository({
          client,
        }),
      }),
    }),
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
  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository: modelRoutingGovernanceRepository,
    modelRegistryRepository,
    permissionGuard,
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRegistryRepository,
    routingPolicyRepository: modelRoutingPolicyRepository,
    aiProviderConnectionRepository,
    modelRoutingGovernanceService,
    auditService,
  });
  const ruleAiIntakeService = new RuleAiIntakeService({
    generator: new OpenAiRuleAiIntakeGenerator({
      aiGatewayService,
      aiProviderRuntimeService,
    }),
    existingRules: createRuleAiSimilarityLedgerResolver(editorialRuleRepository),
  });
  const ruleAiParsingService = new RuleAiParsingService({
    generator: new OpenAiRuleAiParsingGenerator({
      aiGatewayService,
      aiProviderRuntimeService,
    }),
  });
  const promptSkillRegistryService = new PromptSkillRegistryService({
    repository: promptSkillRegistryRepository,
    learningCandidateRepository,
  });
  const manuscriptQualityPackageService = new ManuscriptQualityPackageService({
    repository: manuscriptQualityPackageRepository,
  });
  const modelRegistryService = new ModelRegistryService({
    repository: modelRegistryRepository,
    routingPolicyRepository: modelRoutingPolicyRepository,
    aiProviderConnectionRepository,
  });
  const runtimeBindingService = new RuntimeBindingService({
    repository: runtimeBindingRepository,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    verificationOpsRepository,
    manuscriptQualityPackageRepository,
  });
  const retrievalPresetService = new RetrievalPresetService({
    repository: retrievalPresetRepository,
  });
  const manualReviewPolicyService = new ManualReviewPolicyService({
    repository: manualReviewPolicyRepository,
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
    manuscriptQualityPackageRepository,
  });
  const executionResolutionService = new ExecutionResolutionService({
    executionGovernanceService,
    templateFamilyRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    aiProviderConnectionRepository,
    modelRoutingGovernanceService,
    runtimeBindingService,
    retrievalPresetService,
    manualReviewPolicyService,
    runtimeBindingReadinessService,
  });
  const harnessControlPlaneService = new HarnessControlPlaneService({
    executionGovernanceService,
    runtimeBindingService,
    modelRoutingGovernanceService,
    retrievalPresetService,
    manualReviewPolicyService,
    rollbackHistoryRepository: harnessControlPlaneRollbackRepository,
  });
  const harnessIntegrationService = new HarnessIntegrationService({
    repository: harnessIntegrationRepository,
    governedRunRuntime: runtimeBindingService,
    verificationEvidenceRecorder: verificationOpsService,
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
      retrievalPresetService,
      manualReviewPolicyService,
      sandboxProfileService,
      agentProfileService,
      agentRuntimeService,
      runtimeBindingService,
      runtimeBindingReadinessService,
      aiProviderRuntimeService,
      aiProviderRuntimeCutoverEnabled,
      toolPermissionPolicyService,
    },
    transactionManager: knowledgeServiceTransactionManager,
  });
  const knowledgeSemanticLayerService = new KnowledgeSemanticLayerService({
    repository: knowledgeRepository,
  });
  const knowledgeAiAssistService = new KnowledgeAiAssistService({
    repository: knowledgeRepository,
    generator: new OpenAiKnowledgeAiAssistGenerator({
      aiGatewayService,
      aiProviderRuntimeService,
      uploadRootDir,
    }),
  });
  const mainlineAiRuntimeExecutor =
    options.mainlineAiRuntimeExecutor ??
    new OpenAiMainlineAiRuntimeExecutor({
      aiGatewayService,
      aiProviderRuntimeService,
    });
  const knowledgeUploadService = new KnowledgeUploadService({
    rootDir: uploadRootDir,
  });
  const learningGovernanceService = new LearningGovernanceService({
    repository: learningGovernanceRepository,
    learningCandidateRepository,
    knowledgeService,
    templateService,
    editorialRuleService,
    promptSkillRegistryService,
    activationMetricsService: editorialRuleActivationMetricsService,
    transactionManager: createPostgresWriteTransactionManager({
      getClient: async () => options.client.connect(),
      createContext: (client) => ({
        repository: new PostgresLearningGovernanceRepository({
          client,
        }),
      }),
    }),
  });
  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    templateFamilyRepository,
    transactionManager: workbenchTransactionManager,
  });
  const screeningService = new ScreeningService({
    manuscriptRepository,
    assetRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    retrievalPresetService,
    manualReviewPolicyService,
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
    aiProviderRuntimeService,
    aiProviderRuntimeCutoverEnabled,
    toolPermissionPolicyService,
    agentExecutionService,
    agentExecutionOrchestrationService,
    mainlineAiRuntimeExecutor,
    textAssetRootDir: uploadRootDir,
    manuscriptQualitySourceBlockResolver: docxSourceBlockResolver,
    documentStructureService,
    transactionManager: workbenchTransactionManager,
  });
  const editingService = new EditingService({
    manuscriptRepository,
    assetRepository,
    templateFamilyRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    retrievalPresetService,
    manualReviewPolicyService,
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
    aiProviderRuntimeService,
    aiProviderRuntimeCutoverEnabled,
    toolPermissionPolicyService,
    agentExecutionService,
    agentExecutionOrchestrationService,
    mainlineAiRuntimeExecutor,
    manuscriptQualitySourceBlockResolver: docxSourceBlockResolver,
    documentStructureService,
    editorialDocxTransformService,
    reviewItemsService,
    activationMetricsService: editorialRuleActivationMetricsService,
    transactionManager: workbenchTransactionManager,
  });
  const proofreadingService = new ProofreadingService({
    manuscriptRepository,
    assetRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    retrievalPresetService,
    manualReviewPolicyService,
    executionGovernanceService,
    executionTrackingService,
    jobRepository,
    proofreadingPassRunRepository,
    documentAssetService,
    aiGatewayService,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    runtimeBindingReadinessService,
    aiProviderRuntimeService,
    aiProviderRuntimeCutoverEnabled,
    toolPermissionPolicyService,
    agentExecutionService,
    agentExecutionOrchestrationService,
    mainlineAiRuntimeExecutor,
    textAssetRootDir: uploadRootDir,
    editorialDocxTransformService,
    proofreadingSourceBlockResolver: docxSourceBlockResolver,
    documentStructureService,
    reviewItemsService,
    learningService,
    residualLearningService,
    transactionManager: workbenchTransactionManager,
  });
  const userAdminService = new UserAdminService({
    repository: userAdminRepository,
    authSessionRepository,
    loginAttemptStore,
    auditService,
    passwordHasher: new BcryptPasswordHasher(),
  });
  const aiProviderConnectionService = createAiProviderConnectionService({
    repository: aiProviderConnectionRepository,
    auditService,
    credentialCrypto: aiProviderCredentialCrypto,
    connectivityProbe:
      options.aiProviderConnectivityProbe ??
      new OpenAiChatCompatibleConnectivityProbe(),
  });
  const aiProviderAutoConfigurationService =
    new AiProviderAutoConfigurationService({
      aiProviderConnectionService,
      modelRegistryService,
      modelRoutingGovernanceService,
    });

  return withRuntimeBootstrap(
    {
    authRuntime: options.authRuntime,
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
    editorialRuleApi: createEditorialRuleApi({
      editorialRuleService,
      activationMetricsService: editorialRuleActivationMetricsService,
      editorialRulePackageService,
      extractionTaskService,
      rulePackageCompileService,
      ruleAiIntakeService,
      ruleAiParsingService,
    }),
    editingApi: createEditingApi({
      editingService,
    }),
    manuscriptApi: createManuscriptApi({
      manuscriptService,
      assetService: documentAssetService,
      executionTrackingService,
      executionGovernanceRepository,
      executionResolutionService,
      runtimeBindingReadinessService,
      agentExecutionService,
      proofreadingPassRunRepository,
    }),
    proofreadingApi: createProofreadingApi({
      proofreadingService,
    }),
    screeningApi: createScreeningApi({
      screeningService,
    }),
    documentPipelineApi: {
      async createPreviewSession(input) {
        return {
          status: 200,
          body: await previewService.createPreviewSession(input),
        };
      },
      async handlePreviewCallback(input) {
        return {
          status: 200,
          body: await saveBackService.handleCallback(input),
        };
      },
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
          headers: {
            "Content-Type": download.mimeType,
            "Content-Length": String(download.bytes.byteLength),
            "Content-Disposition": buildDownloadContentDispositionHeader(
              download.fileName,
            ),
            "Cache-Control": "no-store",
          },
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
      executionGovernanceRepository,
      runtimeBindingReadinessService,
      agentExecutionService,
    }),
    harnessControlPlaneApi: createHarnessControlPlaneApi({
      harnessControlPlaneService,
    }),
    harnessDatasetApi: createHarnessDatasetApi({
      harnessDatasetService,
    }),
    harnessIntegrationApi: createHarnessIntegrationApi({
      harnessIntegrationService,
    }),
    knowledgeApi: createKnowledgeApi({
      knowledgeService,
      aiAssistService: knowledgeAiAssistService,
      semanticLayerService: knowledgeSemanticLayerService,
      uploadService: knowledgeUploadService,
      harnessDatasetService,
    }),
    feedbackGovernanceApi: createFeedbackGovernanceApi({
      feedbackGovernanceService,
    }),
    humanReviewRepository,
    humanReviewApi: createHumanReviewApi({
      humanReviewService,
    }),
    learningApi,
    residualLearningApi,
    reviewItemsApi,
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
    manuscriptQualityPackageApi: createManuscriptQualityPackageApi({
      manuscriptQualityPackageService,
    }),
    retrievalPresetApi: createRetrievalPresetApi({
      retrievalPresetService,
    }),
    manualReviewPolicyApi: createManualReviewPolicyApi({
      manualReviewPolicyService,
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
    userAdminApi: createUserAdminApi({
      userAdminService,
    }),
    aiProviderConnectionApi: createAiProviderConnectionApi({
      aiProviderConnectionService,
      aiProviderAutoConfigurationService,
    }),
    permissionGuard,
    },
    runtimeBootstrap,
  );
}

function withRuntimeBootstrap(
  runtime: ApiServerRuntime,
  bootstrap: Promise<void>,
): ApiServerRuntime {
  const bootstrappedRuntime = { ...runtime } as ApiServerRuntime;

  for (const key of Object.keys(runtime) as Array<keyof ApiServerRuntime>) {
    if (key === "authRuntime" || key === "permissionGuard") {
      continue;
    }

    const value = runtime[key];
    if (value && typeof value === "object") {
      (bootstrappedRuntime[key] as unknown) = gateApiWithBootstrap(
        value as Record<string, unknown>,
        bootstrap,
      );
    }
  }

  return bootstrappedRuntime;
}

function gateApiWithBootstrap<TApi extends object>(
  api: TApi,
  bootstrap: Promise<void>,
): TApi {
  return new Proxy(api, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        return value;
      }

      return async (...args: unknown[]) => {
        await bootstrap;
        return Reflect.apply(value, target, args);
      };
    },
  }) as TApi;
}
