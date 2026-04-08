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
export type EditorialRuleEvidenceLevel =
  | "low"
  | "medium"
  | "high"
  | "expert_opinion"
  | "unknown";

export interface EditorialRuleScope {
  [key: string]: unknown;
}

export interface EditorialRuleSelector {
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

export interface EditorialRuleExplanationPayload {
  rationale?: string;
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
  projection_kind?: string;
  summary?: string;
  standard_example?: string;
  incorrect_example?: string;
}

export interface EditorialRuleSetViewModel {
  id: string;
  template_family_id: string;
  journal_template_id?: string;
  module: TemplateModule;
  version_no: number;
  status: EditorialRuleSetStatus;
}

export interface EditorialRuleViewModel {
  id: string;
  rule_set_id: string;
  order_no: number;
  rule_object: string;
  rule_type: EditorialRuleType;
  execution_mode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  selector: EditorialRuleSelector;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
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

export interface CreateEditorialRuleSetInput {
  actorRole: AuthRole;
  templateFamilyId: string;
  journalTemplateId?: string;
  module: TemplateModule;
}

export interface CreateEditorialRuleInput {
  actorRole: AuthRole;
  orderNo: number;
  ruleObject?: string;
  ruleType: EditorialRuleType;
  executionMode: EditorialRuleExecutionMode;
  scope: EditorialRuleScope;
  selector?: EditorialRuleSelector;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  authoringPayload?: Record<string, unknown>;
  explanationPayload?: EditorialRuleExplanationPayload;
  linkagePayload?: EditorialRuleLinkagePayload;
  projectionPayload?: EditorialRuleProjectionPayload;
  evidenceLevel?: EditorialRuleEvidenceLevel;
  confidencePolicy: EditorialRuleConfidencePolicy;
  severity: EditorialRuleSeverity;
  enabled?: boolean;
  exampleBefore?: string;
  exampleAfter?: string;
  manualReviewReasonTemplate?: string;
}
