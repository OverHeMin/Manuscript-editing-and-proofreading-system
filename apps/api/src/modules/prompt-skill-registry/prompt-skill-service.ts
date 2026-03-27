import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
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
}

export interface CreatePromptTemplateInput {
  name: string;
  version: string;
  module: PromptTemplateRecord["module"];
  manuscriptTypes: PromptTemplateRecord["manuscript_types"];
  rollbackTargetVersion?: string;
}

export interface PromptSkillRegistryServiceOptions {
  repository: PromptSkillRegistryRepository;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
}

export class PromptSkillRegistryService {
  private readonly repository: PromptSkillRegistryRepository;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;

  constructor(options: PromptSkillRegistryServiceOptions) {
    this.repository = options.repository;
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
    };

    await this.repository.saveSkillPackage(record);
    return record;
  }

  listSkillPackages(): Promise<SkillPackageRecord[]> {
    return this.repository.listSkillPackages();
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
    };

    await this.repository.savePromptTemplate(record);
    return record;
  }

  listPromptTemplates(): Promise<PromptTemplateRecord[]> {
    return this.repository.listPromptTemplates();
  }
}
