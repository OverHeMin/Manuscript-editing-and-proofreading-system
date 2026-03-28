import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { LearningCandidateRepository } from "../learning/learning-repository.ts";
import { requireApprovedLearningCandidate } from "../shared/learning-candidate-guard.ts";
import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "./prompt-skill-record.ts";
import type { PromptSkillRegistryRepository } from "./prompt-skill-repository.ts";

export interface CreateSkillPackageInput {
  name: string;
  version: string;
  appliesToModules: SkillPackageRecord["applies_to_modules"];
  dependencyTools?: string[];
  sourceLearningCandidateId?: string;
}

export interface CreateSkillPackageFromLearningCandidateInput
  extends CreateSkillPackageInput {
  sourceLearningCandidateId: string;
}

export interface CreatePromptTemplateInput {
  name: string;
  version: string;
  module: PromptTemplateRecord["module"];
  manuscriptTypes: PromptTemplateRecord["manuscript_types"];
  rollbackTargetVersion?: string;
  sourceLearningCandidateId?: string;
}

export interface CreatePromptTemplateFromLearningCandidateInput
  extends CreatePromptTemplateInput {
  sourceLearningCandidateId: string;
}

export interface PromptSkillRegistryServiceOptions {
  repository: PromptSkillRegistryRepository;
  learningCandidateRepository?: LearningCandidateRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class SkillPackageNotFoundError extends Error {
  constructor(skillPackageId: string) {
    super(`Skill package ${skillPackageId} was not found.`);
    this.name = "SkillPackageNotFoundError";
  }
}

export class PromptTemplateNotFoundError extends Error {
  constructor(promptTemplateId: string) {
    super(`Prompt template ${promptTemplateId} was not found.`);
    this.name = "PromptTemplateNotFoundError";
  }
}

export class PromptSkillRegistryStatusTransitionError extends Error {
  constructor(assetType: "skill_package" | "prompt_template", id: string, from: string, to: string) {
    super(`${assetType} ${id} cannot transition from ${from} to ${to}.`);
    this.name = "PromptSkillRegistryStatusTransitionError";
  }
}

export class PromptSkillRegistryService {
  private readonly repository: PromptSkillRegistryRepository;
  private readonly learningCandidateRepository?: LearningCandidateRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: PromptSkillRegistryServiceOptions) {
    this.repository = options.repository;
    this.learningCandidateRepository = options.learningCandidateRepository;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createSkillPackage(
    actorRole: RoleKey,
    input: CreateSkillPackageInput,
  ): Promise<SkillPackageRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: SkillPackageRecord = {
      id: this.createId(),
      name: input.name,
      version: input.version,
      scope: "admin_only",
      status: "draft",
      applies_to_modules: [...input.appliesToModules],
      dependency_tools: input.dependencyTools ? [...input.dependencyTools] : undefined,
      ...(input.sourceLearningCandidateId
        ? {
            source_learning_candidate_id: input.sourceLearningCandidateId,
          }
        : {}),
    };

    await this.repository.saveSkillPackage(record);
    return record;
  }

  async createSkillPackageFromLearningCandidate(
    actorRole: RoleKey,
    input: CreateSkillPackageFromLearningCandidateInput,
  ): Promise<SkillPackageRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    await requireApprovedLearningCandidate(
      this.learningCandidateRepository,
      input.sourceLearningCandidateId,
    );
    return this.createSkillPackage(actorRole, input);
  }

  listSkillPackages(): Promise<SkillPackageRecord[]> {
    return this.repository.listSkillPackages();
  }

  async publishSkillPackage(
    actorRole: RoleKey,
    skillPackageId: string,
  ): Promise<SkillPackageRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record = await this.repository.findSkillPackageById(skillPackageId);
    if (!record) {
      throw new SkillPackageNotFoundError(skillPackageId);
    }

    if (record.status !== "draft") {
      throw new PromptSkillRegistryStatusTransitionError(
        "skill_package",
        skillPackageId,
        record.status,
        "published",
      );
    }

    const relatedRecords = await this.repository.listSkillPackagesByName(record.name);
    for (const existing of relatedRecords) {
      if (existing.id !== record.id && existing.status === "published") {
        await this.repository.saveSkillPackage({
          ...existing,
          status: "archived",
        });
      }
    }

    const published: SkillPackageRecord = {
      ...record,
      status: "published",
    };
    await this.repository.saveSkillPackage(published);
    return published;
  }

  async createPromptTemplate(
    actorRole: RoleKey,
    input: CreatePromptTemplateInput,
  ): Promise<PromptTemplateRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record: PromptTemplateRecord = {
      id: this.createId(),
      name: input.name,
      version: input.version,
      status: "draft",
      module: input.module,
      manuscript_types:
        input.manuscriptTypes === "any"
          ? "any"
          : [...input.manuscriptTypes],
      rollback_target_version: input.rollbackTargetVersion,
      ...(input.sourceLearningCandidateId
        ? {
            source_learning_candidate_id: input.sourceLearningCandidateId,
          }
        : {}),
    };

    await this.repository.savePromptTemplate(record);
    return record;
  }

  async createPromptTemplateFromLearningCandidate(
    actorRole: RoleKey,
    input: CreatePromptTemplateFromLearningCandidateInput,
  ): Promise<PromptTemplateRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    await requireApprovedLearningCandidate(
      this.learningCandidateRepository,
      input.sourceLearningCandidateId,
    );
    return this.createPromptTemplate(actorRole, input);
  }

  listPromptTemplates(): Promise<PromptTemplateRecord[]> {
    return this.repository.listPromptTemplates();
  }

  async publishPromptTemplate(
    actorRole: RoleKey,
    promptTemplateId: string,
  ): Promise<PromptTemplateRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const record = await this.repository.findPromptTemplateById(promptTemplateId);
    if (!record) {
      throw new PromptTemplateNotFoundError(promptTemplateId);
    }

    if (record.status !== "draft") {
      throw new PromptSkillRegistryStatusTransitionError(
        "prompt_template",
        promptTemplateId,
        record.status,
        "published",
      );
    }

    const relatedRecords =
      await this.repository.listPromptTemplatesByNameAndModule(
        record.name,
        record.module,
      );
    for (const existing of relatedRecords) {
      if (existing.id !== record.id && existing.status === "published") {
        await this.repository.savePromptTemplate({
          ...existing,
          status: "archived",
        });
      }
    }

    const published: PromptTemplateRecord = {
      ...record,
      status: "published",
    };
    await this.repository.savePromptTemplate(published);
    return published;
  }
}
