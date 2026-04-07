import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type RegistryAssetStatus = "draft" | "published" | "archived";
export type PromptTemplateKind =
  | "editing_instruction"
  | "proofreading_instruction";

export interface SkillPackageRecord {
  id: string;
  name: string;
  version: string;
  scope: "admin_only";
  status: RegistryAssetStatus;
  applies_to_modules: TemplateModule[];
  dependency_tools?: string[];
  source_learning_candidate_id?: string;
}

export interface PromptTemplateRecord {
  id: string;
  name: string;
  version: string;
  status: RegistryAssetStatus;
  module: TemplateModule;
  manuscript_types: ManuscriptType[] | "any";
  template_kind?: PromptTemplateKind;
  system_instructions?: string;
  task_frame?: string;
  hard_rule_summary?: string;
  allowed_content_operations?: string[];
  forbidden_operations?: string[];
  manual_review_policy?: string;
  output_contract?: string;
  report_style?: string;
  rollback_target_version?: string;
  source_learning_candidate_id?: string;
}
