import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import { InMemoryEditorialRuleRepository } from "../editorial-rules/index.ts";
import type {
  EditorialRuleRecord,
  EditorialRuleRepository,
  EditorialRuleSetRecord,
} from "../editorial-rules/index.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import {
  InMemoryExecutionGovernanceRepository,
} from "./in-memory-execution-governance-repository.ts";
import type {
  ExecutionGovernanceRepository,
} from "./execution-governance-repository.ts";
import type {
  KnowledgeBindingMode,
  KnowledgeBindingRuleRecord,
  ModuleExecutionProfileRecord,
} from "./execution-governance-record.ts";

export interface CreateExecutionProfileInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  moduleTemplateId: string;
  ruleSetId?: string;
  promptTemplateId: string;
  skillPackageIds: string[];
  knowledgeBindingMode: KnowledgeBindingMode;
  notes?: string;
}

export interface CreateKnowledgeBindingRuleInput {
  knowledgeItemId: string;
  module: TemplateModule;
  manuscriptTypes: ManuscriptType[] | "any";
  templateFamilyIds?: string[];
  moduleTemplateIds?: string[];
  sections?: string[];
  riskTags?: string[];
  priority?: number;
  bindingPurpose: KnowledgeBindingRuleRecord["binding_purpose"];
}

export interface ResolveActiveExecutionProfileInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
}

interface ExecutionGovernanceWriteContext {
  repository: ExecutionGovernanceRepository;
}

export interface ExecutionGovernanceServiceOptions {
  repository: ExecutionGovernanceRepository;
  editorialRuleRepository?: EditorialRuleRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  knowledgeRepository: KnowledgeRepository;
  permissionGuard?: PermissionGuard;
  transactionManager?: WriteTransactionManager<ExecutionGovernanceWriteContext>;
  createId?: () => string;
}

export class ModuleExecutionProfileNotFoundError extends Error {
  constructor(profileId: string) {
    super(`Execution profile ${profileId} was not found.`);
    this.name = "ModuleExecutionProfileNotFoundError";
  }
}

export class KnowledgeBindingRuleNotFoundError extends Error {
  constructor(ruleId: string) {
    super(`Knowledge binding rule ${ruleId} was not found.`);
    this.name = "KnowledgeBindingRuleNotFoundError";
  }
}

export class ModuleExecutionProfileStatusTransitionError extends Error {
  constructor(profileId: string, fromStatus: string, toStatus: string) {
    super(
      `Execution profile ${profileId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "ModuleExecutionProfileStatusTransitionError";
  }
}

export class KnowledgeBindingRuleStatusTransitionError extends Error {
  constructor(ruleId: string, fromStatus: string, toStatus: string) {
    super(
      `Knowledge binding rule ${ruleId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "KnowledgeBindingRuleStatusTransitionError";
  }
}

export class ActiveExecutionProfileNotFoundError extends Error {
  constructor(module: string, manuscriptType: string, templateFamilyId: string) {
    super(
      `No active execution profile exists for ${module}/${manuscriptType}/${templateFamilyId}.`,
    );
    this.name = "ActiveExecutionProfileNotFoundError";
  }
}

export class ExecutionProfileModuleTemplateNotPublishedError extends Error {
  constructor(moduleTemplateId: string) {
    super(`Module template ${moduleTemplateId} is not published and cannot be bound.`);
    this.name = "ExecutionProfileModuleTemplateNotPublishedError";
  }
}

export class ExecutionProfilePromptTemplateNotPublishedError extends Error {
  constructor(promptTemplateId: string) {
    super(`Prompt template ${promptTemplateId} is not published and cannot be bound.`);
    this.name = "ExecutionProfilePromptTemplateNotPublishedError";
  }
}

export class ExecutionProfileSkillPackageNotPublishedError extends Error {
  constructor(skillPackageId: string) {
    super(`Skill package ${skillPackageId} is not published and cannot be bound.`);
    this.name = "ExecutionProfileSkillPackageNotPublishedError";
  }
}

export class ExecutionProfileRuleSetNotPublishedError extends Error {
  constructor(ruleSetId: string) {
    super(`Rule set ${ruleSetId} is not published and cannot be bound.`);
    this.name = "ExecutionProfileRuleSetNotPublishedError";
  }
}

export class ExecutionProfileKnowledgeItemNotApprovedError extends Error {
  constructor(knowledgeItemId: string) {
    super(`Knowledge item ${knowledgeItemId} is not approved and cannot be bound.`);
    this.name = "ExecutionProfileKnowledgeItemNotApprovedError";
  }
}

export class ExecutionProfileCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionProfileCompatibilityError";
  }
}

