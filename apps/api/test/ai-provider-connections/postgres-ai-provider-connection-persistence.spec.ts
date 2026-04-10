import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { PostgresAiProviderConnectionRepository } from "../../src/modules/ai-provider-connections/index.ts";

test("postgres ai provider connection persistence captures credentials and test status", async () => {
  await withTemporaryAiProviderConnectionPool(async (pool) => {
    const repository = new PostgresAiProviderConnectionRepository({ client: pool });
    const connectionId = "00000000-0000-0000-0000-000000000111";
    const credentialId = "00000000-0000-0000-0000-000000000222";
    const baseUrlWithSlash = "https://api-edge.example.com/";
    const normalizedBaseUrl = "https://api-edge.example.com";

    await repository.save({
      id: connectionId,
      name: "Edge bridge",
      provider_kind: "openai_compatible",
      compatibility_mode: "openai_chat_compatible",
      base_url: baseUrlWithSlash,
      enabled: true,
      connection_metadata: { region: "us-west" },
    });

    const [savedConnection] = await repository.list();
    assert.ok(savedConnection, "Expected to list the saved connection.");
    assert.equal(savedConnection.id, connectionId);
    assert.equal(savedConnection.provider_kind, "openai_compatible");
    assert.equal(savedConnection.compatibility_mode, "openai_chat_compatible");
    assert.equal(savedConnection.base_url, normalizedBaseUrl);
    assert.deepEqual(savedConnection.connection_metadata, { region: "us-west" });

    await repository.saveCredential({
      id: credentialId,
      connection_id: connectionId,
      credential_ciphertext: "ciphertext:v1:edge-token",
      credential_mask: "****",
      credential_version: 3,
      last_rotated_at: new Date("2026-04-10T00:00:00Z"),
    });

    const credentialRowResult = await pool.query<{
      id: string;
      connection_id: string;
      credential_ciphertext: string;
      credential_mask: string;
      credential_version: number;
      last_rotated_at: Date;
    }>(
      `
        select
          id,
          connection_id,
          credential_ciphertext,
          credential_mask,
          credential_version,
          last_rotated_at
        from ai_provider_credentials
        where id = $1
      `,
      [credentialId],
    );
    assert.equal(
      credentialRowResult.rowCount,
      1,
      "Expected the credential row to persist in ai_provider_credentials.",
    );
    const credentialRow = credentialRowResult.rows[0];
    assert.equal(credentialRow.connection_id, connectionId);
    assert.equal(credentialRow.credential_mask, "****");
    assert.equal(credentialRow.credential_version, 3);
    assert.equal(
      credentialRow.credential_ciphertext,
      "ciphertext:v1:edge-token",
    );
    assert.ok(
      credentialRow.last_rotated_at instanceof Date,
      "Expected last_rotated_at to round-trip as a timestamp.",
    );

    const testTimestamp = new Date("2026-04-10T01:00:00Z");
    await repository.updateConnectionTestStatus({
      connection_id: connectionId,
      status: "failed",
      error_summary: "timeout during handshake",
      tested_at: testTimestamp,
    });

    const reloaded = await repository.findById(connectionId);
    assert.ok(reloaded, "Expected to load the connection after updates.");
    assert.equal(reloaded.base_url, normalizedBaseUrl);
    assert.equal(reloaded.last_test_status, "failed");
    assert.equal(reloaded.last_error_summary, "timeout during handshake");
    expectCredentialSummary(reloaded, { mask: "****", version: 3 });
    assertLastTestAt(reloaded, testTimestamp);

    const [listedWithCredentials] = await repository.list();
    assert.ok(
      listedWithCredentials,
      "Expected the credential summary to surface on list.",
    );
    expectCredentialSummary(listedWithCredentials, { mask: "****", version: 3 });
    assertLastTestAt(listedWithCredentials, testTimestamp);
  });
});

async function withTemporaryAiProviderConnectionPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migration = runMigrateProcess(databaseUrl);
    assert.equal(
      migration.status,
      0,
      `Expected migrate to succeed for ai provider connection persistence database.\n${migration.stdout}\n${migration.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

function expectCredentialSummary(
  record: unknown,
  summary: { mask: string; version: number },
): void {
  assert.deepEqual(Reflect.get(record, "credential_summary"), summary);
}

function assertLastTestAt(record: unknown, expected: Date): void {
  const value = Reflect.get(record, "last_test_at");
  assert.ok(value !== undefined, "Expected last_test_at to be present.");
  const actualDate =
    value instanceof Date ? value : new Date(String(value));
  assert.equal(
    actualDate.getTime(),
    expected.getTime(),
    "Expected last_test_at to round-trip the tested timestamp.",
  );
}
