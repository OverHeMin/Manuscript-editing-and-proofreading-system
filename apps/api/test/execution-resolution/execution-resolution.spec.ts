import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import {
  InMemoryEditorialRuleRepository,
} from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import {
  InMemoryModelRoutingGovernanceRepository,
} from "../../src/modules/model-routing-governance/in-memory-model-routing-governance-repository.ts";
import { ModelRoutingGovernanceService } from "../../src/modules/model-routing-governance/model-routing-governance-service.ts";
import { InMemoryAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/in-memory-ai-provider-connection-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import {
  ExecutionResolutionService,
  ExecutionResolutionModelNotFoundError,
} from "../../src/modules/execution-resolution/index.ts";
import type { RuntimeBindingReadinessReport } from "../../src/modules/runtime-bindings/index.ts";
import { InMemoryRuntimeBindingRepository } from "../../src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts";
import { RuntimeBindingService } from "../../src/modules/runtime-bindings/runtime-binding-service.ts";
import { InMemorySandboxProfileRepository } from "../../src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts";
import { InMemoryAgentProfileRepository } from "../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { InMemoryRetrievalPresetRepository } from "../../src/modules/retrieval-presets/in-memory-retrieval-preset-repository.ts";
import { RetrievalPresetService } from "../../src/modules/retrieval-presets/retrieval-preset-service.ts";
import { InMemoryManualReviewPolicyRepository } from "../../src/modules/manual-review-policies/in-memory-manual-review-policy-repository.ts";
import { ManualReviewPolicyService } from "../../src/modules/manual-review-policies/manual-review-policy-service.ts";

function createExecutionResolutionHarness(input?: {
  runtimeBindingReadinessService?: {
    getActiveBindingReadinessForScope: () => Promise<RuntimeBindingReadinessReport>;
  };
}) {
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const modelRegistryRepository = new InMemoryModelRegistryRepository();
  const modelRoutingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const aiProviderConnectionRepository = new InMemoryAiProviderConnectionRepository();
  const modelRoutingGovernanceRepository =
    new InMemoryModelRoutingGovernanceRepository();
  const runtimeBindingRepository = new InMemoryRuntimeBindingRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const retrievalPresetRepository = new InMemoryRetrievalPresetRepository();
  const manualReviewPolicyRepository = new InMemoryManualReviewPolicyRepository();
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    createId: (() => {
      const ids = ["profile-1", "rule-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected execution governance test ids.");
        return value;
      };
    })(),
  });
  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository: modelRoutingGovernanceRepository,
    modelRegistryRepository,
    createId: (() => {
      const ids = [
        "governance-id-1",
        "governance-id-2",
        "governance-id-3",
        "governance-id-4",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected model routing governance test ids.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-28T12:00:00.000Z"),
  });
  const runtimeBindingService = new RuntimeBindingService({
    repository: runtimeBindingRepository,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    verificationOpsRepository,
  });
  const retrievalPresetService = new RetrievalPresetService({
    repository: retrievalPresetRepository,
  });
  const manualReviewPolicyService = new ManualReviewPolicyService({
    repository: manualReviewPolicyRepository,
  });
  const executionResolutionService = new ExecutionResolutionService({
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    aiProviderConnectionRepository,
    modelRoutingGovernanceService,
    runtimeBindingReadinessService: input?.runtimeBindingReadinessService,
    runtimeBindingService,
    retrievalPresetService,
    manualReviewPolicyService,
  });

  return {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    aiProviderConnectionRepository,
    modelRoutingGovernanceRepository,
    runtimeBindingRepository,
    retrievalPresetRepository,
    manualReviewPolicyRepository,
    executionResolutionService,
  };
}

async function savePublishedRuleSet(input: {
  repository: InMemoryEditorialRuleRepository;
  id: string;
  module: "screening" | "editing" | "proofreading";
}) {
  await input.repository.saveRuleSet({
    id: input.id,
    template_family_id: "family-1",
    module: input.module,
    version_no: 1,
    status: "published",
  });
}

