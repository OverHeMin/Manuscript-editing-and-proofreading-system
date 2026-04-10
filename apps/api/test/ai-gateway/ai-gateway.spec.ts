import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import {
  AuthorizationError,
  PermissionGuard,
} from "../../src/auth/permission-guard.ts";
import { createAiGatewayApi } from "../../src/modules/ai-gateway/ai-gateway-api.ts";
import {
  AiGatewayService,
  ModelSelectionNotAllowedError,
} from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import {
  InMemoryModelRoutingGovernanceRepository,
} from "../../src/modules/model-routing-governance/in-memory-model-routing-governance-repository.ts";
import { ModelRoutingGovernanceService } from "../../src/modules/model-routing-governance/model-routing-governance-service.ts";
import { InMemoryAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/in-memory-ai-provider-connection-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { createModelRegistryApi } from "../../src/modules/model-registry/model-registry-api.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";

function createAiGatewayHarness() {
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const aiProviderConnectionRepository = new InMemoryAiProviderConnectionRepository();
  const modelRoutingGovernanceRepository =
    new InMemoryModelRoutingGovernanceRepository();
  const auditService = new InMemoryAuditService();
  const issuedIds = [
    "model-1",
    "model-2",
    "model-3",
    "model-4",
    "model-5",
    "model-6",
    "model-7",
    "model-8",
    "model-9",
    "model-10",
    "model-11",
    "model-12",
  ];
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected an AI gateway test id to be available.");
    return value;
  };
  const governanceIds = [
    "governance-id-1",
    "governance-id-2",
    "governance-id-3",
    "governance-id-4",
  ];
  const nextGovernanceId = () => {
    const value = governanceIds.shift();
    assert.ok(value, "Expected a governance id to be available.");
    return value;
  };

  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    aiProviderConnectionRepository,
    permissionGuard: new PermissionGuard(),
    createId: nextId,
  });
  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository: modelRoutingGovernanceRepository,
    modelRegistryRepository: modelRepository,
    createId: nextGovernanceId,
    now: () => new Date("2026-03-27T08:00:00.000Z"),
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    aiProviderConnectionRepository,
    modelRoutingGovernanceService,
    auditService,
    now: () => new Date("2026-03-27T08:00:00.000Z"),
  });

  return {
    modelRegistryApi: createModelRegistryApi({
      modelRegistryService,
    }),
    aiGatewayApi: createAiGatewayApi({
      aiGatewayService,
    }),
    aiProviderConnectionRepository,
    modelRoutingGovernanceRepository,
    auditService,
  };
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
    created_at: "2026-03-27T08:00:00.000Z",
    updated_at: "2026-03-27T08:00:00.000Z",
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
    created_at: "2026-03-27T08:00:00.000Z",
    updated_at: "2026-03-27T08:00:00.000Z",
  });
}

test("admin can create update and list model registry entries for governed model switching", async () => {
  const { modelRegistryApi } = createAiGatewayHarness();

  await assert.rejects(
    () =>
      modelRegistryApi.createModelEntry({
        actorRole: "editor",
        input: {
          provider: "openai",
          modelName: "gpt-5-mini",
          modelVersion: "2026-03",
          allowedModules: ["screening"],
          isProdAllowed: false,
        },
      }),
    AuthorizationError,
  );

  const created = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-mini",
      modelVersion: "2026-03",
      allowedModules: ["screening"],
      isProdAllowed: false,
    },
  });

  const updated = await modelRegistryApi.updateModelEntry({
    actorRole: "admin",
    modelId: created.body.id,
    input: {
      allowedModules: ["screening", "editing"],
      isProdAllowed: true,
    },
  });
  const listed = await modelRegistryApi.listModelEntries();

  assert.equal(created.status, 201);
  assert.equal(updated.status, 200);
  assert.deepEqual(listed.body, [
    {
      id: "model-1",
      provider: "openai",
      model_name: "gpt-5-mini",
      model_version: "2026-03",
      allowed_modules: ["screening", "editing"],
      is_prod_allowed: true,
      cost_profile: undefined,
      rate_limit: undefined,
      fallback_model_id: undefined,
    },
  ]);
});

