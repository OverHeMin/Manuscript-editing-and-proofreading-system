import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createAgentRuntimeApi } from "../../src/modules/agent-runtime/agent-runtime-api.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { AgentRuntimeService } from "../../src/modules/agent-runtime/agent-runtime-service.ts";
import { createAgentProfileApi } from "../../src/modules/agent-profiles/agent-profile-api.ts";
import { InMemoryAgentProfileRepository } from "../../src/modules/agent-profiles/in-memory-agent-profile-repository.ts";
import { AgentProfileService } from "../../src/modules/agent-profiles/agent-profile-service.ts";
import { createPromptSkillRegistryApi } from "../../src/modules/prompt-skill-registry/prompt-skill-api.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { PromptSkillRegistryService } from "../../src/modules/prompt-skill-registry/prompt-skill-service.ts";
import { createExecutionGovernanceApi } from "../../src/modules/execution-governance/execution-governance-api.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { createRuntimeBindingApi } from "../../src/modules/runtime-bindings/runtime-binding-api.ts";
import { InMemoryRuntimeBindingRepository } from "../../src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts";
import { RuntimeBindingReadinessService } from "../../src/modules/runtime-bindings/runtime-binding-readiness-service.ts";
import { RuntimeBindingService } from "../../src/modules/runtime-bindings/runtime-binding-service.ts";
import { createSandboxProfileApi } from "../../src/modules/sandbox-profiles/sandbox-profile-api.ts";
import { InMemorySandboxProfileRepository } from "../../src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts";
import { SandboxProfileService } from "../../src/modules/sandbox-profiles/sandbox-profile-service.ts";
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { createToolGatewayApi } from "../../src/modules/tool-gateway/tool-gateway-api.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { createToolPermissionPolicyApi } from "../../src/modules/tool-permission-policies/tool-permission-policy-api.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { ToolPermissionPolicyService } from "../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";
import { createVerificationOpsApi } from "../../src/modules/verification-ops/verification-ops-api.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { VerificationOpsService } from "../../src/modules/verification-ops/verification-ops-service.ts";