async function saveActivePolicy(input: {
  repository: InMemoryModelRoutingGovernanceRepository;
  policyId: string;
  versionId: string;
  scopeKind: "module" | "template_family";
  scopeValue: string;
  primaryModelId: string;
  fallbackModelIds?: string[];
}) {
  await input.repository.saveScope({
    id: input.policyId,
    scope_kind: input.scopeKind,
    scope_value: input.scopeValue,
    active_version_id: input.versionId,
    created_at: "2026-03-28T12:00:00.000Z",
    updated_at: "2026-03-28T12:00:00.000Z",
  });
  await input.repository.saveVersion({
    id: input.versionId,
    policy_scope_id: input.policyId,
    scope_kind: input.scopeKind,
    scope_value: input.scopeValue,
    version_no: 1,
    primary_model_id: input.primaryModelId,
    fallback_model_ids: [...(input.fallbackModelIds ?? [])],
    evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
    status: "active",
    created_at: "2026-03-28T12:00:00.000Z",
    updated_at: "2026-03-28T12:00:00.000Z",
  });
}

test("execution resolution expands the active profile into a concrete runtime bundle", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 3,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.1.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await knowledgeRepository.save({
    id: "knowledge-1",
    title: "Editing rule",
    canonical_text: "Approved editing knowledge item.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
  });
  await modelRegistryRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-03-01",
    allowed_modules: ["editing", "proofreading"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-1",
    },
    template_overrides: {},
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-1",
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });

  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: ["skill-editing-1"],
    knowledgeBindingMode: "profile_plus_dynamic",
  });
  await executionGovernanceService.createKnowledgeBindingRule("admin", {
    knowledgeItemId: "knowledge-1",
    module: "editing",
    manuscriptTypes: ["clinical_study"],
    templateFamilyIds: ["family-1"],
    moduleTemplateIds: ["template-editing-1"],
    priority: 50,
    bindingPurpose: "required",
  });
  await executionGovernanceService.activateKnowledgeBindingRule("rule-1", "admin");
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");

  const resolved = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.equal(resolved.profile.id, "profile-1");
  assert.equal(resolved.module_template.id, "template-editing-1");
  assert.equal(resolved.prompt_template.id, "prompt-editing-1");
  assert.deepEqual(
    resolved.skill_packages.map((record) => record.id),
    ["skill-editing-1"],
  );
  assert.equal(resolved.resolved_model.id, "model-editing-1");
  assert.equal(resolved.model_source, "template_family_policy");
  assert.deepEqual(
    resolved.knowledge_binding_rules.map((record) => record.id),
    ["rule-1"],
  );
  assert.deepEqual(
    resolved.knowledge_items.map((record) => record.id),
    ["knowledge-1"],
  );
  assert.equal(resolved.runtime_binding_readiness.observation_status, "failed_open");
  assert.equal(
    resolved.runtime_binding_readiness.error,
    "Runtime binding readiness service is unavailable.",
  );
  assert.equal(resolved.runtime_binding_readiness.report, undefined);
});

