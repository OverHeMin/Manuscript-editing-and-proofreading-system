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
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { createModelRegistryApi } from "../../src/modules/model-registry/model-registry-api.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";

function createAiGatewayHarness() {
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const auditService = new InMemoryAuditService();
  const issuedIds = [
    "model-1",
    "model-2",
    "model-3",
    "model-4",
    "model-5",
    "model-6",
  ];
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected an AI gateway test id to be available.");
    return value;
  };

  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    permissionGuard: new PermissionGuard(),
    createId: nextId,
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
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
    auditService,
  };
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

test("ai gateway resolves the module default model when no template override exists", async () => {
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
    taskId: "task-1",
  });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.layer, "module_default");
  assert.equal(resolved.body.model.id, editingModel.body.id);
});

test("ai gateway resolves a template override before the module default", async () => {
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
    taskId: "task-2",
  });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.layer, "template_override");
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
        layer: "system_default",
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
