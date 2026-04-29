import type { TemplateModule } from "../templates/template-record.ts";

export type EditorialRuleSetStatus =
  | "draft"
  | "candidate"
  | "canary"
  | "active"
  | "published"
  | "archived"
  | "rolled_back";
export type EditorialRuleType = "format" | "content";
export type EditorialRuleDomain =
  | "page_structure"
  | "title_heading"
  | "abstract_keywords"
  | "front_matter"
  | "body_paragraph"
  | "references"
  | "declarations"
  | "table"
  | "image_symbol"
  | "object_symbol"
  | "journal_override";
export type EditorialRuleStructuredActionKind =
  | "inspect_only"
  | "suggest_change"
  | "auto_apply"
  | "full_table_rebuild"
  | "manual_review_required"
  | "block_completion";
export type EditorialRuleAutomationGrade = "A" | "B" | "C" | "D";
export type EditorialRuleScopeLayer = "general" | "medical" | "journal";
export type EditorialRuleExecutionMode =
  | "apply"
  | "inspect"
  | "apply_and_inspect";
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
export const EDITORIAL_RULE_ACTIVATION_METRIC_KEYS = [
  "governed_hit_count",
  "false_positive_count",
  "human_confirmation_count",
  "accept_change_only_count",
  "evidence_only_archive_count",
  "routed_rule_candidate_count",
  "routed_knowledge_candidate_count",
  "routed_prompt_candidate_count",
  "writeback_created_count",
  "writeback_applied_count",
  "table_patch_applied_count",
  "table_patch_skipped_no_anchor_count",
  "table_patch_skipped_conflict_count",
  "table_patch_skipped_unsafe_count",
] as const;
export type EditorialRuleActivationMetricKey =
  (typeof EDITORIAL_RULE_ACTIVATION_METRIC_KEYS)[number];

export const DEFAULT_EDITORIAL_RULE_PRIORITY = 100;

export interface EditorialRuleScope {
  manuscript_types?: string[];
  sections?: string[];
  object_granularity?: string[];
  [key: string]: unknown;
}

export interface EditorialRuleTrigger {
  kind: string;
  [key: string]: unknown;
}

export interface EditorialRuleAction {
  kind: string;
  [key: string]: unknown;
}

export interface EditorialRuleStructuredAction {
  kind: EditorialRuleStructuredActionKind;
  target?: string;
  requires_validation: boolean;
  manual_review_reason?: string;
}

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
  evidence_package_ids?: string[];
  table_evidence_revision_ids?: string[];
  target_model_block_ids?: string[];
  overrides_rule_ids?: string[];
}

export interface EditorialRuleGoldSampleGatePayload {
  status: "not_required" | "pending" | "passed" | "failed";
  specimen_ids?: string[];
  validation_snapshot_ids?: string[];
  negative_specimen_ids?: string[];
  failure_reasons?: string[];
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface EditorialRuleProjectionPayload {
  projection_kind: EditorialRuleProjectionKind;
  summary?: string;
  standard_example?: string;
  incorrect_example?: string;
}

export interface EditorialRuleSetReleaseScope {
  manuscript_types?: string[];
  sections?: string[];
  object_granularity?: string[];
  [key: string]: unknown;
}

export interface EditorialRuleSetRecord {
  id: string;
  template_family_id: string;
  journal_template_id?: string;
  module: TemplateModule;
  version_no: number;
  status: EditorialRuleSetStatus;
  release_scope?: EditorialRuleSetReleaseScope;
  candidate_validation_run_id?: string;
  candidate_validation_evidence_pack_id?: string;
  online_regression_run_id?: string;
  online_regression_evidence_pack_id?: string;
  rollback_rule_set_id?: string;
  metrics_summary?: EditorialRuleActivationMetricsSummary;
  release_comparison?: EditorialRuleReleaseComparisonSummary;
}

export interface EditorialRuleRecord {
  id: string;
  rule_set_id: string;
  order_no: number;
  priority?: number;
  rule_object: string;
  rule_type: EditorialRuleType;
  rule_domain?: EditorialRuleDomain;
  execution_mode: EditorialRuleExecutionMode;
  structured_action?: EditorialRuleStructuredAction;
  automation_grade?: EditorialRuleAutomationGrade;
  scope_layer?: EditorialRuleScopeLayer;
  scope: EditorialRuleScope;
  selector: Record<string, unknown>;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  authoring_payload: Record<string, unknown>;
  explanation_payload?: EditorialRuleExplanationPayload;
  linkage_payload?: EditorialRuleLinkagePayload;
  projection_payload?: EditorialRuleProjectionPayload;
  gold_sample_gate?: EditorialRuleGoldSampleGatePayload;
  evidence_level?: EditorialRuleEvidenceLevel;
  confidence_policy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled: boolean;
  example_before?: string;
  example_after?: string;
  manual_review_reason_template?: string;
  metrics_summary?: EditorialRuleActivationMetricsSummary;
}

export interface EditorialRuleActivationMetricRecord {
  rule_id: string;
  rule_set_id: string;
  metric_key: EditorialRuleActivationMetricKey;
  metric_count: number;
  created_at: string;
  updated_at: string;
}

export interface EditorialRuleActivationMetricTotals {
  governed_hit_count: number;
  false_positive_count: number;
  human_confirmation_count: number;
  accept_change_only_count: number;
  evidence_only_archive_count: number;
  routed_rule_candidate_count: number;
  routed_knowledge_candidate_count: number;
  routed_prompt_candidate_count: number;
  writeback_created_count: number;
  writeback_applied_count: number;
  table_patch_applied_count: number;
  table_patch_skipped_no_anchor_count: number;
  table_patch_skipped_conflict_count: number;
  table_patch_skipped_unsafe_count: number;
}

export interface EditorialRuleActivationMetricRates {
  false_positive_rate: number;
  human_confirmation_rate: number;
  evidence_only_archive_rate: number;
  writeback_success_rate: number;
}

export interface EditorialRuleActivationMetricsSummary {
  rule_id?: string;
  rule_set_id?: string;
  totals: EditorialRuleActivationMetricTotals;
  rates: EditorialRuleActivationMetricRates;
}

export interface EditorialRuleReleaseComparisonSummary {
  status: "stable" | "degraded" | "insufficient_data";
  recommendation: "promote" | "hold" | "rollback_recommended";
  baseline_rule_set_id?: string;
  compared_rule_set_id: string;
  baseline_metrics: EditorialRuleActivationMetricsSummary;
  candidate_metrics: EditorialRuleActivationMetricsSummary;
  reasons: string[];
}
