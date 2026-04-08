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
import type { EditorialRuleService } from "../editorial-rules/editorial-rule-service.ts";
import type {
  EditorialRuleConfidencePolicy,
  EditorialRuleExecutionMode,
  EditorialRuleRecord,
  EditorialRuleSeverity,
  EditorialRuleType,
} from "../editorial-rules/editorial-rule-record.ts";

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

export interface ApplyEditorialRuleDraftWritebackInput
  extends ApplyLearningWritebackBaseInput {
  targetType: "editorial_rule_draft";
}

export type ApplyLearningWritebackInput =
  | ApplyKnowledgeWritebackInput
  | ApplyModuleTemplateWritebackInput
  | ApplyPromptTemplateWritebackInput
  | ApplySkillPackageWritebackInput
  | ApplyEditorialRuleDraftWritebackInput;

interface LearningGovernanceWriteContext {
  repository: LearningGovernanceRepository;
}

export interface LearningGovernanceServiceOptions {
  repository: LearningGovernanceRepository;
  learningCandidateRepository: LearningCandidateRepository;
  knowledgeService: KnowledgeService;
  templateService: TemplateGovernanceService;
  editorialRuleService: Pick<EditorialRuleService, "createRuleSet" | "createRule">;
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

export class LearningRuleDraftTemplateFamilyRequiredError extends Error {
  constructor(candidateId: string) {
    super(
      `Learning candidate ${candidateId} requires a suggested template family before creating an editorial rule draft.`,
    );
    this.name = "LearningRuleDraftTemplateFamilyRequiredError";
  }
}

export class LearningRuleDraftModuleUnsupportedError extends Error {
  constructor(candidateId: string, module: string) {
    super(
      `Learning candidate ${candidateId} cannot create an editorial rule draft for unsupported module ${module}.`,
    );
    this.name = "LearningRuleDraftModuleUnsupportedError";
  }
}

export class LearningGovernanceService {
  private readonly repository: LearningGovernanceRepository;
  private readonly learningCandidateRepository: LearningCandidateRepository;
  private readonly knowledgeService: KnowledgeService;
  private readonly templateService: TemplateGovernanceService;
  private readonly editorialRuleService: Pick<
    EditorialRuleService,
    "createRuleSet" | "createRule"
  >;
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
    this.editorialRuleService = options.editorialRuleService;
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
      case "editorial_rule_draft": {
        const candidate = await requireApprovedLearningCandidate(
          this.learningCandidateRepository,
          writeback.learning_candidate_id,
        );
        const templateFamilyId = candidate.suggested_template_family_id;
        if (!templateFamilyId) {
          throw new LearningRuleDraftTemplateFamilyRequiredError(candidate.id);
        }

        const payload = readEditorialRuleDraftPayload(candidate.candidate_payload);
        const ruleSet = await this.editorialRuleService.createRuleSet(actorRole, {
          templateFamilyId,
          journalTemplateId: candidate.suggested_journal_template_id,
          module: toEditorialRuleModule(candidate.id, candidate.module),
        });
        const created = await this.editorialRuleService.createRule(actorRole, {
          ruleSetId: ruleSet.id,
          orderNo: payload.order_no ?? 10,
          ruleObject: candidate.suggested_rule_object ?? "statement",
          ruleType: payload.rule_type ?? "format",
          executionMode: payload.execution_mode ?? "apply_and_inspect",
          scope: payload.scope ?? {},
          selector: payload.selector ?? {},
          trigger: payload.trigger ?? {
            kind: "manual_review_required",
          },
          action:
            payload.action ?? {
              kind: "emit_finding",
              message:
                candidate.proposal_text ??
                candidate.title ??
                "Review the candidate and complete the editorial rule draft.",
            },
          authoringPayload: payload.authoring_payload ?? {},
          explanationPayload: payload.explanation_payload,
          linkagePayload: {
            ...(payload.linkage_payload ?? {}),
            source_learning_candidate_id: candidate.id,
            ...(candidate.snapshot_asset_id
              ? { source_snapshot_asset_id: candidate.snapshot_asset_id }
              : {}),
          },
          projectionPayload: payload.projection_payload,
          confidencePolicy: payload.confidence_policy ?? "manual_only",
          severity: payload.severity ?? "warning",
          ...(payload.example_before
            ? { exampleBefore: payload.example_before }
            : {}),
          ...(payload.example_after
            ? { exampleAfter: payload.example_after }
            : {}),
          ...(payload.manual_review_reason_template
            ? {
                manualReviewReasonTemplate:
                  payload.manual_review_reason_template,
              }
            : {}),
        });
        return created.id;
      }
    }
  }
}

type EditorialRuleDraftPayload = Partial<{
  order_no: number;
  rule_type: EditorialRuleType;
  execution_mode: EditorialRuleExecutionMode;
  scope: EditorialRuleRecord["scope"];
  selector: EditorialRuleRecord["selector"];
  trigger: EditorialRuleRecord["trigger"];
  action: EditorialRuleRecord["action"];
  authoring_payload: EditorialRuleRecord["authoring_payload"];
  explanation_payload: EditorialRuleRecord["explanation_payload"];
  linkage_payload: EditorialRuleRecord["linkage_payload"];
  projection_payload: EditorialRuleRecord["projection_payload"];
  example_before: string;
  example_after: string;
  manual_review_reason_template: string;
  confidence_policy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
}>;

function readEditorialRuleDraftPayload(
  payload: Record<string, unknown> | undefined,
): EditorialRuleDraftPayload {
  return (payload ?? {}) as EditorialRuleDraftPayload;
}

function toEditorialRuleModule(
  candidateId: string,
  module: string,
): "screening" | "editing" | "proofreading" {
  if (
    module === "screening" ||
    module === "editing" ||
    module === "proofreading"
  ) {
    return module;
  }

  throw new LearningRuleDraftModuleUnsupportedError(candidateId, module);
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