export class ExecutionGovernanceService {
  private readonly repository: ExecutionGovernanceRepository;
  private readonly editorialRuleRepository: EditorialRuleRepository;
  private readonly moduleTemplateRepository: ModuleTemplateRepository;
  private readonly promptSkillRegistryRepository: PromptSkillRegistryRepository;
  private readonly knowledgeRepository: KnowledgeRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly transactionManager: WriteTransactionManager<ExecutionGovernanceWriteContext>;
  private readonly createId: () => string;

  constructor(options: ExecutionGovernanceServiceOptions) {
    this.repository = options.repository;
    this.editorialRuleRepository =
      options.editorialRuleRepository ?? new InMemoryEditorialRuleRepository();
    this.moduleTemplateRepository = options.moduleTemplateRepository;
    this.promptSkillRegistryRepository = options.promptSkillRegistryRepository;
    this.knowledgeRepository = options.knowledgeRepository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.transactionManager =
      options.transactionManager ??
      createExecutionGovernanceTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createProfile(
    actorRole: RoleKey,
    input: CreateExecutionProfileInput,
  ): Promise<ModuleExecutionProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const version = await this.repository.reserveNextProfileVersion(
      input.module,
      input.manuscriptType,
      input.templateFamilyId,
    );

    const record: ModuleExecutionProfileRecord = {
      id: this.createId(),
      module: input.module,
      manuscript_type: input.manuscriptType,
      template_family_id: input.templateFamilyId,
      module_template_id: input.moduleTemplateId,
      rule_set_id: input.ruleSetId,
      prompt_template_id: input.promptTemplateId,
      skill_package_ids: [...new Set(input.skillPackageIds)],
      knowledge_binding_mode: input.knowledgeBindingMode,
      status: "draft",
      version,
      notes: input.notes,
    };

    await this.repository.saveProfile(record);
    return record;
  }

  async publishProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<ModuleExecutionProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const profile = await repository.findProfileById(profileId);
      if (!profile) {
        throw new ModuleExecutionProfileNotFoundError(profileId);
      }

      if (profile.status !== "draft") {
        throw new ModuleExecutionProfileStatusTransitionError(
          profileId,
          profile.status,
          "active",
        );
      }

      await this.assertProfileReferencesArePublishable(profile);

      const profiles = await repository.listProfiles();
      for (const existing of profiles) {
        if (
          existing.id !== profile.id &&
          existing.status === "active" &&
          existing.module === profile.module &&
          existing.manuscript_type === profile.manuscript_type &&
          existing.template_family_id === profile.template_family_id
        ) {
          await repository.saveProfile({
            ...existing,
            status: "archived",
          });
        }
      }

