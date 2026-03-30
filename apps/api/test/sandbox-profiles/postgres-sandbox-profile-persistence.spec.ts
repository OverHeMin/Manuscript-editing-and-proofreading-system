import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresSandboxProfileRepository } from "../../src/modules/sandbox-profiles/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres sandbox profile repository persists risk posture fields", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresSandboxProfileRepository({ client: pool });

      await repository.save({
        id: "sandbox-1",
        name: "Editing Workspace",
        status: "active",
        sandbox_mode: "workspace_write",
        network_access: false,
        approval_required: true,
        allowed_tool_ids: ["tool-1", "tool-2"],
        admin_only: true,
      });

      const loaded = await repository.findById("sandbox-1");
      const list = await repository.list();

      assert.deepEqual(loaded, {
        id: "sandbox-1",
        name: "Editing Workspace",
        status: "active",
        sandbox_mode: "workspace_write",
        network_access: false,
        approval_required: true,
        allowed_tool_ids: ["tool-1", "tool-2"],
        admin_only: true,
      });
      assert.deepEqual(list.map((record) => record.id), ["sandbox-1"]);
    } finally {
      await pool.end();
    }
  });
});
