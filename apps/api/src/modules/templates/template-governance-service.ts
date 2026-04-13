import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { HarnessDatasetRepository } from "../harness-datasets/harness-dataset-repository.ts";
import type { KnowledgeRetrievalQualityRunRecord } from "../knowledge-retrieval/knowledge-retrieval-record.ts";
import type { KnowledgeRetrievalRepository } from "../knowledge-retrieval/knowledge-retrieval-repository.ts";
import type { KnowledgeRetrievalService } from "../knowledge-retrieval/knowledge-retrieval-service.ts";
import type { LearningCandidateRepository } from "../learning/learning-repository.ts";
import type { ExtractionTaskRepository } from "../editorial-rules/extraction-task-repository.ts";
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
  GovernedContentModuleRepository,
  ModuleTemplateRepository,
  TemplateCompositionRepository,
  TemplateFamilyRepository,
} from "./template-repository.ts";
import type {
  GovernedContentModuleClass,
  GovernedContentModuleEvidenceLevel,
  GovernedContentModuleRecord,
  GovernedContentModuleRiskLevel,
  JournalTemplateProfileRecord,
  ModuleTemplateRecord,
  TemplateCompositionRecord,
  TemplateFamilyRecord,
  TemplateModule,
} from "./template-record.ts";
import type { RuleEvidenceExample } from "@medical/contracts";

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

export interface CreateContentModuleDraftInput {
  moduleClass: GovernedContentModuleClass;
  name: string;
  category: string;
  manuscriptTypeScope: TemplateFamilyRecord["manuscript_type"][];
  executionModuleScope: TemplateModule[];
  applicableSections?: string[];
  summary: string;
  guidance?: string[];
  examples?: RuleEvidenceExample[];
  evidenceLevel?: GovernedContentModuleEvidenceLevel;
  riskLevel?: GovernedContentModuleRiskLevel;
  sourceTaskId?: string;
  sourceCandidateId?: string;
}

export interface UpdateContentModuleDraftInput {
  name?: string;
  category?: string;
  manuscriptTypeScope?: TemplateFamilyRecord["manuscript_type"][];
  executionModuleScope?: TemplateModule[];
  applicableSections?: string[];
  summary?: string;
  guidance?: string[];
  examples?: RuleEvidenceExample[];
  evidenceLevel?: GovernedContentModuleEvidenceLevel;
  riskLevel?: GovernedContentModuleRiskLevel;
  status?: GovernedContentModuleRecord["status"];
}

export interface CreateContentModuleDraftFromCandidateInput {
  taskId: string;
  candidateId: string;
  moduleClass: GovernedContentModuleClass;
}

export interface CreateTemplateCompositionDraftInput {
  name: string;
  manuscriptType: TemplateFamilyRecord["manuscript_type"];
  journalScope?: string;
  generalModuleIds?: string[];
  medicalModuleIds?: string[];
  executionModuleScope: TemplateModule[];
  notes?: string;
  sourceTaskId?: string;
  sourceCandidateIds?: string[];
}

export interface UpdateTemplateCompositionDraftInput {
  name?: string;
  journalScope?: string;
  generalModuleIds?: string[];
  medicalModuleIds?: string[];
  executionModuleScope?: TemplateModule[];
  notes?: string;
  status?: TemplateCompositionRecord["status"];
}

export interface CreateTemplateCompositionDraftFromCandidateInput {
  taskId: string;
  candidateId: string;
  name?: string;
}

export interface CreateModuleTemplateDraftFromLearningCandidateInput
  extends CreateModuleTemplateDraftInput {
  sourceLearningCandidateId: string;
}

export interface CreateJournalTemplateProfileInput {
  templateFamilyId: string;
  manuscriptType: TemplateFamilyRecord["manuscript_type"];
  journalKey: string;
  journalName: string;
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
  contentModuleRepository?: GovernedContentModuleRepository;
  templateCompositionRepository?: TemplateCompositionRepository;
  extractionTaskRepository?: Pick<
    ExtractionTaskRepository,
    "findTaskById" | "findCandidateById"
  >;
  learningCandidateRepository?: LearningCandidateRepository;
  harnessDatasetRepository?: HarnessDatasetRepository;
  knowledgeRetrievalRepository?: Pick<
    KnowledgeRetrievalRepository,
    "findLatestRetrievalQualityRunByTemplateFamilyId"
  >;
  knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalQualityRun"
  >;
  transactionManager?: WriteTransactionManager<TemplateWriteContext>;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
  now?: () => Date;
}

