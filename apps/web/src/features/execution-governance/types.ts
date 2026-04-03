import type { AuthRole } from "../auth/roles.ts";
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

export interface ModuleExecutionProfileViewModel {
  id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  template_family_id: string;
  module_template_id: string;
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
}

export interface ResolvedExecutionBundleViewModel {
  profile: ModuleExecutionProfileViewModel;
  module_template: ModuleTemplateViewModel;
  prompt_template: PromptTemplateViewModel;
  skill_packages: SkillPackageViewModel[];
  resolved_model: ModelRegistryEntryViewModel;
  model_source: ExecutionResolutionModelSource;
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
