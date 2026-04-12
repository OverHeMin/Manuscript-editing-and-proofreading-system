export const MANUSCRIPT_QUALITY_ACTION_LADDER = [
  "auto_fix",
  "suggest_fix",
  "manual_review",
  "block",
] as const;

export type ManuscriptQualityScope =
  | "general_proofreading"
  | "medical_specialized";

export type ManuscriptQualityAction =
  (typeof MANUSCRIPT_QUALITY_ACTION_LADDER)[number];

export type ManuscriptQualitySeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ManuscriptQualityCategory =
  | "punctuation_and_pairs"
  | "full_half_width_and_spacing"
  | "typo_redundancy_and_omission"
  | "consistency"
  | "sensitive_and_compliance"
  | "sentence_and_logic"
  | "medical_calculation_and_parsing"
  | "medical_logic"
  | "medical_norms_and_magnitude"
  | "table_text_consistency"
  | "system_fallback";

export type ManuscriptQualitySourceKind =
  | "deterministic_rule"
  | "lexicon"
  | "language_model"
  | "third_party_adapter"
  | "system_fallback";

export interface ManuscriptQualitySpan {
  start: number;
  end: number;
}

export interface ManuscriptQualityIssue {
  issue_id: string;
  module_scope: ManuscriptQualityScope;
  issue_type: string;
  category: ManuscriptQualityCategory;
  severity: ManuscriptQualitySeverity;
  action: ManuscriptQualityAction;
  confidence: number;
  span?: ManuscriptQualitySpan;
  paragraph_index?: number;
  sentence_index?: number;
  source_kind: ManuscriptQualitySourceKind;
  source_id?: string;
  text_excerpt: string;
  normalized_excerpt?: string;
  suggested_replacement?: string;
  explanation: string;
}

export interface ManuscriptQualityFindingSummary {
  total_issue_count: number;
  issue_count_by_scope: Partial<Record<ManuscriptQualityScope, number>>;
  issue_count_by_action: Partial<Record<ManuscriptQualityAction, number>>;
  issue_count_by_severity: Partial<Record<ManuscriptQualitySeverity, number>>;
  highest_action?: ManuscriptQualityAction;
  representative_issue_ids: string[];
}