test("routing policy rejects models that are invalid for governed production routing", async () => {
  const { modelRegistryApi } = createAiGatewayHarness();

  const nonProdModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-eval",
      modelVersion: "2026-03",
      allowedModules: ["screening"],
      isProdAllowed: false,
    },
  });
  const editingOnlyModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-editing",
      modelVersion: "2026-03",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });

  await assert.rejects(
    () =>
      modelRegistryApi.updateRoutingPolicy({
        actorRole: "admin",
        input: {
          systemDefaultModelId: nonProdModel.body.id,
        },
      }),
    /production/i,
  );

  await assert.rejects(
    () =>
      modelRegistryApi.updateRoutingPolicy({
        actorRole: "admin",
        input: {
          moduleDefaults: {
            screening: editingOnlyModel.body.id,
          },
        },
      }),
    /screening/i,
  );

  await assert.rejects(
    () =>
      modelRegistryApi.updateRoutingPolicy({
        actorRole: "admin",
        input: {
          templateOverrides: {
            "template-guarded-1": nonProdModel.body.id,
          },
        },
      }),
    /production/i,
  );
});

test("ai gateway resolves an active template family policy before module policy and legacy defaults", async () => {
  const {
    modelRegistryApi,
    aiGatewayApi,
    modelRoutingGovernanceRepository,
  } = createAiGatewayHarness();

  const systemModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-mini",
      modelVersion: "2026-03",
      allowedModules: ["screening", "editing", "proofreading"],
      isProdAllowed: true,
    },
  });
  const legacyTemplateOverride = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "google",
      modelName: "gemini-editing-legacy-template",
      modelVersion: "2.5",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });
  const legacyModuleDefault = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "anthropic",
      modelName: "claude-editing-legacy-module",
      modelVersion: "4.0",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });
  const governedModulePrimary = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-editing-module",
      modelVersion: "2026-03",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });
  const governedTemplatePrimary = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-editing-family",
      modelVersion: "2026-04",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });
  const fallbackOne = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "azure_openai",
      modelName: "gpt-5-editing-fallback-1",
      modelVersion: "2026-03",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });
  const fallbackTwo = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-editing-fallback-2",
      modelVersion: "2026-03",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      systemDefaultModelId: systemModel.body.id,
      templateOverrides: {
        "template-editing-1": legacyTemplateOverride.body.id,
      },
      moduleDefaults: {
        editing: legacyModuleDefault.body.id,
      },
    },
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-1",
    scopeKind: "module",
    scopeValue: "editing",
    primaryModelId: governedModulePrimary.body.id,
    fallbackModelIds: [fallbackOne.body.id],
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-2",
    versionId: "policy-version-2",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: governedTemplatePrimary.body.id,
    fallbackModelIds: [fallbackOne.body.id, fallbackTwo.body.id],
  });

  const resolved = await aiGatewayApi.resolveModelSelection({
    module: "editing",
    moduleTemplateId: "template-editing-1",
    templateFamilyId: "family-1",
    taskId: "task-governed-1",
  });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.layer, "template_family_policy");
  assert.equal(resolved.body.policy_version_id, "policy-version-2");
  assert.equal(resolved.body.policy_scope_kind, "template_family");
  assert.equal(resolved.body.policy_scope_value, "family-1");
  assert.equal(resolved.body.model.id, governedTemplatePrimary.body.id);
  assert.deepEqual(
    resolved.body.fallback_chain.map((model) => model.id),
    [fallbackOne.body.id, fallbackTwo.body.id],
  );
});

