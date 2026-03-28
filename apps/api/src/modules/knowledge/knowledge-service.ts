import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { LearningCandidateRepository } from "../learning/learning-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import { requireApprovedLearningCandidate } from "../shared/learning-candidate-guard.ts";
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

export interface KnowledgeServiceOptions {
  repository: KnowledgeRepository;
  reviewActionRepository: KnowledgeReviewActionRepository;
  learningCandidateRepository?: LearningCandidateRepository;
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

export class KnowledgeService {
  private readonly repository: KnowledgeRepository;
  private readonly reviewActionRepository: KnowledgeReviewActionRepository;
  private readonly learningCandidateRepository?: LearningCandidateRepository;
  private readonly transactionManager: WriteTransactionManager<KnowledgeWriteContext>;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: KnowledgeServiceOptions) {
    this.repository = options.repository;
    this.reviewActionRepository = options.reviewActionRepository;
    this.learningCandidateRepository = options.learningCandidateRepository;
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