function createRuntimeBindingHarness() {
  const ids = {
    runtimeBinding: ["binding-1", "binding-2"],
    runtime: ["runtime-1", "runtime-2"],
    sandbox: ["sandbox-1"],
    agentProfile: ["agent-profile-1"],
    toolPolicy: ["tool-policy-1"],
    tool: ["tool-1", "tool-2"],
    promptSkill: ["skill-1", "prompt-1", "skill-2", "prompt-2"],
    executionGovernance: ["execution-profile-1", "execution-profile-2"],
    verificationOps: [
      "check-profile-1",
      "release-profile-1",
      "suite-1",
      "draft-check-profile-1",
      "draft-release-profile-1",
      "draft-suite-1",
    ],
  };

  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const promptSkillRegistryRepository =
    new InMemoryPromptSkillRegistryRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const executionGovernanceRepository =
    new InMemoryExecutionGovernanceRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();

  const runtimeBindingService = new RuntimeBindingService({
    repository: new InMemoryRuntimeBindingRepository(),
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    verificationOpsRepository,
    createId: () => {
      const value = ids.runtimeBinding.shift();
      assert.ok(value, "Expected a runtime binding id to be available.");
      return value;
    },
  });
  const executionGovernanceApi = createExecutionGovernanceApi({
    executionGovernanceService: new ExecutionGovernanceService({
      repository: executionGovernanceRepository,
      moduleTemplateRepository,
      promptSkillRegistryRepository,
      knowledgeRepository: new InMemoryKnowledgeRepository(),
      createId: () => {
        const value = ids.executionGovernance.shift();
        assert.ok(value, "Expected an execution governance id to be available.");
        return value;
      },
    }),
  });
  const readinessService = new RuntimeBindingReadinessService({
    runtimeBindingService,
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    executionGovernanceRepository,
    verificationOpsRepository,
  });

  return {
    executionGovernanceApi,
    moduleTemplateRepository,
    readinessService,
    runtimeApi: createAgentRuntimeApi({
      agentRuntimeService: new AgentRuntimeService({
        repository: agentRuntimeRepository,
        createId: () => {
          const value = ids.runtime.shift();
          assert.ok(value, "Expected an agent runtime id to be available.");
          return value;
        },
      }),
    }),
    sandboxApi: createSandboxProfileApi({
      sandboxProfileService: new SandboxProfileService({
        repository: sandboxProfileRepository,
        createId: () => {
          const value = ids.sandbox.shift();
          assert.ok(value, "Expected a sandbox profile id to be available.");
          return value;
        },
      }),
    }),
    agentProfileApi: createAgentProfileApi({
      agentProfileService: new AgentProfileService({
        repository: agentProfileRepository,
        createId: () => {
          const value = ids.agentProfile.shift();
          assert.ok(value, "Expected an agent profile id to be available.");
          return value;
        },
      }),
    }),
    toolGatewayApi: createToolGatewayApi({
      toolGatewayService: new ToolGatewayService({
        repository: toolGatewayRepository,
        createId: () => {
          const value = ids.tool.shift();
          assert.ok(value, "Expected a tool id to be available.");
          return value;
        },
      }),
    }),
    promptSkillApi: createPromptSkillRegistryApi({
      promptSkillRegistryService: new PromptSkillRegistryService({
        repository: promptSkillRegistryRepository,
        createId: () => {
          const value = ids.promptSkill.shift();
          assert.ok(value, "Expected a prompt/skill id to be available.");
          return value;
        },
      }),
    }),
    toolPermissionPolicyApi: createToolPermissionPolicyApi({
      toolPermissionPolicyService: new ToolPermissionPolicyService({
        repository: toolPermissionPolicyRepository,
        toolGatewayRepository,
        createId: () => {
          const value = ids.toolPolicy.shift();
          assert.ok(value, "Expected a tool permission policy id to be available.");
          return value;
        },
      }),
    }),
    verificationOpsApi: createVerificationOpsApi({
      verificationOpsService: new VerificationOpsService({
        repository: verificationOpsRepository,
        toolGatewayRepository,
        createId: () => {
          const value = ids.verificationOps.shift();
          assert.ok(value, "Expected a verification-ops id to be available.");
          return value;
        },
      }),
    }),
    runtimeBindingApi: createRuntimeBindingApi({
      runtimeBindingService,
      runtimeBindingReadinessService: readinessService,
    }),
  };
}

