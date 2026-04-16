import type { LearningCandidateViewModel } from "../learning-review/index.ts";

export type TemplateGovernanceLedgerDensity = "compact" | "comfortable";

export type TemplateGovernanceRuleLedgerAssetKind =
  | "rule"
  | "large_template"
  | "journal_template"
  | "general_package"
  | "medical_package"
  | "recycled_candidate";

export type TemplateGovernanceRuleLedgerCategory =
  | "all"
  | TemplateGovernanceRuleLedgerAssetKind;

export interface TemplateGovernanceRuleLedgerRelatedRule {
  id: string;
  title: string;
  publish_status: string;
  module_label: string;
}

export interface TemplateGovernanceRuleLedgerRow {
  id: string;
  asset_kind: TemplateGovernanceRuleLedgerAssetKind;
  title: string;
  module_label: string;
  manuscript_type_label: string;
  semantic_status: string;
  publish_status: string;
  contributor_label: string;
  updated_at?: string;
  default_rule_count?: number;
  related_rules?: TemplateGovernanceRuleLedgerRelatedRule[];
  learning_candidate?: LearningCandidateViewModel;
}

export interface TemplateGovernanceRuleLedgerSummary {
  totalCount: number;
  visibleCount: number;
  draftCount: number;
  publishedCount: number;
}

export interface TemplateGovernanceRuleLedgerViewModel {
  category: TemplateGovernanceRuleLedgerCategory;
  rows: TemplateGovernanceRuleLedgerRow[];
  selectedRowId?: string | null;
  selectedRow?: TemplateGovernanceRuleLedgerRow | null;
  searchQuery?: string;
  summary?: TemplateGovernanceRuleLedgerSummary;
}

export interface TemplateGovernanceLedgerSearchRow {
  id: string;
  primary: string;
  secondary?: string;
  cells: string[];
}

export interface TemplateGovernanceLedgerSearchState {
  mode: "idle" | "results";
  query: string;
  title: string;
  rows: TemplateGovernanceLedgerSearchRow[];
}
