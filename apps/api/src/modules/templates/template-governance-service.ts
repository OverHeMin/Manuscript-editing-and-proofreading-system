import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { HarnessDatasetRepository } from "../harness-datasets/harness-dataset-repository.ts";
import type { KnowledgeRetrievalQualityRunRecord } from "../knowledge-retrieval/knowledge-retrieval-record.ts";
import type { KnowledgeRetrievalService } from "../knowledge-retrieval/knowledge-retrieval-service.ts";
import type { LearningCandidateRepository } from "../learning/learning-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import { requireApprovedLearningCandidate } from "../shared/learning-candidate-guard.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "./in-memory-template-family-repository.ts";
import type {
  ModuleTemplateRepository,
  TemplateFamilyRepository,
} from "./template-repository.ts";
import type {
  ModuleTemplateRecord,
  TemplateFamilyRecord,
  TemplateModule,
} from "./template-record.ts";

export interface CreateTemplateFamilyInput {
  manuscriptType: TemplateFamilyRecord["manuscript_type"];
  name: string;
}

export interface UpdateTemplateFamilyInput {
  name?: string;
  status?: TemplateFamilyRecord["status"];
}

export interface CreateModuleTemplateDraftInput {
  templateFamilyId: string;
  module: TemplateModule;
  manuscriptType: ModuleTemplateRecord["manuscript_type"];
  prompt: string;
  checklist?: string[];
  sectionRequirements?: string[];
  sourceLearningCandidateId?: string;
}

export interface UpdateModuleTemplateDraftInput {
  prompt?: string;
  checklist?: string[];
  sectionRequirements?: string[];
}

export interface CreateModuleTemplateDraftFromLearningCandidateInput
  extends CreateModuleTemplateDraftInput {
  sourceLearningCandidateId: string;
}

export interface CreateTemplateRetrievalQualityRunInput {
  module: TemplateModule;
  goldSetVersionId: string;
  retrievalSnapshotIds: string[];
  retrieverConfig: {
    strategy: "vector" | "hybrid" | "template_pack";
    topK: number;
    embeddingProvider?: string;
    embeddingModel?: string;
    filters?: Record<string, unknown>;
  };
  rerankerConfig?: {
    provider: string;
    model?: string;
    topK: number;
    metadata?: Record<string, unknown>;
  };
  metricSummary: {
    answerRelevancy: number;
    contextPrecision?: number;
    contextRecall?: number;
    rankingConsistency?: number;
  };
  createdBy: string;
}

export interface TemplateGovernanceServiceOptions {
  templateFamilyRepository: TemplateFamilyRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  learningCandidateRepository?: LearningCandidateRepository;
  harnessDatasetRepository?: HarnessDatasetRepository;
  knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalQualityRun"
  >;
  transactionManager?: WriteTransactionManager<TemplateWriteContext>;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
  now?: () => Date;
}

interface TemplateWriteContext {
  templateFamilyRepository: TemplateFamilyRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
}

export class TemplateFamilyNotFoundError extends Error {
  constructor(templateFamilyId: string) {
    super(`Template family ${templateFamilyId} was not found.`);
    this.name = "TemplateFamilyNotFoundError";
  }
}

export class ModuleTemplateNotFoundError extends Error {
  constructor(moduleTemplateId: string) {
    super(`Module template ${moduleTemplateId} was not found.`);
    this.name = "ModuleTemplateNotFoundError";
  }
}