      const activeProfile: ModuleExecutionProfileRecord = {
        ...profile,
        status: "active",
      };
      await repository.saveProfile(activeProfile);
      return activeProfile;
    });
  }

  async archiveProfile(
    profileId: string,
    actorRole: RoleKey,
  ): Promise<ModuleExecutionProfileRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const profile = await this.requireProfile(profileId);

    if (profile.status === "archived") {
      return profile;
    }

    const archived: ModuleExecutionProfileRecord = {
      ...profile,
      status: "archived",
    };
    await this.repository.saveProfile(archived);
    return archived;
  }

  listProfiles(): Promise<ModuleExecutionProfileRecord[]> {
    return this.repository.listProfiles();
  }

  async resolveActiveProfile(
    input: ResolveActiveExecutionProfileInput,
  ): Promise<ModuleExecutionProfileRecord> {
    const match = (await this.repository.listProfiles())
      .filter(
        (record) =>
          record.status === "active" &&
          record.module === input.module &&
          record.manuscript_type === input.manuscriptType &&
          record.template_family_id === input.templateFamilyId,
      )
      .sort((left, right) => right.version - left.version)[0];

    if (!match) {
      throw new ActiveExecutionProfileNotFoundError(
        input.module,
        input.manuscriptType,
        input.templateFamilyId,
      );
    }

    return match;
  }

  async createKnowledgeBindingRule(
    actorRole: RoleKey,
    input: CreateKnowledgeBindingRuleInput,
  ): Promise<KnowledgeBindingRuleRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: KnowledgeBindingRuleRecord = {
      id: this.createId(),
      knowledge_item_id: input.knowledgeItemId,
      module: input.module,
      manuscript_types:
        input.manuscriptTypes === "any"
          ? "any"
          : [...input.manuscriptTypes],
      template_family_ids: input.templateFamilyIds
        ? [...input.templateFamilyIds]
        : undefined,
      module_template_ids: input.moduleTemplateIds
        ? [...input.moduleTemplateIds]
        : undefined,
      sections: input.sections ? [...input.sections] : undefined,
      risk_tags: input.riskTags ? [...input.riskTags] : undefined,
      priority: input.priority ?? 0,
      binding_purpose: input.bindingPurpose,
      status: "draft",
    };

    await this.repository.saveKnowledgeBindingRule(record);
    return record;
  }

  async activateKnowledgeBindingRule(
    ruleId: string,
    actorRole: RoleKey,
  ): Promise<KnowledgeBindingRuleRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const rule = await this.repository.findKnowledgeBindingRuleById(ruleId);
    if (!rule) {
      throw new KnowledgeBindingRuleNotFoundError(ruleId);
    }

    if (rule.status !== "draft") {
      throw new KnowledgeBindingRuleStatusTransitionError(
        ruleId,
        rule.status,
        "active",
      );
    }

    await this.assertKnowledgeItemApproved(rule.knowledge_item_id);

    const activeRule: KnowledgeBindingRuleRecord = {
      ...rule,
      status: "active",
    };
    await this.repository.saveKnowledgeBindingRule(activeRule);
    return activeRule;
  }

  listKnowledgeBindingRules(): Promise<KnowledgeBindingRuleRecord[]> {
    return this.repository.listKnowledgeBindingRules();
  }

  async listApplicableActiveKnowledgeBindingRules(input: {
    module: TemplateModule;
    manuscriptType: ManuscriptType;
    templateFamilyId: string;
    moduleTemplateId: string;
  }): Promise<KnowledgeBindingRuleRecord[]> {
    return (await this.repository.listKnowledgeBindingRules()).filter((rule) =>
      this.matchesRuleScope(rule, {
        module: input.module,
        manuscriptType: input.manuscriptType,
        templateFamilyId: input.templateFamilyId,
        moduleTemplateId: input.moduleTemplateId,
      }),
    );
  }

  async resolvePublishedRuleSource(profile: ModuleExecutionProfileRecord): Promise<{
    ruleSet: EditorialRuleSetRecord;
    rules: EditorialRuleRecord[];
  }> {
    const ruleSet = await this.requirePublishedRuleSet(profile);
    const rules = await this.editorialRuleRepository.listRulesByRuleSetId(ruleSet.id);

    return {
      ruleSet,
      rules,
    };
  }

  private async assertProfileReferencesArePublishable(
    profile: ModuleExecutionProfileRecord,
  ): Promise<void> {
    const moduleTemplate = await this.moduleTemplateRepository.findById(
      profile.module_template_id,
    );
    if (!moduleTemplate || moduleTemplate.status !== "published") {
      throw new ExecutionProfileModuleTemplateNotPublishedError(
        profile.module_template_id,
      );
    }

    if (
      moduleTemplate.module !== profile.module ||
      moduleTemplate.manuscript_type !== profile.manuscript_type ||
      moduleTemplate.template_family_id !== profile.template_family_id
    ) {
      throw new ExecutionProfileCompatibilityError(
        `Module template ${moduleTemplate.id} is incompatible with execution profile ${profile.id}.`,
      );
    }

    const promptTemplate =
      await this.promptSkillRegistryRepository.findPromptTemplateById(
        profile.prompt_template_id,
      );
    if (!promptTemplate || promptTemplate.status !== "published") {
      throw new ExecutionProfilePromptTemplateNotPublishedError(
        profile.prompt_template_id,
      );
    }

    if (
      promptTemplate.module !== profile.module ||
      !matchesManuscriptType(
        promptTemplate.manuscript_types,
        profile.manuscript_type,
      )
    ) {
      throw new ExecutionProfileCompatibilityError(
        `Prompt template ${promptTemplate.id} is incompatible with execution profile ${profile.id}.`,
      );
    }

    for (const skillPackageId of profile.skill_package_ids) {
      const skillPackage =
        await this.promptSkillRegistryRepository.findSkillPackageById(
          skillPackageId,
        );
      if (!skillPackage || skillPackage.status !== "published") {
        throw new ExecutionProfileSkillPackageNotPublishedError(skillPackageId);
      }

      if (!skillPackage.applies_to_modules.includes(profile.module)) {
        throw new ExecutionProfileCompatibilityError(
          `Skill package ${skillPackage.id} is incompatible with execution profile ${profile.id}.`,
        );
      }
    }

    await this.requirePublishedRuleSet(profile);

    const activeBindingRules = await this.listApplicableActiveKnowledgeBindingRules({
      module: profile.module,
      manuscriptType: profile.manuscript_type,
      templateFamilyId: profile.template_family_id,
      moduleTemplateId: profile.module_template_id,
    });
    for (const rule of activeBindingRules) {
      await this.assertKnowledgeItemApproved(rule.knowledge_item_id);
    }
  }

  private async requirePublishedRuleSet(
    profile: ModuleExecutionProfileRecord,
  ): Promise<EditorialRuleSetRecord> {
    const ruleSetId = profile.rule_set_id;
    if (!ruleSetId) {
      throw new ExecutionProfileRuleSetNotPublishedError("missing");
    }

    const ruleSet = await this.editorialRuleRepository.findRuleSetById(ruleSetId);
    if (!ruleSet || ruleSet.status !== "published") {
      throw new ExecutionProfileRuleSetNotPublishedError(ruleSetId);
    }

    if (
      ruleSet.module !== profile.module ||
      ruleSet.template_family_id !== profile.template_family_id
    ) {
      throw new ExecutionProfileCompatibilityError(
        `Rule set ${ruleSet.id} is incompatible with execution profile ${profile.id}.`,
      );
    }

    return ruleSet;
  }

  private async assertKnowledgeItemApproved(
    knowledgeItemId: string,
  ): Promise<void> {
    const knowledgeItem = await this.knowledgeRepository.findById(knowledgeItemId);

    if (!knowledgeItem || knowledgeItem.status !== "approved") {
      throw new ExecutionProfileKnowledgeItemNotApprovedError(knowledgeItemId);
    }
  }

  private async requireProfile(
    profileId: string,
  ): Promise<ModuleExecutionProfileRecord> {
    const profile = await this.repository.findProfileById(profileId);
    if (!profile) {
      throw new ModuleExecutionProfileNotFoundError(profileId);
    }
    return profile;
  }

  private matchesRuleScope(
    rule: KnowledgeBindingRuleRecord,
    scope: {
      module: TemplateModule;
      manuscriptType: ManuscriptType;
      templateFamilyId: string;
      moduleTemplateId: string;
    },
  ): boolean {
    return (
      rule.status === "active" &&
      rule.module === scope.module &&
      matchesManuscriptType(rule.manuscript_types, scope.manuscriptType) &&
      (!rule.template_family_ids ||
        rule.template_family_ids.length === 0 ||
        rule.template_family_ids.includes(scope.templateFamilyId)) &&
      (!rule.module_template_ids ||
        rule.module_template_ids.length === 0 ||
        rule.module_template_ids.includes(scope.moduleTemplateId))
    );
  }
}

function matchesManuscriptType(
  manuscriptTypes: ManuscriptType[] | "any",
  manuscriptType: ManuscriptType,
): boolean {
  return manuscriptTypes === "any" || manuscriptTypes.includes(manuscriptType);
}

function createExecutionGovernanceTransactionManager(
  context: ExecutionGovernanceWriteContext,
): WriteTransactionManager<ExecutionGovernanceWriteContext> {
  if (context.repository instanceof InMemoryExecutionGovernanceRepository) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository],
    });
  }

  return createDirectWriteTransactionManager(context);
}
