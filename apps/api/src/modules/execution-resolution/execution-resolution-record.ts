import type {
  KnowledgeBindingRuleRecord,
  ModuleExecutionProfileRecord,
} from "../execution-governance/execution-governance-record.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "../prompt-skill-registry/prompt-skill-record.ts";
import type { ModuleTemplateRecord } from "../templates/template-record.ts";

export type ExecutionResolutionModelSource =
  | "template_family_policy"
  | "module_policy"
  | "legacy_template_override"
  | "legacy_module_default"
  | "legacy_system_default";

export interface ResolvedExecutionBundleRecord {
  profile: ModuleExecutionProfileRecord;
  module_template: ModuleTemplateRecord;
  prompt_template: PromptTemplateRecord;
  skill_packages: SkillPackageRecord[];
  resolved_model: ModelRegistryRecord;
  model_source: ExecutionResolutionModelSource;
  knowledge_binding_rules: KnowledgeBindingRuleRecord[];
  knowledge_items: KnowledgeRecord[];
}
