import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiProviderAutoConfigurationService } from "../../src/modules/ai-provider-connections/ai-provider-auto-configuration-service.ts";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/ai-provider-credential-crypto.ts";
import { createAiProviderConnectionService } from "../../src/modules/ai-provider-connections/ai-provider-connection-service.ts";
import { InMemoryAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/in-memory-ai-provider-connection-repository.ts";
import type {
  AiProviderConnectivityProbe,
  AiProviderConnectivityProbeResult,
  AiProviderModelDiscoveryResult,
} from "../../src/modules/ai-provider-connections/openai-chat-compatible-connectivity-probe.ts";
import { InMemoryModelRegistryRepository, InMemoryModelRoutingPolicyRepository } from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import type { RoleKey } from "../../src/users/roles.ts";

const TEST_MASTER_KEY = Buffer.alloc(32, 0x42).toString("base64");
const FIXED_NOW = new Date("2026-04-27T00:00:00Z");
const adminActor = { id: "admin-actor", role: "admin" as RoleKey };

class StubConnectivityProbe implements AiProviderConnectivityProbe {
  private readonly result: AiProviderConnectivityProbeResult;
  private readonly discoveryResult: AiProviderModelDiscoveryResult;
  readonly testedModelNames: string[] = [];

  constructor(
    result: AiProviderConnectivityProbeResult,
    discoveryResult: AiProviderModelDiscoveryResult,
  ) {
    this.result = result;
    this.discoveryResult = discoveryResult;
  }

  async testConnection(input: {
    modelName: string;
  }): Promise<AiProviderConnectivityProbeResult> {
    this.testedModelNames.push(input.modelName);
    return this.result;
  }

  async discoverModels(): Promise<AiProviderModelDiscoveryResult> {
    return this.discoveryResult;
  }
}

function createService(input: {
  probe: AiProviderConnectivityProbe;
  modelIds?: string[];
}) {
  const connectionRepository = new InMemoryAiProviderConnectionRepository();
  const modelRegistryRepository = new InMemoryModelRegistryRepository();
  const connectionService = createAiProviderConnectionService({
    repository: connectionRepository,
    auditService: new InMemoryAuditService(),
    credentialCrypto: new AiProviderCredentialCrypto({
      AI_PROVIDER_MASTER_KEY: TEST_MASTER_KEY,
    } as NodeJS.ProcessEnv),
    connectivityProbe: input.probe,
    now: () => new Date(FIXED_NOW),
    createId: () => "connection-auto-1",
  });
  let modelIdIndex = 0;
  const modelRegistryService = new ModelRegistryService({
    repository: modelRegistryRepository,
    routingPolicyRepository: new InMemoryModelRoutingPolicyRepository(),
    aiProviderConnectionRepository: connectionRepository,
    createId: () =>
      input.modelIds?.[modelIdIndex++] ?? `auto-model-${modelIdIndex++}`,
  });

  return {
    service: new AiProviderAutoConfigurationService({
      connectionService,
      modelRegistryService,
    }),
    connectionRepository,
    modelRegistryRepository,
  };
}

test("auto configuration registers discovered models and wires fallback after a passed probe", async () => {
  const { service, modelRegistryRepository, connectionRepository } = createService({
    modelIds: ["model-primary", "model-fallback"],
    probe: new StubConnectivityProbe(
      { status: "passed", testedAt: FIXED_NOW },
      {
        status: "passed",
        testedAt: FIXED_NOW,
        models: [{ id: "qwen-plus" }, { id: "qwen-turbo" }],
      },
    ),
  });

  const result = await service.configureFromApiKey({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    apiKey: "sk-test",
    providerKind: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    connectionName: "Qwen Auto",
  });

  assert.equal(result.connection.id, "connection-auto-1");
  assert.deepEqual(
    result.registeredModels.map((model) => ({
      id: model.id,
      name: model.model_name,
      fallback: model.fallback_model_id,
      connectionId: model.connection_id,
    })),
    [
      {
        id: "model-primary",
        name: "qwen-plus",
        fallback: "model-fallback",
        connectionId: "connection-auto-1",
      },
      {
        id: "model-fallback",
        name: "qwen-turbo",
        fallback: undefined,
        connectionId: "connection-auto-1",
      },
    ],
  );
  assert.equal(result.test.status, "passed");

  const storedModels = await modelRegistryRepository.list();
  assert.equal(storedModels.length, 2);
  assert.equal(storedModels[0]?.allowed_modules.includes("screening"), true);
  assert.equal(storedModels[0]?.is_prod_allowed, true);
  assert.equal((await connectionRepository.findById("connection-auto-1"))?.last_test_status, "passed");
});

test("auto configuration does not register models when connectivity test fails", async () => {
  const { service, modelRegistryRepository } = createService({
    probe: new StubConnectivityProbe(
      {
        status: "failed",
        testedAt: FIXED_NOW,
        errorSummary: "Provider returned HTTP 401",
      },
      {
        status: "passed",
        testedAt: FIXED_NOW,
        models: [{ id: "qwen-plus" }],
      },
    ),
  });

  const result = await service.configureFromApiKey({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    apiKey: "bad-key",
    providerKind: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  assert.equal(result.test.status, "failed");
  assert.equal(result.registeredModels.length, 0);
  assert.equal((await modelRegistryRepository.list()).length, 0);
});

test("auto configuration uses a current DeepSeek model as the fallback test model", async () => {
  const probe = new StubConnectivityProbe(
    { status: "passed", testedAt: FIXED_NOW },
    {
      status: "failed",
      testedAt: FIXED_NOW,
      models: [],
      errorSummary: "Models endpoint unavailable",
    },
  );
  const { service } = createService({ probe });

  const result = await service.configureFromApiKey({
    actorId: adminActor.id,
    actorRole: adminActor.role,
    apiKey: "sk-test",
    providerKind: "deepseek",
    baseUrl: "https://api.deepseek.com",
    connectionName: "DeepSeek Auto",
  });

  assert.equal(result.test.status, "passed");
  assert.deepEqual(probe.testedModelNames, ["deepseek-v4-flash"]);
});
