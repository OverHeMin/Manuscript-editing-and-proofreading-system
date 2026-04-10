import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { PostgresAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/index.ts";
import type { ModelRegistryRecord } from "../../src/modules/model-registry/model-record.ts";
import {
  PostgresModelRegistryRepository,
  PostgresModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/index.ts";

test("postgres model registry persistence stores models and routing policy", async () => {
  await withTemporaryModelRegistryPool(async (pool) => {
    const connectionRepository = new PostgresAiProviderConnectionRepository({
      client: pool,
    });
    const modelRepository = new PostgresModelRegistryRepository({
      client: pool,
    });
    const routingPolicyRepository = new PostgresModelRoutingPolicyRepository({
      client: pool,
    });

    const openAiConnectionId = "00000000-0000-0000-0000-000000000101";
    const anthropicConnectionId = "00000000-0000-0000-0000-000000000102";

    await connectionRepository.save({
      id: openAiConnectionId,
      name: "Primary OpenAI connection",
      provider_kind: "openai",
      compatibility_mode: "openai_chat_compatible",
      base_url: "https://api.openai.example.com",
      enabled: true,
      connection_metadata: { environment: "test" },
    });
    await connectionRepository.save({
      id: anthropicConnectionId,
      name: "Primary Anthropic connection",
      provider_kind: "anthropic",
      compatibility_mode: "anthropic_messages_compatible",
      base_url: "https://api.anthropic.example.com",
      enabled: true,
      connection_metadata: { environment: "test" },
    });

    const openAiRecord = {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      provider: "openai",
      model_name: "gpt-5.4",
      model_version: "2026-03-01",
      allowed_modules: ["screening", "editing", "proofreading"],
      is_prod_allowed: true,
      cost_profile: {
        currency: "USD",
        unit: "per_1m_tokens",
        input: 5,
        output: 15,
      },
      rate_limit: {
        rpm: 60,
        tpm: 120000,
      },
      connection_id: openAiConnectionId,
    } satisfies ModelRegistryRecord & { connection_id: string };
    await modelRepository.save(openAiRecord);
    const anthropicRecord = {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      provider: "anthropic",
      model_name: "claude-sonnet",
      model_version: "2026-02-15",
      allowed_modules: ["editing", "proofreading"],
      is_prod_allowed: true,
      fallback_model_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      connection_id: anthropicConnectionId,
    } satisfies ModelRegistryRecord & { connection_id: string };
    await modelRepository.save(anthropicRecord);
    await routingPolicyRepository.save({
      system_default_model_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      module_defaults: {
        editing: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
      template_overrides: {
        "template-proofreading-core": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
    });

    const loadedPrimaryModel = await modelRepository.findById(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const listedModels = await modelRepository.list();
    const foundByProvider = await modelRepository.findByProviderModelVersion(
      "anthropic",
      "claude-sonnet",
      "2026-02-15",
    );
    const anthropicById = await modelRepository.findById(
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    );
    const loadedPolicy = await routingPolicyRepository.get();

    assert.ok(loadedPrimaryModel, "Expected primary model to be persisted.");
    assert.deepEqual(loadedPrimaryModel, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      provider: "openai",
      model_name: "gpt-5.4",
      model_version: "2026-03-01",
      allowed_modules: ["screening", "editing", "proofreading"],
      is_prod_allowed: true,
      cost_profile: {
        currency: "USD",
        unit: "per_1m_tokens",
        input: 5,
        output: 15,
      },
      rate_limit: {
        rpm: 60,
        tpm: 120000,
      },
      connection_id: openAiConnectionId,
    });
    const modelsById = new Map(listedModels.map((record) => [record.id, record]));
    const openAiListed = modelsById.get(openAiRecord.id);
    const anthropicListed = modelsById.get(anthropicRecord.id);
    assert.ok(openAiListed);
    assert.ok(anthropicListed);
    assert.equal(getConnectionId(openAiListed), openAiConnectionId);
    assert.equal(openAiListed.fallback_model_id, undefined);
    assert.equal(getConnectionId(anthropicListed), anthropicConnectionId);
    assert.equal(
      anthropicListed.fallback_model_id,
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    assert.ok(foundByProvider, "Expected anthropic model to be persisted.");
    assert.deepEqual(foundByProvider, {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      provider: "anthropic",
      model_name: "claude-sonnet",
      model_version: "2026-02-15",
      allowed_modules: ["editing", "proofreading"],
      is_prod_allowed: true,
      fallback_model_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      connection_id: anthropicConnectionId,
    });
    assert.equal(getConnectionId(foundByProvider), anthropicConnectionId);
    assert.ok(anthropicById, "Expected anthropic `findById` to return a record.");
    assert.equal(
      anthropicById.fallback_model_id,
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    assert.equal(getConnectionId(anthropicById), anthropicConnectionId);
    assert.deepEqual(loadedPolicy, {
      system_default_model_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      module_defaults: {
        editing: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
      template_overrides: {
        "template-proofreading-core": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
    });
  });
});

async function withTemporaryModelRegistryPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for model registry persistence test database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

function getConnectionId(record: unknown): string | undefined {
  if (typeof record !== "object" || record === null) {
    return undefined;
  }

  const value = Reflect.get(record, "connection_id");
  return typeof value === "string" ? value : undefined;
}
