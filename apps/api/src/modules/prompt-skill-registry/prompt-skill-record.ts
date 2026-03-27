import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type RegistryAssetStatus = "draft" | "published" | "archived";

export interface SkillPackageRecord {
  id: string;
  name: string;
  version: string;
  scope: "admin_only";
  status: RegistryAssetStatus;
  applies_to_modules: TemplateModule[];
  dependency_tools?: string[];
}

export interface PromptTemplateRecord {
  id: string;
  name: string;
  version: string;
  status: RegistryAssetStatus;
  module: TemplateModule;
  manuscript_types: ManuscriptType[] | "any";
  rollback_target_version?: string;
}