test("execution resolution summarizes the operator-facing governed context across the three manuscript desks", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
    runtimeBindingRepository,
    retrievalPresetRepository,
    manualReviewPolicyRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });
  await modelRegistryRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-04-01",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-1",
    },
    template_overrides: {},
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-editing-1",
    versionId: "policy-version-editing-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-1",
  });

  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");

  await runtimeBindingRepository.save({
    id: "binding-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    runtime_id: "runtime-editing-1",
    sandbox_profile_id: "sandbox-editing-1",
    agent_profile_id: "agent-editing-1",
    tool_permission_policy_id: "tool-policy-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: [],
    execution_profile_id: createdProfile.id,
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    release_check_profile_id: undefined,
    status: "active",
    version: 1,
  });
  await retrievalPresetRepository.save({
    id: "retrieval-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    name: "Editing retrieval",
    top_k: 6,
    rerank_enabled: true,
    citation_required: true,
    status: "active",
    version: 1,
  });
  await manualReviewPolicyRepository.save({
    id: "manual-review-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    name: "Editing review policy",
    min_confidence_threshold: 0.8,
    high_risk_force_review: true,
    conflict_force_review: true,
    insufficient_knowledge_force_review: true,
    status: "active",
    version: 1,
  });

  const summary = await executionResolutionService.resolveOperatorSummary({
    manuscriptType: "clinical_study",
    baseTemplateFamilyId: "family-1",
  });

  assert.equal(summary.observation_status, "reported");
  assert.equal(summary.base_template_family_id, "family-1");
  assert.equal(summary.journal_template_selection_state, "base_family_only");
  assert.deepEqual(
    summary.modules.map((module) => ({
      module: module.module,
      status: module.status,
    })),
    [
      {
        module: "screening",
        status: "not_configured",
      },
      {
        module: "editing",
        status: "resolved",
      },
      {
        module: "proofreading",
        status: "not_configured",
      },
    ],
  );
  assert.deepEqual(summary.modules.find((module) => module.module === "editing"), {
    module: "editing",
    status: "resolved",
    execution_profile_id: createdProfile.id,
    module_template_id: "template-editing-1",
    runtime_binding_id: "binding-editing-1",
    retrieval_preset_id: "retrieval-editing-1",
    manual_review_policy_id: "manual-review-editing-1",
    model_routing_policy_version_id: "policy-version-editing-1",
    resolved_model_id: "model-editing-1",
    model_source: "template_family_policy",
    provider_readiness_status: "warning",
    warning_codes: ["legacy_unbound"],
  });
});

test("execution resolution reads the approved revision when a bound asset has a newer draft revision", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 3,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.1.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await knowledgeRepository.saveAsset({
    id: "knowledge-asset-1",
    status: "active",
    current_revision_id: "knowledge-asset-1-revision-2",
    current_approved_revision_id: "knowledge-asset-1-revision-1",
    created_at: "2026-03-28T12:00:00.000Z",
    updated_at: "2026-03-28T12:05:00.000Z",
  });
  await knowledgeRepository.saveRevision({
    id: "knowledge-asset-1-revision-1",
    asset_id: "knowledge-asset-1",
    revision_no: 1,
    status: "approved",
    title: "Approved editing rule",
    canonical_text: "The approved revision should stay in the execution bundle.",
    knowledge_kind: "rule",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
    created_at: "2026-03-28T12:00:00.000Z",
    updated_at: "2026-03-28T12:00:00.000Z",
  });
  await knowledgeRepository.saveRevision({
    id: "knowledge-asset-1-revision-2",
    asset_id: "knowledge-asset-1",
    revision_no: 2,
    status: "draft",
    title: "Draft editing rule",
    canonical_text: "This draft must not replace the approved revision in runtime resolution.",
    knowledge_kind: "rule",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
    created_at: "2026-03-28T12:05:00.000Z",
    updated_at: "2026-03-28T12:05:00.000Z",
  });
  await modelRegistryRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-03-01",
    allowed_modules: ["editing", "proofreading"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-1",
    },
    template_overrides: {},
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-1",
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });

  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: ["skill-editing-1"],
    knowledgeBindingMode: "profile_plus_dynamic",
  });
  await executionGovernanceService.createKnowledgeBindingRule("admin", {
    knowledgeItemId: "knowledge-asset-1",
    module: "editing",
    manuscriptTypes: ["clinical_study"],
    templateFamilyIds: ["family-1"],
    moduleTemplateIds: ["template-editing-1"],
    priority: 50,
    bindingPurpose: "required",
  });
  await executionGovernanceService.activateKnowledgeBindingRule("rule-1", "admin");
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");

  const resolved = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.deepEqual(
    resolved.knowledge_items.map((record) => ({
      id: record.id,
      status: record.status,
      title: record.title,
    })),
    [
      {
        id: "knowledge-asset-1",
        status: "approved",
        title: "Approved editing rule",
      },
    ],
  );
});

