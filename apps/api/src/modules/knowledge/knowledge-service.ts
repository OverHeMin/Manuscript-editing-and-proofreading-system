import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { AgentProfileService } from "../agent-profiles/agent-profile-service.ts";
import type { AgentRuntimeService } from "../agent-runtime/agent-runtime-service.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type {
  KnowledgeRetrievalSnapshotRecord,
} from "../knowledge-retrieval/knowledge-retrieval-record.ts";
import type { KnowledgeRetrievalRepository } from "../knowledge-retrieval/knowledge-retrieval-repository.ts";
import type { KnowledgeRetrievalService } from "../knowledge-retrieval/knowledge-retrieval-service.ts";
import type { LearningCandidateRepository } from "../learning/learning-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";
import type { RuntimeBindingService } from "../runtime-bindings/runtime-binding-service.ts";
import type { SandboxProfileService } from "../sandbox-profiles/sandbox-profile-service.ts";
import {
  resolveGovernedAgentContext,
  type GovernedAgentContext,
} from "../shared/governed-agent-context-resolver.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import { requireApprovedLearningCandidate } from "../shared/learning-candidate-guard.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ToolPermissionPolicyService } from "../tool-permission-policies/tool-permission-policy-service.ts";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "./in-memory-knowledge-repository.ts";
import type {
  KnowledgeRepository,
  KnowledgeReviewActionRepository,
} from "./knowledge-repository.ts";
import type {
  KnowledgeRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

export interface CreateKnowledgeDraftInput {
  title: string;
  canonicalText: string;
  summary?: string;
  knowledgeKind: KnowledgeRecord["knowledge_kind"];
  moduleScope: KnowledgeRecord["routing"]["module_scope"];
  manuscriptTypes: KnowledgeRecord["routing"]["manuscript_types"];
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  evidenceLevel?: KnowledgeRecord["evidence_level"];
  sourceType?: KnowledgeRecord["source_type"];
  sourceLink?: string;
  aliases?: string[];
  templateBindings?: string[];
  sourceLearningCandidateId?: string;
}

export interface CreateKnowledgeDraftFromLearningCandidateInput
  extends CreateKnowledgeDraftInput {
  sourceLearningCandidateId: string;
}

export interface UpdateKnowledgeDraftInput {
  title?: string;
  canonicalText?: string;
  summary?: string;
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  aliases?: string[];
  templateBindings?: string[];
}

export interface ResolveGovernedRetrievalContextInput {
  manuscriptId: string;
  module: TemplateModule;
  actorId: string;
  actorRole: RoleKey;
  jobId?: string;
}

export interface GovernedRetrievalContextRecord {
  manuscript_id: string;
  module: TemplateModule;
  template_family_id: string;
  knowledge_item_ids: string[];
  retrieval_status: GovernedAgentContext["retrievalContext"]["status"];
  retrieval_snapshot_id?: string;
  retrieval_failure_reason?: string;
}

export interface GovernedRetrievalResolverDependencies {
  manuscriptRepository: ManuscriptRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  executionGovernanceService: ExecutionGovernanceService;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
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
}

export interface KnowledgeServiceOptions {
  repository: KnowledgeRepository;
  reviewActionRepository: KnowledgeReviewActionRepository;
  learningCandidateRepository?: LearningCandidateRepository;
  knowledgeRetrievalRepository?: KnowledgeRetrievalRepository;
  knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalSnapshot"
  >;
  governedRetrievalResolverDependencies?: GovernedRetrievalResolverDependencies;
  transactionManager?: WriteTransactionManager<KnowledgeWriteContext>;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
  now?: () => Date;
}

interface KnowledgeWriteContext {
  repository: KnowledgeRepository;
  reviewActionRepository: KnowledgeReviewActionRepository;
}

export class KnowledgeItemNotFoundError extends Error {
  constructor(knowledgeItemId: string) {
    super(`Knowledge item ${knowledgeItemId} was not found.`);
    this.name = "KnowledgeItemNotFoundError";
  }
}

export class KnowledgeStatusTransitionError extends Error {
  constructor(knowledgeItemId: string, fromStatus: string, toStatus: string) {
    super(
      `Knowledge item ${knowledgeItemId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "KnowledgeStatusTransitionError";
  }
}

export class GovernedRetrievalContextDependencyError extends Error {
  constructor() {
    super("Governed retrieval context dependencies are not configured.");
    this.name = "GovernedRetrievalContextDependencyError";
  }
}

export class KnowledgeRetrievalSnapshotNotFoundError extends Error {
  constructor(snapshotId: string) {
    super(`Knowledge retrieval snapshot ${snapshotId} was not found.`);
    this.name = "KnowledgeRetrievalSnapshotNotFoundError";
  }
}

export class KnowledgeService {
  private readonly repository: KnowledgeRepository;
  private readonly reviewActionRepository: KnowledgeReviewActionRepository;
  private readonly learningCandidateRepository?: LearningCandidateRepository;
  private readonly knowledgeRetrievalRepository?: KnowledgeRetrievalRepository;
  private readonly knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalSnapshot"
  >;
  private readonly governedRetrievalResolverDependencies?: GovernedRetrievalResolverDependencies;
  private readonly transactionManager: WriteTransactionManager<KnowledgeWriteContext>;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: KnowledgeServiceOptions) {
    this.repository = options.repository;
    this.reviewActionRepository = options.reviewActionRepository;
    this.learningCandidateRepository = options.learningCandidateRepository;
    this.knowledgeRetrievalRepository = options.knowledgeRetrievalRepository;
    this.knowledgeRetrievalService = options.knowledgeRetrievalService;
    this.governedRetrievalResolverDependencies =
      options.governedRetrievalResolverDependencies;
    this.transactionManager =
      options.transactionManager ??
      createKnowledgeWriteTransactionManager({
        repository: this.repository,
        reviewActionRepository: this.reviewActionRepository,
      });
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createDraft(input: CreateKnowledgeDraftInput): Promise<KnowledgeRecord> {
    const record: KnowledgeRecord = {
      id: this.createId(),
      title: input.title,
      canonical_text: input.canonicalText,
      summary: input.summary,
      knowledge_kind: input.knowledgeKind,
      status: "draft",
      routing: {
        module_scope: input.moduleScope,
        manuscript_types: input.manuscriptTypes,
        sections: input.sections,
        risk_tags: input.riskTags,
        discipline_tags: input.disciplineTags,
      },
      evidence_level: input.evidenceLevel,
      source_type: input.sourceType,
      source_link: input.sourceLink,
      aliases: input.aliases,
      template_bindings: input.templateBindings,
      ...(input.sourceLearningCandidateId
        ? {
            source_learning_candidate_id: input.sourceLearningCandidateId,
          }
        : {}),
    };

    await this.repository.save(record);
    return record;
  }

  async createDraftFromLearningCandidate(
    actorRole: RoleKey,
    input: CreateKnowledgeDraftFromLearningCandidateInput,
  ): Promise<KnowledgeRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    await requireApprovedLearningCandidate(
      this.learningCandidateRepository,
      input.sourceLearningCandidateId,
    );
    return this.createDraft(input);
  }

  async submitForReview(knowledgeItemId: string): Promise<KnowledgeRecord> {
    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const knowledgeItem = await this.requireKnowledgeItem(
          knowledgeItemId,
          repository,
        );

        if (knowledgeItem.status !== "draft") {
          throw new KnowledgeStatusTransitionError(
            knowledgeItemId,
            knowledgeItem.status,
            "pending_review",
          );
        }

        const updatedRecord: KnowledgeRecord = {
          ...knowledgeItem,
          status: "pending_review",
        };

        await repository.save(updatedRecord);
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: knowledgeItemId,
          action: "submitted_for_review",
          actor_role: "user",
          created_at: this.now().toISOString(),
        });

        return updatedRecord;
      },
    );
  }

  async approve(
    knowledgeItemId: string,
    actorRole: RoleKey,
    reviewNote?: string,
  ): Promise<KnowledgeRecord> {
    this.permissionGuard.assert(actorRole, "knowledge.review");

    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const knowledgeItem = await this.requireKnowledgeItem(
          knowledgeItemId,
          repository,
        );

        if (knowledgeItem.status !== "pending_review") {
          throw new KnowledgeStatusTransitionError(
            knowledgeItemId,
            knowledgeItem.status,
            "approved",
          );
        }

        const updatedRecord: KnowledgeRecord = {
          ...knowledgeItem,
          status: "approved",
        };

        await repository.save(updatedRecord);
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: knowledgeItemId,
          action: "approved",
          actor_role: actorRole,
          review_note: reviewNote,
          created_at: this.now().toISOString(),
        });

        return updatedRecord;
      },
    );
  }

  async reject(
    knowledgeItemId: string,
    actorRole: RoleKey,
    reviewNote?: string,
  ): Promise<KnowledgeRecord> {
    this.permissionGuard.assert(actorRole, "knowledge.review");

    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const knowledgeItem = await this.requireKnowledgeItem(
          knowledgeItemId,
          repository,
        );

        if (knowledgeItem.status !== "pending_review") {
          throw new KnowledgeStatusTransitionError(
            knowledgeItemId,
            knowledgeItem.status,
            "draft",
          );
        }

        // Rejection sends the item back to the editable lane without erasing
        // prior review history, so the next submission stays auditable.
        const updatedRecord: KnowledgeRecord = {
          ...knowledgeItem,
          status: "draft",
        };

        await repository.save(updatedRecord);
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: knowledgeItemId,
          action: "rejected",
          actor_role: actorRole,
          review_note: reviewNote,
          created_at: this.now().toISOString(),
        });

        return updatedRecord;
      },
    );
  }

  async updateDraft(
    knowledgeItemId: string,
    input: UpdateKnowledgeDraftInput,
  ): Promise<KnowledgeRecord> {
    const knowledgeItem = await this.requireKnowledgeItem(knowledgeItemId);

    if (knowledgeItem.status !== "draft") {
      throw new KnowledgeStatusTransitionError(
        knowledgeItemId,
        knowledgeItem.status,
        "draft",
      );
    }

    const updatedRecord: KnowledgeRecord = {
      ...knowledgeItem,
      title: input.title ?? knowledgeItem.title,
      canonical_text: input.canonicalText ?? knowledgeItem.canonical_text,
      summary: input.summary ?? knowledgeItem.summary,
      routing: {
        ...knowledgeItem.routing,
        sections: input.sections ?? knowledgeItem.routing.sections,
        risk_tags: input.riskTags ?? knowledgeItem.routing.risk_tags,
        discipline_tags:
          input.disciplineTags ?? knowledgeItem.routing.discipline_tags,
      },
      aliases: input.aliases ?? knowledgeItem.aliases,
      template_bindings: input.templateBindings ?? knowledgeItem.template_bindings,
    };

    await this.repository.save(updatedRecord);
    return updatedRecord;
  }

  async archive(knowledgeItemId: string): Promise<KnowledgeRecord> {
    const knowledgeItem = await this.requireKnowledgeItem(knowledgeItemId);

    if (knowledgeItem.status === "archived") {
      return knowledgeItem;
    }

    const archivedRecord: KnowledgeRecord = {
      ...knowledgeItem,
      status: "archived",
    };

    await this.repository.save(archivedRecord);
    return archivedRecord;
  }

  listKnowledgeItems(): Promise<KnowledgeRecord[]> {
    return this.repository.list();
  }

  listPendingReviewItems(): Promise<KnowledgeRecord[]> {
    return this.repository.listByStatus("pending_review");
  }

  async listReviewActions(
    knowledgeItemId: string,
  ): Promise<KnowledgeReviewActionRecord[]> {
    await this.requireKnowledgeItem(knowledgeItemId);
    return this.reviewActionRepository.listByKnowledgeItemId(knowledgeItemId);
  }

  async resolveGovernedRetrievalContext(
    input: ResolveGovernedRetrievalContextInput,
  ): Promise<GovernedRetrievalContextRecord> {
    this.permissionGuard.assert(input.actorRole, "permissions.manage");

    if (
      !this.governedRetrievalResolverDependencies ||
      !this.knowledgeRetrievalService
    ) {
      throw new GovernedRetrievalContextDependencyError();
    }

    const governedContext = await resolveGovernedAgentContext({
      manuscriptId: input.manuscriptId,
      module: input.module,
      jobId: input.jobId ?? this.createId(),
      actorId: input.actorId,
      actorRole: input.actorRole,
      manuscriptRepository:
        this.governedRetrievalResolverDependencies.manuscriptRepository,
      moduleTemplateRepository:
        this.governedRetrievalResolverDependencies.moduleTemplateRepository,
      executionGovernanceService:
        this.governedRetrievalResolverDependencies.executionGovernanceService,
      promptSkillRegistryRepository:
        this.governedRetrievalResolverDependencies.promptSkillRegistryRepository,
      knowledgeRepository: this.repository,
      aiGatewayService:
        this.governedRetrievalResolverDependencies.aiGatewayService,
      sandboxProfileService:
        this.governedRetrievalResolverDependencies.sandboxProfileService,
      agentProfileService:
        this.governedRetrievalResolverDependencies.agentProfileService,
      agentRuntimeService:
        this.governedRetrievalResolverDependencies.agentRuntimeService,
      runtimeBindingService:
        this.governedRetrievalResolverDependencies.runtimeBindingService,
      runtimeBindingReadinessService:
        this.governedRetrievalResolverDependencies.runtimeBindingReadinessService,
      toolPermissionPolicyService:
        this.governedRetrievalResolverDependencies.toolPermissionPolicyService,
      knowledgeRetrievalService: this.knowledgeRetrievalService,
    });

    return {
      manuscript_id: governedContext.manuscript.id,
      module: input.module,
      template_family_id: governedContext.executionProfile.template_family_id,
      knowledge_item_ids: governedContext.moduleContext.knowledgeSelections.map(
        (selection) => selection.knowledgeItem.id,
      ),
      retrieval_status: governedContext.retrievalContext.status,
      ...(governedContext.retrievalContext.retrieval_snapshot_id
        ? {
            retrieval_snapshot_id:
              governedContext.retrievalContext.retrieval_snapshot_id,
          }
        : {}),
      ...(governedContext.retrievalContext.failure_reason
        ? {
            retrieval_failure_reason:
              governedContext.retrievalContext.failure_reason,
          }
        : {}),
    };
  }

  async getRetrievalSnapshot(
    actorRole: RoleKey,
    snapshotId: string,
  ): Promise<KnowledgeRetrievalSnapshotRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const snapshot =
      await this.knowledgeRetrievalRepository?.findRetrievalSnapshotById(snapshotId);
    if (!snapshot) {
      throw new KnowledgeRetrievalSnapshotNotFoundError(snapshotId);
    }

    return snapshot;
  }

  private async requireKnowledgeItem(
    knowledgeItemId: string,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRecord> {
    const knowledgeItem = await repository.findById(knowledgeItemId);

    if (!knowledgeItem) {
      throw new KnowledgeItemNotFoundError(knowledgeItemId);
    }

    return knowledgeItem;
  }
}

function createKnowledgeWriteTransactionManager(
  context: KnowledgeWriteContext,
): WriteTransactionManager<KnowledgeWriteContext> {
  if (
    context.repository instanceof InMemoryKnowledgeRepository &&
    context.reviewActionRepository instanceof
      InMemoryKnowledgeReviewActionRepository
  ) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository, context.reviewActionRepository],
    });
  }

  return createDirectWriteTransactionManager(context);
}