export class ModuleTemplateStatusTransitionError extends Error {
  constructor(moduleTemplateId: string, fromStatus: string, toStatus: string) {
    super(
      `Module template ${moduleTemplateId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "ModuleTemplateStatusTransitionError";
  }
}

export class ModuleTemplateDraftNotEditableError extends Error {
  constructor(moduleTemplateId: string, status: string) {
    super(
      `Module template ${moduleTemplateId} is ${status} and can only be edited while in draft status.`,
    );
    this.name = "ModuleTemplateDraftNotEditableError";
  }
}

export class TemplateFamilyManuscriptTypeMismatchError extends Error {
  constructor(
    templateFamilyId: string,
    familyType: string,
    templateType: string,
  ) {
    super(
      `Template family ${templateFamilyId} expects manuscript type ${familyType}, received ${templateType}.`,
    );
    this.name = "TemplateFamilyManuscriptTypeMismatchError";
  }
}

export class TemplateFamilyActiveConflictError extends Error {
  constructor(
    manuscriptType: string,
    templateFamilyId: string,
    activeTemplateFamilyId?: string,
  ) {
    super(
      activeTemplateFamilyId
        ? `Template family ${templateFamilyId} cannot be activated for manuscript type ${manuscriptType} while template family ${activeTemplateFamilyId} is already active.`
        : `Template family ${templateFamilyId} cannot be activated for manuscript type ${manuscriptType} because another template family is already active.`,
    );
    this.name = "TemplateFamilyActiveConflictError";
  }
}

export class TemplateRetrievalQualityDependencyError extends Error {
  constructor() {
    super("Retrieval quality dependencies are not configured.");
    this.name = "TemplateRetrievalQualityDependencyError";
  }
}

export class TemplateRetrievalGoldSetVersionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRetrievalGoldSetVersionValidationError";
  }
}

export class TemplateGovernanceService {
  private readonly templateFamilyRepository: TemplateFamilyRepository;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly learningCandidateRepository?: LearningCandidateRepository;
  private readonly harnessDatasetRepository?: HarnessDatasetRepository;
  private readonly knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalQualityRun"
  >;
  private readonly transactionManager: WriteTransactionManager<TemplateWriteContext>;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: TemplateGovernanceServiceOptions) {
    this.templateFamilyRepository = options.templateFamilyRepository;
    this.moduleTemplateRepository = options.moduleTemplateRepository;
    this.learningCandidateRepository = options.learningCandidateRepository;
    this.harnessDatasetRepository = options.harnessDatasetRepository;
    this.knowledgeRetrievalService = options.knowledgeRetrievalService;
    this.transactionManager =
      options.transactionManager ??
      createTemplateWriteTransactionManager({
        templateFamilyRepository: this.templateFamilyRepository,
        moduleTemplateRepository: this.moduleTemplateRepository,
      });
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createTemplateFamily(
    input: CreateTemplateFamilyInput,
  ): Promise<TemplateFamilyRecord> {
    const record: TemplateFamilyRecord = {
      id: this.createId(),
      manuscript_type: input.manuscriptType,
      name: input.name,
      status: "draft",
    };

    await this.templateFamilyRepository.save(record);
    return record;
  }

  async createModuleTemplateDraft(
    input: CreateModuleTemplateDraftInput,
  ): Promise<ModuleTemplateRecord> {
    return this.transactionManager.withTransaction(
      async ({ templateFamilyRepository, moduleTemplateRepository }) => {
        const templateFamily = await templateFamilyRepository.findById(
          input.templateFamilyId,
        );

        if (!templateFamily) {
          throw new TemplateFamilyNotFoundError(input.templateFamilyId);
        }

        if (templateFamily.manuscript_type !== input.manuscriptType) {
          throw new TemplateFamilyManuscriptTypeMismatchError(
            input.templateFamilyId,
            templateFamily.manuscript_type,
            input.manuscriptType,
          );
        }

        const record: ModuleTemplateRecord = {
          id: this.createId(),
          template_family_id: input.templateFamilyId,
          module: input.module,
          manuscript_type: input.manuscriptType,
          version_no: await moduleTemplateRepository.reserveNextVersionNumber(
            input.templateFamilyId,
            input.module,
          ),
          status: "draft",
          prompt: input.prompt,
          checklist: input.checklist,
          section_requirements: input.sectionRequirements,
          ...(input.sourceLearningCandidateId
            ? {
                source_learning_candidate_id: input.sourceLearningCandidateId,
              }
            : {}),
        };

        await moduleTemplateRepository.save(record);
        return record;
      },
    );
  }

  async createModuleTemplateDraftFromLearningCandidate(
    actorRole: RoleKey,
    input: CreateModuleTemplateDraftFromLearningCandidateInput,
  ): Promise<ModuleTemplateRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    await requireApprovedLearningCandidate(
      this.learningCandidateRepository,
      input.sourceLearningCandidateId,
    );
    return this.createModuleTemplateDraft(input);
  }

  async publishModuleTemplate(
    moduleTemplateId: string,
    actorRole: RoleKey,
  ): Promise<ModuleTemplateRecord> {
    this.permissionGuard.assert(actorRole, "templates.publish");

    return this.transactionManager.withTransaction(
      async ({ moduleTemplateRepository }) => {
        const template = await moduleTemplateRepository.findById(moduleTemplateId);

        if (!template) {
          throw new ModuleTemplateNotFoundError(moduleTemplateId);
        }

        if (template.status !== "draft") {
          throw new ModuleTemplateStatusTransitionError(
            moduleTemplateId,
            template.status,
            "published",
          );
        }

        const existingTemplates =
          await moduleTemplateRepository.listByTemplateFamilyIdAndModule(
            template.template_family_id,
            template.module,
          );

        for (const existingTemplate of existingTemplates) {
          if (
            existingTemplate.id !== template.id &&
            existingTemplate.status === "published"
          ) {
            await moduleTemplateRepository.save({
              ...existingTemplate,
              status: "archived",
            });
          }
        }

        const publishedTemplate: ModuleTemplateRecord = {
          ...template,
          status: "published",
        };

        await moduleTemplateRepository.save(publishedTemplate);
        return publishedTemplate;
      },
    );
  }

  async updateModuleTemplateDraft(
    moduleTemplateId: string,
    input: UpdateModuleTemplateDraftInput,
  ): Promise<ModuleTemplateRecord> {
    return this.transactionManager.withTransaction(
      async ({ moduleTemplateRepository }) => {
        const template = await moduleTemplateRepository.findById(moduleTemplateId);

        if (!template) {
          throw new ModuleTemplateNotFoundError(moduleTemplateId);
        }

        if (template.status !== "draft") {
          throw new ModuleTemplateDraftNotEditableError(
            moduleTemplateId,
            template.status,
          );
        }

        const updatedTemplate: ModuleTemplateRecord = {
          ...template,
          prompt: input.prompt ?? template.prompt,
          checklist: input.checklist ?? template.checklist,
          section_requirements:
            input.sectionRequirements ?? template.section_requirements,
        };

        await moduleTemplateRepository.save(updatedTemplate);
        return updatedTemplate;
      },
    );
  }

  async updateTemplateFamily(
    templateFamilyId: string,
    input: UpdateTemplateFamilyInput,
  ): Promise<TemplateFamilyRecord> {
    return this.transactionManager.withTransaction(
      async ({ templateFamilyRepository }) => {
        const templateFamily = await templateFamilyRepository.findById(
          templateFamilyId,
        );

        if (!templateFamily) {
          throw new TemplateFamilyNotFoundError(templateFamilyId);
        }

        const nextStatus = input.status ?? templateFamily.status;
        if (nextStatus === "active" && templateFamily.status !== "active") {
          const activeFamily = (await templateFamilyRepository.list()).find(
            (family) =>
              family.id !== templateFamilyId &&
              family.manuscript_type === templateFamily.manuscript_type &&
              family.status === "active",
          );

          if (activeFamily) {
            throw new TemplateFamilyActiveConflictError(
              templateFamily.manuscript_type,
              templateFamilyId,
              activeFamily.id,
            );
          }
        }

        const updatedFamily: TemplateFamilyRecord = {
          ...templateFamily,
          name: input.name ?? templateFamily.name,
          status: nextStatus,
        };

        await templateFamilyRepository.save(updatedFamily);
        return updatedFamily;
      },
    );
  }

  async listModuleTemplatesByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<ModuleTemplateRecord[]> {
    const templateFamily = await this.templateFamilyRepository.findById(
      templateFamilyId,
    );
    if (!templateFamily) {
      throw new TemplateFamilyNotFoundError(templateFamilyId);
    }

    return this.moduleTemplateRepository.listByTemplateFamilyId(templateFamilyId);
  }

  async createRetrievalQualityRun(
    templateFamilyId: string,
    actorRole: RoleKey,
    input: CreateTemplateRetrievalQualityRunInput,
  ): Promise<KnowledgeRetrievalQualityRunRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    if (!this.harnessDatasetRepository || !this.knowledgeRetrievalService) {
      throw new TemplateRetrievalQualityDependencyError();
    }

    const templateFamily = await this.templateFamilyRepository.findById(templateFamilyId);
    if (!templateFamily) {
      throw new TemplateFamilyNotFoundError(templateFamilyId);
    }

    const goldSetVersion =
      await this.harnessDatasetRepository.findGoldSetVersionById(input.goldSetVersionId);
    if (!goldSetVersion) {
      throw new TemplateRetrievalGoldSetVersionValidationError(
        `Harness gold-set version ${input.goldSetVersionId} was not found.`,
      );
    }

    if (goldSetVersion.status !== "published") {
      throw new TemplateRetrievalGoldSetVersionValidationError(
        `Harness gold-set version ${input.goldSetVersionId} must be published before retrieval-quality runs can start.`,
      );
    }

    const goldSetFamily = await this.harnessDatasetRepository.findGoldSetFamilyById(
      goldSetVersion.family_id,
    );
    if (!goldSetFamily) {
      throw new TemplateRetrievalGoldSetVersionValidationError(
        `Harness gold-set family ${goldSetVersion.family_id} was not found.`,
      );
    }

    if (goldSetFamily.scope.module !== input.module) {
      throw new TemplateRetrievalGoldSetVersionValidationError(
        `Harness gold-set version ${input.goldSetVersionId} is scoped to module ${goldSetFamily.scope.module}, not ${input.module}.`,
      );
    }

    if (
      goldSetFamily.scope.template_family_id &&
      goldSetFamily.scope.template_family_id !== templateFamilyId
    ) {
      throw new TemplateRetrievalGoldSetVersionValidationError(
        `Harness gold-set version ${input.goldSetVersionId} is scoped to template family ${goldSetFamily.scope.template_family_id}, not ${templateFamilyId}.`,
      );
    }

    if (
      !goldSetFamily.scope.manuscript_types.includes(templateFamily.manuscript_type)
    ) {
      throw new TemplateRetrievalGoldSetVersionValidationError(
        `Harness gold-set version ${input.goldSetVersionId} does not cover manuscript type ${templateFamily.manuscript_type}.`,
      );
    }

    return this.knowledgeRetrievalService.recordRetrievalQualityRun({
      goldSetVersionId: input.goldSetVersionId,
      module: input.module,
      templateFamilyId,
      retrievalSnapshotIds: input.retrievalSnapshotIds,
      retrieverConfig: input.retrieverConfig,
      rerankerConfig: input.rerankerConfig,
      metricSummary: input.metricSummary,
      createdBy: input.createdBy,
    });
  }

  listTemplateFamilies(): Promise<TemplateFamilyRecord[]> {
    return this.templateFamilyRepository.list();
  }
}

function createTemplateWriteTransactionManager(
  context: TemplateWriteContext,
): WriteTransactionManager<TemplateWriteContext> {
  if (
    context.templateFamilyRepository instanceof InMemoryTemplateFamilyRepository &&
    context.moduleTemplateRepository instanceof InMemoryModuleTemplateRepository
  ) {
    return createScopedWriteTransactionManager({
      queueKey: context.moduleTemplateRepository,
      context,
      repositories: [
        context.templateFamilyRepository,
        context.moduleTemplateRepository,
      ],
    });
  }

  return createDirectWriteTransactionManager(context);
}
