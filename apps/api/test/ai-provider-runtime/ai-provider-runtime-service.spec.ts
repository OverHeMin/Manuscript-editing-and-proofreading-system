import test from "node:test";
import assert from "node:assert/strict";
import type { ResolvedModelSelection } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/ai-provider-credential-crypto.ts";
import { InMemoryAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/in-memory-ai-provider-connection-repository.ts";
import type { ModelRegistryRecord } from "../../src/modules/model-registry/model-record.ts";
import {
  AiProviderRuntimeConfigurationError,
  createAiProviderRuntimeService,
} from "../../src/modules/ai-provider-runtime/index.ts";

const TEST_MASTER_KEY = Buffer.alloc(32, 0x43).toString("base64");

function createRuntimeHarness() {
  const repository = new InMemoryAiProviderConnectionRepository();
  const credentialCrypto = new AiProviderCredentialCrypto({
    AI_PROVIDER_MASTER_KEY: TEST_MASTER_KEY,
  } as NodeJS.ProcessEnv);
  const service = createAiProviderRuntimeService({
    repository,
    credentialCrypto,
  });

  return {
    repository,
    credentialCrypto,
    service,
  };
}

function buildSelection(input?: {
  model?: Partial<ModelRegistryRecord>;
  fallbackChain?: ModelRegistryRecord[];
}): ResolvedModelSelection {
  return {
    layer: "module_policy",
    model: {
      id: "model-primary",
      provider: "openai",
      model_name: "qwen-max",
      model_version: "2026-04",
      allowed_modules: ["editing"],
      is_prod_allowed: true,
      connection_id: "connection-primary",
      ...input?.model,
    },
    fallback_chain: input?.fallbackChain ?? [],
    warnings: [],
  };
}

async function saveConnection(input: {
  repository: InMemoryAiProviderConnectionRepository;
  credentialCrypto: AiProviderCredentialCrypto;
  id?: string;
  name?: string;
  providerKind: string;
  compatibilityMode?: string;
  baseUrl?: string;
  enabled?: boolean;
  apiKey?: string;
}) {
  const connectionId = input.id ?? "connection-primary";
  await input.repository.save({
    id: connectionId,
    name: input.name ?? `${input.providerKind}-connection`,
    provider_kind: input.providerKind,
    compatibility_mode: input.compatibilityMode ?? "openai_chat_compatible",
    base_url: input.baseUrl ?? "https://example.invalid/v1/",
    enabled: input.enabled ?? true,
  });

  if (input.apiKey) {
    await input.repository.saveCredential({
      id: `${connectionId}-credential`,
      connection_id: connectionId,
      credential_ciphertext: input.credentialCrypto.encrypt({
        apiKey: input.apiKey,
      }),
      credential_mask: input.credentialCrypto.maskApiKey(input.apiKey),
      last_rotated_at: new Date("2026-04-10T08:00:00.000Z"),
    });
  }
}

test("runtime service resolves request-ready targets for every phase-1 provider kind", async () => {
  const providerKinds = ["qwen", "deepseek", "openai", "openai_compatible"];

  for (const providerKind of providerKinds) {
    const harness = createRuntimeHarness();
    await saveConnection({
      repository: harness.repository,
      credentialCrypto: harness.credentialCrypto,
      providerKind,
      baseUrl: "https://provider.example.com/v1/",
      apiKey: "sk-runtime-provider",
    });

    const resolved = await harness.service.resolveSelectionRuntime(
      buildSelection(),
    );

    assert.equal(resolved.primary.adapter, "openai_chat_compatible");
    assert.equal(resolved.primary.provider_kind, providerKind);
    assert.equal(resolved.primary.base_url, "https://provider.example.com/v1");
    assert.equal(
      resolved.primary.request_url,
      "https://provider.example.com/v1/chat/completions",
    );
    assert.equal(
      resolved.primary.headers.Authorization,
      "Bearer sk-runtime-provider",
    );
    assert.equal(
      resolved.primary.headers["Content-Type"],
      "application/json",
    );
  }
});

test("runtime service rejects legacy-unbound selections at runtime resolution time", async () => {
  const harness = createRuntimeHarness();

  await assert.rejects(
    () =>
      harness.service.resolveSelectionRuntime(
        buildSelection({
          model: {
            connection_id: undefined,
          },
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderRuntimeConfigurationError);
      assert.equal(error.code, "legacy_unbound");
      return true;
    },
  );
});

test("runtime service fails closed when the bound connection is missing disabled or incomplete", async () => {
  const harness = createRuntimeHarness();

  await saveConnection({
    repository: harness.repository,
    credentialCrypto: harness.credentialCrypto,
    id: "connection-disabled",
    providerKind: "qwen",
    enabled: false,
    apiKey: "sk-disabled",
  });
  await saveConnection({
    repository: harness.repository,
    credentialCrypto: harness.credentialCrypto,
    id: "connection-no-credential",
    providerKind: "deepseek",
  });
  await saveConnection({
    repository: harness.repository,
    credentialCrypto: harness.credentialCrypto,
    id: "connection-unsupported",
    providerKind: "openai_compatible",
    compatibilityMode: "anthropic_messages",
    apiKey: "sk-unsupported",
  });

  await assert.rejects(
    () =>
      harness.service.resolveSelectionRuntime(
        buildSelection({
          model: {
            connection_id: "connection-missing",
          },
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderRuntimeConfigurationError);
      assert.equal(error.code, "connection_missing");
      return true;
    },
  );

  await assert.rejects(
    () =>
      harness.service.resolveSelectionRuntime(
        buildSelection({
          model: {
            connection_id: "connection-disabled",
          },
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderRuntimeConfigurationError);
      assert.equal(error.code, "connection_disabled");
      return true;
    },
  );

  await assert.rejects(
    () =>
      harness.service.resolveSelectionRuntime(
        buildSelection({
          model: {
            connection_id: "connection-no-credential",
          },
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderRuntimeConfigurationError);
      assert.equal(error.code, "credential_missing");
      return true;
    },
  );

  await assert.rejects(
    () =>
      harness.service.resolveSelectionRuntime(
        buildSelection({
          model: {
            connection_id: "connection-unsupported",
          },
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderRuntimeConfigurationError);
      assert.equal(error.code, "unsupported_adapter");
      return true;
    },
  );
});

test("runtime service only plans one-hop fallback for transient provider failures and records primary fallback reason", () => {
  const harness = createRuntimeHarness();
  const selection = buildSelection({
    fallbackChain: [
      {
        id: "model-fallback",
        provider: "openai",
        model_name: "fallback-model",
        model_version: "2026-04",
        allowed_modules: ["editing"],
        is_prod_allowed: true,
        connection_id: "connection-fallback",
      },
    ],
  });

  const transientCases = [
    {
      failure: { kind: "timeout" } as const,
      reason: "timeout",
    },
    {
      failure: { kind: "http", status: 429 } as const,
      reason: "rate_limit",
    },
    {
      failure: { kind: "http", status: 502 } as const,
      reason: "upstream_5xx",
    },
  ];

  for (const testCase of transientCases) {
    const decision = harness.service.planFallbackFromFailure({
      selection,
      failure: testCase.failure,
    });

    assert.equal(decision.allow_fallback, true);
    assert.equal(decision.primary_model_id, "model-primary");
    assert.equal(decision.fallback_model_id, "model-fallback");
    assert.equal(decision.reason, testCase.reason);
    assert.deepEqual(decision.log_entry, {
      primary_model_id: "model-primary",
      fallback_model_id: "model-fallback",
      reason: testCase.reason,
    });
  }

  const configFailure = new AiProviderRuntimeConfigurationError(
    "connection_missing",
    "Resolved model references a missing ai provider connection.",
  );
  const configDecision = harness.service.planFallbackFromFailure({
    selection,
    failure: {
      kind: "configuration",
      error: configFailure,
    },
  });

  assert.equal(configDecision.allow_fallback, false);
  assert.equal(configDecision.primary_model_id, "model-primary");
  assert.equal(configDecision.fallback_model_id, "model-fallback");
  assert.equal(configDecision.reason, "connection_missing");
  assert.deepEqual(configDecision.log_entry, {
    primary_model_id: "model-primary",
    fallback_model_id: "model-fallback",
    reason: "connection_missing",
  });
});