async function seedPublishableBindingDependencies() {
  const harness = createRuntimeBindingHarness();

  const tool = await harness.toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "knowledge.search",
      scope: "knowledge",
    },
  });
  const policy = await harness.toolPermissionPolicyApi.createPolicy({
    actorRole: "admin",
    input: {
      name: "Read First Policy",
      allowedToolIds: [tool.body.id],
      highRiskToolIds: [],
    },
  });
  await harness.toolPermissionPolicyApi.activatePolicy({
    actorRole: "admin",
    policyId: policy.body.id,
  });

  const sandbox = await harness.sandboxApi.createProfile({
    actorRole: "admin",
    input: {
      name: "Safe Workspace",
      sandboxMode: "workspace_write",
      networkAccess: false,
      approvalRequired: true,
      allowedToolIds: [tool.body.id],
    },
  });
  await harness.sandboxApi.activateProfile({
    actorRole: "admin",
    profileId: sandbox.body.id,
  });

  const runtime = await harness.runtimeApi.createRuntime({
    actorRole: "admin",
    input: {
      name: "Deep Agents Runtime",
      adapter: "deepagents",
      sandboxProfileId: sandbox.body.id,
      allowedModules: ["editing"],
    },
  });
  await harness.runtimeApi.publishRuntime({
    actorRole: "admin",
    runtimeId: runtime.body.id,
  });

  const agentProfile = await harness.agentProfileApi.createProfile({
    actorRole: "admin",
    input: {
      name: "Editing Executor",
      roleKey: "subagent",
      moduleScope: ["editing"],
      manuscriptTypes: ["clinical_study"],
    },
  });
  await harness.agentProfileApi.publishProfile({
    actorRole: "admin",
    profileId: agentProfile.body.id,
  });

  const skillPackage = await harness.promptSkillApi.createSkillPackage({
    actorRole: "admin",
    input: {
      name: "Editing Skills",
      version: "1.0.0",
      appliesToModules: ["editing"],
      dependencyTools: [tool.body.name],
    },
  });
  await harness.promptSkillApi.publishSkillPackage({
    actorRole: "admin",
    skillPackageId: skillPackage.body.id,
  });

  const promptTemplate = await harness.promptSkillApi.createPromptTemplate({
    actorRole: "admin",
    input: {
      name: "Editing Prompt",
      version: "1.0.0",
      module: "editing",
      manuscriptTypes: ["clinical_study"],
    },
  });
  await harness.promptSkillApi.publishPromptTemplate({
    actorRole: "admin",
    promptTemplateId: promptTemplate.body.id,
  });
  await harness.moduleTemplateRepository.save({
    id: "module-template-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing template",
  });
  const executionProfile = await harness.executionGovernanceApi.createProfile({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      moduleTemplateId: "module-template-1",
      promptTemplateId: promptTemplate.body.id,
      skillPackageIds: [skillPackage.body.id],
      knowledgeBindingMode: "profile_only",
    },
  });
  await harness.executionGovernanceApi.publishProfile({
    actorRole: "admin",
    profileId: executionProfile.body.id,
  });

  const checkProfile = await harness.verificationOpsApi.createVerificationCheckProfile({
    actorRole: "admin",
    input: {
      name: "Editing Browser QA",
      checkType: "browser_qa",
      toolIds: [tool.body.id],
    },
  });
  await harness.verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: checkProfile.body.id,
  });

  const releaseProfile = await harness.verificationOpsApi.createReleaseCheckProfile({
    actorRole: "admin",
    input: {
      name: "Editing Release Gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [checkProfile.body.id],
    },
  });
  await harness.verificationOpsApi.publishReleaseCheckProfile({
    actorRole: "admin",
    profileId: releaseProfile.body.id,
  });

  const suite = await harness.verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Regression Suite",
      suiteType: "regression",
      verificationCheckProfileIds: [checkProfile.body.id],
      moduleScope: ["editing"],
    },
  });
  await harness.verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: suite.body.id,
  });

  return {
    ...harness,
    runtimeId: runtime.body.id,
    sandboxProfileId: sandbox.body.id,
    agentProfileId: agentProfile.body.id,
    toolPermissionPolicyId: policy.body.id,
    promptTemplateId: promptTemplate.body.id,
    skillPackageId: skillPackage.body.id,
    executionProfileId: executionProfile.body.id,
    verificationCheckProfileId: checkProfile.body.id,
    evaluationSuiteId: suite.body.id,
    releaseCheckProfileId: releaseProfile.body.id,
  };
}

