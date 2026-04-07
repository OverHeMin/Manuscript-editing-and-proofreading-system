import type { AuthRole } from "../auth/roles.ts";
import type { TemplateModule } from "../templates/types.ts";

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

export interface EditorialRuleSetViewModel {
  id: string;
  template_family_id: string;
  module: TemplateModule;
  version_no: number;
  status: EditorialRuleSetStatus;
}

export interface EditorialRuleViewModel {
  id: string;
  rule_set_id: string;
  order_no: number;
  rule_type: EditorialRuleType;
  execution_mode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  confidence_policy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled: boolean;
  example_before?: string;
  example_after?: string;
  manual_review_reason_template?: string;
}

export interface CreateEditorialRuleSetInput {
  actorRole: AuthRole;
  templateFamilyId: string;
  module: TemplateModule;
}

export interface CreateEditorialRuleInput {
  actorRole: AuthRole;
  orderNo: number;
  ruleType: EditorialRuleType;
  executionMode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  confidencePolicy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled?: boolean;
  exampleBefore?: string;
  exampleAfter?: string;
  manualReviewReasonTemplate?: string;
}
