import { PermissionGuard } from "../auth/permission-guard.ts";
import { PostgresAuditService } from "../audit/index.ts";
import type { HttpAuthRuntime } from "./demo-auth-runtime.ts";
import type { ApiServerRuntime } from "./api-http-server.ts";
import {
  AgentProfileService,
  createAgentProfileApi,
  PostgresAgentProfileRepository,
} from "../modules/agent-profiles/index.ts";
import {
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
  DocumentAssetService,
  PostgresDocumentAssetRepository,
} from "../modules/assets/index.ts";
import {
  DocumentExportService,
} from "../modules/document-pipeline/index.ts";
import {
  createEditingApi,
  EditingService,
} from "../modules/editing/index.ts";
import {
  FeedbackGovernanceService,
  InMemoryFeedbackGovernanceRepository,
} from "../modules/feedback-governance/index.ts";
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
  createExecutionTrackingApi,
  ExecutionTrackingService,
  InMemoryExecutionTrackingRepository,
  PostgresExecutionTrackingRepository,
} from "../modules/execution-tracking/index.ts";
import {
  createKnowledgeApi,
  KnowledgeService,
  PostgresKnowledgeRepository,
  PostgresKnowledgeReviewActionRepository,
} from "../modules/knowledge/index.ts";
import {
  createLearningApi,
  InMemoryReviewedCaseSnapshotRepository,
  LearningService,
  PostgresLearningCandidateRepository,
} from "../modules/learning/index.ts";
import {
  createLearningGovernanceApi,
  LearningGovernanceService,
  PostgresLearningGovernanceRepository,
} from "../modules/learning-governance/index.ts";
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
  createManuscriptApi,
  ManuscriptLifecycleService,
  PostgresManuscriptRepository,
} from "../modules/manuscripts/index.ts";
import {
  createPromptSkillRegistryApi,
  PostgresPromptSkillRegistryRepository,
  PromptSkillRegistryService,
} from "../modules/prompt-skill-registry/index.ts";
import {
  createProofreadingApi,
  ProofreadingService,
} from "../modules/proofreading/index.ts";
import {
  createRuntimeBindingApi,
  PostgresRuntimeBindingRepository,
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
  createToolGatewayApi,
  PostgresToolGatewayRepository,
  ToolGatewayService,
} from "../modules/tool-gateway/index.ts";
import {
  createToolPermissionPolicyApi,
  PostgresToolPermissionPolicyRepository,
  ToolPermissionPolicyService,
} from "../modules/tool-permission-policies/index.ts";

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
}

export function createPersistentGovernanceRuntime(
  options: CreatePersistentGovernanceRuntimeOptions,
): ApiServerRuntime {
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
  const reviewedCaseSnapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
  const feedbackGovernanceRepository = new InMemoryFeedbackGovernanceRepository();
  const feedbackExecutionTrackingRepository =
    new InMemoryExecutionTrackingRepository();

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
  const learningGovernanceRepository = new PostgresLearningGovernanceRepository({
    client: options.client,
  });
  const executionGovernanceRepository = new PostgresExecutionGovernanceRepository({
    client: options.client,
  });
  const executionTrackingRepository = new PostgresExecutionTrackingRepository({
    client: options.client,
  });
  const modelRegistryRepository = new PostgresModelRegistryRepository({
    client: options.client,
  });
  const modelRoutingPolicyRepository = new PostgresModelRoutingPolicyRepository({
    client: options.client,
  });
  const runtimeBindingRepository = new PostgresRuntimeBindingRepository({
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

  const workbenchTransactionManager = createPostgresWriteTransactionManager({
    getClient: async () => options.client.connect(),
    createContext: (client) => ({
      manuscriptRepository: new PostgresManuscriptRepository({ client }),
      assetRepository: new PostgresDocumentAssetRepository({ client }),
      jobRepository: new PostgresJobRepository({ client }),
    }),
  });

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
  });
  const exportService = new DocumentExportService({
    assetRepository,
    manuscriptRepository,
  });
  const feedbackGovernanceService = new FeedbackGovernanceService({
    repository: feedbackGovernanceRepository,
    executionTrackingRepository: feedbackExecutionTrackingRepository,
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
  const knowledgeService = new KnowledgeService({
    repository: knowledgeRepository,
    reviewActionRepository: knowledgeReviewActionRepository,
    learningCandidateRepository,
    transactionManager: createPostgresWriteTransactionManager({
      getClient: async () => options.client.connect(),
      createContext: (client) => ({
        repository: new PostgresKnowledgeRepository({ client }),
        reviewActionRepository: new PostgresKnowledgeReviewActionRepository({
          client,
        }),
      }),
    }),
  });
  const templateService = new TemplateGovernanceService({
    templateFamilyRepository,
    moduleTemplateRepository,
    learningCandidateRepository,
    transactionManager: createPostgresWriteTransactionManager({
      getClient: async () => options.client.connect(),
      createContext: (client) => ({
        templateFamilyRepository: new PostgresTemplateFamilyRepository({
          client,
        }),
        moduleTemplateRepository: new PostgresModuleTemplateRepository({
          client,
        }),
      }),
    }),
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
  const aiGatewayService = new AiGatewayService({
    repository: modelRegistryRepository,
    routingPolicyRepository: modelRoutingPolicyRepository,
    auditService: new PostgresAuditService({
      client: options.client,
    }),
  });
  const promptSkillRegistryService = new PromptSkillRegistryService({
    repository: promptSkillRegistryRepository,
    learningCandidateRepository,
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
  });
  const runtimeBindingService = new RuntimeBindingService({
    repository: runtimeBindingRepository,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
  });
  const learningGovernanceService = new LearningGovernanceService({
    repository: learningGovernanceRepository,
    learningCandidateRepository,
    knowledgeService,
    templateService,
    promptSkillRegistryService,
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
    executionGovernanceService,
    executionTrackingService,
    jobRepository,
    documentAssetService,
    aiGatewayService,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    runtimeBindingService,
    toolPermissionPolicyService,
    agentExecutionService,
    transactionManager: workbenchTransactionManager,
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
    toolPermissionPolicyService,
    agentExecutionService,
    transactionManager: workbenchTransactionManager,
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
    toolPermissionPolicyService,
    agentExecutionService,
    transactionManager: workbenchTransactionManager,
  });

  return {
    authRuntime: options.authRuntime,
    agentExecutionApi: createAgentExecutionApi({
      agentExecutionService,
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
    knowledgeApi: createKnowledgeApi({ knowledgeService }),
    learningApi: createLearningApi({ learningService }),
    learningGovernanceApi: createLearningGovernanceApi({
      learningGovernanceService,
    }),
    templateApi: createTemplateApi({ templateService }),
    modelRegistryApi: createModelRegistryApi({ modelRegistryService }),
    promptSkillRegistryApi: createPromptSkillRegistryApi({
      promptSkillRegistryService,
    }),
    runtimeBindingApi: createRuntimeBindingApi({
      runtimeBindingService,
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
