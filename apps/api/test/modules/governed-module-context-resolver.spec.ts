import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryAgentProfileRepository } from "../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import { AgentProfileService } from "../../src/modules/agent-profiles/agent-profile-service.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { AgentRuntimeService } from "../../src/modules/agent-runtime/agent-runtime-service.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import { InMemoryManualReviewPolicyRepository } from "../../src/modules/manual-review-policies/in-memory-manual-review-policy-repository.ts";
import { ManualReviewPolicyService } from "../../src/modules/manual-review-policies/manual-review-policy-service.ts";
import {
  InMemoryModelRoutingGovernanceRepository,
} from "../../src/modules/model-routing-governance/in-memory-model-routing-governance-repository.ts";
import { ModelRoutingGovernanceService } from "../../src/modules/model-routing-governance/model-routing-governance-service.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { InMemoryRetrievalPresetRepository } from "../../src/modules/retrieval-presets/in-memory-retrieval-preset-repository.ts";
import { RetrievalPresetService } from "../../src/modules/retrieval-presets/retrieval-preset-service.ts";
import { InMemoryRuntimeBindingRepository } from "../../src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts";
import type { RuntimeBindingReadinessReport } from "../../src/modules/runtime-bindings/runtime-binding-readiness.ts";
import { RuntimeBindingService } from "../../src/modules/runtime-bindings/runtime-binding-service.ts";
import { InMemorySandboxProfileRepository } from "../../src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts";
import { SandboxProfileService } from "../../src/modules/sandbox-profiles/sandbox-profile-service.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import {
  ActiveRuntimeBindingNotFoundError,
  resolveGovernedAgentContext,
} from "../../src/modules/shared/governed-agent-context-resolver.ts";
import { resolveGovernedModuleContext } from "../../src/modules/shared/governed-module-context-resolver.ts";
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { ToolPermissionPolicyService } from "../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";
import { ActiveExecutionProfileNotFoundError } from "../../src/modules/execution-governance/execution-governance-service.ts";

