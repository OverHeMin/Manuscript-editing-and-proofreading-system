import type { ManuscriptType } from "../manuscripts/types.ts";

export type TemplateModule = "screening" | "editing" | "proofreading";
export type ModuleTemplateStatus = "draft" | "published" | "archived";
export type TemplateFamilyStatus = "draft" | "active" | "archived";
export type JournalTemplateProfileStatus = TemplateFamilyStatus;

export interface TemplateFamilyViewModel {
  id: string;
  manuscript_type: ManuscriptType;
  name: string;
  status: TemplateFamilyStatus;
}

export interface JournalTemplateProfileViewModel {
  id: string;
  template_family_id: string;
  journal_key: string;
  journal_name: string;
  status: JournalTemplateProfileStatus;
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

export interface CreateJournalTemplateProfileInput {
  templateFamilyId: string;
  manuscriptType: ManuscriptType;
  journalKey: string;
  journalName: string;
}

export interface UpdateModuleTemplateDraftInput {
  prompt?: string;
  checklist?: string[];
  sectionRequirements?: string[];
}