class TemplateGovernanceRepositoryConfigurationError extends Error {
  constructor(repositoryRole: string) {
    super(
      `Template governance requires a ${repositoryRole} when the template family repository does not provide that capability.`,
    );
    this.name = "TemplateGovernanceRepositoryConfigurationError";
  }
}

interface TemplateWriteContext {
  templateFamilyRepository: TemplateFamilyRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  contentModuleRepository: GovernedContentModuleRepository;
  templateCompositionRepository: TemplateCompositionRepository;
}

function isGovernedContentModuleRepository(
  repository: TemplateFamilyRepository,
): repository is TemplateFamilyRepository & GovernedContentModuleRepository {
  const candidate = repository as Partial<GovernedContentModuleRepository>;
  return (
    typeof candidate.saveContentModule === "function" &&
    typeof candidate.findContentModuleById === "function" &&
    typeof candidate.listContentModules === "function"
  );
}

function isTemplateCompositionRepository(
  repository: TemplateFamilyRepository,
): repository is TemplateFamilyRepository & TemplateCompositionRepository {
  const candidate = repository as Partial<TemplateCompositionRepository>;
  return (
    typeof candidate.saveTemplateComposition === "function" &&
    typeof candidate.findTemplateCompositionById === "function" &&
    typeof candidate.listTemplateCompositions === "function"
  );
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

export class GovernedContentModuleNotFoundError extends Error {
  constructor(contentModuleId: string) {
    super(`Governed content module ${contentModuleId} was not found.`);
    this.name = "GovernedContentModuleNotFoundError";
  }
}

export class TemplateCompositionNotFoundError extends Error {
  constructor(templateCompositionId: string) {
    super(`Template composition ${templateCompositionId} was not found.`);
    this.name = "TemplateCompositionNotFoundError";
  }
}

export class ExtractionCandidateIntakeStateError extends Error {
  constructor(candidateId: string, status: string) {
    super(
      `Extraction candidate ${candidateId} is ${status} and cannot be intaken before confirmation.`,
    );
    this.name = "ExtractionCandidateIntakeStateError";
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

export class JournalTemplateProfileNotFoundError extends Error {
  constructor(journalTemplateProfileId: string) {
    super(`Journal template profile ${journalTemplateProfileId} was not found.`);
    this.name = "JournalTemplateProfileNotFoundError";
  }
}

export class JournalTemplateProfileKeyConflictError extends Error {
  constructor(templateFamilyId: string, journalKey: string) {
    super(
      `Template family ${templateFamilyId} already contains a journal template profile with key ${journalKey}.`,
    );
    this.name = "JournalTemplateProfileKeyConflictError";
  }
}

export class JournalTemplateProfileStatusTransitionError extends Error {
  constructor(
    journalTemplateProfileId: string,
    fromStatus: string,
    toStatus: string,
  ) {
    super(
      `Journal template profile ${journalTemplateProfileId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "JournalTemplateProfileStatusTransitionError";
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

export class TemplateRetrievalQualityRunNotFoundError extends Error {
  constructor(templateFamilyId: string) {
    super(
      `Template family ${templateFamilyId} does not have a retrieval-quality run yet.`,
    );
    this.name = "TemplateRetrievalQualityRunNotFoundError";
  }
}

export class TemplateGovernanceService {
  private readonly templateFamilyRepository: TemplateFamilyRepository;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly contentModuleRepository: GovernedContentModuleRepository;
  private readonly templateCompositionRepository: TemplateCompositionRepository;
  private readonly extractionTaskRepository?: Pick<
    ExtractionTaskRepository,
    "findTaskById" | "findCandidateById"
  >;
  private readonly learningCandidateRepository?: LearningCandidateRepository;
  private readonly harnessDatasetRepository?: HarnessDatasetRepository;
  private readonly knowledgeRetrievalRepository?: Pick<
    KnowledgeRetrievalRepository,
    "findLatestRetrievalQualityRunByTemplateFamilyId"
  >;
  private readonly knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalQualityRun"
  >;
  private readonly transactionManager: WriteTransactionManager<TemplateWriteContext>;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: TemplateGovernanceServiceOptions) {
    this.templateFamilyRepository = options.templateFamilyRepository;
    this.moduleTemplateRepository = options.moduleTemplateRepository;
    this.contentModuleRepository = options.contentModuleRepository
      ? options.contentModuleRepository
      : isGovernedContentModuleRepository(options.templateFamilyRepository)
        ? options.templateFamilyRepository
        : (() => {
            throw new TemplateGovernanceRepositoryConfigurationError(
              "content module repository",
            );
          })();
    this.templateCompositionRepository = options.templateCompositionRepository
      ? options.templateCompositionRepository
      : isTemplateCompositionRepository(options.templateFamilyRepository)
        ? options.templateFamilyRepository
        : (() => {
            throw new TemplateGovernanceRepositoryConfigurationError(
              "template composition repository",
            );
          })();
    this.extractionTaskRepository = options.extractionTaskRepository;
    this.learningCandidateRepository = options.learningCandidateRepository;
    this.harnessDatasetRepository = options.harnessDatasetRepository;
    this.knowledgeRetrievalRepository = options.knowledgeRetrievalRepository;
    this.knowledgeRetrievalService = options.knowledgeRetrievalService;
    this.transactionManager =
      options.transactionManager ??
      createTemplateWriteTransactionManager({
        templateFamilyRepository: this.templateFamilyRepository,
        moduleTemplateRepository: this.moduleTemplateRepository,
        contentModuleRepository: this.contentModuleRepository,
        templateCompositionRepository: this.templateCompositionRepository,
      });
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
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

  async createJournalTemplateProfile(
    input: CreateJournalTemplateProfileInput,
  ): Promise<JournalTemplateProfileRecord> {
    return this.transactionManager.withTransaction(
      async ({ templateFamilyRepository }) => {
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

        const existingTemplate =
          await templateFamilyRepository.findJournalTemplateProfileByTemplateFamilyIdAndJournalKey(
            input.templateFamilyId,
            input.journalKey,
          );
        if (existingTemplate) {
          throw new JournalTemplateProfileKeyConflictError(
            input.templateFamilyId,
            input.journalKey,
          );
        }

        const record: JournalTemplateProfileRecord = {
          id: this.createId(),
          template_family_id: input.templateFamilyId,
          journal_key: input.journalKey,
          journal_name: input.journalName,
          status: "draft",
        };

        await templateFamilyRepository.saveJournalTemplateProfile(record);
        return record;
      },
    );
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

  async createContentModuleDraft(
    input: CreateContentModuleDraftInput,
  ): Promise<GovernedContentModuleRecord> {
    const timestamp = this.now().toISOString();
    const record: GovernedContentModuleRecord = {
      id: this.createId(),
      module_class: input.moduleClass,
      name: input.name,
      category: input.category,
      manuscript_type_scope: [...input.manuscriptTypeScope],
      execution_module_scope: [...input.executionModuleScope],
      ...(input.applicableSections
        ? { applicable_sections: [...input.applicableSections] }
        : {}),
      summary: input.summary,
      ...(input.guidance ? { guidance: [...input.guidance] } : {}),
      ...(input.examples
        ? { examples: input.examples.map((example) => ({ ...example })) }
        : {}),
      ...(input.evidenceLevel ? { evidence_level: input.evidenceLevel } : {}),
      ...(input.riskLevel ? { risk_level: input.riskLevel } : {}),
      ...(input.sourceTaskId ? { source_task_id: input.sourceTaskId } : {}),
      ...(input.sourceCandidateId
        ? { source_candidate_id: input.sourceCandidateId }
        : {}),
      status: "draft",
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.contentModuleRepository.saveContentModule(record);
    return record;
  }

  async updateContentModuleDraft(
    contentModuleId: string,
    input: UpdateContentModuleDraftInput,
  ): Promise<GovernedContentModuleRecord> {
    return this.transactionManager.withTransaction(
      async ({ contentModuleRepository }) => {
        const record = await contentModuleRepository.findContentModuleById(
          contentModuleId,
        );
        if (!record) {
          throw new GovernedContentModuleNotFoundError(contentModuleId);
        }

        const updated: GovernedContentModuleRecord = {
          ...record,
          name: input.name ?? record.name,
          category: input.category ?? record.category,
          manuscript_type_scope:
            input.manuscriptTypeScope ?? record.manuscript_type_scope,
          execution_module_scope:
            input.executionModuleScope ?? record.execution_module_scope,
          applicable_sections:
            input.applicableSections ?? record.applicable_sections,
          summary: input.summary ?? record.summary,
          guidance: input.guidance ?? record.guidance,
          examples: input.examples ?? record.examples,
          evidence_level: input.evidenceLevel ?? record.evidence_level,
          risk_level: input.riskLevel ?? record.risk_level,
          status: input.status ?? record.status,
          updated_at: this.now().toISOString(),
        };

        await contentModuleRepository.saveContentModule(updated);
        return updated;
      },
    );
  }

  async createContentModuleDraftFromCandidate(
    input: CreateContentModuleDraftFromCandidateInput,
  ): Promise<GovernedContentModuleRecord> {
    const resolvedCandidate = await this.requireConfirmedExtractionCandidate(
      input.taskId,
      input.candidateId,
    );

    return this.createContentModuleDraft({
      moduleClass: input.moduleClass,
      name: resolvedCandidate.candidate.title,
      category: resolvedCandidate.candidate.package_kind,
      manuscriptTypeScope: [resolvedCandidate.task.manuscript_type],
      executionModuleScope:
        resolvedCandidate.candidate.candidate_payload.cards.applicability.modules,
      applicableSections:
        resolvedCandidate.candidate.candidate_payload.cards.applicability.sections,
      summary: resolvedCandidate.candidate.semantic_draft_payload.semantic_summary,
      guidance: resolvedCandidate.candidate.semantic_draft_payload.normalization_recipe,
      examples:
        resolvedCandidate.candidate.semantic_draft_payload.evidence_examples,
      ...(input.moduleClass === "medical_specialized"
        ? {
            evidenceLevel: "expert_opinion" as GovernedContentModuleEvidenceLevel,
            riskLevel: "high" as GovernedContentModuleRiskLevel,
          }
        : {}),
      sourceTaskId: resolvedCandidate.task.id,
      sourceCandidateId: resolvedCandidate.candidate.id,
    });
  }

  async listContentModules(input?: {
    moduleClass?: GovernedContentModuleClass;
  }): Promise<Array<GovernedContentModuleRecord & { template_usage_count: number }>> {
    const [contentModules, templateCompositions] = await Promise.all([
      this.contentModuleRepository.listContentModules(input),
      this.templateCompositionRepository.listTemplateCompositions(),
    ]);

    return contentModules.map((record) => ({
      ...record,
      template_usage_count: countTemplateUsage(templateCompositions, record),
    }));
  }

  async createTemplateCompositionDraft(
    input: CreateTemplateCompositionDraftInput,
  ): Promise<TemplateCompositionRecord> {
    await this.assertReferencedContentModulesExist(input.generalModuleIds ?? []);
    await this.assertReferencedContentModulesExist(input.medicalModuleIds ?? []);

    const timestamp = this.now().toISOString();
    const record: TemplateCompositionRecord = {
      id: this.createId(),
      name: input.name,
      manuscript_type: input.manuscriptType,
      ...(input.journalScope ? { journal_scope: input.journalScope } : {}),
      general_module_ids: [...(input.generalModuleIds ?? [])],
      medical_module_ids: [...(input.medicalModuleIds ?? [])],
      execution_module_scope: [...input.executionModuleScope],
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.sourceTaskId ? { source_task_id: input.sourceTaskId } : {}),
      ...(input.sourceCandidateIds
        ? { source_candidate_ids: [...input.sourceCandidateIds] }
        : {}),
      version_no: 1,
      status: "draft",
      created_at: timestamp,
      updated_at: timestamp,
    };

    await this.templateCompositionRepository.saveTemplateComposition(record);
    return record;
  }

  async updateTemplateCompositionDraft(
    templateCompositionId: string,
    input: UpdateTemplateCompositionDraftInput,
  ): Promise<TemplateCompositionRecord> {
    return this.transactionManager.withTransaction(
      async ({ templateCompositionRepository }) => {
        const record =
          await templateCompositionRepository.findTemplateCompositionById(
            templateCompositionId,
          );
        if (!record) {
          throw new TemplateCompositionNotFoundError(templateCompositionId);
        }

        await this.assertReferencedContentModulesExist(
          input.generalModuleIds ?? record.general_module_ids,
        );
        await this.assertReferencedContentModulesExist(
          input.medicalModuleIds ?? record.medical_module_ids,
        );

        const updated: TemplateCompositionRecord = {
          ...record,
          name: input.name ?? record.name,
          general_module_ids:
            input.generalModuleIds ?? record.general_module_ids,
          medical_module_ids:
            input.medicalModuleIds ?? record.medical_module_ids,
          execution_module_scope:
            input.executionModuleScope ?? record.execution_module_scope,
          ...(input.journalScope !== undefined
            ? { journal_scope: input.journalScope }
            : record.journal_scope
              ? { journal_scope: record.journal_scope }
              : {}),
          ...(input.notes !== undefined
            ? { notes: input.notes }
            : record.notes
              ? { notes: record.notes }
              : {}),
          status: input.status ?? record.status,
          updated_at: this.now().toISOString(),
        };

        await templateCompositionRepository.saveTemplateComposition(updated);
        return updated;
      },
    );
  }

  async createTemplateCompositionDraftFromCandidate(
    input: CreateTemplateCompositionDraftFromCandidateInput,
  ): Promise<TemplateCompositionRecord> {
    const resolvedCandidate = await this.requireConfirmedExtractionCandidate(
      input.taskId,
      input.candidateId,
    );

    return this.createTemplateCompositionDraft({
      name: input.name ?? resolvedCandidate.candidate.title,
      manuscriptType: resolvedCandidate.task.manuscript_type,
      journalScope: resolvedCandidate.task.journal_key,
      executionModuleScope:
        resolvedCandidate.candidate.candidate_payload.cards.applicability.modules,
      notes: resolvedCandidate.candidate.semantic_draft_payload.semantic_summary,
      sourceTaskId: resolvedCandidate.task.id,
      sourceCandidateIds: [resolvedCandidate.candidate.id],
    });
  }

  listTemplateCompositions(): Promise<TemplateCompositionRecord[]> {
    return this.templateCompositionRepository.listTemplateCompositions();
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

  async activateJournalTemplateProfile(
    journalTemplateProfileId: string,
    actorRole: RoleKey,
  ): Promise<JournalTemplateProfileRecord> {
    this.permissionGuard.assert(actorRole, "templates.publish");

    return this.transactionManager.withTransaction(
      async ({ templateFamilyRepository }) => {
        const template =
          await templateFamilyRepository.findJournalTemplateProfileById(
            journalTemplateProfileId,
          );

        if (!template) {
          throw new JournalTemplateProfileNotFoundError(journalTemplateProfileId);
        }

        if (template.status === "active") {
          return template;
        }

        if (template.status !== "draft") {
          throw new JournalTemplateProfileStatusTransitionError(
            journalTemplateProfileId,
            template.status,
            "active",
          );
        }

        const updatedTemplate: JournalTemplateProfileRecord = {
          ...template,
          status: "active",
        };

        await templateFamilyRepository.saveJournalTemplateProfile(updatedTemplate);
        return updatedTemplate;
      },
    );
  }

  async archiveJournalTemplateProfile(
    journalTemplateProfileId: string,
    actorRole: RoleKey,
  ): Promise<JournalTemplateProfileRecord> {
    this.permissionGuard.assert(actorRole, "templates.publish");

    return this.transactionManager.withTransaction(
      async ({ templateFamilyRepository }) => {
        const template =
          await templateFamilyRepository.findJournalTemplateProfileById(
            journalTemplateProfileId,
          );

        if (!template) {
          throw new JournalTemplateProfileNotFoundError(journalTemplateProfileId);
        }

        if (template.status === "archived") {
          return template;
        }

        if (template.status !== "active") {
          throw new JournalTemplateProfileStatusTransitionError(
            journalTemplateProfileId,
            template.status,
            "archived",
          );
        }

        const updatedTemplate: JournalTemplateProfileRecord = {
          ...template,
          status: "archived",
        };

        await templateFamilyRepository.saveJournalTemplateProfile(updatedTemplate);
        return updatedTemplate;
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

  async listJournalTemplateProfilesByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<JournalTemplateProfileRecord[]> {
    const templateFamily = await this.templateFamilyRepository.findById(
      templateFamilyId,
    );
    if (!templateFamily) {
      throw new TemplateFamilyNotFoundError(templateFamilyId);
    }

    return this.templateFamilyRepository.listJournalTemplateProfilesByTemplateFamilyId(
      templateFamilyId,
    );
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

  async getLatestRetrievalQualityRun(
    templateFamilyId: string,
    actorRole: RoleKey,
  ): Promise<KnowledgeRetrievalQualityRunRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    if (!this.knowledgeRetrievalRepository) {
      throw new TemplateRetrievalQualityDependencyError();
    }

    const templateFamily = await this.templateFamilyRepository.findById(templateFamilyId);
    if (!templateFamily) {
      throw new TemplateFamilyNotFoundError(templateFamilyId);
    }

    const latestRun =
      await this.knowledgeRetrievalRepository.findLatestRetrievalQualityRunByTemplateFamilyId(
        templateFamilyId,
      );
    if (!latestRun) {
      throw new TemplateRetrievalQualityRunNotFoundError(templateFamilyId);
    }

    return latestRun;
  }

  private async requireConfirmedExtractionCandidate(
    taskId: string,
    candidateId: string,
  ): Promise<{
    task: NonNullable<Awaited<ReturnType<ExtractionTaskRepository["findTaskById"]>>>;
    candidate: NonNullable<
      Awaited<ReturnType<ExtractionTaskRepository["findCandidateById"]>>
    >;
  }> {
    if (!this.extractionTaskRepository) {
      throw new ExtractionCandidateIntakeStateError(
        candidateId,
        "missing_repository",
      );
    }

    const [task, candidate] = await Promise.all([
      this.extractionTaskRepository.findTaskById(taskId),
      this.extractionTaskRepository.findCandidateById(candidateId),
    ]);

    if (!task) {
      throw new ExtractionCandidateIntakeStateError(candidateId, "missing_task");
    }

    if (!candidate || candidate.task_id !== taskId) {
      throw new ExtractionCandidateIntakeStateError(candidateId, "missing");
    }

    if (candidate.confirmation_status !== "confirmed") {
      throw new ExtractionCandidateIntakeStateError(
        candidateId,
        candidate.confirmation_status,
      );
    }

    return {
      task,
      candidate,
    };
  }

  private async assertReferencedContentModulesExist(
    contentModuleIds: readonly string[],
  ): Promise<void> {
    for (const contentModuleId of contentModuleIds) {
      const contentModule =
        await this.contentModuleRepository.findContentModuleById(contentModuleId);
      if (!contentModule) {
        throw new GovernedContentModuleNotFoundError(contentModuleId);
      }
    }
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
    context.moduleTemplateRepository instanceof InMemoryModuleTemplateRepository &&
    context.contentModuleRepository instanceof InMemoryTemplateFamilyRepository &&
    context.templateCompositionRepository instanceof InMemoryTemplateFamilyRepository
  ) {
    return createScopedWriteTransactionManager({
      queueKey: context.moduleTemplateRepository,
      context,
      repositories: [context.templateFamilyRepository, context.moduleTemplateRepository],
    });
  }

  return createDirectWriteTransactionManager(context);
}

function countTemplateUsage(
  templateCompositions: readonly TemplateCompositionRecord[],
  record: Pick<GovernedContentModuleRecord, "id" | "module_class">,
): number {
  return templateCompositions.filter((templateComposition) =>
    record.module_class === "general"
      ? templateComposition.general_module_ids.includes(record.id)
      : templateComposition.medical_module_ids.includes(record.id),
  ).length;
}
