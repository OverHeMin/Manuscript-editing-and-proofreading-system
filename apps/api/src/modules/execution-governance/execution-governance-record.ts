import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type ModuleExecutionProfileStatus = "draft" | "active" | "archived";
export type KnowledgeBindingMode = "profile_only" | "profile_plus_dynamic";
export type KnowledgeBindingRuleStatus = "draft" | "active" | "archived";
export type KnowledgeBindingPurpose =
  | "required"
  | "recommended"
  | "risk_guardrail"
  | "section_specific";

export interface ModuleExecutionProfileRecord {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  module_template_id: string;
  rule_set_id?: string;
  prompt_template_id: string;
  skill_package_ids: string[];
  knowledge_binding_mode: KnowledgeBindingMode;
  status: ModuleExecutionProfileStatus;
  version: number;
  notes?: string;
}

export interface KnowledgeBindingRuleRecord {
  id: string;
  knowledge_item_id: string;
  module: TemplateModule;
  manuscript_types: ManuscriptType[] | "any";
  template_family_ids?: string[];
  module_template_ids?: string[];
  sections?: string[];
  risk_tags?: string[];
  priority: number;
  binding_purpose: KnowledgeBindingPurpose;
  status: KnowledgeBindingRuleStatus;
}
