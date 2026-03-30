import { PermissionGuard } from "../auth/permission-guard.ts";
import type { HttpAuthRuntime } from "./demo-auth-runtime.ts";
import type { ApiServerRuntime } from "./api-http-server.ts";
import {
  DocumentAssetService,
  InMemoryDocumentAssetRepository,
} from "../modules/assets/index.ts";
import {
  FeedbackGovernanceService,
  InMemoryFeedbackGovernanceRepository,
} from "../modules/feedback-governance/index.ts";
import { InMemoryExecutionTrackingRepository } from "../modules/execution-tracking/index.ts";
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
  createModelRegistryApi,
  ModelRegistryService,
  PostgresModelRegistryRepository,
  PostgresModelRoutingPolicyRepository,
} from "../modules/model-registry/index.ts";
import { InMemoryManuscriptRepository } from "../modules/manuscripts/index.ts";
import {
  createPromptSkillRegistryApi,
  PostgresPromptSkillRegistryRepository,
  PromptSkillRegistryService,
} from "../modules/prompt-skill-registry/index.ts";
import { createPostgresWriteTransactionManager } from "../modules/shared/write-transaction-manager.ts";
import {
  createTemplateApi,
  PostgresModuleTemplateRepository,
  PostgresTemplateFamilyRepository,
  TemplateGovernanceService,
} from "../modules/templates/index.ts";

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

  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const reviewedCaseSnapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
  const feedbackGovernanceRepository = new InMemoryFeedbackGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();

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
  const modelRegistryRepository = new PostgresModelRegistryRepository({
    client: options.client,
  });
  const modelRoutingPolicyRepository = new PostgresModelRoutingPolicyRepository({
    client: options.client,
  });
  const promptSkillRegistryRepository =
    new PostgresPromptSkillRegistryRepository({
      client: options.client,
    });

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
  const promptSkillRegistryService = new PromptSkillRegistryService({
    repository: promptSkillRegistryRepository,
    learningCandidateRepository,
  });
  const modelRegistryService = new ModelRegistryService({
    repository: modelRegistryRepository,
    routingPolicyRepository: modelRoutingPolicyRepository,
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

  return {
    authRuntime: options.authRuntime,
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
    permissionGuard,
  };
}