test("execution resolution reports runtime binding readiness when observation succeeds", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
  } = createExecutionResolutionHarness();

  const expectedScope = {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  } as const;
  const readinessReport: RuntimeBindingReadinessReport = {
    status: "ready",
    scope: expectedScope,
    binding: {
      id: "binding-1",
      status: "active",
      version: 1,
      runtime_id: "runtime-1",
      sandbox_profile_id: "sandbox-1",
      agent_profile_id: "agent-profile-1",
      tool_permission_policy_id: "policy-1",
      prompt_template_id: "prompt-editing-1",
      skill_package_ids: ["skill-editing-1"],
      execution_profile_id: "profile-1",
      verification_check_profile_ids: [],
      evaluation_suite_ids: [],
      release_check_profile_id: undefined,
    },
    issues: [],
    execution_profile_alignment: {
      status: "aligned",
      binding_execution_profile_id: "profile-1",
      active_execution_profile_id: "profile-1",
    },
  };
  const executionResolutionService = new ExecutionResolutionService({
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceService: new ModelRoutingGovernanceService({
      repository: modelRoutingGovernanceRepository,
      modelRegistryRepository,
      createId: () => "unused-governance-id",
      now: () => new Date("2026-03-28T12:00:00.000Z"),
    }),
    runtimeBindingReadinessService: {
      async getActiveBindingReadinessForScope(scope) {
        assert.deepEqual(scope, expectedScope);
        return readinessReport;
      },
    },
  });

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 3,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.1.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await knowledgeRepository.save({
    id: "knowledge-1",
    title: "Editing rule",
    canonical_text: "Approved editing knowledge item.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
  });
  await modelRegistryRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-03-01",
    allowed_modules: ["editing", "proofreading"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-1",
    },
    template_overrides: {},
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-1",
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });

  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: ["skill-editing-1"],
    knowledgeBindingMode: "profile_plus_dynamic",
  });
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");

  const resolved = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.equal(resolved.runtime_binding_readiness.observation_status, "reported");
  assert.deepEqual(resolved.runtime_binding_readiness.report, readinessReport);
  assert.equal(resolved.runtime_binding_readiness.error, undefined);
});

test("execution resolution surfaces missing runtime binding readiness reports without failing resolve", async () => {
  const readinessReport: RuntimeBindingReadinessReport = {
    status: "missing",
    scope: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
    },
    issues: [
      {
        code: "missing_active_binding",
        message: "No active runtime binding exists for editing/clinical_study/family-1.",
      },
    ],
    execution_profile_alignment: {
      status: "missing_active_profile",
    },
  };
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
  } = createExecutionResolutionHarness();
  const executionResolutionService = new ExecutionResolutionService({
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceService: new ModelRoutingGovernanceService({
      repository: modelRoutingGovernanceRepository,
      modelRegistryRepository,
      createId: () => "unused-governance-id",
      now: () => new Date("2026-03-28T12:00:00.000Z"),
    }),
    runtimeBindingReadinessService: {
      async getActiveBindingReadinessForScope() {
        return readinessReport;
      },
    },
  });

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 3,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.1.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await modelRegistryRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-03-01",
    allowed_modules: ["editing", "proofreading"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-1",
    },
    template_overrides: {},
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-1",
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });
  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");

  const resolved = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.equal(resolved.runtime_binding_readiness.observation_status, "reported");
  assert.deepEqual(resolved.runtime_binding_readiness.report, readinessReport);
});

