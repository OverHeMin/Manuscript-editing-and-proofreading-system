import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/ai-provider-credential-crypto.ts";
import { AiProviderConnectionService } from "../../src/modules/ai-provider-connections/ai-provider-connection-service.ts";
import { InMemoryAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/in-memory-ai-provider-connection-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import { InMemoryModelRoutingGovernanceRepository } from "../../src/modules/model-routing-governance/in-memory-model-routing-governance-repository.ts";
import { ModelRoutingGovernanceService } from "../../src/modules/model-routing-governance/model-routing-governance-service.ts";
import {
  ensureQwenModuleRoutingConfiguration,
} from "../../src/database/scripts/seed-qwen-module-routing.ts";

const TEST_MASTER_KEY = Buffer.alloc(32, 0x55).toString("base64");

function createHarness() {
  const auditService = new InMemoryAuditService();
  const connectionRepository = new InMemoryAiProviderConnectionRepository();
  const modelRepository = new InMemoryModelRegistryRepository();
  const legacyRoutingRepository = new InMemoryModelRoutingPolicyRepository();
  const routingRepository = new InMemoryModelRoutingGovernanceRepository();
  const connectionService = new AiProviderConnectionService({
    repository: connectionRepository,
    auditService,
    credentialCrypto: new AiProviderCredentialCrypto({
      AI_PROVIDER_MASTER_KEY: TEST_MASTER_KEY,
    } as NodeJS.ProcessEnv),
  });
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository: legacyRoutingRepository,
    aiProviderConnectionRepository: connectionRepository,
    createId: (() => {
      let nextId = 1;
      return () => `model-${nextId++}`;
    })(),
  });
  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository: routingRepository,
    modelRegistryRepository: modelRepository,
    createId: (() => {
      let nextId = 1;
      return () => `routing-${nextId++}`;
    })(),
    now: () => new Date("2026-04-17T10:00:00.000Z"),
  });

  return {
    connectionService,
    modelRegistryService,
    modelRoutingGovernanceService,
  };
}

test("qwen module routing seed creates the connection, models, and active module fallbacks idempotently", async () => {
  const harness = createHarness();

  await ensureQwenModuleRoutingConfiguration({
    actorRole: "admin",
    actorId: "seed-script",
    aiProviderConnectionService: harness.connectionService,
    modelRegistryService: harness.modelRegistryService,
    modelRoutingGovernanceService: harness.modelRoutingGovernanceService,
    connection: {
      name: "Qwen Production",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "sk-qwen-seed-12345678",
    },
    modules: {
      screening: {
        primaryModelName: "qwen-screening-primary",
        fallbackModelName: "qwen-screening-fallback",
      },
      editing: {
        primaryModelName: "qwen-editing-primary",
        fallbackModelName: "qwen-editing-fallback",
      },
      proofreading: {
        primaryModelName: "qwen-proofreading-primary",
        fallbackModelName: "qwen-proofreading-fallback",
      },
    },
  });

  const firstConnections = await harness.connectionService.listConnections();
  const firstModels = await harness.modelRegistryService.listSystemSettingsModels();
  const firstDefaults =
    await harness.modelRoutingGovernanceService.listSystemSettingsModuleDefaults();
  const firstPolicies = await harness.modelRoutingGovernanceService.listPolicies();

  assert.equal(firstConnections.length, 1);
  assert.equal(firstConnections[0]?.name, "Qwen Production");
  assert.equal(firstConnections[0]?.provider_kind, "qwen");
  assert.equal(firstConnections[0]?.enabled, true);
  assert.equal(firstModels.length, 6);
  assert.deepEqual(
    firstDefaults.map((record) => ({
      moduleKey: record.module_key,
      primaryModelName: record.primary_model_name,
      fallbackModelName: record.fallback_model_name,
    })),
    [
      {
        moduleKey: "screening",
        primaryModelName: "qwen-screening-primary",
        fallbackModelName: "qwen-screening-fallback",
      },
      {
        moduleKey: "editing",
        primaryModelName: "qwen-editing-primary",
        fallbackModelName: "qwen-editing-fallback",
      },
      {
        moduleKey: "proofreading",
        primaryModelName: "qwen-proofreading-primary",
        fallbackModelName: "qwen-proofreading-fallback",
      },
    ],
  );

  await ensureQwenModuleRoutingConfiguration({
    actorRole: "admin",
    actorId: "seed-script",
    aiProviderConnectionService: harness.connectionService,
    modelRegistryService: harness.modelRegistryService,
    modelRoutingGovernanceService: harness.modelRoutingGovernanceService,
    connection: {
      name: "Qwen Production",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "sk-qwen-seed-12345678",
    },
    modules: {
      screening: {
        primaryModelName: "qwen-screening-primary",
        fallbackModelName: "qwen-screening-fallback",
      },
      editing: {
        primaryModelName: "qwen-editing-primary",
        fallbackModelName: "qwen-editing-fallback",
      },
      proofreading: {
        primaryModelName: "qwen-proofreading-primary",
        fallbackModelName: "qwen-proofreading-fallback",
      },
    },
  });

  const secondModels = await harness.modelRegistryService.listSystemSettingsModels();
  const secondDefaults =
    await harness.modelRoutingGovernanceService.listSystemSettingsModuleDefaults();
  const secondPolicies = await harness.modelRoutingGovernanceService.listPolicies();

  assert.equal(secondModels.length, firstModels.length);
  assert.deepEqual(
    secondDefaults.map((record) => ({
      moduleKey: record.module_key,
      primaryModelName: record.primary_model_name,
      fallbackModelName: record.fallback_model_name,
    })),
    [
      {
        moduleKey: "screening",
        primaryModelName: "qwen-screening-primary",
        fallbackModelName: "qwen-screening-fallback",
      },
      {
        moduleKey: "editing",
        primaryModelName: "qwen-editing-primary",
        fallbackModelName: "qwen-editing-fallback",
      },
      {
        moduleKey: "proofreading",
        primaryModelName: "qwen-proofreading-primary",
        fallbackModelName: "qwen-proofreading-fallback",
      },
    ],
  );
  assert.deepEqual(
    secondPolicies.map((policy) => ({
      scope: policy.scope_value,
      versionCount: policy.versions.length,
      activeVersionId: policy.active_version?.id,
    })),
    firstPolicies.map((policy) => ({
      scope: policy.scope_value,
      versionCount: policy.versions.length,
      activeVersionId: policy.active_version?.id,
    })),
  );
});
