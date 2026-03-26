import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { withTemporaryDatabase, withTestClient } from "./support/postgres.ts";
import { getMigrationChecksum, runMigrateProcess } from "./support/migrate-process.ts";

const expectedTableColumns: Record<string, string[]> = {
  manuscripts: [
    "id",
    "title",
    "manuscript_type",
    "status",
    "created_by",
    "current_template_family_id",
  ],
  document_assets: [
    "id",
    "manuscript_id",
    "asset_type",
    "status",
    "storage_key",
    "source_job_id",
    "is_current",
  ],
  jobs: ["id", "manuscript_id", "module", "job_type", "status", "requested_by"],
  template_families: ["id", "manuscript_type", "name", "status"],
  module_templates: [
    "id",
    "template_family_id",
    "module",
    "manuscript_type",
    "version_no",
    "status",
    "prompt",
  ],
  knowledge_items: [
    "id",
    "title",
    "canonical_text",
    "knowledge_kind",
    "module_scope",
    "manuscript_types",
    "status",
  ],
  learning_candidates: [
    "id",
    "type",
    "status",
    "module",
    "manuscript_type",
    "snapshot_asset_id",
  ],
  model_registry: [
    "id",
    "provider",
    "model_name",
    "model_version",
    "allowed_modules",
    "fallback_model_id",
  ],
  audit_logs: ["id", "actor_id", "action", "target_table", "target_id", "created_at"],
};

const expectedIndexes = [
  "manuscripts_status_idx",
  "document_assets_manuscript_id_idx",
  "knowledge_items_status_module_scope_idx",
  "knowledge_items_manuscript_types_gin_idx",
  "knowledge_items_risk_tags_gin_idx",
  "module_templates_manuscript_type_module_idx",
];

const expectedRoleKeys = [
  "admin",
  "editor",
  "knowledge_reviewer",
  "proofreader",
  "screener",
  "user",
];

test("database schema exposes the required core tables and columns", { concurrency: false }, async () => {
  await withTestClient(async (client) => {
    const tablesResult = await client.query<{
      table_name: string;
      column_name: string;
    }>(
      `
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [Object.keys(expectedTableColumns)],
    );

    const columnsByTable = new Map<string, Set<string>>();

    for (const row of tablesResult.rows) {
      if (!columnsByTable.has(row.table_name)) {
        columnsByTable.set(row.table_name, new Set());
      }

      columnsByTable.get(row.table_name)?.add(row.column_name);
    }

    const missingTables = Object.keys(expectedTableColumns).filter(
      (tableName) => !columnsByTable.has(tableName),
    );

    assert.deepEqual(
      missingTables,
      [],
      `Missing core tables: ${missingTables.join(", ") || "none"}`,
    );

    for (const [tableName, expectedColumns] of Object.entries(expectedTableColumns)) {
      const actualColumns = columnsByTable.get(tableName) ?? new Set<string>();
      const missingColumns = expectedColumns.filter((columnName) => !actualColumns.has(columnName));

      assert.deepEqual(
        missingColumns,
        [],
        `Table ${tableName} is missing columns: ${missingColumns.join(", ") || "none"}`,
      );
    }
  });
});

test("database schema creates the required lookup indexes", { concurrency: false }, async () => {
  await withTestClient(async (client) => {
    const indexesResult = await client.query<{ indexname: string }>(
      `
        select indexname
        from pg_indexes
        where schemaname = 'public'
      `,
    );

    const actualIndexNames = new Set(indexesResult.rows.map((row) => row.indexname));
    const missingIndexes = expectedIndexes.filter((indexName) => !actualIndexNames.has(indexName));

    assert.deepEqual(
      missingIndexes,
      [],
      `Missing lookup indexes: ${missingIndexes.join(", ") || "none"}`,
    );
  });
});

test("migration seeds system roles and records migration bookkeeping", { concurrency: false }, async () => {
  await withTestClient(async (client) => {
    const rolesResult = await client.query<{ key: string }>(
      `
        select key
        from roles
        order by key
      `,
    );
    const migrationResult = await client.query<{ version: string; checksum: string }>(
      `
        select version, checksum
        from schema_migrations
        order by version
      `,
    );

    assert.deepEqual(
      rolesResult.rows.map((row) => row.key),
      expectedRoleKeys,
      "System roles should be present after migration and seeding.",
    );
    assert.deepEqual(
      migrationResult.rows,
      [
        {
          version: "0001_initial.sql",
          checksum: getMigrationChecksum("0001_initial.sql"),
        },
        {
          version: "0002_model_registry_version_guard.sql",
          checksum: getMigrationChecksum("0002_model_registry_version_guard.sql"),
        },
      ],
      "Expected migration bookkeeping for both applied database migrations.",
    );
  });
});

test("model_registry rejects duplicate unversioned models", { concurrency: false }, async () => {
  await withTestClient(async (client) => {
    const modelName = `gpt-unversioned-regression-${process.pid}`;

    await client.query(
      `
        delete from model_registry
        where model_name = $1
      `,
      [modelName],
    );

    try {
      await client.query(
        `
          insert into model_registry (
            provider,
            model_name,
            allowed_modules,
            is_prod_allowed
          )
          values (
            'openai',
            $1,
            array['screening']::module_type[],
            false
          )
        `,
        [modelName],
      );

      await assert.rejects(
        () =>
          client.query(
            `
              insert into model_registry (
                provider,
                model_name,
                allowed_modules,
                is_prod_allowed
              )
              values (
                'openai',
                $1,
                array['screening']::module_type[],
                true
              )
            `,
            [modelName],
          ),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, "23505");
          return true;
        },
        "Expected duplicate logical unversioned models to be rejected.",
      );
    } finally {
      await client.query(
        `
          delete from model_registry
          where model_name = $1
        `,
        [modelName],
      );
    }
  });
});

test("migrate detects checksum mismatches before applying anything new", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(
        `
          update schema_migrations
          set checksum = 'tampered-checksum'
          where version = '0001_initial.sql'
        `,
      );
    } finally {
      await client.end();
    }

    const result = runMigrateProcess(databaseUrl);
    assert.notEqual(result.status, 0, "Expected migrate to fail on checksum mismatch.");
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /Migration checksum mismatch for 0001_initial\.sql/,
    );
  });
});
