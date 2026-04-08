import type {
  JournalTemplateId,
  ManuscriptType,
  TemplateFamilyId,
} from "./manuscript.js";
import type { ModuleType } from "./templates.js";

export type EditorialRuleSetId = string;
export type EditorialRuleId = string;

export type RuleObjectKey =
  | "title"
  | "author_line"
  | "abstract"
  | "keyword"
  | "heading_hierarchy"
  | "terminology"
  | "numeric_unit"
  | "statistical_expression"
  | "table"
  | "figure"
  | "reference"
  | "statement"
  | "manuscript_structure"
  | "journal_column";

export type EditorialRuleSetStatus = "draft" | "published" | "archived";
export type EditorialRuleType = "format" | "content";
export type EditorialRuleExecutionMode =
  | "apply"
  | "inspect"
  | "apply_and_inspect";
export type EditorialRuleExecutionPosture =
  | "auto"
  | "guarded"
  | "inspect_only";
export type EditorialRuleConfidencePolicy =
  | "always_auto"
  | "high_confidence_only"
  | "manual_only";
export type EditorialRuleSeverity = "info" | "warning" | "error";
export type EditorialRuleEvidenceLevel =
  | "low"
  | "medium"
  | "high"
  | "expert_opinion"
  | "unknown";
export type EditorialRuleProjectionKind = "rule" | "checklist" | "prompt_snippet";

export interface EditorialRuleExplanationPayload {
  rationale: string;
  applies_when?: string[];
  not_applies_when?: string[];
  correct_example?: string;
  incorrect_example?: string;
  review_prompt?: string;
}

export interface EditorialRuleLinkagePayload {
  source_learning_candidate_id?: string;
  source_snapshot_asset_id?: string;
  projected_knowledge_item_ids?: string[];
  overrides_rule_ids?: string[];
}

export interface EditorialRuleProjectionPayload {
  projection_kind: EditorialRuleProjectionKind;
  summary?: string;
  standard_example?: string;
  incorrect_example?: string;
}

export interface EditorialRuleSet {
  id: EditorialRuleSetId;
  template_family_id: TemplateFamilyId;
  journal_template_id?: JournalTemplateId;
  module: ModuleType;
  version_no: number;
  status: EditorialRuleSetStatus;
}

export interface EditorialRule {
  id: EditorialRuleId;
  rule_set_id: EditorialRuleSetId;
  order_no: number;
  rule_object: RuleObjectKey;
  rule_type: EditorialRuleType;
  execution_mode: EditorialRuleExecutionMode;
  scope: Record<string, unknown>;
  selector: Record<string, unknown>;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
  authoring_payload: Record<string, unknown>;
  explanation_payload?: EditorialRuleExplanationPayload;
  linkage_payload?: EditorialRuleLinkagePayload;
  projection_payload?: EditorialRuleProjectionPayload;
  evidence_level?: EditorialRuleEvidenceLevel;
  confidence_policy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled: boolean;
  example_before?: string;
  example_after?: string;
  manual_review_reason_template?: string;
}

export interface EditorialRulePreviewContext {
  manuscript_type: ManuscriptType;
  module: ModuleType;
  template_family_id: TemplateFamilyId;
  journal_template_id?: JournalTemplateId;
  rule_object?: RuleObjectKey;
}

export interface EditorialRulePreviewMatchedRule {
  rule_id: EditorialRuleId;
  rule_object: RuleObjectKey;
  coverage_key: string;
  execution_posture: EditorialRuleExecutionPosture;
  overridden_rule_ids: EditorialRuleId[];
  reason: string;
}

export interface EditorialRulePreviewResult {
  matched_rule_ids: EditorialRuleId[];
  overridden_rule_ids: EditorialRuleId[];
  reasons: string[];
  output?: string;
  execution_posture: EditorialRuleExecutionPosture;
  inspect_only: boolean;
  matched_rules: EditorialRulePreviewMatchedRule[];
}

export interface EditorialRuleObjectCatalogEntry {
  key: RuleObjectKey;
  label: string;
  default_execution_posture: EditorialRuleExecutionPosture;
  preview_strategy: "text_transform" | "finding_only";
  projection_kinds: EditorialRuleProjectionKind[];
}
