import type { AgentProfileRepository } from "../modules/agent-profiles/agent-profile-repository.ts";
import type { AgentRuntimeRepository } from "../modules/agent-runtime/agent-runtime-repository.ts";
import type { EditorialRuleRepository } from "../modules/editorial-rules/editorial-rule-repository.ts";
import type { ExecutionGovernanceRepository } from "../modules/execution-governance/execution-governance-repository.ts";
import type {
  ModelRegistryRepository,
  ModelRoutingPolicyRepository,
} from "../modules/model-registry/model-registry-repository.ts";
import type { ManualReviewPolicyRepository } from "../modules/manual-review-policies/manual-review-policy-repository.ts";
import type { PromptSkillRegistryRepository } from "../modules/prompt-skill-registry/prompt-skill-repository.ts";
import type { RetrievalPresetRepository } from "../modules/retrieval-presets/retrieval-preset-repository.ts";
import type { RuntimeBindingRepository } from "../modules/runtime-bindings/runtime-binding-repository.ts";
import type { SandboxProfileRepository } from "../modules/sandbox-profiles/sandbox-profile-repository.ts";
import type {
  ModuleTemplateRepository,
  TemplateFamilyRepository,
} from "../modules/templates/template-repository.ts";
import type { TemplateModule } from "../modules/templates/template-record.ts";
import type { ToolPermissionPolicyRepository } from "../modules/tool-permission-policies/tool-permission-policy-repository.ts";

interface PersistentWorkbenchReviewBaselineDeps {
  templateFamilyRepository: TemplateFamilyRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  editorialRuleRepository: EditorialRuleRepository;
  executionGovernanceRepository: ExecutionGovernanceRepository;
  sandboxProfileRepository: SandboxProfileRepository;
  agentRuntimeRepository: AgentRuntimeRepository;
  agentProfileRepository: AgentProfileRepository;
  runtimeBindingRepository: RuntimeBindingRepository;
  toolPermissionPolicyRepository: ToolPermissionPolicyRepository;
  modelRegistryRepository: ModelRegistryRepository;
  modelRoutingPolicyRepository: ModelRoutingPolicyRepository;
  retrievalPresetRepository: RetrievalPresetRepository;
  manualReviewPolicyRepository: ManualReviewPolicyRepository;
}

const REVIEW_BASELINE_FAMILY = {
  id: baselineUuid("00", "00"),
  manuscript_type: "review" as const,
  name: "Review 基础模板族",
  status: "active" as const,
};

