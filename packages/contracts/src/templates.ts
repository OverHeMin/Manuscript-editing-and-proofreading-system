import type { ManuscriptType, TemplateFamilyId } from "./manuscript.js";
import type { ManuscriptModule } from "./assets.js";

export type ModuleType = Extract<
  ManuscriptModule,
  "screening" | "editing" | "proofreading"
>;

export type ModuleTemplateStatus = "draft" | "published" | "archived";

// Not explicitly versioned in the specs yet; keep minimal and permissive.
export type TemplateFamilyStatus = "draft" | "active" | "archived";

export type TemplateKnowledgeBindingPurpose =
  | "required"
  | "recommended"
  | "risk_guardrail"
  | "section_specific";

export type ModuleTemplateId = string;
export type TemplateKnowledgeBindingId = string;

export interface TemplateFamily {
  id: TemplateFamilyId;
  manuscript_type: ManuscriptType;
  name: string;
  status: TemplateFamilyStatus;
}

export interface ModuleTemplate {
  id: ModuleTemplateId;
  template_family_id: TemplateFamilyId;

  module: ModuleType;
  manuscript_type: ManuscriptType;

  version_no: number;
  status: ModuleTemplateStatus;

  // Keep structure flexible; V1 will iterate.
  prompt: string;
  checklist?: string[];
  section_requirements?: string[];
}

export interface TemplateKnowledgeBinding {
  id: TemplateKnowledgeBindingId;
  template_family_id: TemplateFamilyId;
  module_template_id?: ModuleTemplateId;

  // Section routing is optional; a binding can apply at template-level or section-level.
  section_key?: string;

  knowledge_item_id: string;
  purpose: TemplateKnowledgeBindingPurpose;

  created_at?: string;
}

