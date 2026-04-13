import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptModule } from "../jobs/job-record.ts";
import type { RuleEvidenceExample } from "@medical/contracts";

export type ModuleTemplateStatus = "draft" | "published" | "archived";
export type TemplateFamilyStatus = "draft" | "active" | "archived";
export type JournalTemplateProfileStatus = TemplateFamilyStatus;
export type GovernedLedgerStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "archived";
export type GovernedContentModuleClass = "general" | "medical_specialized";
export type GovernedContentModuleEvidenceLevel =
  | "unknown"
  | "low"
  | "medium"
  | "high"
  | "expert_opinion";
export type GovernedContentModuleRiskLevel = "low" | "medium" | "high";

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

export interface GovernedContentModuleRecord {
  id: string;
  module_class: GovernedContentModuleClass;
  name: string;
  category: string;
  manuscript_type_scope: ManuscriptType[];
  execution_module_scope: TemplateModule[];
  applicable_sections?: string[];
  summary: string;
  guidance?: string[];
  examples?: RuleEvidenceExample[];
  evidence_level?: GovernedContentModuleEvidenceLevel;
  risk_level?: GovernedContentModuleRiskLevel;
  source_task_id?: string;
  source_candidate_id?: string;
  status: GovernedLedgerStatus;
  created_at: string;
  updated_at: string;
}

export interface TemplateCompositionRecord {
  id: string;
  name: string;
  manuscript_type: ManuscriptType;
  journal_scope?: string;
  general_module_ids: string[];
  medical_module_ids: string[];
  execution_module_scope: TemplateModule[];
  notes?: string;
  source_task_id?: string;
  source_candidate_ids?: string[];
  version_no: number;
  status: GovernedLedgerStatus;
  created_at: string;
  updated_at: string;
}