test("execution resolution fails open when runtime binding readiness observation throws unexpectedly", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
  } = createExecutionResolutionHarness();
  const executionResolutionService = new ExecutionResolutionService({
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceService: new ModelRoutingGovernanceService({
      repository: modelRoutingGovernanceRepository,
      modelRegistryRepository,
      createId: () => "unused-governance-id",
      now: () => new Date("2026-03-28T12:00:00.000Z"),
    }),
    runtimeBindingReadinessService: {
      async getActiveBindingReadinessForScope() {
        throw new Error("readiness observation exploded");
      },
    },
  });

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 3,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.1.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await modelRegistryRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-03-01",
    allowed_modules: ["editing", "proofreading"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-1",
    },
    template_overrides: {},
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-1",
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });
  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");

  const resolved = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.equal(resolved.profile.id, "profile-1");
  assert.equal(resolved.runtime_binding_readiness.observation_status, "failed_open");
  assert.equal(
    resolved.runtime_binding_readiness.error,
    "readiness observation exploded",
  );
  assert.equal(resolved.runtime_binding_readiness.report, undefined);
});

test("execution resolution fails when no compatible routed model exists", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-screening-1",
    module: "screening",
  });
  await executionGovernanceService.createProfile("admin", {
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-screening-1",
    ruleSetId: "rule-set-screening-1",
    promptTemplateId: "prompt-screening-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile("profile-1", "admin");

  await assert.rejects(
    () =>
      executionResolutionService.resolveExecutionBundle({
        module: "screening",
        manuscriptType: "clinical_study",
        templateFamilyId: "family-1",
      }),
    ExecutionResolutionModelNotFoundError,
  );
});

