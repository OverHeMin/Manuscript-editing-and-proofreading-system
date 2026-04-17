import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/ai-provider-credential-crypto.ts";
import { InMemoryAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/in-memory-ai-provider-connection-repository.ts";
import {
  AiProviderRuntimeConfigurationError,
  createAiProviderRuntimeService,
} from "../../src/modules/ai-provider-runtime/index.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryAgentProfileRepository } from "../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import { AgentProfileService } from "../../src/modules/agent-profiles/agent-profile-service.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { AgentRuntimeService } from "../../src/modules/agent-runtime/agent-runtime-service.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { InMemoryRuntimeBindingRepository } from "../../src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts";
import type { RuntimeBindingReadinessReport } from "../../src/modules/runtime-bindings/runtime-binding-readiness.ts";
import { RuntimeBindingService } from "../../src/modules/runtime-bindings/runtime-binding-service.ts";
import { InMemorySandboxProfileRepository } from "../../src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts";
import { SandboxProfileService } from "../../src/modules/sandbox-profiles/sandbox-profile-service.ts";
import {
  ActiveRuntimeBindingNotFoundError,
  resolveGovernedAgentContext,
} from "../../src/modules/shared/governed-agent-context-resolver.ts";
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { ToolPermissionPolicyService } from "../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";

const TEST_MASTER_KEY = Buffer.alloc(32, 0x44).toString("base64");

async function createResolverHarness(input?: {
  providerConnection?: {
    id?: string;
    enabled?: boolean;
    compatibilityMode?: string;
    apiKey?: string;
  };
}) {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const runtimeBindingRepository = new InMemoryRuntimeBindingRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
  });
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const auditService = new InMemoryAuditService();
  const aiProviderConnectionRepository = new InMemoryAiProviderConnectionRepository();
  const aiProviderCredentialCrypto = new AiProviderCredentialCrypto({
    AI_PROVIDER_MASTER_KEY: TEST_MASTER_KEY,
  } as NodeJS.ProcessEnv);
  const aiProviderRuntimeService = createAiProviderRuntimeService({
    repository: aiProviderConnectionRepository,
    credentialCrypto: aiProviderCredentialCrypto,
  });
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    aiProviderConnectionRepository,
    createId: (() => {
      const ids = ["model-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a model id to be available.");
        return value;
      };
    })(),
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    aiProviderConnectionRepository,
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

  if (input?.providerConnection) {
    const connectionId = input.providerConnection.id ?? "connection-1";
    await aiProviderConnectionRepository.save({
      id: connectionId,
      name: "Resolver runtime connection",
      provider_kind: "qwen",
      compatibility_mode:
        input.providerConnection.compatibilityMode ?? "openai_chat_compatible",
      base_url: "https://resolver.example.com/v1",
      enabled: true,
    });

    if (input.providerConnection.apiKey) {
      await aiProviderConnectionRepository.saveCredential({
        id: `${connectionId}-credential`,
        connection_id: connectionId,
        credential_ciphertext: aiProviderCredentialCrypto.encrypt({
          apiKey: input.providerConnection.apiKey,
        }),
        credential_mask: aiProviderCredentialCrypto.maskApiKey(
          input.providerConnection.apiKey,
        ),
        last_rotated_at: new Date("2026-03-28T12:00:00.000Z"),
      });
    }
  }

  const systemModel = await modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-default",
    modelVersion: "2026-03",
    allowedModules: ["screening", "editing", "proofreading"],
    isProdAllowed: true,
    ...(input?.providerConnection
      ? {
          connectionId: input.providerConnection.id ?? "connection-1",
        }
      : {}),
  });
  await modelRegistryService.updateRoutingPolicy("admin", {
    systemDefaultModelId: systemModel.id,
    moduleDefaults: {
      editing: systemModel.id,
    },
  });

  if (input?.providerConnection?.enabled === false) {
    const connection = await aiProviderConnectionRepository.findById(
      input.providerConnection.id ?? "connection-1",
    );
    assert.ok(connection, "Expected the provider connection fixture.");
    await aiProviderConnectionRepository.save({
      ...connection,
      enabled: false,
    });
  }

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

  await verificationOpsRepository.saveVerificationCheckProfile({
    id: "check-profile-1",
    name: "Editing Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [tool.id],
    admin_only: true,
  });
  await verificationOpsRepository.saveReleaseCheckProfile({
    id: "release-profile-1",
    name: "Editing Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["check-profile-1"],
    admin_only: true,
  });
  await verificationOpsRepository.saveEvaluationSuite({
    id: "suite-1",
    name: "Editing Regression Suite",
    suite_type: "regression",
    status: "active",
    verification_check_profile_ids: ["check-profile-1"],
    module_scope: ["editing"],
    requires_production_baseline: false,
    supports_ab_comparison: true,
    hard_gate_policy: {
      must_use_deidentified_samples: true,
      requires_parsable_output: true,
    },
    score_weights: {
      structure: 0.2,
      terminology: 0.2,
      knowledge_coverage: 0.2,
      risk_detection: 0.2,
      human_edit_burden: 0.1,
      cost_and_latency: 0.1,
    },
    admin_only: true,
  });

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
    verificationCheckProfileIds: ["check-profile-1"],
    evaluationSuiteIds: ["suite-1"],
    releaseCheckProfileId: "release-profile-1",
  });
  await runtimeBindingService.activateBinding(runtimeBinding.id, "admin");

  return {
    manuscriptRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceService,
    aiGatewayService,
    aiProviderRuntimeService,
    sandboxProfileService,
    agentProfileService,
    agentRuntimeService,
    toolPermissionPolicyService,
    runtimeBindingService,
  };
}

