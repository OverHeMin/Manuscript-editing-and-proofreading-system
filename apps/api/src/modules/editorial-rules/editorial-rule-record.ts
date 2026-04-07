import type { TemplateModule } from "../templates/template-record.ts";

export type EditorialRuleSetStatus = "draft" | "published" | "archived";
export type EditorialRuleType = "format" | "content";
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

export interface EditorialRuleScope {
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

export interface EditorialRuleSetRecord {
  id: string;
  template_family_id: string;
  journal_template_id?: string;
  module: TemplateModule;
  version_no: number;
  status: EditorialRuleSetStatus;
}

export interface EditorialRuleRecord {
  id: string;
  rule_set_id: string;
  order_no: number;
  rule_object: string;
  rule_type: EditorialRuleType;
  execution_mode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  selector: Record<string, unknown>;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  authoring_payload: Record<string, unknown>;
  evidence_level?: EditorialRuleEvidenceLevel;
  confidence_policy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled: boolean;
  example_before?: string;
  example_after?: string;
  manual_review_reason_template?: string;
}
