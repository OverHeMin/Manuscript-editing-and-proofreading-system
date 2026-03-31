import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresAgentProfileRepository } from "../../src/modules/agent-profiles/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres agent profile repository persists fixed platform roles and any-scope fields", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresAgentProfileRepository({ client: pool });

      await repository.save({
        id: "agent-profile-1",
        name: "Verification Operator",
        role_key: "gstack",
        status: "published",
        module_scope: "any",
        manuscript_types: "any",
        description: "Runs verification flows.",
        admin_only: true,
      });

      const loaded = await repository.findById("agent-profile-1");
      const list = await repository.list();

      assert.deepEqual(loaded, {
        id: "agent-profile-1",
        name: "Verification Operator",
        role_key: "gstack",
        status: "published",
        module_scope: "any",
        manuscript_types: "any",
        description: "Runs verification flows.",
        admin_only: true,
      });
      assert.deepEqual(list.map((record) => record.id), ["agent-profile-1"]);
    } finally {
      await pool.end();
    }
  });
});
