import type { ManuscriptType } from "../manuscripts/types.ts";

export type TemplateModule = "screening" | "editing" | "proofreading";
export type ModuleTemplateStatus = "draft" | "published" | "archived";
export type TemplateFamilyStatus = "draft" | "active" | "archived";

export interface TemplateFamilyViewModel {
  id: string;
  manuscript_type: ManuscriptType;
  name: string;
  status: TemplateFamilyStatus;
}

export interface ModuleTemplateViewModel {
  id: string;
  template_family_id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  version_no: number;
  status: ModuleTemplateStatus;
  prompt: string;
  checklist?: string[];
  section_requirements?: string[];
}

export interface CreateTemplateFamilyInput {
  manuscriptType: ManuscriptType;
  name: string;
}

export interface UpdateTemplateFamilyInput {
  name?: string;
  status?: TemplateFamilyStatus;
}

export interface CreateModuleTemplateDraftInput {
  templateFamilyId: string;
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  prompt: string;
  checklist?: string[];
  sectionRequirements?: string[];
}
