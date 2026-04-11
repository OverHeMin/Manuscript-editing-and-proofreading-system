import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "../editorial-rules/editorial-rule-record.ts";
import type {
  KnowledgeBindingRuleRecord,
  ModuleExecutionProfileRecord,
} from "../execution-governance/execution-governance-record.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type {
  ModelSelectionWarning,
  ResolvedAiProviderConnectionSummary,
} from "../ai-gateway/ai-gateway-service.ts";
import type {
  ManualReviewPolicyRecord,
} from "../manual-review-policies/manual-review-policy-record.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import type {
  ModelRoutingPolicyVersionRecord,
} from "../model-routing-governance/model-routing-governance-record.ts";
import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "../prompt-skill-registry/prompt-skill-record.ts";
import type {
  RetrievalPresetRecord,
} from "../retrieval-presets/retrieval-preset-record.ts";
import type { RuntimeBindingRecord } from "../runtime-bindings/runtime-binding-record.ts";
import type { RuntimeBindingReadinessReport } from "../runtime-bindings/runtime-binding-readiness.ts";
import type { ModuleTemplateRecord } from "../templates/template-record.ts";

export type ExecutionResolutionModelSource =
  | "template_family_policy"
  | "module_policy"
  | "legacy_template_override"
  | "legacy_module_default"
  | "legacy_system_default";

export interface RuntimeBindingReadinessObservationRecord {
  observation_status: "reported" | "failed_open";
  report?: RuntimeBindingReadinessReport;
  error?: string;
}

export interface ProviderReadinessIssueRecord {
  code:
    | "legacy_unbound"
    | "connection_missing"
    | "connection_disabled"
    | "credential_missing"
    | "connection_test_failed"
    | "connection_test_unknown";
  message: string;
}

export interface ProviderReadinessRecord {
  status: "ok" | "warning";
  issues: ProviderReadinessIssueRecord[];
}

export interface ResolvedExecutionBundleRecord {
  profile: ModuleExecutionProfileRecord;
  runtime_binding?: RuntimeBindingRecord;
  model_routing_policy_version?: ModelRoutingPolicyVersionRecord;
  retrieval_preset?: RetrievalPresetRecord;
  manual_review_policy?: ManualReviewPolicyRecord;
  module_template: ModuleTemplateRecord;
  rule_set: EditorialRuleSetRecord;
  rules: EditorialRuleRecord[];
  prompt_template: PromptTemplateRecord;
  skill_packages: SkillPackageRecord[];
  resolved_model: ModelRegistryRecord;
  model_source: ExecutionResolutionModelSource;
  resolved_connection?: ResolvedAiProviderConnectionSummary;
  provider_readiness: ProviderReadinessRecord;
  fallback_chain: ModelRegistryRecord[];
  warnings: ModelSelectionWarning[];
  knowledge_binding_rules: KnowledgeBindingRuleRecord[];
  knowledge_items: KnowledgeRecord[];
  runtime_binding_readiness: RuntimeBindingReadinessObservationRecord;
}