async function createResolverHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const retrievalPresetRepository = new InMemoryRetrievalPresetRepository();
  const manualReviewPolicyRepository =
    new InMemoryManualReviewPolicyRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const runtimeBindingRepository = new InMemoryRuntimeBindingRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    createId: (() => {
      const ids = ["profile-1", "rule-1", "profile-2", "rule-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an execution governance id to be available.");
        return value;
      };
    })(),
  });
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const modelRoutingGovernanceRepository =
    new InMemoryModelRoutingGovernanceRepository();
  const auditService = new InMemoryAuditService();
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    createId: (() => {
      const ids = ["model-1", "model-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a model id to be available.");
        return value;
      };
    })(),
  });
  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository: modelRoutingGovernanceRepository,
    modelRegistryRepository: modelRepository,
    createId: (() => {
      const ids = [
        "governance-id-1",
        "governance-id-2",
        "governance-id-3",
        "governance-id-4",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a governance id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-28T12:00:00.000Z"),
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    modelRoutingGovernanceService,
    auditService,
    now: () => new Date("2026-03-28T12:00:00.000Z"),
  });
  const sandboxProfileService = new SandboxProfileService({
    repository: sandboxProfileRepository,
    createId: (() => {
      const ids = ["sandbox-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a sandbox profile id to be available.");
        return value;
      };
    })(),
  });
  const agentProfileService = new AgentProfileService({
    repository: agentProfileRepository,
    createId: (() => {
      const ids = ["agent-profile-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an agent profile id to be available.");
        return value;
      };
    })(),
  });
  const agentRuntimeService = new AgentRuntimeService({
    repository: agentRuntimeRepository,
    createId: (() => {
      const ids = ["runtime-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an agent runtime id to be available.");
        return value;
      };
    })(),
  });
  const toolGatewayService = new ToolGatewayService({
    repository: toolGatewayRepository,
    createId: (() => {
      const ids = ["tool-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a tool id to be available.");
        return value;
      };
    })(),
  });
  const toolPermissionPolicyService = new ToolPermissionPolicyService({
    repository: toolPermissionPolicyRepository,
    toolGatewayRepository,
    createId: (() => {
      const ids = ["policy-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a tool permission policy id to be available.");
        return value;
      };
    })(),
  });
  const runtimeBindingService = new RuntimeBindingService({
    repository: runtimeBindingRepository,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    verificationOpsRepository,
    createId: (() => {
      const ids = ["binding-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a runtime binding id to be available.");
        return value;
      };
    })(),
  });
  const retrievalPresetService = new RetrievalPresetService({
    repository: retrievalPresetRepository,
  });
  const manualReviewPolicyService = new ManualReviewPolicyService({
    repository: manualReviewPolicyRepository,
  });

  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Governed Editing Fixture",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-28T11:30:00.000Z",
    updated_at: "2026-03-28T11:30:00.000Z",
  });
  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 2,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.2.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "2.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await knowledgeRepository.save({
    id: "knowledge-bound-1",
    title: "Bound rule",
    canonical_text: "Always normalize trial terminology.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
  });
  await knowledgeRepository.save({
    id: "knowledge-dynamic-1",
    title: "Dynamic rule",
    canonical_text: "Keep abbreviations consistent.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-editing-1"],
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  await editorialRuleRepository.saveRule({
    id: "editorial-rule-1",
    rule_set_id: "rule-set-1",
    order_no: 10,
    rule_object: "generic",
    rule_type: "content",
    execution_mode: "inspect",
    scope: {},
    selector: {},
    trigger: {
      kind: "structural_presence",
      field: "abstract",
    },
    action: {
      kind: "emit_finding",
      message: "Abstract should be present.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });
  await executionGovernanceRepository.saveProfile({
    id: "profile-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-editing-1",
    rule_set_id: "rule-set-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await executionGovernanceRepository.saveKnowledgeBindingRule({
    id: "rule-1",
    knowledge_item_id: "knowledge-bound-1",
    module: "editing",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-editing-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });

  const systemModel = await modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-default",
    modelVersion: "2026-03",
    allowedModules: ["screening", "editing", "proofreading"],
    isProdAllowed: true,
  });
  const fallbackModel = await modelRegistryService.createModelEntry("admin", {
    provider: "azure_openai",
    modelName: "gpt-5-editing-fallback",
    modelVersion: "2026-03",
    allowedModules: ["editing"],
    isProdAllowed: true,
  });
  await modelRegistryService.updateRoutingPolicy("admin", {
    systemDefaultModelId: systemModel.id,
    moduleDefaults: {
      editing: systemModel.id,
    },
  });
  await modelRoutingGovernanceRepository.saveScope({
    id: "policy-scope-1",
    scope_kind: "template_family",
    scope_value: "family-1",
    active_version_id: "policy-version-1",
    created_at: "2026-03-28T12:00:00.000Z",
    updated_at: "2026-03-28T12:00:00.000Z",
  });
  await modelRoutingGovernanceRepository.saveVersion({
    id: "policy-version-1",
    policy_scope_id: "policy-scope-1",
    scope_kind: "template_family",
    scope_value: "family-1",
    version_no: 1,
    primary_model_id: systemModel.id,
    fallback_model_ids: [fallbackModel.id],
    evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
    status: "active",
    created_at: "2026-03-28T12:00:00.000Z",
    updated_at: "2026-03-28T12:00:00.000Z",
  });

  const tool = await toolGatewayService.createTool("admin", {
    name: "knowledge.search",
    scope: "knowledge",
  });
  const policy = await toolPermissionPolicyService.createPolicy("admin", {
    name: "Editing Policy",
    allowedToolIds: [tool.id],
    highRiskToolIds: [],
  });
  await toolPermissionPolicyService.activatePolicy(policy.id, "admin");

  const sandboxProfile = await sandboxProfileService.createProfile("admin", {
    name: "Editing Sandbox",
    sandboxMode: "workspace_write",
    networkAccess: false,
    approvalRequired: true,
    allowedToolIds: [tool.id],
  });
  await sandboxProfileService.activateProfile(sandboxProfile.id, "admin");

  const runtime = await agentRuntimeService.createRuntime("admin", {
    name: "Deep Agents Editing Runtime",
    adapter: "deepagents",
    sandboxProfileId: sandboxProfile.id,
    allowedModules: ["editing"],
  });
  await agentRuntimeService.publishRuntime(runtime.id, "admin");

  const agentProfile = await agentProfileService.createProfile("admin", {
    name: "Editing Executor",
    roleKey: "subagent",
    moduleScope: ["editing"],
    manuscriptTypes: ["clinical_study"],
  });
  await agentProfileService.publishProfile(agentProfile.id, "admin");

  const runtimeBinding = await runtimeBindingService.createBinding("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    runtimeId: runtime.id,
    sandboxProfileId: sandboxProfile.id,
    agentProfileId: agentProfile.id,
    toolPermissionPolicyId: policy.id,
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: ["skill-editing-1"],
    executionProfileId: "profile-1",
  });
  await runtimeBindingService.activateBinding(runtimeBinding.id, "admin");

  return {
    manuscriptRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceRepository,
    executionGovernanceService,
    aiGatewayService,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    toolPermissionPolicyService,
    runtimeBindingService,
    retrievalPresetService,
    manualReviewPolicyService,
  };
}