test("execution resolution falls back through legacy template override, module default, then system default when no active governed policy exists", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-screening-1",
    module: "screening",
  });
  await executionGovernanceService.createProfile("admin", {
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-screening-1",
    ruleSetId: "rule-set-screening-1",
    promptTemplateId: "prompt-screening-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile("profile-1", "admin");
  await modelRegistryRepository.save({
    id: "model-system-1",
    provider: "openai",
    model_name: "gpt-5-system",
    model_version: "2026-03-01",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  await modelRegistryRepository.save({
    id: "model-module-1",
    provider: "openai",
    model_name: "gpt-5-module",
    model_version: "2026-03-01",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  await modelRegistryRepository.save({
    id: "model-template-1",
    provider: "openai",
    model_name: "gpt-5-template",
    model_version: "2026-03-01",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });

  await modelRoutingPolicyRepository.save({
    system_default_model_id: "model-system-1",
    module_defaults: {
      screening: "model-module-1",
    },
    template_overrides: {
      "template-screening-1": "model-template-1",
    },
  });

  const templateResolved = await executionResolutionService.resolveExecutionBundle({
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  assert.equal(templateResolved.resolved_model.id, "model-template-1");
  assert.equal(templateResolved.model_source, "legacy_template_override");

  await modelRoutingPolicyRepository.save({
    system_default_model_id: "model-system-1",
    module_defaults: {
      screening: "model-module-1",
    },
    template_overrides: {},
  });

  const moduleResolved = await executionResolutionService.resolveExecutionBundle({
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  assert.equal(moduleResolved.resolved_model.id, "model-module-1");
  assert.equal(moduleResolved.model_source, "legacy_module_default");

  await modelRoutingPolicyRepository.save({
    system_default_model_id: "model-system-1",
    module_defaults: {},
    template_overrides: {},
  });

  const systemResolved = await executionResolutionService.resolveExecutionBundle({
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  assert.equal(systemResolved.resolved_model.id, "model-system-1");
  assert.equal(systemResolved.model_source, "legacy_system_default");
});

test("execution resolution returns connection summaries, provider readiness, and fallback chain output", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    aiProviderConnectionRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await aiProviderConnectionRepository.save({
    id: "connection-deepseek-1",
    name: "DeepSeek Primary",
    provider_kind: "deepseek",
    compatibility_mode: "openai_chat_compatible",
    base_url: "https://api.deepseek.com",
    enabled: true,
    last_test_status: "failed",
    credential_summary: {
      mask: "sk-***9999",
      version: 3,
    },
  });
  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });
  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");
  await knowledgeRepository.save({
    id: "knowledge-1",
    title: "Editing guidance",
    canonical_text: "Approved editing guidance.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
  });
  await modelRegistryRepository.save({
    id: "model-editing-fallback-1",
    provider: "openai",
    model_name: "deepseek-fallback",
    model_version: "2026-04-01",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
    connection_id: "connection-deepseek-1",
  });
  await modelRegistryRepository.save({
    id: "model-editing-primary-1",
    provider: "openai",
    model_name: "deepseek-chat",
    model_version: "2026-04-01",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
    fallback_model_id: "model-editing-fallback-1",
    connection_id: "connection-deepseek-1",
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-primary-1",
    },
    template_overrides: {},
  });

  const resolved = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.equal(resolved.resolved_model.id, "model-editing-primary-1");
  assert.deepEqual(resolved.resolved_connection, {
    id: "connection-deepseek-1",
    name: "DeepSeek Primary",
    provider_kind: "deepseek",
    compatibility_mode: "openai_chat_compatible",
    enabled: true,
    last_test_status: "failed",
    credential_present: true,
  });
  assert.equal(resolved.provider_readiness.status, "warning");
  assert.ok(
    resolved.provider_readiness.issues.some(
      (issue) => issue.code === "connection_test_failed",
    ),
  );
  assert.deepEqual(
    resolved.fallback_chain.map((record) => record.id),
    ["model-editing-fallback-1"],
  );
  assert.deepEqual(resolved.warnings, []);
});

test("execution resolution surfaces legacy_unbound warnings before runtime cutover", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-screening-1",
    module: "screening",
  });
  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-screening-1",
    ruleSetId: "rule-set-screening-1",
    promptTemplateId: "prompt-screening-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");
  await modelRegistryRepository.save({
    id: "model-screening-legacy-1",
    provider: "openai",
    model_name: "legacy-screening-model",
    model_version: "2026-04-01",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      screening: "model-screening-legacy-1",
    },
    template_overrides: {},
  });

  const resolved = await executionResolutionService.resolveExecutionBundle({
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.equal(resolved.resolved_model.id, "model-screening-legacy-1");
  assert.equal(resolved.resolved_connection, undefined);
  assert.ok(
    resolved.warnings.some((warning) => warning.code === "legacy_unbound"),
  );
});

test("execution resolution includes governed runtime retrieval and manual review records and supports preview overrides", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
    runtimeBindingRepository,
    retrievalPresetRepository,
    manualReviewPolicyRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });
  await modelRegistryRepository.save({
    id: "model-editing-active-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-04-01",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
  });
  await modelRegistryRepository.save({
    id: "model-editing-preview-2",
    provider: "openai",
    model_name: "gpt-5.4-preview",
    model_version: "2026-04-02",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-active-1",
    },
    template_overrides: {},
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-active-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-active-1",
  });
  await modelRoutingGovernanceRepository.saveVersion({
    id: "policy-version-preview-2",
    policy_scope_id: "policy-scope-1",
    scope_kind: "template_family",
    scope_value: "family-1",
    version_no: 2,
    primary_model_id: "model-editing-preview-2",
    fallback_model_ids: [],
    evidence_links: [{ kind: "evaluation_run", id: "run-2" }],
    status: "approved",
    created_at: "2026-03-28T12:20:00.000Z",
    updated_at: "2026-03-28T12:20:00.000Z",
  });

  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: ["skill-editing-1"],
    knowledgeBindingMode: "profile_plus_dynamic",
  });
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");
  await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: ["skill-editing-1"],
    knowledgeBindingMode: "profile_plus_dynamic",
  });

  await runtimeBindingRepository.save({
    id: "binding-active-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    runtime_id: "runtime-active-1",
    sandbox_profile_id: "sandbox-active-1",
    agent_profile_id: "agent-active-1",
    tool_permission_policy_id: "tool-policy-active-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    execution_profile_id: "profile-1",
    verification_check_profile_ids: ["check-profile-1"],
    evaluation_suite_ids: ["suite-1"],
    release_check_profile_id: "release-profile-1",
    status: "active",
    version: 1,
  });
  await runtimeBindingRepository.save({
    id: "binding-preview-2",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    runtime_id: "runtime-preview-2",
    sandbox_profile_id: "sandbox-preview-2",
    agent_profile_id: "agent-preview-2",
    tool_permission_policy_id: "tool-policy-preview-2",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    execution_profile_id: "profile-2",
    verification_check_profile_ids: ["check-profile-2"],
    evaluation_suite_ids: ["suite-2"],
    release_check_profile_id: "release-profile-2",
    status: "draft",
    version: 2,
  });

  await retrievalPresetRepository.save({
    id: "retrieval-active-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    name: "Active retrieval",
    top_k: 6,
    section_filters: ["discussion"],
    risk_tag_filters: ["grounding"],
    rerank_enabled: true,
    citation_required: true,
    min_retrieval_score: 0.6,
    status: "active",
    version: 1,
  });
  await retrievalPresetRepository.save({
    id: "retrieval-preview-2",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    name: "Preview retrieval",
    top_k: 10,
    section_filters: ["methods"],
    risk_tag_filters: ["coverage"],
    rerank_enabled: false,
    citation_required: false,
    min_retrieval_score: 0.4,
    status: "draft",
    version: 2,
  });

  await manualReviewPolicyRepository.save({
    id: "manual-review-active-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    name: "Active review policy",
    min_confidence_threshold: 0.8,
    high_risk_force_review: true,
    conflict_force_review: true,
    insufficient_knowledge_force_review: true,
    module_blocklist_rules: ["unsafe-claim"],
    status: "active",
    version: 1,
  });
  await manualReviewPolicyRepository.save({
    id: "manual-review-preview-2",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    name: "Preview review policy",
    min_confidence_threshold: 0.7,
    high_risk_force_review: false,
    conflict_force_review: true,
    insufficient_knowledge_force_review: false,
    module_blocklist_rules: ["statistical-overreach"],
    status: "draft",
    version: 2,
  });

  const resolvedActive = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.ok(resolvedActive.runtime_binding);
  assert.ok(resolvedActive.model_routing_policy_version);
  assert.ok(resolvedActive.retrieval_preset);
  assert.ok(resolvedActive.manual_review_policy);
  assert.equal(resolvedActive.runtime_binding.id, "binding-active-1");
  assert.equal(
    resolvedActive.model_routing_policy_version.id,
    "policy-version-active-1",
  );
  assert.equal(resolvedActive.retrieval_preset?.id, "retrieval-active-1");
  assert.equal(
    resolvedActive.manual_review_policy?.id,
    "manual-review-active-1",
  );

  const preview = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    runtimeBindingId: "binding-preview-2",
    modelRoutingPolicyVersionId: "policy-version-preview-2",
    retrievalPresetId: "retrieval-preview-2",
    manualReviewPolicyId: "manual-review-preview-2",
  });

  assert.ok(preview.runtime_binding);
  assert.ok(preview.model_routing_policy_version);
  assert.ok(preview.retrieval_preset);
  assert.ok(preview.manual_review_policy);
  assert.equal(preview.runtime_binding.id, "binding-preview-2");
  assert.equal(
    preview.model_routing_policy_version.id,
    "policy-version-preview-2",
  );
  assert.equal(preview.retrieval_preset?.id, "retrieval-preview-2");
  assert.equal(preview.manual_review_policy?.id, "manual-review-preview-2");

  const stillActive = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.ok(stillActive.runtime_binding);
  assert.ok(stillActive.retrieval_preset);
  assert.ok(stillActive.manual_review_policy);
  assert.equal(stillActive.runtime_binding.id, "binding-active-1");
  assert.equal(stillActive.retrieval_preset?.id, "retrieval-active-1");
  assert.equal(
    stillActive.manual_review_policy?.id,
    "manual-review-active-1",
  );
});

