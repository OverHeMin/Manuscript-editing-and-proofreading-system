import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/ai-provider-credential-crypto.ts";
import { createAiProviderConnectionService } from "../../src/modules/ai-provider-connections/ai-provider-connection-service.ts";
import { InMemoryAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/in-memory-ai-provider-connection-repository.ts";
import {
  AiProviderAutoConfigurationService,
  type AiProviderModelDiscoveryClient,
} from "../../src/modules/ai-provider-connections/ai-provider-auto-configuration-service.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
  ModelRegistryService,
} from "../../src/modules/model-registry/index.ts";
import {
  InMemoryModelRoutingGovernanceRepository,
  ModelRoutingGovernanceService,
} from "../../src/modules/model-routing-governance/index.ts";
import type { RoleKey } from "../../src/users/roles.ts";

const TEST_MASTER_KEY = Buffer.alloc(32, 0x52).toString("base64");
const adminRole = "admin" satisfies RoleKey;

function createDeterministicIdFactory() {
  let nextId = 0;
  return () => `generated-${++nextId}`;
}

function createHarness(input: {
  discoveryClient?: AiProviderModelDiscoveryClient;
} = {}) {
  const createId = createDeterministicIdFactory();
  const aiProviderRepository = new InMemoryAiProviderConnectionRepository();
  const modelRegistryRepository = new InMemoryModelRegistryRepository();
  const modelRoutingGovernanceRepository = new InMemoryModelRoutingGovernanceRepository();
  const modelRoutingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const aiProviderConnectionService = createAiProviderConnectionService({
    repository: aiProviderRepository,
    auditService: new InMemoryAuditService(),
    credentialCrypto: new AiProviderCredentialCrypto({
      AI_PROVIDER_MASTER_KEY: TEST_MASTER_KEY,
    } as NodeJS.ProcessEnv),
    createId,
  });
  const modelRegistryService = new ModelRegistryService({
    repository: modelRegistryRepository,
    routingPolicyRepository: modelRoutingPolicyRepository,
    aiProviderConnectionRepository: aiProviderRepository,
    createId,
  });
  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository: modelRoutingGovernanceRepository,
    modelRegistryRepository,
    createId,
  });
  const service = new AiProviderAutoConfigurationService({
    aiProviderConnectionService,
    modelRegistryService,
    modelRoutingGovernanceService,
    discoveryClient: input.discoveryClient,
  });

  return {
    service,
    aiProviderRepository,
    modelRegistryRepository,
    modelRoutingGovernanceService,
  };
}

test("auto configuration creates a DeepSeek connection, discovered model, and module routes without echoing the key", async () => {
  const discoveredModel = {
    id: "deepseek-chat",
    name: "deepseek-chat",
    contextWindow: 64_000,
    supportsJsonMode: true,
  };
  const { service, aiProviderRepository, modelRegistryRepository, modelRoutingGovernanceService } =
    createHarness({
      discoveryClient: {
        async discoverModels() {
          return [discoveredModel];
        },
      },
    });

  const result = await service.configure({
    actorId: "admin-1",
    actorRole: adminRole,
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "sk-deepseek-auto-config-test-key",
    defaultModel: "deepseek-chat",
    moduleRoutes: {
      screening: "deepseek-chat",
      editing: "deepseek-chat",
      proofreading: "deepseek-chat",
    },
    discoverModels: true,
  });

  assert.equal(result.connection.provider_kind, "deepseek");
  assert.equal(result.connection.base_url, "https://api.deepseek.com");
  assert.equal(result.connection.credential_summary?.mask.includes("auto-config-test-key"), false);
  assert.equal(JSON.stringify(result).includes("sk-deepseek-auto-config-test-key"), false);
  assert.equal(result.models.length, 1);
  assert.equal(result.models[0].model_name, "deepseek-chat");
  assert.deepEqual(result.models[0].allowed_modules, ["screening", "editing", "proofreading"]);
  assert.equal(result.models[0].connection_id, result.connection.id);
  assert.equal(result.discovery.status, "discovered");
  assert.equal(result.discovery.models[0].contextWindow, 64_000);
  assert.equal(result.discovery.models[0].supportsJsonMode, true);

  const credential = await aiProviderRepository.findCredentialByConnectionId(result.connection.id);
  assert.ok(credential);
  assert.notEqual(credential.credential_ciphertext, "sk-deepseek-auto-config-test-key");

  const models = await modelRegistryRepository.list();
  assert.equal(models.length, 1);
  const defaults = await modelRoutingGovernanceService.listSystemSettingsModuleDefaults();
  assert.deepEqual(
    defaults.map((record) => [record.module_key, record.primary_model_id]),
    [
      ["screening", result.models[0].id],
      ["editing", result.models[0].id],
      ["proofreading", result.models[0].id],
    ],
  );
});

test("auto configuration falls back to the requested model when provider model discovery fails", async () => {
  const { service } = createHarness({
    discoveryClient: {
      async discoverModels() {
        throw new Error("models endpoint unavailable");
      },
    },
  });

  const result = await service.configure({
    actorId: "admin-1",
    actorRole: adminRole,
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "sk-qwen-auto-config-test-key",
    defaultModel: "qwen-max",
    moduleRoutes: {
      proofreading: "qwen-max",
    },
    discoverModels: true,
  });

  assert.equal(result.connection.provider_kind, "qwen");
  assert.equal(result.discovery.status, "fallback");
  assert.match(result.discovery.errorSummary ?? "", /models endpoint unavailable/);
  assert.equal(result.models[0].model_name, "qwen-max");
  assert.deepEqual(result.models[0].allowed_modules, ["proofreading"]);
  assert.equal(JSON.stringify(result).includes("sk-qwen-auto-config-test-key"), false);
});