test("only admin can create and activate runtime bindings", async () => {
  const harness = await seedPublishableBindingDependencies();

  await assert.rejects(
    () =>
      harness.runtimeBindingApi.createBinding({
        actorRole: "editor",
        input: {
          module: "editing",
          manuscriptType: "clinical_study",
          templateFamilyId: "family-1",
          runtimeId: harness.runtimeId,
          sandboxProfileId: harness.sandboxProfileId,
          agentProfileId: harness.agentProfileId,
          toolPermissionPolicyId: harness.toolPermissionPolicyId,
          promptTemplateId: harness.promptTemplateId,
          skillPackageIds: [harness.skillPackageId],
          verificationCheckProfileIds: [harness.verificationCheckProfileId],
          evaluationSuiteIds: [harness.evaluationSuiteId],
          releaseCheckProfileId: harness.releaseCheckProfileId,
        },
      }),
    AuthorizationError,
  );

  const created = await harness.runtimeBindingApi.createBinding({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: harness.runtimeId,
      sandboxProfileId: harness.sandboxProfileId,
      agentProfileId: harness.agentProfileId,
      toolPermissionPolicyId: harness.toolPermissionPolicyId,
      promptTemplateId: harness.promptTemplateId,
      skillPackageIds: [harness.skillPackageId],
      verificationCheckProfileIds: [harness.verificationCheckProfileId],
      evaluationSuiteIds: [harness.evaluationSuiteId],
      releaseCheckProfileId: harness.releaseCheckProfileId,
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.deepEqual(created.body.verification_check_profile_ids, [
    harness.verificationCheckProfileId,
  ]);
  assert.deepEqual(created.body.evaluation_suite_ids, [harness.evaluationSuiteId]);
  assert.equal(
    created.body.release_check_profile_id,
    harness.releaseCheckProfileId,
  );

  const activated = await harness.runtimeBindingApi.activateBinding({
    actorRole: "admin",
    bindingId: created.body.id,
  });

  assert.equal(activated.status, 200);
  assert.equal(activated.body.status, "active");
});

test("runtime bindings archive the previous active binding for the same module manuscript type and template family", async () => {
  const harness = await seedPublishableBindingDependencies();

  const first = await harness.runtimeBindingApi.createBinding({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: harness.runtimeId,
      sandboxProfileId: harness.sandboxProfileId,
      agentProfileId: harness.agentProfileId,
      toolPermissionPolicyId: harness.toolPermissionPolicyId,
      promptTemplateId: harness.promptTemplateId,
      skillPackageIds: [harness.skillPackageId],
      verificationCheckProfileIds: [harness.verificationCheckProfileId],
      evaluationSuiteIds: [harness.evaluationSuiteId],
      releaseCheckProfileId: harness.releaseCheckProfileId,
    },
  });
  await harness.runtimeBindingApi.activateBinding({
    actorRole: "admin",
    bindingId: first.body.id,
  });

  const second = await harness.runtimeBindingApi.createBinding({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: harness.runtimeId,
      sandboxProfileId: harness.sandboxProfileId,
      agentProfileId: harness.agentProfileId,
      toolPermissionPolicyId: harness.toolPermissionPolicyId,
      promptTemplateId: harness.promptTemplateId,
      skillPackageIds: [harness.skillPackageId],
      verificationCheckProfileIds: [harness.verificationCheckProfileId],
      evaluationSuiteIds: [harness.evaluationSuiteId],
      releaseCheckProfileId: harness.releaseCheckProfileId,
    },
  });
  await harness.runtimeBindingApi.activateBinding({
    actorRole: "admin",
    bindingId: second.body.id,
  });

  const firstReloaded = await harness.runtimeBindingApi.getBinding({
    bindingId: first.body.id,
  });

  assert.equal(firstReloaded.body.status, "archived");
});