test("execution resolution rejects override ids from another governed scope", async () => {
  const {
    executionGovernanceService,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
    runtimeBindingRepository,
    retrievalPresetRepository,
    manualReviewPolicyRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing template",
  });
  await moduleTemplateRepository.save({
    id: "template-editing-foreign-1",
    template_family_id: "family-2",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Foreign editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-foreign-1",
    name: "editing_foreign",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await savePublishedRuleSet({
    repository: editorialRuleRepository,
    id: "rule-set-editing-1",
    module: "editing",
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-editing-foreign-1",
    template_family_id: "family-2",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  await modelRegistryRepository.save({
    id: "model-editing-active-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-04-01",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
  });
  await modelRegistryRepository.save({
    id: "model-editing-foreign-1",
    provider: "openai",
    model_name: "gpt-5.4-foreign",
    model_version: "2026-04-02",
    allowed_modules: ["editing"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-active-1",
    },
    template_overrides: {},
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-active-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-active-1",
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-foreign-1",
    versionId: "policy-version-foreign-1",
    scopeKind: "template_family",
    scopeValue: "family-2",
    primaryModelId: "model-editing-foreign-1",
  });

  const activeProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    ruleSetId: "rule-set-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile(activeProfile.id, "admin");
  const foreignProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-2",
    moduleTemplateId: "template-editing-foreign-1",
    ruleSetId: "rule-set-editing-foreign-1",
    promptTemplateId: "prompt-editing-foreign-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });

  await runtimeBindingRepository.save({
    id: "binding-active-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    runtime_id: "runtime-active-1",
    sandbox_profile_id: "sandbox-active-1",
    agent_profile_id: "agent-active-1",
    tool_permission_policy_id: "tool-policy-active-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: [],
    execution_profile_id: activeProfile.id,
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    release_check_profile_id: undefined,
    status: "active",
    version: 1,
  });
  await runtimeBindingRepository.save({
    id: "binding-foreign-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-2",
    runtime_id: "runtime-foreign-1",
    sandbox_profile_id: "sandbox-foreign-1",
    agent_profile_id: "agent-foreign-1",
    tool_permission_policy_id: "tool-policy-foreign-1",
    prompt_template_id: "prompt-editing-foreign-1",
    skill_package_ids: [],
    execution_profile_id: foreignProfile.id,
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    release_check_profile_id: undefined,
    status: "draft",
    version: 1,
  });
  await retrievalPresetRepository.save({
    id: "retrieval-active-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    name: "Active retrieval",
    top_k: 6,
    rerank_enabled: true,
    citation_required: true,
    status: "active",
    version: 1,
  });
  await retrievalPresetRepository.save({
    id: "retrieval-foreign-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-2",
    name: "Foreign retrieval",
    top_k: 10,
    rerank_enabled: false,
    citation_required: false,
    status: "draft",
    version: 1,
  });
  await manualReviewPolicyRepository.save({
    id: "manual-review-active-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    name: "Active review policy",
    min_confidence_threshold: 0.8,
    high_risk_force_review: true,
    conflict_force_review: true,
    insufficient_knowledge_force_review: true,
    status: "active",
    version: 1,
  });
  await manualReviewPolicyRepository.save({
    id: "manual-review-foreign-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-2",
    name: "Foreign review policy",
    min_confidence_threshold: 0.7,
    high_risk_force_review: false,
    conflict_force_review: true,
    insufficient_knowledge_force_review: false,
    status: "draft",
    version: 1,
  });

  const baseScope = {
    module: "editing" as const,
    manuscriptType: "clinical_study" as const,
    templateFamilyId: "family-1",
  };
  const cases = [
    { executionProfileId: foreignProfile.id },
    { runtimeBindingId: "binding-foreign-1" },
    { modelRoutingPolicyVersionId: "policy-version-foreign-1" },
    { retrievalPresetId: "retrieval-foreign-1" },
    { manualReviewPolicyId: "manual-review-foreign-1" },
  ];

  for (const input of cases) {
    await assert.rejects(
      () =>
        executionResolutionService.resolveExecutionBundle({
          ...baseScope,
          ...input,
        }),
      /scope/i,
    );
  }
});
