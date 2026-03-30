import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresToolGatewayRepository } from "../../src/modules/tool-gateway/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres tool gateway repository persists scoped tools and updates", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const repository = new PostgresToolGatewayRepository({ client: pool });

      await repository.save({
        id: "tool-1",
        name: "knowledge.search",
        scope: "knowledge",
        access_mode: "read",
        admin_only: true,
      });
      await repository.save({
        id: "tool-1",
        name: "knowledge.search",
        scope: "knowledge",
        access_mode: "write",
        admin_only: true,
      });
      await repository.save({
        id: "tool-2",
        name: "browser.capture",
        scope: "browser_qa",
        access_mode: "read",
        admin_only: true,
      });

      const knowledgeTools = await repository.listByScope("knowledge");
      const loaded = await repository.findById("tool-1");

      assert.deepEqual(knowledgeTools.map((record) => record.id), ["tool-1"]);
      assert.equal(loaded?.access_mode, "write");
    } finally {
      await pool.end();
    }
  });
});
