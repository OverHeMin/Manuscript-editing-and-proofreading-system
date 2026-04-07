import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptModule } from "../jobs/job-record.ts";

export type ModuleTemplateStatus = "draft" | "published" | "archived";
export type TemplateFamilyStatus = "draft" | "active" | "archived";
export type JournalTemplateProfileStatus = TemplateFamilyStatus;

export type TemplateModule = Extract<
  ManuscriptModule,
  "screening" | "editing" | "proofreading"
>;

export interface TemplateFamilyRecord {
  id: string;
  manuscript_type: ManuscriptType;
  name: string;
  status: TemplateFamilyStatus;
}

export interface JournalTemplateProfileRecord {
  id: string;
  template_family_id: string;
  journal_key: string;
  journal_name: string;
  status: JournalTemplateProfileStatus;
}

export interface ModuleTemplateRecord {
  id: string;
  template_family_id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  version_no: number;
  status: ModuleTemplateStatus;
  prompt: string;
  checklist?: string[];
  section_requirements?: string[];
  source_learning_candidate_id?: string;
}