test("resolver returns the active execution profile with frozen template, prompt, skill, knowledge, and model context", async () => {
  const harness = await createResolverHarness();

  const context = await resolveGovernedModuleContext({
    manuscriptId: "manuscript-1",
    module: "editing",
    jobId: "job-1",
    actorId: "editor-1",
    actorRole: "editor",
    manuscriptRepository: harness.manuscriptRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    executionGovernanceService: harness.executionGovernanceService,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    aiGatewayService: harness.aiGatewayService,
  });

  assert.equal(context.executionProfile.id, "profile-1");
  assert.equal(context.promptTemplate.id, "prompt-editing-1");
  assert.equal(context.skillPackages[0]?.id, "skill-editing-1");
  assert.deepEqual(
    context.knowledgeSelections.map((selection) => selection.knowledgeItem.id),
    ["knowledge-bound-1", "knowledge-dynamic-1"],
  );
  assert.equal(context.knowledgeSelections[0]?.matchSource, "binding_rule");
  assert.equal(context.knowledgeSelections[1]?.matchSource, "template_binding");
  assert.equal(context.modelSelection.layer, "template_family_policy");
  assert.equal(context.modelSelection.policy_version_id, "policy-version-1");
  assert.equal(context.modelSelection.policy_scope_kind, "template_family");
  assert.equal(context.modelSelection.policy_scope_value, "family-1");
  assert.equal(context.modelSelection.model.id, "model-1");
  assert.deepEqual(
    context.modelSelection.fallback_chain.map((model) => model.id),
    ["model-2"],
  );
});

test("resolver fails when no active execution profile exists for the module scope", async () => {
  const harness = await createResolverHarness();

  await harness.executionGovernanceRepository.saveProfile({
    id: "profile-archived",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    knowledge_binding_mode: "profile_only",
    status: "archived",
    version: 1,
  });

  await assert.rejects(
    () =>
      resolveGovernedModuleContext({
        manuscriptId: "manuscript-1",
        module: "screening",
        jobId: "job-2",
        actorId: "screener-1",
        actorRole: "screener",
        manuscriptRepository: harness.manuscriptRepository,
        moduleTemplateRepository: harness.moduleTemplateRepository,
        executionGovernanceService: harness.executionGovernanceService,
        promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
        knowledgeRepository: harness.knowledgeRepository,
        aiGatewayService: harness.aiGatewayService,
      }),
    ActiveExecutionProfileNotFoundError,
  );
});

