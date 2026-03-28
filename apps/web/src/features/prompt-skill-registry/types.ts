import type { AuthRole } from "../auth/roles.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type { TemplateModule } from "../templates/types.ts";

export type RegistryAssetStatus = "draft" | "published" | "archived";

export interface SkillPackageViewModel {
  id: string;
  name: string;
  version: string;
  scope: "admin_only";
  status: RegistryAssetStatus;
  applies_to_modules: TemplateModule[];
  dependency_tools?: string[];
}

export interface PromptTemplateViewModel {
  id: string;
  name: string;
  version: string;
  status: RegistryAssetStatus;
  module: TemplateModule;
  manuscript_types: ManuscriptType[] | "any";
  rollback_target_version?: string;
}

export interface CreateSkillPackageInput {
  actorRole: AuthRole;
  name: string;
  version: string;
  appliesToModules: TemplateModule[];
  dependencyTools?: string[];
}

export interface CreatePromptTemplateInput {
  actorRole: AuthRole;
  name: string;
  version: string;
  module: TemplateModule;
  manuscriptTypes: ManuscriptType[] | "any";
  rollbackTargetVersion?: string;
}