test("runtime bindings reject draft dependencies and require active or published upstream records", async () => {
  const harness = createRuntimeBindingHarness();

  const runtime = await harness.runtimeApi.createRuntime({
    actorRole: "admin",
    input: {
      name: "Deep Agents Runtime",
      adapter: "deepagents",
      sandboxProfileId: "sandbox-1",
      allowedModules: ["editing"],
    },
  });
  const sandbox = await harness.sandboxApi.createProfile({
    actorRole: "admin",
    input: {
      name: "Safe Workspace",
      sandboxMode: "workspace_write",
      networkAccess: false,
      approvalRequired: true,
      allowedToolIds: [],
    },
  });
  const agentProfile = await harness.agentProfileApi.createProfile({
    actorRole: "admin",
    input: {
      name: "Editing Executor",
      roleKey: "subagent",
      moduleScope: ["editing"],
      manuscriptTypes: ["clinical_study"],
    },
  });
  const promptTemplate = await harness.promptSkillApi.createPromptTemplate({
    actorRole: "admin",
    input: {
      name: "Editing Prompt",
      version: "1.0.0",
      module: "editing",
      manuscriptTypes: ["clinical_study"],
    },
  });
  const skillPackage = await harness.promptSkillApi.createSkillPackage({
    actorRole: "admin",
    input: {
      name: "Editing Skills",
      version: "1.0.0",
      appliesToModules: ["editing"],
    },
  });
  const policy = await harness.toolPermissionPolicyApi.createPolicy({
    actorRole: "admin",
    input: {
      name: "Read First Policy",
      allowedToolIds: [],
      highRiskToolIds: [],
    },
  });
  const draftCheckProfile = await harness.verificationOpsApi.createVerificationCheckProfile({
    actorRole: "admin",
    input: {
      name: "Draft Browser QA",
      checkType: "browser_qa",
      toolIds: [],
    },
  });
  const draftReleaseProfile = await harness.verificationOpsApi.createReleaseCheckProfile({
    actorRole: "admin",
    input: {
      name: "Draft Release Gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [],
    },
  });
  const draftSuite = await harness.verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Draft Regression Suite",
      suiteType: "regression",
      verificationCheckProfileIds: [],
      moduleScope: ["editing"],
    },
  });

  await assert.rejects(
    () =>
      harness.runtimeBindingApi.createBinding({
        actorRole: "admin",
        input: {
          module: "editing",
          manuscriptType: "clinical_study",
          templateFamilyId: "family-1",
          runtimeId: runtime.body.id,
          sandboxProfileId: sandbox.body.id,
          agentProfileId: agentProfile.body.id,
          toolPermissionPolicyId: policy.body.id,
          promptTemplateId: promptTemplate.body.id,
          skillPackageIds: [skillPackage.body.id],
          verificationCheckProfileIds: [draftCheckProfile.body.id],
          evaluationSuiteIds: [draftSuite.body.id],
          releaseCheckProfileId: draftReleaseProfile.body.id,
        },
      }),
    /active|published/i,
  );
});

test("runtime binding readiness reports ready for an active aligned binding", async () => {
  const harness = await seedPublishableBindingDependencies();

  const created = await harness.runtimeBindingApi.createBinding({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: harness.runtimeId,
      sandboxProfileId: harness.sandboxProfileId,
      agentProfileId: harness.agentProfileId,
      toolPermissionPolicyId: harness.toolPermissionPolicyId,
      promptTemplateId: harness.promptTemplateId,
      skillPackageIds: [harness.skillPackageId],
      executionProfileId: harness.executionProfileId,
      verificationCheckProfileIds: [harness.verificationCheckProfileId],
      evaluationSuiteIds: [harness.evaluationSuiteId],
      releaseCheckProfileId: harness.releaseCheckProfileId,
    },
  });
  await harness.runtimeBindingApi.activateBinding({
    actorRole: "admin",
    bindingId: created.body.id,
  });

  const readiness = await harness.readinessService.getBindingReadiness(
    created.body.id,
  );

  assert.equal(readiness.status, "ready");
  assert.deepEqual(readiness.issues, []);
  assert.equal(readiness.execution_profile_alignment.status, "aligned");
});

test("runtime binding readiness reports missing when no active binding exists for the scope", async () => {
  const harness = await seedPublishableBindingDependencies();

  const readiness = await harness.readinessService.getActiveBindingReadinessForScope(
    {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
    },
  );

  assert.equal(readiness.status, "missing");
  assert.deepEqual(readiness.issues.map((issue) => issue.code), [
    "missing_active_binding",
  ]);
});

