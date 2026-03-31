import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import {
  PostgresModelRegistryRepository,
  PostgresModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/index.ts";

test("postgres model registry persistence stores models and routing policy", async () => {
  await withTemporaryModelRegistryPool(async (pool) => {
    const modelRepository = new PostgresModelRegistryRepository({
      client: pool,
    });
    const routingPolicyRepository = new PostgresModelRoutingPolicyRepository({
      client: pool,
    });

    await modelRepository.save({
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
    });
    await modelRepository.save({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      provider: "anthropic",
      model_name: "claude-sonnet",
      model_version: "2026-02-15",
      allowed_modules: ["editing", "proofreading"],
      is_prod_allowed: true,
      fallback_model_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
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
    const loadedPolicy = await routingPolicyRepository.get();

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
    });
    assert.deepEqual(
      listedModels.map((record) => ({
        id: record.id,
        provider: record.provider,
        model_name: record.model_name,
      })),
      [
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          provider: "anthropic",
          model_name: "claude-sonnet",
        },
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          provider: "openai",
          model_name: "gpt-5.4",
        },
      ],
    );
    assert.deepEqual(foundByProvider, {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      provider: "anthropic",
      model_name: "claude-sonnet",
      model_version: "2026-02-15",
      allowed_modules: ["editing", "proofreading"],
      is_prod_allowed: true,
      fallback_model_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
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
