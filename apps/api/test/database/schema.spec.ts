import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { withTemporaryDatabase, withTestClient } from "./support/postgres.ts";
import { getMigrationChecksum, runMigrateProcess } from "./support/migrate-process.ts";

const expectedTableColumns: Record<string, string[]> = {
  roles: ["key", "description", "created_at"],
  users: [
    "id",
    "username",
    "display_name",
    "role_key",
    "password_hash",
    "status",
    "created_at",
    "updated_at",
  ],
  auth_sessions: [
    "id",
    "user_id",
    "provider",
    "issued_at",
    "expires_at",
    "refresh_at",
    "ip_address",
    "user_agent",
    "revoked_at",
  ],
  login_attempts: [
    "username",
    "failure_count",
    "first_failed_at",
    "last_failed_at",
    "locked_until",
  ],
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
    "file_name",
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
    "source_learning_candidate_id",
  ],
  knowledge_items: [
    "id",
    "title",
    "canonical_text",
    "knowledge_kind",
    "module_scope",
    "manuscript_types",
    "status",
    "source_learning_candidate_id",
  ],
  knowledge_review_actions: [
    "id",
    "knowledge_item_id",
    "action",
    "actor_role",
    "review_note",
    "created_at",
  ],
  learning_candidates: [
    "id",
    "type",
    "status",
    "module",
    "manuscript_type",
    "snapshot_asset_id",
  ],
  learning_writebacks: [
    "id",
    "learning_candidate_id",
    "target_type",
    "status",
    "created_draft_asset_id",
    "created_by",
    "created_at",
    "applied_by",
    "applied_at",
  ],
  prompt_templates: [
    "id",
    "name",
    "version",
    "status",
    "module",
    "manuscript_types",
    "rollback_target_version",
    "source_learning_candidate_id",
  ],
  skill_packages: [
    "id",
    "name",
    "version",
    "scope",
    "status",
    "applies_to_modules",
    "dependency_tools",
    "source_learning_candidate_id",
  ],
  model_routing_policies: [
    "singleton_key",
    "system_default_model_id",
    "module_defaults",
    "template_overrides",
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
  "users_username_idx",
  "auth_sessions_user_id_idx",
  "auth_sessions_active_expires_at_idx",
  "manuscripts_status_idx",
  "document_assets_manuscript_id_idx",
  "knowledge_items_status_module_scope_idx",
  "knowledge_items_manuscript_types_gin_idx",
  "knowledge_items_risk_tags_gin_idx",
  "knowledge_review_actions_knowledge_item_id_created_at_idx",
  "learning_writebacks_candidate_target_status_idx",
  "prompt_templates_module_name_status_idx",
  "skill_packages_name_status_idx",
  "module_templates_manuscript_type_module_idx",
  "module_templates_template_family_id_module_status_idx",
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
        {
          version: "0003_document_assets_file_name.sql",
          checksum: getMigrationChecksum("0003_document_assets_file_name.sql"),
        },
        {
          version: "0004_auth_persistence.sql",
          checksum: getMigrationChecksum("0004_auth_persistence.sql"),
        },
        {
          version: "0005_governed_registry_persistence.sql",
          checksum: getMigrationChecksum("0005_governed_registry_persistence.sql"),
        },
        {
          version: "0006_prompt_skill_registry_persistence.sql",
          checksum: getMigrationChecksum("0006_prompt_skill_registry_persistence.sql"),
        },
        {
          version: "0007_model_routing_policy_persistence.sql",
          checksum: getMigrationChecksum("0007_model_routing_policy_persistence.sql"),
        },
      ],
      "Expected migration bookkeeping for all applied database migrations.",
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

test("migrate accepts line-ending-only checksum differences for existing migrations", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const initialMigration = runMigrateProcess(databaseUrl);
    assert.equal(initialMigration.status, 0, "Expected migrate to succeed for a fresh isolated database.");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      for (const fileName of [
        "0001_initial.sql",
        "0002_model_registry_version_guard.sql",
        "0003_document_assets_file_name.sql",
        "0004_auth_persistence.sql",
        "0005_governed_registry_persistence.sql",
        "0006_prompt_skill_registry_persistence.sql",
        "0007_model_routing_policy_persistence.sql",
      ]) {
        await client.query(
          `
            update schema_migrations
            set checksum = $1
            where version = $2
          `,
          [getLineEndingNormalizedMigrationChecksum(fileName), fileName],
        );
      }
    } finally {
      await client.end();
    }

    const rerunMigration = runMigrateProcess(databaseUrl);
    assert.equal(
      rerunMigration.status,
      0,
      `Expected migrate to accept equivalent line-ending-only checksum changes.\n${rerunMigration.stdout}\n${rerunMigration.stderr}`,
    );
  });
});

function getLineEndingNormalizedMigrationChecksum(fileName: string): string {
  const migrationFilePath = path.join(
    import.meta.dirname,
    "../../src/database/migrations",
    fileName,
  );
  const migrationSql = readFileSync(migrationFilePath, "utf8").replaceAll("\r\n", "\n");
  return createHash("sha256").update(migrationSql).digest("hex");
}
