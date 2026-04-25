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
export type JournalFormatTargetZone =
  | "front_matter"
  | "title"
  | "abstract"
  | "keywords"
  | "body"
  | "figures_tables"
  | "declarations"
  | "references";
export type JournalFormatTargetAnchor =
  | "before_title"
  | "after_title"
  | "after_author_line"
  | "after_affiliation_line"
  | "after_abstract"
  | "after_keywords"
  | "before_body"
  | "after_body"
  | "before_reference"
  | "header_zone"
  | "footer_zone";
export type JournalFormatTargetContentSourcePolicy =
  | "must_harvest_existing"
  | "prefer_existing_with_manual_fill"
  | "manual_only";
export type JournalFormatTargetCompletionGate =
  | "block_on_missing"
  | "block_on_unresolved"
  | "warn_only";

export interface JournalFormatTargetBlockFormatPolicy {
  display_label?: string;
  prefix?: string;
  suffix?: string;
  separator?: string;
  target_position?: string;
  style_requirements?: string[];
  allow_auto_reorder: boolean;
}

export interface JournalFormatTargetBlock {
  block_key: string;
  label: string;
  zone: JournalFormatTargetZone;
  anchor: JournalFormatTargetAnchor;
  order: number;
  required: boolean;
  repeatable: boolean;
  enabled: boolean;
  format_policy: JournalFormatTargetBlockFormatPolicy;
  content_source_policy: JournalFormatTargetContentSourcePolicy;
  completion_gate: JournalFormatTargetCompletionGate;
}

export interface JournalTargetTableModel {
  caption_position: "above" | "below";
  note_position: "below" | "above" | "inline";
  border_policy: string;
  three_line_table_required: boolean;
  vertical_border_policy: "forbid" | "allow" | "require";
  header_depth_policy: string;
  stub_column_policy: string;
  merged_cell_policy: "preserve" | "normalize" | "manual_review";
  font_policy: string;
  rich_text_policy: "preserve" | "normalize_supported" | "manual_review";
  unit_marker_policy: string;
  special_symbol_policy: string;
  width_policy: string;
  auto_rebuild_eligibility_policy: string;
  manual_review_downgrade_policy: string;
}

export interface JournalFormatTargetModel {
  skeleton: JournalFormatTargetZone[];
  target_blocks: JournalFormatTargetBlock[];
  journal_target_table_model?: JournalTargetTableModel;
}

export interface JournalFormatTargetModelVersionRecord {
  version_id: string;
  version_no: number;
  created_at: string;
  journal_format_target_model: JournalFormatTargetModel;
}

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
  target_model_version_id?: string;
  target_model_version_no?: number;
  journal_format_target_model?: JournalFormatTargetModel;
  target_model_versions?: JournalFormatTargetModelVersionRecord[];
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
