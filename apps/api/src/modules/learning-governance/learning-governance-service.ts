import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type {
  LearningCandidateRepository,
} from "../learning/learning-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import {
  requireApprovedLearningCandidate,
} from "../shared/learning-candidate-guard.ts";
import {
  InMemoryLearningGovernanceRepository,
} from "./in-memory-learning-governance-repository.ts";
import type {
  LearningGovernanceRepository,
} from "./learning-governance-repository.ts";
import type {
  LearningWritebackRecord,
  LearningWritebackTarget,
} from "./learning-governance-record.ts";
import type {
  CreateKnowledgeDraftFromLearningCandidateInput,
  KnowledgeService,
} from "../knowledge/knowledge-service.ts";
import type {
  CreateModuleTemplateDraftFromLearningCandidateInput,
  TemplateGovernanceService,
} from "../templates/template-governance-service.ts";
import type {
  CreatePromptTemplateFromLearningCandidateInput,
  CreateSkillPackageFromLearningCandidateInput,
  PromptSkillRegistryService,
} from "../prompt-skill-registry/prompt-skill-service.ts";

export interface CreateLearningWritebackInput {
  learningCandidateId: string;
  targetType: LearningWritebackTarget;
  createdBy: string;
}

interface ApplyLearningWritebackBaseInput {
  writebackId: string;
  targetType: LearningWritebackTarget;
  appliedBy: string;
}

export interface ApplyKnowledgeWritebackInput
  extends ApplyLearningWritebackBaseInput,
    Omit<
      CreateKnowledgeDraftFromLearningCandidateInput,
      "sourceLearningCandidateId"
    > {
  targetType: "knowledge_item";
}

export interface ApplyModuleTemplateWritebackInput
  extends ApplyLearningWritebackBaseInput,
    Omit<
      CreateModuleTemplateDraftFromLearningCandidateInput,
      "sourceLearningCandidateId"
    > {
  targetType: "module_template";
}

export interface ApplyPromptTemplateWritebackInput
  extends ApplyLearningWritebackBaseInput,
    Omit<
      CreatePromptTemplateFromLearningCandidateInput,
      "sourceLearningCandidateId"
    > {
  targetType: "prompt_template";
}

export interface ApplySkillPackageWritebackInput
  extends ApplyLearningWritebackBaseInput,
    Omit<
      CreateSkillPackageFromLearningCandidateInput,
      "sourceLearningCandidateId"
    > {
  targetType: "skill_package";
}

export type ApplyLearningWritebackInput =
  | ApplyKnowledgeWritebackInput
  | ApplyModuleTemplateWritebackInput
  | ApplyPromptTemplateWritebackInput
  | ApplySkillPackageWritebackInput;

interface LearningGovernanceWriteContext {
  repository: LearningGovernanceRepository;
}