const REVIEW_BASELINE_MODULES: ReadonlyArray<{
  module: TemplateModule;
  moduleTemplateId: string;
  promptTemplateId: string;
  skillPackageId: string;
  ruleSetId: string;
  executionProfileId: string;
  sandboxProfileId: string;
  runtimeId: string;
  agentProfileId: string;
  toolPermissionPolicyId: string;
  runtimeBindingId: string;
  modelId: string;
  retrievalPresetId: string;
  manualReviewPolicyId: string;
  promptName: string;
  skillName: string;
  runtimeName: string;
  sandboxName: string;
  agentProfileName: string;
  toolPermissionPolicyName: string;
  modelName: string;
  retrievalName: string;
  manualReviewName: string;
  sectionFilters: string[];
  riskTagFilters: string[];
  citationRequired: boolean;
  minRetrievalScore: number;
  minConfidenceThreshold: number;
  moduleBlocklistRules: string[];
}> = [
  {
    module: "screening",
    moduleTemplateId: baselineUuid("11", "01"),
    promptTemplateId: baselineUuid("11", "02"),
    skillPackageId: baselineUuid("11", "03"),
    ruleSetId: baselineUuid("11", "04"),
    executionProfileId: baselineUuid("11", "05"),
    sandboxProfileId: baselineUuid("11", "06"),
    runtimeId: baselineUuid("11", "07"),
    agentProfileId: baselineUuid("11", "08"),
    toolPermissionPolicyId: baselineUuid("11", "09"),
    runtimeBindingId: baselineUuid("11", "10"),
    modelId: baselineUuid("11", "11"),
    retrievalPresetId: baselineUuid("11", "12"),
    manualReviewPolicyId: baselineUuid("11", "13"),
    promptName: "persistent_review_screening_mainline",
    skillName: "persistent_review_screening_skills",
    runtimeName: "Persistent Review Screening Runtime",
    sandboxName: "Persistent Review Screening Sandbox",
    agentProfileName: "Persistent Review Screening Executor",
    toolPermissionPolicyName: "Persistent Review Screening Policy",
    modelName: "persistent-review-screening-model",
    retrievalName: "Persistent Review Screening Retrieval",
    manualReviewName: "Persistent Review Screening Policy",
    sectionFilters: ["abstract", "introduction"],
    riskTagFilters: ["triage"],
    citationRequired: false,
    minRetrievalScore: 0.45,
    minConfidenceThreshold: 0.72,
    moduleBlocklistRules: ["medical-safety-escalation"],
  },
  {
    module: "editing",
    moduleTemplateId: baselineUuid("22", "01"),
    promptTemplateId: baselineUuid("22", "02"),
    skillPackageId: baselineUuid("22", "03"),
    ruleSetId: baselineUuid("22", "04"),
    executionProfileId: baselineUuid("22", "05"),
    sandboxProfileId: baselineUuid("22", "06"),
    runtimeId: baselineUuid("22", "07"),
    agentProfileId: baselineUuid("22", "08"),
    toolPermissionPolicyId: baselineUuid("22", "09"),
    runtimeBindingId: baselineUuid("22", "10"),
    modelId: baselineUuid("22", "11"),
    retrievalPresetId: baselineUuid("22", "12"),
    manualReviewPolicyId: baselineUuid("22", "13"),
    promptName: "persistent_review_editing_mainline",
    skillName: "persistent_review_editing_skills",
    runtimeName: "Persistent Review Editing Runtime",
    sandboxName: "Persistent Review Editing Sandbox",
    agentProfileName: "Persistent Review Editing Executor",
    toolPermissionPolicyName: "Persistent Review Editing Policy",
    modelName: "persistent-review-editing-model",
    retrievalName: "Persistent Review Editing Retrieval",
    manualReviewName: "Persistent Review Editing Policy",
    sectionFilters: ["methods", "discussion"],
    riskTagFilters: ["grounding"],
    citationRequired: true,
    minRetrievalScore: 0.55,
    minConfidenceThreshold: 0.8,
    moduleBlocklistRules: ["unsupported-claim"],
  },
  {
    module: "proofreading",
    moduleTemplateId: baselineUuid("33", "01"),
    promptTemplateId: baselineUuid("33", "02"),
    skillPackageId: baselineUuid("33", "03"),
    ruleSetId: baselineUuid("33", "04"),
    executionProfileId: baselineUuid("33", "05"),
    sandboxProfileId: baselineUuid("33", "06"),
    runtimeId: baselineUuid("33", "07"),
    agentProfileId: baselineUuid("33", "08"),
    toolPermissionPolicyId: baselineUuid("33", "09"),
    runtimeBindingId: baselineUuid("33", "10"),
    modelId: baselineUuid("33", "11"),
    retrievalPresetId: baselineUuid("33", "12"),
    manualReviewPolicyId: baselineUuid("33", "13"),
    promptName: "persistent_review_proofreading_mainline",
    skillName: "persistent_review_proofreading_skills",
    runtimeName: "Persistent Review Proofreading Runtime",
    sandboxName: "Persistent Review Proofreading Sandbox",
    agentProfileName: "Persistent Review Proofreading Executor",
    toolPermissionPolicyName: "Persistent Review Proofreading Policy",
    modelName: "persistent-review-proofreading-model",
    retrievalName: "Persistent Review Proofreading Retrieval",
    manualReviewName: "Persistent Review Proofreading Policy",
    sectionFilters: ["results", "references"],
    riskTagFilters: ["consistency"],
    citationRequired: false,
    minRetrievalScore: 0.42,
    minConfidenceThreshold: 0.7,
    moduleBlocklistRules: ["meaning-change"],
  },
];

