import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { PostgresManuscriptRepository } from "../../src/modules/manuscripts/postgres-manuscript-repository.ts";

test("postgres manuscript repository persists current journal template selection", async () => {
  await withMigratedManuscriptPool(async (pool) => {
    const repository = new PostgresManuscriptRepository({
      client: pool,
    });

    await pool.query(
      `
        insert into template_families (id, manuscript_type, name, status)
        values ($1, 'clinical_study', 'Clinical study family', 'active')
      `,
      ["11111111-1111-1111-1111-111111111111"],
    );
    await pool.query(
      `
        insert into journal_template_profiles (
          id,
          template_family_id,
          journal_key,
          journal_name,
          status
        )
        values ($1, $2, $3, $4, 'active')
      `,
      [
        "22222222-2222-2222-2222-222222222222",
        "11111111-1111-1111-1111-111111111111",
        "journal-alpha",
        "Journal Alpha",
      ],
    );

    await repository.save({
      id: "33333333-3333-3333-3333-333333333333",
      title: "Clinical study manuscript",
      manuscript_type: "clinical_study",
      status: "uploaded",
      created_by: "editor-1",
      current_template_family_id: "11111111-1111-1111-1111-111111111111",
      current_journal_template_id: "22222222-2222-2222-2222-222222222222",
      created_at: "2026-04-07T10:00:00.000Z",
      updated_at: "2026-04-07T10:00:00.000Z",
    });

    const loaded = await repository.findById(
      "33333333-3333-3333-3333-333333333333",
    );

    assert.deepEqual(loaded, {
      id: "33333333-3333-3333-3333-333333333333",
      title: "Clinical study manuscript",
      manuscript_type: "clinical_study",
      status: "uploaded",
      created_by: "editor-1",
      current_template_family_id: "11111111-1111-1111-1111-111111111111",
      current_journal_template_id: "22222222-2222-2222-2222-222222222222",
      created_at: "2026-04-07T10:00:00.000Z",
      updated_at: "2026-04-07T10:00:00.000Z",
    });
  });
});

async function withMigratedManuscriptPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for manuscript persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}
