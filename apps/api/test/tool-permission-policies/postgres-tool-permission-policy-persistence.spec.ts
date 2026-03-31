import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres tool permission policy repository persists allowlists and risk flags", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresToolPermissionPolicyRepository({
        client: pool,
      });

      await repository.save({
        id: "policy-1",
        name: "Editing Policy",
        status: "active",
        default_mode: "read",
        allowed_tool_ids: ["tool-1", "tool-2"],
        high_risk_tool_ids: ["tool-2"],
        write_requires_confirmation: true,
        admin_only: true,
      });

      const loaded = await repository.findById("policy-1");
      const list = await repository.list();

      assert.deepEqual(loaded, {
        id: "policy-1",
        name: "Editing Policy",
        status: "active",
        default_mode: "read",
        allowed_tool_ids: ["tool-1", "tool-2"],
        high_risk_tool_ids: ["tool-2"],
        write_requires_confirmation: true,
        admin_only: true,
      });
      assert.deepEqual(list.map((record) => record.id), ["policy-1"]);
    } finally {
      await pool.end();
    }
  });
});
