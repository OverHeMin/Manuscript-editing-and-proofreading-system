import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresAgentRuntimeRepository } from "../../src/modules/agent-runtime/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres agent runtime repository persists module-scoped runtimes", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresAgentRuntimeRepository({ client: pool });

      await repository.save({
        id: "runtime-1",
        name: "Deep Editing Runtime",
        adapter: "deepagents",
        status: "active",
        sandbox_profile_id: "sandbox-1",
        allowed_modules: ["editing"],
        runtime_slot: "editing",
        admin_only: true,
      });
      await repository.save({
        id: "runtime-2",
        name: "Internal Screening Runtime",
        adapter: "internal_prompt",
        status: "draft",
        allowed_modules: ["screening"],
        admin_only: true,
      });

      const editing = await repository.listByModule("editing", true);
      const all = await repository.list();
      const runtime = await repository.findById("runtime-1");

      assert.deepEqual(editing.map((record) => record.id), ["runtime-1"]);
      assert.deepEqual(all.map((record) => record.id), ["runtime-1", "runtime-2"]);
      assert.deepEqual(runtime, {
        id: "runtime-1",
        name: "Deep Editing Runtime",
        adapter: "deepagents",
        status: "active",
        sandbox_profile_id: "sandbox-1",
        allowed_modules: ["editing"],
        runtime_slot: "editing",
        admin_only: true,
      });
    } finally {
      await pool.end();
    }
  });
});
