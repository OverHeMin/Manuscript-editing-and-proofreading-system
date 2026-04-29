import type { ManuscriptType } from "./manuscript.js";
import type { ModuleType } from "./templates.js";
import type { ConfirmedAiTablePackage } from "./table-evidence.js";

export type RuleAiIntakeSourceKind = "manual_description";

export type RuleAiGovernanceLayer =
  | "template_family"
  | "module_template"
  | "journal_template"
  | "medical_package"
  | "general_package";

export type RuleAiTemplateMatchStatus =
  | "matched"
  | "multiple_candidates"
  | "no_match";

export type RuleAiSimilarityKind =
  | "duplicate"
  | "similar"
  | "conflict"
  | "no_material_overlap";

export type RuleAiParsingConsistency =
  | "consistent"
  | "partially_inconsistent"
  | "missing_evidence"
  | "possibly_duplicate"
  | "uncertain";

export interface RuleAiScopeDraft {
  module_scope?: ModuleType | "any";
  manuscript_types?: ManuscriptType[] | "any";
  sections?: string[];
  journal_key?: string;
  template_family_id?: string;
  module_template_id?: string;
  journal_template_id?: string;
}

export interface RuleAiEvidenceItem {
  kind:
    | "user_description"
    | "document_excerpt"
    | "diff_excerpt"
    | "table_snapshot"
    | "confirmed_table_package"
    | "image_understanding";
  text?: string;
  source_id?: string;
  authority?: "authoritative" | "review_required" | "unavailable";
  confirmed_table_package?: ConfirmedAiTablePackage;
}

export interface RuleAiConfidenceMap {
  overall: number;
  fields?: Record<string, number>;
}

export interface RuleAiDraft {
  source_kind: RuleAiIntakeSourceKind;
  ai_understanding_summary: string;
  recommended_governance_layer: RuleAiGovernanceLayer;
  recommended_template_id?: string;
  new_template_candidate?: {
    title: string;
    rationale: string;
    review_required: true;
  };
  target_object: string;
  trigger: string;
  action: string;
  exclusions?: string[];
  scope: RuleAiScopeDraft;
  priority_suggestion?: {
    rationale: string;
    professional_authority?: boolean;
  };
  evidence: RuleAiEvidenceItem[];
  confidence: RuleAiConfidenceMap;
  uncertainties: string[];
}

export interface RuleAiTemplateMatch {
  status: RuleAiTemplateMatchStatus;
  template_id?: string;
  candidates?: Array<{
    template_id: string;
    label: string;
    rationale: string;
  }>;
  new_template_candidate?: RuleAiDraft["new_template_candidate"];
}

export interface RuleAiSimilarityMatch {
  kind: RuleAiSimilarityKind;
  rule_id?: string;
  title: string;
  rationale: string;
  suggested_resolution:
    | "merge"
    | "reuse_existing"
    | "keep_separate"
    | "manual_review";
}

export interface RuleAiIntakeDraftRequest {
  source_kind: "manual_description";
  description: string;
  context?: RuleAiScopeDraft & {
    operator_hints?: string;
  };
}

export interface RuleAiIntakeDraftResponse {
  draft: RuleAiDraft;
  template_match: RuleAiTemplateMatch;
  similar_rule_matches: RuleAiSimilarityMatch[];
  warnings?: string[];
}

export interface RuleAiParsingRequest {
  rule_fields: {
    title?: string;
    rule_body: string;
    module_scope?: ModuleType | "any";
    manuscript_types?: ManuscriptType[] | "any";
    sections?: string[];
    target_object?: string;
    trigger?: string;
    action?: string;
    evidence?: RuleAiEvidenceItem[];
  };
}

export interface RuleAiParsingFinding {
  field: string;
  severity: "info" | "warning" | "blocking";
  message: string;
  suggested_revision?: string;
}

export interface RuleAiParsingResponse {
  ai_understanding_summary: string;
  consistency: RuleAiParsingConsistency;
  findings: RuleAiParsingFinding[];
  similar_rule_matches?: RuleAiSimilarityMatch[];
  requires_human_confirmation: boolean;
  warnings?: string[];
}