test("resolver returns the active runtime binding with profile runtime sandbox and tool policy context", async () => {
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
      verification_check_profile_ids: ["check-profile-1"],
      evaluation_suite_ids: ["suite-1"],
      release_check_profile_id: "release-profile-1",
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
  assert.ok(
    context.moduleContext.modelSelection.warnings.some(
      (warning) => warning.code === "legacy_unbound",
    ),
  );
  assert.deepEqual(context.verificationExpectations, {
    verification_check_profile_ids: ["check-profile-1"],
    evaluation_suite_ids: ["suite-1"],
    release_check_profile_id: "release-profile-1",
  });
  assert.equal(context.runtimeBindingReadiness.observation_status, "reported");
  assert.deepEqual(context.runtimeBindingReadiness.report, readinessReport);
  assert.equal(context.runtimeBindingReadiness.error, undefined);
});

test("resolver rejects legacy unbound selections after AI provider runtime cutover", async () => {
  const harness = await createResolverHarness();

  await assert.rejects(
    () =>
      resolveGovernedAgentContext({
        manuscriptId: "manuscript-1",
        module: "editing",
        jobId: "job-cutover-legacy",
        actorId: "admin-1",
        actorRole: "admin",
        manuscriptRepository: harness.manuscriptRepository,
        moduleTemplateRepository: harness.moduleTemplateRepository,
        executionGovernanceService: harness.executionGovernanceService,
        promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
        knowledgeRepository: harness.knowledgeRepository,
        aiGatewayService: harness.aiGatewayService,
        aiProviderRuntimeService: harness.aiProviderRuntimeService,
        aiProviderRuntimeCutoverEnabled: true,
        sandboxProfileService: harness.sandboxProfileService,
        agentProfileService: harness.agentProfileService,
        agentRuntimeService: harness.agentRuntimeService,
        runtimeBindingService: harness.runtimeBindingService,
        toolPermissionPolicyService: harness.toolPermissionPolicyService,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderRuntimeConfigurationError);
      assert.equal(error.code, "legacy_unbound");
      return true;
    },
  );
});

test("resolver rejects structurally invalid connection-backed selections after AI provider runtime cutover", async () => {
  const harness = await createResolverHarness({
    providerConnection: {
      enabled: false,
      apiKey: "sk-disabled-runtime",
    },
  });

  await assert.rejects(
    () =>
      resolveGovernedAgentContext({
        manuscriptId: "manuscript-1",
        module: "editing",
        jobId: "job-cutover-disabled",
        actorId: "admin-1",
        actorRole: "admin",
        manuscriptRepository: harness.manuscriptRepository,
        moduleTemplateRepository: harness.moduleTemplateRepository,
        executionGovernanceService: harness.executionGovernanceService,
        promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
        knowledgeRepository: harness.knowledgeRepository,
        aiGatewayService: harness.aiGatewayService,
        aiProviderRuntimeService: harness.aiProviderRuntimeService,
        aiProviderRuntimeCutoverEnabled: true,
        sandboxProfileService: harness.sandboxProfileService,
        agentProfileService: harness.agentProfileService,
        agentRuntimeService: harness.agentRuntimeService,
        runtimeBindingService: harness.runtimeBindingService,
        toolPermissionPolicyService: harness.toolPermissionPolicyService,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderRuntimeConfigurationError);
      assert.equal(error.code, "connection_disabled");
      return true;
    },
  );
});

test("resolver fails when no active runtime binding exists for the governed module scope", async () => {
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

test("resolver fails open when runtime binding readiness observation throws unexpectedly", async () => {
  const harness = await createResolverHarness();

  const context = await resolveGovernedAgentContext({
    manuscriptId: "manuscript-1",
    module: "editing",
    jobId: "job-3",
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
      async getBindingReadiness() {
        throw new Error("governed readiness exploded");
      },
    },
  });

  assert.equal(context.runtimeBinding.id, "binding-1");
  assert.equal(context.runtimeBindingReadiness.observation_status, "failed_open");
  assert.equal(context.runtimeBindingReadiness.error, "governed readiness exploded");
  assert.equal(context.runtimeBindingReadiness.report, undefined);
});
