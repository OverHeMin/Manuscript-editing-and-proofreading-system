import type { AuthRole } from "../auth/roles.ts";
import type {
  EditorialRuleSetViewModel,
  EditorialRuleViewModel,
} from "../editorial-rules/types.ts";
import type { KnowledgeItemViewModel } from "../knowledge/types.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type { ModelRegistryEntryViewModel } from "../model-registry/types.ts";
import type {
  PromptTemplateViewModel,
  SkillPackageViewModel,
} from "../prompt-skill-registry/types.ts";
import type { ModuleTemplateViewModel, TemplateModule } from "../templates/types.ts";

export type ExecutionProfileStatus = "draft" | "active" | "archived";
export type KnowledgeBindingMode = "profile_only" | "profile_plus_dynamic";
export type KnowledgeBindingRuleStatus = "draft" | "active" | "archived";
export type ExecutionResolutionModelSource =
  | "template_family_policy"
  | "module_policy"
  | "legacy_template_override"
  | "legacy_module_default"
  | "legacy_system_default"
  | "task_override";
export type KnowledgeBindingPurpose =
  | "required"
  | "recommended"
  | "risk_guardrail"
  | "section_specific";
export type ExecutionPreviewWarningCode =
  | "legacy_unbound"
  | "connection_missing"
  | "connection_disabled"
  | "credential_missing";
export type ProviderReadinessIssueCode =
  | "legacy_unbound"
  | "connection_missing"
  | "connection_disabled"
  | "credential_missing"
  | "connection_test_failed"
  | "connection_test_unknown";

export interface ModuleExecutionProfileViewModel {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  module_template_id: string;
  rule_set_id?: string;
  prompt_template_id: string;
  skill_package_ids: string[];
  knowledge_binding_mode: KnowledgeBindingMode;
  status: ExecutionProfileStatus;
  version: number;
  notes?: string;
}

export interface KnowledgeBindingRuleViewModel {
  id: string;
  knowledge_item_id: string;
  module: TemplateModule;
  manuscript_types: ManuscriptType[] | "any";
  template_family_ids?: string[];
  module_template_ids?: string[];
  sections?: string[];
  risk_tags?: string[];
  priority: number;
  binding_purpose: KnowledgeBindingPurpose;
  status: KnowledgeBindingRuleStatus;
}

export interface CreateExecutionProfileInput {
  actorRole: AuthRole;
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  moduleTemplateId: string;
  ruleSetId?: string;
  promptTemplateId: string;
  skillPackageIds: string[];
  knowledgeBindingMode: KnowledgeBindingMode;
  notes?: string;
}

export interface PublishExecutionProfileInput {
  actorRole: AuthRole;
  profileId: string;
}

export interface ArchiveExecutionProfileInput {
  actorRole: AuthRole;
  profileId: string;
}

export interface CreateKnowledgeBindingRuleInput {
  actorRole: AuthRole;
  knowledgeItemId: string;
  module: TemplateModule;
  manuscriptTypes: ManuscriptType[] | "any";
  templateFamilyIds?: string[];
  moduleTemplateIds?: string[];
  sections?: string[];
  riskTags?: string[];
  priority?: number;
  bindingPurpose: KnowledgeBindingPurpose;
}

export interface ActivateKnowledgeBindingRuleInput {
  actorRole: AuthRole;
  ruleId: string;
}

export interface ResolveExecutionBundlePreviewInput {
  module: TemplateModule;
  manuscriptType: ManuscriptType;
  templateFamilyId: string;
  executionProfileId?: string;
  runtimeBindingId?: string;
  modelRoutingPolicyVersionId?: string;
  retrievalPresetId?: string;
  manualReviewPolicyId?: string;
}

export interface RetrievalPresetViewModel {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  name: string;
  top_k: number;
  section_filters?: string[];
  risk_tag_filters?: string[];
  rerank_enabled: boolean;
  citation_required: boolean;
  min_retrieval_score?: number;
  status: "draft" | "active" | "archived";
  version: number;
}

export interface ManualReviewPolicyViewModel {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  name: string;
  min_confidence_threshold: number;
  high_risk_force_review: boolean;
  conflict_force_review: boolean;
  insufficient_knowledge_force_review: boolean;
  module_blocklist_rules?: string[];
  status: "draft" | "active" | "archived";
  version: number;
}

export interface ResolvedAiProviderConnectionSummaryViewModel {
  id: string;
  name: string;
  provider_kind: string;
  compatibility_mode: string;
  enabled: boolean;
  last_test_status: "unknown" | "passed" | "failed";
  credential_present: boolean;
}

export interface ProviderReadinessIssueViewModel {
  code: ProviderReadinessIssueCode;
  message: string;
}

export interface ProviderReadinessViewModel {
  status: "ok" | "warning";
  issues: ProviderReadinessIssueViewModel[];
}

export interface ExecutionPreviewWarningViewModel {
  code: ExecutionPreviewWarningCode;
  message: string;
}

export interface ResolvedExecutionBundleViewModel {
  profile: ModuleExecutionProfileViewModel;
  module_template: ModuleTemplateViewModel;
  rule_set: EditorialRuleSetViewModel;
  rules: EditorialRuleViewModel[];
  prompt_template: PromptTemplateViewModel;
  skill_packages: SkillPackageViewModel[];
  resolved_model: ModelRegistryEntryViewModel;
  model_source: ExecutionResolutionModelSource;
  runtime_binding?: {
    id: string;
    runtime_id: string;
    sandbox_profile_id: string;
    agent_profile_id: string;
    tool_permission_policy_id: string;
    prompt_template_id: string;
    skill_package_ids: string[];
    execution_profile_id?: string;
    evaluation_suite_ids: string[];
    release_check_profile_id?: string;
    status: "draft" | "active" | "archived";
    version: number;
  };
  model_routing_policy_version?: {
    id: string;
    policy_scope_id: string;
    scope_kind: "module" | "template_family";
    scope_value: string;
    version_no: number;
    primary_model_id: string;
    fallback_model_ids: string[];
    status:
      | "draft"
      | "pending_review"
      | "approved"
      | "active"
      | "rejected"
      | "rolled_back"
      | "superseded";
    created_at: string;
    updated_at: string;
  };
  retrieval_preset?: RetrievalPresetViewModel;
  manual_review_policy?: ManualReviewPolicyViewModel;
  resolved_connection?: ResolvedAiProviderConnectionSummaryViewModel;
  provider_readiness: ProviderReadinessViewModel;
  fallback_chain: ModelRegistryEntryViewModel[];
  warnings: ExecutionPreviewWarningViewModel[];
  knowledge_binding_rules: KnowledgeBindingRuleViewModel[];
  knowledge_items: KnowledgeItemViewModel[];
}

export function formatExecutionResolutionModelSourceLabel(
  source: ExecutionResolutionModelSource,
): string {
  switch (source) {
    case "template_family_policy":
      return "Template Family Policy";
    case "module_policy":
      return "Module Policy";
    case "legacy_template_override":
      return "Legacy Template Override";
    case "legacy_module_default":
      return "Legacy Module Default";
    case "legacy_system_default":
      return "Legacy System Default";
    case "task_override":
      return "Task Override";
  }
}