test("runtime binding readiness reports degraded dependency state after activation drift", async () => {
  const harness = await seedPublishableBindingDependencies();

  const created = await harness.runtimeBindingApi.createBinding({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: harness.runtimeId,
      sandboxProfileId: harness.sandboxProfileId,
      agentProfileId: harness.agentProfileId,
      toolPermissionPolicyId: harness.toolPermissionPolicyId,
      promptTemplateId: harness.promptTemplateId,
      skillPackageIds: [harness.skillPackageId],
      executionProfileId: harness.executionProfileId,
      verificationCheckProfileIds: [harness.verificationCheckProfileId],
      evaluationSuiteIds: [harness.evaluationSuiteId],
      releaseCheckProfileId: harness.releaseCheckProfileId,
    },
  });
  await harness.runtimeBindingApi.activateBinding({
    actorRole: "admin",
    bindingId: created.body.id,
  });
  await harness.runtimeApi.archiveRuntime({
    actorRole: "admin",
    runtimeId: harness.runtimeId,
  });

  const readiness = await harness.readinessService.getBindingReadiness(
    created.body.id,
  );

  assert.equal(readiness.status, "degraded");
  assert.ok(
    readiness.issues.some((issue) => issue.code === "runtime_not_active"),
  );
});

test("runtime binding readiness reports execution-profile prompt and skill drift against the active scope profile", async () => {
  const harness = await seedPublishableBindingDependencies();

  const created = await harness.runtimeBindingApi.createBinding({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      runtimeId: harness.runtimeId,
      sandboxProfileId: harness.sandboxProfileId,
      agentProfileId: harness.agentProfileId,
      toolPermissionPolicyId: harness.toolPermissionPolicyId,
      promptTemplateId: harness.promptTemplateId,
      skillPackageIds: [harness.skillPackageId],
      executionProfileId: harness.executionProfileId,
      verificationCheckProfileIds: [harness.verificationCheckProfileId],
      evaluationSuiteIds: [harness.evaluationSuiteId],
      releaseCheckProfileId: harness.releaseCheckProfileId,
    },
  });
  await harness.runtimeBindingApi.activateBinding({
    actorRole: "admin",
    bindingId: created.body.id,
  });

  const secondSkillPackage = await harness.promptSkillApi.createSkillPackage({
    actorRole: "admin",
    input: {
      name: "Editing Skills V2",
      version: "2.0.0",
      appliesToModules: ["editing"],
    },
  });
  await harness.promptSkillApi.publishSkillPackage({
    actorRole: "admin",
    skillPackageId: secondSkillPackage.body.id,
  });
  const secondPromptTemplate = await harness.promptSkillApi.createPromptTemplate({
    actorRole: "admin",
    input: {
      name: "Editing Prompt V2",
      version: "2.0.0",
      module: "editing",
      manuscriptTypes: ["clinical_study"],
    },
  });
  await harness.promptSkillApi.publishPromptTemplate({
    actorRole: "admin",
    promptTemplateId: secondPromptTemplate.body.id,
  });
  const secondExecutionProfile = await harness.executionGovernanceApi.createProfile({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      moduleTemplateId: "module-template-1",
      promptTemplateId: secondPromptTemplate.body.id,
      skillPackageIds: [secondSkillPackage.body.id],
      knowledgeBindingMode: "profile_only",
    },
  });
  await harness.executionGovernanceApi.publishProfile({
    actorRole: "admin",
    profileId: secondExecutionProfile.body.id,
  });

  const readiness = await harness.readinessService.getBindingReadiness(
    created.body.id,
  );

  assert.equal(readiness.status, "degraded");
  assert.ok(
    readiness.issues.some(
      (issue) => issue.code === "binding_execution_profile_drift",
    ),
  );
  assert.ok(
    readiness.issues.some((issue) => issue.code === "binding_prompt_drift"),
  );
  assert.ok(
    readiness.issues.some(
      (issue) => issue.code === "binding_skill_package_drift",
    ),
  );
});
