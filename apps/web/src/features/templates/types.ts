import type { ManuscriptType } from "../manuscripts/types.ts";

export type TemplateModule = "screening" | "editing" | "proofreading";
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

export interface RuleEvidenceExampleViewModel {
  before: string;
  after: string;
  note?: string;
}

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

export interface GovernedContentModuleViewModel {
  id: string;
  module_class: GovernedContentModuleClass;
  name: string;
  category: string;
  manuscript_type_scope: ManuscriptType[];
  execution_module_scope: TemplateModule[];
  applicable_sections?: string[];
  summary: string;
  guidance?: string[];
  examples?: RuleEvidenceExampleViewModel[];
  evidence_level?: GovernedContentModuleEvidenceLevel;
  risk_level?: GovernedContentModuleRiskLevel;
  source_task_id?: string;
  source_candidate_id?: string;
  template_usage_count: number;
  status: GovernedLedgerStatus;
  created_at: string;
  updated_at: string;
}

export interface TemplateCompositionViewModel {
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

export interface CreateContentModuleDraftInput {
  moduleClass: GovernedContentModuleClass;
  name: string;
  category: string;
  manuscriptTypeScope: ManuscriptType[];
  executionModuleScope: TemplateModule[];
  applicableSections?: string[];
  summary: string;
  guidance?: string[];
  examples?: RuleEvidenceExampleViewModel[];
  evidenceLevel?: GovernedContentModuleEvidenceLevel;
  riskLevel?: GovernedContentModuleRiskLevel;
  sourceTaskId?: string;
  sourceCandidateId?: string;
}

export interface UpdateContentModuleDraftInput {
  name?: string;
  category?: string;
  manuscriptTypeScope?: ManuscriptType[];
  executionModuleScope?: TemplateModule[];
  applicableSections?: string[];
  summary?: string;
  guidance?: string[];
  examples?: RuleEvidenceExampleViewModel[];
  evidenceLevel?: GovernedContentModuleEvidenceLevel;
  riskLevel?: GovernedContentModuleRiskLevel;
  status?: GovernedLedgerStatus;
}

export interface CreateContentModuleDraftFromCandidateInput {
  taskId: string;
  candidateId: string;
  moduleClass: GovernedContentModuleClass;
}

export interface CreateTemplateCompositionDraftInput {
  name: string;
  manuscriptType: ManuscriptType;
  journalScope?: string;
  generalModuleIds?: string[];
  medicalModuleIds?: string[];
  executionModuleScope: TemplateModule[];
  notes?: string;
  sourceTaskId?: string;
  sourceCandidateIds?: string[];
}

export interface UpdateTemplateCompositionDraftInput {
  name?: string;
  journalScope?: string;
  generalModuleIds?: string[];
  medicalModuleIds?: string[];
  executionModuleScope?: TemplateModule[];
  notes?: string;
  status?: GovernedLedgerStatus;
}

export interface CreateTemplateCompositionDraftFromCandidateInput {
  taskId: string;
  candidateId: string;
  name?: string;
}