test("ai gateway resolves an active module policy before legacy defaults when no template family policy exists", async () => {
  const {
    modelRegistryApi,
    aiGatewayApi,
    modelRoutingGovernanceRepository,
  } = createAiGatewayHarness();

  const systemModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-mini",
      modelVersion: "2026-03",
      allowedModules: ["screening", "editing", "proofreading"],
      isProdAllowed: true,
    },
  });
  const legacyTemplateOverride = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "google",
      modelName: "gemini-screening-legacy-template",
      modelVersion: "2.5",
      allowedModules: ["screening"],
      isProdAllowed: true,
    },
  });
  const legacyModuleDefault = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "anthropic",
      modelName: "claude-screening-legacy-module",
      modelVersion: "4.0",
      allowedModules: ["screening"],
      isProdAllowed: true,
    },
  });
  const governedModulePrimary = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-screening-governed",
      modelVersion: "2026-04",
      allowedModules: ["screening"],
      isProdAllowed: true,
    },
  });
  const governedFallback = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "azure_openai",
      modelName: "gpt-5-screening-fallback",
      modelVersion: "2026-03",
      allowedModules: ["screening"],
      isProdAllowed: true,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      systemDefaultModelId: systemModel.body.id,
      moduleDefaults: {
        screening: legacyModuleDefault.body.id,
      },
      templateOverrides: {
        "template-1": legacyTemplateOverride.body.id,
      },
    },
  });
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-1",
    scopeKind: "module",
    scopeValue: "screening",
    primaryModelId: governedModulePrimary.body.id,
    fallbackModelIds: [governedFallback.body.id],
  });

  const resolved = await aiGatewayApi.resolveModelSelection({
    module: "screening",
    moduleTemplateId: "template-1",
    templateFamilyId: "family-1",
    taskId: "task-governed-2",
  });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.layer, "module_policy");
  assert.equal(resolved.body.policy_version_id, "policy-version-1");
  assert.equal(resolved.body.policy_scope_kind, "module");
  assert.equal(resolved.body.policy_scope_value, "screening");
  assert.equal(resolved.body.model.id, governedModulePrimary.body.id);
  assert.deepEqual(
    resolved.body.fallback_chain.map((model) => model.id),
    [governedFallback.body.id],
  );
});

test("ai gateway resolves the legacy module default model when no governed policy or template override exists", async () => {
  const { modelRegistryApi, aiGatewayApi } = createAiGatewayHarness();

  const systemModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-mini",
      modelVersion: "2026-03",
      allowedModules: ["screening", "editing", "proofreading"],
      isProdAllowed: true,
    },
  });
  const editingModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5",
      modelVersion: "2026-03",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      systemDefaultModelId: systemModel.body.id,
      moduleDefaults: {
        editing: editingModel.body.id,
      },
    },
  });

  const resolved = await aiGatewayApi.resolveModelSelection({
    module: "editing",
    taskId: "task-legacy-1",
  });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.layer, "legacy_module_default");
  assert.equal(resolved.body.model.id, editingModel.body.id);
});

test("ai gateway resolves the legacy template override before the legacy module default", async () => {
  const { modelRegistryApi, aiGatewayApi } = createAiGatewayHarness();

  const systemModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-mini",
      modelVersion: "2026-03",
      allowedModules: ["screening", "editing", "proofreading"],
      isProdAllowed: true,
    },
  });
  const moduleDefault = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "anthropic",
      modelName: "claude-sonnet",
      modelVersion: "4.0",
      allowedModules: ["screening"],
      isProdAllowed: true,
    },
  });
  const templateOverride = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "google",
      modelName: "gemini-pro",
      modelVersion: "2.5",
      allowedModules: ["screening"],
      isProdAllowed: true,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      systemDefaultModelId: systemModel.body.id,
      moduleDefaults: {
        screening: moduleDefault.body.id,
      },
      templateOverrides: {
        "template-1": templateOverride.body.id,
      },
    },
  });

  const resolved = await aiGatewayApi.resolveModelSelection({
    module: "screening",
    moduleTemplateId: "template-1",
    taskId: "task-legacy-2",
  });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.layer, "legacy_template_override");
  assert.equal(resolved.body.model.id, templateOverride.body.id);
});

