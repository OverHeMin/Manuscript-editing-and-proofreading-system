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
import { createRuntimeBindingApi } from "../../src/modules/runtime-bindings/runtime-binding-api.ts";
import { InMemoryRuntimeBindingRepository } from "../../src/modules/runtime-bindings/in-memory-runtime-binding-repository.ts";
import { RuntimeBindingService } from "../../src/modules/runtime-bindings/runtime-binding-service.ts";
import { createSandboxProfileApi } from "../../src/modules/sandbox-profiles/sandbox-profile-api.ts";
import { InMemorySandboxProfileRepository } from "../../src/modules/sandbox-profiles/in-memory-sandbox-profile-repository.ts";
import { SandboxProfileService } from "../../src/modules/sandbox-profiles/sandbox-profile-service.ts";
import { createToolGatewayApi } from "../../src/modules/tool-gateway/tool-gateway-api.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { createToolPermissionPolicyApi } from "../../src/modules/tool-permission-policies/tool-permission-policy-api.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import { ToolPermissionPolicyService } from "../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";

function createRuntimeBindingHarness() {
  const ids = {
    runtimeBinding: ["binding-1", "binding-2"],
    runtime: ["runtime-1", "runtime-2"],
    sandbox: ["sandbox-1"],
    agentProfile: ["agent-profile-1"],
    toolPolicy: ["tool-policy-1"],
    tool: ["tool-1", "tool-2"],
    promptSkill: ["skill-1", "prompt-1"],
  };

  const agentRuntimeRepository = new InMemoryAgentRuntimeRepository();
  const sandboxProfileRepository = new InMemorySandboxProfileRepository();
  const agentProfileRepository = new InMemoryAgentProfileRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const toolPermissionPolicyRepository =
    new InMemoryToolPermissionPolicyRepository();
  const promptSkillRegistryRepository =
    new InMemoryPromptSkillRegistryRepository();

  const runtimeBindingService = new RuntimeBindingService({
    repository: new InMemoryRuntimeBindingRepository(),
    agentRuntimeRepository,
    sandboxProfileRepository,
    agentProfileRepository,
    toolPermissionPolicyRepository,
    promptSkillRegistryRepository,
    createId: () => {
      const value = ids.runtimeBinding.shift();
      assert.ok(value, "Expected a runtime binding id to be available.");
      return value;
    },
  });

  return {
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
    runtimeBindingApi: createRuntimeBindingApi({
      runtimeBindingService,
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

  return {
    ...harness,
    runtimeId: runtime.body.id,
    sandboxProfileId: sandbox.body.id,
    agentProfileId: agentProfile.body.id,
    toolPermissionPolicyId: policy.body.id,
    promptTemplateId: promptTemplate.body.id,
    skillPackageId: skillPackage.body.id,
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
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");

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
        },
      }),
    /active|published/i,
  );
});