export async function ensurePersistentWorkbenchReviewBaseline(
  deps: PersistentWorkbenchReviewBaselineDeps,
): Promise<void> {
  const templateFamilies = await deps.templateFamilyRepository.list();
  const activeReviewFamily = templateFamilies.find(
    (family) =>
      family.manuscript_type === "review" && family.status === "active",
  );
  const hasDraftReviewFamily = templateFamilies.some(
    (family) =>
      family.manuscript_type === "review" && family.status === "draft",
  );

  if (
    activeReviewFamily &&
    activeReviewFamily.id !== REVIEW_BASELINE_FAMILY.id
  ) {
    return;
  }

  if (!activeReviewFamily && !hasDraftReviewFamily) {
    return;
  }

  if (!activeReviewFamily) {
    await deps.templateFamilyRepository.save(REVIEW_BASELINE_FAMILY);
  }

  for (const config of REVIEW_BASELINE_MODULES) {
    await deps.moduleTemplateRepository.save({
      id: config.moduleTemplateId,
      template_family_id: REVIEW_BASELINE_FAMILY.id,
      module: config.module,
      manuscript_type: "review",
      version_no: 1,
      status: "published",
      prompt: `${config.module} instructions for governed review manuscripts.`,
    });
    await deps.promptSkillRegistryRepository.savePromptTemplate({
      id: config.promptTemplateId,
      name: config.promptName,
      version: "1.0.0",
      status: "published",
      module: config.module,
      manuscript_types: ["review"],
    });
    await deps.promptSkillRegistryRepository.saveSkillPackage({
      id: config.skillPackageId,
      name: config.skillName,
      version: "1.0.0",
      scope: "admin_only",
      status: "published",
      applies_to_modules: [config.module],
    });
    await deps.editorialRuleRepository.saveRuleSet({
      id: config.ruleSetId,
      template_family_id: REVIEW_BASELINE_FAMILY.id,
      module: config.module,
      version_no: 1,
      status: "published",
    });
    await deps.executionGovernanceRepository.saveProfile({
      id: config.executionProfileId,
      module: config.module,
      manuscript_type: "review",
      template_family_id: REVIEW_BASELINE_FAMILY.id,
      module_template_id: config.moduleTemplateId,
      rule_set_id: config.ruleSetId,
      prompt_template_id: config.promptTemplateId,
      skill_package_ids: [config.skillPackageId],
      knowledge_binding_mode: "profile_plus_dynamic",
      status: "active",
      version: 1,
    });
    await deps.sandboxProfileRepository.save({
      id: config.sandboxProfileId,
      name: config.sandboxName,
      status: "active",
      sandbox_mode: "workspace_write",
      network_access: false,
      approval_required: true,
      allowed_tool_ids: [],
      admin_only: true,
    });
    await deps.agentRuntimeRepository.save({
      id: config.runtimeId,
      name: config.runtimeName,
      adapter: "deepagents",
      status: "active",
      sandbox_profile_id: config.sandboxProfileId,
      allowed_modules: [config.module],
      runtime_slot: config.module,
      admin_only: true,
    });
    await deps.agentProfileRepository.save({
      id: config.agentProfileId,
      name: config.agentProfileName,
      role_key: "subagent",
      status: "published",
      module_scope: [config.module],
      manuscript_types: ["review"],
      admin_only: true,
    });
    await deps.toolPermissionPolicyRepository.save({
      id: config.toolPermissionPolicyId,
      name: config.toolPermissionPolicyName,
      status: "active",
      default_mode: "read",
      allowed_tool_ids: [],
      high_risk_tool_ids: [],
      write_requires_confirmation: false,
      admin_only: true,
    });
    await deps.modelRegistryRepository.save({
      id: config.modelId,
      provider: "openai",
      model_name: config.modelName,
      model_version: "2026-04-15",
      allowed_modules: [config.module],
      is_prod_allowed: true,
    });
    await deps.retrievalPresetRepository.save({
      id: config.retrievalPresetId,
      module: config.module,
      manuscript_type: "review",
      template_family_id: REVIEW_BASELINE_FAMILY.id,
      name: config.retrievalName,
      top_k: 4,
      section_filters: config.sectionFilters,
      risk_tag_filters: config.riskTagFilters,
      rerank_enabled: true,
      citation_required: config.citationRequired,
      min_retrieval_score: config.minRetrievalScore,
      status: "active",
      version: 1,
    });
    await deps.manualReviewPolicyRepository.save({
      id: config.manualReviewPolicyId,
      module: config.module,
      manuscript_type: "review",
      template_family_id: REVIEW_BASELINE_FAMILY.id,
      name: config.manualReviewName,
      min_confidence_threshold: config.minConfidenceThreshold,
      high_risk_force_review: true,
      conflict_force_review: true,
      insufficient_knowledge_force_review: true,
      module_blocklist_rules: config.moduleBlocklistRules,
      status: "active",
      version: 1,
    });
    await deps.runtimeBindingRepository.save({
      id: config.runtimeBindingId,
      module: config.module,
      manuscript_type: "review",
      template_family_id: REVIEW_BASELINE_FAMILY.id,
      runtime_id: config.runtimeId,
      sandbox_profile_id: config.sandboxProfileId,
      agent_profile_id: config.agentProfileId,
      tool_permission_policy_id: config.toolPermissionPolicyId,
      prompt_template_id: config.promptTemplateId,
      skill_package_ids: [config.skillPackageId],
      execution_profile_id: config.executionProfileId,
      verification_check_profile_ids: [],
      evaluation_suite_ids: [],
      status: "active",
      version: 1,
    });
  }

  const modelRoutingPolicy = await deps.modelRoutingPolicyRepository.get();
  await deps.modelRoutingPolicyRepository.save({
    ...modelRoutingPolicy,
    module_defaults: {
      ...modelRoutingPolicy.module_defaults,
    },
    template_overrides: {
      ...modelRoutingPolicy.template_overrides,
      ...Object.fromEntries(
        REVIEW_BASELINE_MODULES.map((config) => [
          config.moduleTemplateId,
          config.modelId,
        ]),
      ),
    },
  });
}

function baselineUuid(moduleCode: string, assetCode: string): string {
  return `64646464-${moduleCode}${assetCode}-4000-8000-${moduleCode}${assetCode}00000000`;
}