test("ai gateway rejects blocked task override models", async () => {
  const { modelRegistryApi, aiGatewayApi } = createAiGatewayHarness();

  const safeDefault = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-mini",
      modelVersion: "2026-03",
      allowedModules: ["screening", "editing", "proofreading"],
      isProdAllowed: true,
    },
  });
  const blockedOverride = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-experimental",
      modelVersion: "2026-03",
      allowedModules: ["screening"],
      isProdAllowed: false,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      systemDefaultModelId: safeDefault.body.id,
    },
  });

  await assert.rejects(
    () =>
      aiGatewayApi.resolveModelSelection({
        module: "screening",
        taskId: "task-3",
        taskOverrideModelId: blockedOverride.body.id,
        taskOverrideAllowList: [blockedOverride.body.id],
      }),
    ModelSelectionNotAllowedError,
  );
});

test("ai gateway rejects task overrides whose fallback models are blocked for production", async () => {
  const { modelRegistryApi, aiGatewayApi } = createAiGatewayHarness();

  const blockedFallback = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-fallback",
      modelVersion: "2026-03",
      allowedModules: ["editing"],
      isProdAllowed: false,
    },
  });
  const primaryModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-primary",
      modelVersion: "2026-03",
      allowedModules: ["editing"],
      isProdAllowed: true,
      fallbackModelId: blockedFallback.body.id,
    },
  });
  const safeDefault = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-safe-default",
      modelVersion: "2026-03",
      allowedModules: ["screening", "editing", "proofreading"],
      isProdAllowed: true,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      systemDefaultModelId: safeDefault.body.id,
    },
  });

  await assert.rejects(
    () =>
      aiGatewayApi.resolveModelSelection({
        module: "editing",
        taskId: "task-3b",
        taskOverrideModelId: primaryModel.body.id,
        taskOverrideAllowList: [primaryModel.body.id],
      }),
    ModelSelectionNotAllowedError,
  );
});

test("ai gateway audits rejected model selections", async () => {
  const { modelRegistryApi, aiGatewayApi, auditService } = createAiGatewayHarness();

  const safeDefault = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-mini",
      modelVersion: "2026-03",
      allowedModules: ["screening", "editing", "proofreading"],
      isProdAllowed: true,
    },
  });
  const blockedOverride = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-experimental",
      modelVersion: "2026-03",
      allowedModules: ["screening"],
      isProdAllowed: false,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      systemDefaultModelId: safeDefault.body.id,
    },
  });

  await assert.rejects(
    () =>
      aiGatewayApi.resolveModelSelection({
        module: "screening",
        taskId: "task-3c",
        actorId: "user-2",
        actorRole: "admin",
        taskOverrideModelId: blockedOverride.body.id,
        taskOverrideAllowList: [blockedOverride.body.id],
      }),
    ModelSelectionNotAllowedError,
  );

  assert.deepEqual(auditService.list(), [
    {
      actorId: "user-2",
      roleKey: "admin",
      action: "ai.model.resolve",
      targetTable: "model_registry",
      targetId: "model-2",
      occurredAt: "2026-03-27T08:00:00.000Z",
      metadata: {
        layer: "task_override",
        module: "screening",
        moduleTemplateId: undefined,
        taskId: "task-3c",
        provider: "openai",
        modelName: "gpt-5-experimental",
        modelVersion: "2026-03",
        fallbackModelId: undefined,
        outcome: "rejected",
        error: "Selected model model-2 is blocked for production work.",
      },
    },
  ]);
});