test("resolver applies active retrieval presets to dynamic knowledge and returns governed retrieval/manual-review settings", async () => {
  const harness = await createResolverHarness();

  await harness.knowledgeRepository.save({
    id: "knowledge-dynamic-2",
    title: "Methods coverage rule",
    canonical_text: "Expand methods coverage for trial workflow descriptions.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
      sections: ["methods"],
      risk_tags: ["coverage"],
    },
  });
  await harness.knowledgeRepository.save({
    id: "knowledge-dynamic-3",
    title: "Results conflict rule",
    canonical_text: "Check conflicting results statements before rewriting.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
      sections: ["results"],
      risk_tags: ["conflict"],
    },
  });

  const retrievalPreset = await harness.retrievalPresetService.createPreset("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Methods coverage only",
    topK: 1,
    sectionFilters: ["methods"],
    riskTagFilters: ["coverage"],
    rerankEnabled: true,
    citationRequired: true,
    minRetrievalScore: 0.6,
  });
  await harness.retrievalPresetService.activatePreset(retrievalPreset.id, "admin");

  const manualReviewPolicy =
    await harness.manualReviewPolicyService.createPolicy("admin", {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      name: "Editing relaxed review",
      minConfidenceThreshold: 0.7,
      highRiskForceReview: false,
      conflictForceReview: false,
      insufficientKnowledgeForceReview: false,
    });
  await harness.manualReviewPolicyService.activatePolicy(
    manualReviewPolicy.id,
    "admin",
  );

  const context = await resolveGovernedModuleContext({
    manuscriptId: "manuscript-1",
    module: "editing",
    jobId: "job-3",
    actorId: "editor-1",
    actorRole: "editor",
    manuscriptRepository: harness.manuscriptRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    executionGovernanceService: harness.executionGovernanceService,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    aiGatewayService: harness.aiGatewayService,
    retrievalPresetService: harness.retrievalPresetService,
    manualReviewPolicyService: harness.manualReviewPolicyService,
  } as never);

  assert.equal((context as { retrievalPreset?: { id: string } }).retrievalPreset?.id, retrievalPreset.id);
  assert.equal(
    (context as { manualReviewPolicy?: { id: string } }).manualReviewPolicy?.id,
    manualReviewPolicy.id,
  );
  assert.deepEqual(
    context.knowledgeSelections.map((selection) => selection.knowledgeItem.id),
    ["knowledge-bound-1", "knowledge-dynamic-2"],
  );
});

test("agent resolver returns the active runtime binding with profile runtime sandbox and tool policy context", async () => {
  const harness = await createResolverHarness();
  const readinessReport: RuntimeBindingReadinessReport = {
    status: "ready",
    scope: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
    },
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

  const context = await resolveGovernedAgentContext({
    manuscriptId: "manuscript-1",
    module: "editing",
    jobId: "job-1",
    actorId: "admin-1",
    actorRole: "admin",
    manuscriptRepository: harness.manuscriptRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    executionGovernanceService: harness.executionGovernanceService,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    runtimeBindingReadinessService: {
      async getBindingReadiness(bindingId) {
        assert.equal(bindingId, "binding-1");
        return readinessReport;
      },
    },
  });

  assert.equal(context.agentProfile.role_key, "subagent");
  assert.equal(context.runtime.id, "runtime-1");
  assert.equal(context.sandboxProfile.id, "sandbox-1");
  assert.equal(context.toolPolicy.id, "policy-1");
  assert.equal(context.runtimeBinding.id, "binding-1");
  assert.equal(context.moduleContext.executionProfile.id, "profile-1");
  assert.equal(context.runtimeBindingReadiness.observation_status, "reported");
  assert.deepEqual(context.runtimeBindingReadiness.report, readinessReport);
});

test("agent resolver fails when no active runtime binding exists for the governed module scope", async () => {
  const harness = await createResolverHarness();
  const [binding] = await harness.runtimeBindingService.listBindingsForScope({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  assert.ok(binding, "Expected a runtime binding fixture.");

  await harness.runtimeBindingService.archiveBinding(binding.id, "admin");

  await assert.rejects(
    () =>
      resolveGovernedAgentContext({
        manuscriptId: "manuscript-1",
        module: "editing",
        jobId: "job-2",
        actorId: "admin-1",
        actorRole: "admin",
        manuscriptRepository: harness.manuscriptRepository,
        moduleTemplateRepository: harness.moduleTemplateRepository,
        executionGovernanceService: harness.executionGovernanceService,
        promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
        knowledgeRepository: harness.knowledgeRepository,
        aiGatewayService: harness.aiGatewayService,
        sandboxProfileService: harness.sandboxProfileService,
        agentProfileService: harness.agentProfileService,
        agentRuntimeService: harness.agentRuntimeService,
        runtimeBindingService: harness.runtimeBindingService,
        toolPermissionPolicyService: harness.toolPermissionPolicyService,
      }),
    ActiveRuntimeBindingNotFoundError,
  );
});