export interface LearningGovernanceServiceOptions {
  repository: LearningGovernanceRepository;
  learningCandidateRepository: LearningCandidateRepository;
  knowledgeService: KnowledgeService;
  templateService: TemplateGovernanceService;
  promptSkillRegistryService: PromptSkillRegistryService;
  permissionGuard?: PermissionGuard;
  transactionManager?: WriteTransactionManager<LearningGovernanceWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export class LearningWritebackNotFoundError extends Error {
  constructor(writebackId: string) {
    super(`Learning writeback ${writebackId} was not found.`);
    this.name = "LearningWritebackNotFoundError";
  }
}

export class LearningGovernanceConflictError extends Error {
  constructor(candidateId: string, targetType: LearningWritebackTarget) {
    super(
      `Learning candidate ${candidateId} already has an active writeback for ${targetType}.`,
    );
    this.name = "LearningGovernanceConflictError";
  }
}

export class LearningWritebackTargetMismatchError extends Error {
  constructor(writebackId: string, expected: string, actual: string) {
    super(
      `Learning writeback ${writebackId} expects target ${expected}, received ${actual}.`,
    );
    this.name = "LearningWritebackTargetMismatchError";
  }
}

export class LearningWritebackStatusTransitionError extends Error {
  constructor(writebackId: string, fromStatus: string, toStatus: string) {
    super(
      `Learning writeback ${writebackId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "LearningWritebackStatusTransitionError";
  }
}

export class LearningGovernanceService {
  private readonly repository: LearningGovernanceRepository;
  private readonly learningCandidateRepository: LearningCandidateRepository;
  private readonly knowledgeService: KnowledgeService;
  private readonly templateService: TemplateGovernanceService;
  private readonly promptSkillRegistryService: PromptSkillRegistryService;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager<LearningGovernanceWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: LearningGovernanceServiceOptions) {
    this.repository = options.repository;
    this.learningCandidateRepository = options.learningCandidateRepository;
    this.knowledgeService = options.knowledgeService;
    this.templateService = options.templateService;
    this.promptSkillRegistryService = options.promptSkillRegistryService;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.transactionManager =
      options.transactionManager ??
      createLearningGovernanceTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createWriteback(
    actorRole: RoleKey,
    input: CreateLearningWritebackInput,
  ): Promise<LearningWritebackRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    await requireApprovedLearningCandidate(
      this.learningCandidateRepository,
      input.learningCandidateId,
    );

    const existing = await this.repository.listByCandidateId(input.learningCandidateId);
    if (
      existing.some(
        (record) =>
          record.target_type === input.targetType && record.status !== "archived",
      )
    ) {
      throw new LearningGovernanceConflictError(
        input.learningCandidateId,
        input.targetType,
      );
    }

    const record: LearningWritebackRecord = {
      id: this.createId(),
      learning_candidate_id: input.learningCandidateId,
      target_type: input.targetType,
      status: "draft",
      created_by: input.createdBy,
      created_at: this.now().toISOString(),
    };

    await this.repository.save(record);
    return record;
  }

  async applyWriteback(
    actorRole: RoleKey,
    input: ApplyLearningWritebackInput,
  ): Promise<LearningWritebackRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const writeback = await repository.findById(input.writebackId);
      if (!writeback) {
        throw new LearningWritebackNotFoundError(input.writebackId);
      }

      if (writeback.target_type !== input.targetType) {
        throw new LearningWritebackTargetMismatchError(
          input.writebackId,
          writeback.target_type,
          input.targetType,
        );
      }

      if (writeback.status !== "draft") {
        throw new LearningWritebackStatusTransitionError(
          input.writebackId,
          writeback.status,
          "applied",
        );
      }

      // Learning writebacks are only allowed to create governed draft assets.
      // Publication remains on the existing registry-specific approval path.
      const createdDraftAssetId = await this.createDraftAssetFromWriteback(
        actorRole,
        writeback,
        input,
      );

      const applied: LearningWritebackRecord = {
        ...writeback,
        status: "applied",
        created_draft_asset_id: createdDraftAssetId,
        applied_by: input.appliedBy,
        applied_at: this.now().toISOString(),
      };
      await repository.save(applied);
      return applied;
    });
  }

  listWritebacksByCandidate(
    learningCandidateId: string,
  ): Promise<LearningWritebackRecord[]> {
    return this.repository.listByCandidateId(learningCandidateId);
  }

  private async createDraftAssetFromWriteback(
    actorRole: RoleKey,
    writeback: LearningWritebackRecord,
    input: ApplyLearningWritebackInput,
  ): Promise<string> {
    switch (input.targetType) {
      case "knowledge_item": {
        const created = await this.knowledgeService.createDraftFromLearningCandidate(
          actorRole,
          {
            sourceLearningCandidateId: writeback.learning_candidate_id,
            title: input.title,
            canonicalText: input.canonicalText,
            summary: input.summary,
            knowledgeKind: input.knowledgeKind,
            moduleScope: input.moduleScope,
            manuscriptTypes: input.manuscriptTypes,
            sections: input.sections,
            riskTags: input.riskTags,
            disciplineTags: input.disciplineTags,
            evidenceLevel: input.evidenceLevel,
            sourceType: input.sourceType,
            sourceLink: input.sourceLink,
            aliases: input.aliases,
            templateBindings: input.templateBindings,
          },
        );
        return created.id;
      }
      case "module_template": {
        const created =
          await this.templateService.createModuleTemplateDraftFromLearningCandidate(
            actorRole,
            {
              sourceLearningCandidateId: writeback.learning_candidate_id,
              templateFamilyId: input.templateFamilyId,
              module: input.module,
              manuscriptType: input.manuscriptType,
              prompt: input.prompt,
              checklist: input.checklist,
              sectionRequirements: input.sectionRequirements,
            },
          );
        return created.id;
      }
      case "prompt_template": {
        const created =
          await this.promptSkillRegistryService.createPromptTemplateFromLearningCandidate(
            actorRole,
            {
              sourceLearningCandidateId: writeback.learning_candidate_id,
              name: input.name,
              version: input.version,
              module: input.module,
              manuscriptTypes: input.manuscriptTypes,
              rollbackTargetVersion: input.rollbackTargetVersion,
            },
          );
        return created.id;
      }
      case "skill_package": {
        const created =
          await this.promptSkillRegistryService.createSkillPackageFromLearningCandidate(
            actorRole,
            {
              sourceLearningCandidateId: writeback.learning_candidate_id,
              name: input.name,
              version: input.version,
              appliesToModules: input.appliesToModules,
              dependencyTools: input.dependencyTools,
            },
          );
        return created.id;
      }
    }
  }
}

function createLearningGovernanceTransactionManager(
  context: LearningGovernanceWriteContext,
): WriteTransactionManager<LearningGovernanceWriteContext> {
  if (context.repository instanceof InMemoryLearningGovernanceRepository) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository],
    });
  }

  return createDirectWriteTransactionManager(context);
}