test("ai gateway writes an audit record for each model resolution", async () => {
  const { modelRegistryApi, aiGatewayApi, auditService } = createAiGatewayHarness();

  const model = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "gpt-5-mini",
      modelVersion: "2026-03",
      allowedModules: ["screening", "editing", "proofreading"],
      isProdAllowed: true,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      systemDefaultModelId: model.body.id,
    },
  });

  await aiGatewayApi.resolveModelSelection({
    module: "proofreading",
    moduleTemplateId: "template-proof-1",
    taskId: "task-4",
    actorId: "user-1",
    actorRole: "admin",
  });

  assert.deepEqual(auditService.list(), [
    {
      actorId: "user-1",
      roleKey: "admin",
      action: "ai.model.resolve",
      targetTable: "model_registry",
      targetId: "model-1",
      occurredAt: "2026-03-27T08:00:00.000Z",
      metadata: {
        layer: "legacy_system_default",
        module: "proofreading",
        moduleTemplateId: "template-proof-1",
        taskId: "task-4",
        provider: "openai",
        modelName: "gpt-5-mini",
        modelVersion: "2026-03",
        fallbackModelId: undefined,
      },
    },
  ]);
});

test("ai gateway exposes resolved connection metadata and model fallback chains", async () => {
  const {
    modelRegistryApi,
    aiGatewayApi,
    aiProviderConnectionRepository,
  } = createAiGatewayHarness();

  await aiProviderConnectionRepository.save({
    id: "connection-qwen-1",
    name: "Qwen Production",
    provider_kind: "qwen",
    compatibility_mode: "openai_chat_compatible",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    enabled: true,
    last_test_status: "passed",
    credential_summary: {
      mask: "sk-***562",
      version: 2,
    },
  });

  const fallbackModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "qwen-fallback",
      modelVersion: "2026-04",
      allowedModules: ["editing"],
      isProdAllowed: true,
      connectionId: "connection-qwen-1",
    } as Parameters<typeof modelRegistryApi.createModelEntry>[0]["input"],
  });
  const primaryModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "qwen-max",
      modelVersion: "2026-04",
      allowedModules: ["editing"],
      isProdAllowed: true,
      connectionId: "connection-qwen-1",
      fallbackModelId: fallbackModel.body.id,
    } as Parameters<typeof modelRegistryApi.createModelEntry>[0]["input"],
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      moduleDefaults: {
        editing: primaryModel.body.id,
      },
    },
  });

  const resolved = await aiGatewayApi.resolveModelSelection({
    module: "editing",
    taskId: "task-connection-aware",
  });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.model.connection_id, "connection-qwen-1");
  assert.deepEqual(resolved.body.resolved_connection, {
    id: "connection-qwen-1",
    name: "Qwen Production",
    provider_kind: "qwen",
    compatibility_mode: "openai_chat_compatible",
    enabled: true,
    last_test_status: "passed",
    credential_present: true,
  });
  assert.deepEqual(
    resolved.body.fallback_chain.map((model) => model.id),
    [fallbackModel.body.id],
  );
  assert.deepEqual(resolved.body.warnings, []);
});

test("ai gateway marks legacy unbound selections with a migration warning", async () => {
  const { modelRegistryApi, aiGatewayApi } = createAiGatewayHarness();

  const unboundModel = await modelRegistryApi.createModelEntry({
    actorRole: "admin",
    input: {
      provider: "openai",
      modelName: "legacy-unbound-model",
      modelVersion: "2026-04",
      allowedModules: ["screening"],
      isProdAllowed: true,
    },
  });

  await modelRegistryApi.updateRoutingPolicy({
    actorRole: "admin",
    input: {
      moduleDefaults: {
        screening: unboundModel.body.id,
      },
    },
  });

  const resolved = await aiGatewayApi.resolveModelSelection({
    module: "screening",
    taskId: "task-legacy-warning",
  });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.model.id, unboundModel.body.id);
  assert.equal(resolved.body.resolved_connection, undefined);
  assert.ok(
    resolved.body.warnings.some(
      (warning) => warning.code === "legacy_unbound",
    ),
  );
});
