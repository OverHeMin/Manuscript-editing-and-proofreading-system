import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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
  evaluation_sample_sets: [
    "id",
    "name",
    "module",
    "manuscript_types",
    "risk_tags",
    "sample_count",
    "source_policy",
    "status",
    "admin_only",
  ],
  evaluation_sample_set_items: [
    "id",
    "sample_set_id",
    "manuscript_id",
    "snapshot_asset_id",
    "reviewed_case_snapshot_id",
    "module",
    "manuscript_type",
    "risk_tags",
  ],
  verification_check_profiles: [
    "id",
    "name",
    "check_type",
    "status",
    "tool_ids",
    "admin_only",
  ],
  release_check_profiles: [
    "id",
    "name",
    "check_type",
    "status",
    "verification_check_profile_ids",
    "admin_only",
  ],
  evaluation_suites: [
    "id",
    "name",
    "suite_type",
    "status",
    "verification_check_profile_ids",
    "module_scope",
    "module_scope_is_any",
    "requires_production_baseline",
    "supports_ab_comparison",
    "hard_gate_policy",
    "score_weights",
    "admin_only",
  ],
  verification_evidence: [
    "id",
    "kind",
    "label",
    "uri",
    "artifact_asset_id",
    "check_profile_id",
    "created_at",
  ],
  evaluation_runs: [
    "id",
    "suite_id",
    "sample_set_id",
    "baseline_binding",
    "candidate_binding",
    "release_check_profile_id",
    "run_item_count",
    "status",
    "evidence_ids",
    "started_at",
    "finished_at",
  ],
  evaluation_run_items: [
    "id",
    "evaluation_run_id",
    "sample_set_item_id",
    "lane",
    "result_asset_id",
    "hard_gate_passed",
    "weighted_score",
    "failure_kind",
    "failure_reason",
    "diff_summary",
    "requires_human_review",
  ],
  evaluation_evidence_packs: [
    "id",
    "experiment_run_id",
    "summary_status",
    "score_summary",
    "regression_summary",
    "failure_summary",
    "cost_summary",
    "latency_summary",
    "created_at",
  ],
  evaluation_promotion_recommendations: [
    "id",
    "experiment_run_id",
    "evidence_pack_id",
    "status",
    "decision_reason",
    "learning_candidate_ids",
    "created_at",
  ],
};

const expectedIndexes = [
  "manuscripts_status_idx",
  "document_assets_manuscript_id_idx",
  "knowledge_items_status_module_scope_idx",
  "knowledge_items_manuscript_types_gin_idx",
  "knowledge_items_risk_tags_gin_idx",
  "module_templates_manuscript_type_module_idx",
  "evaluation_sample_sets_module_status_idx",
  "evaluation_sample_set_items_sample_set_id_idx",
  "verification_check_profiles_status_idx",
  "release_check_profiles_status_idx",
  "evaluation_suites_status_idx",
  "evaluation_runs_suite_id_started_at_idx",
  "evaluation_run_items_evaluation_run_id_idx",
  "evaluation_evidence_packs_experiment_run_id_idx",
  "evaluation_promotion_recommendations_experiment_run_id_idx",
];

const expectedRoleKeys = [
  "admin",
  "editor",
  "knowledge_reviewer",
  "proofreader",
  "screener",
  "user",
];

const migrationDirectory = path.join(
  import.meta.dirname,
  "../../src/database/migrations",
);
const requiredMigrationFiles = readdirSync(migrationDirectory)
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();

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
    const actualMigrations = new Map(
      migrationResult.rows.map((row) => [row.version, row.checksum]),
    );

    for (const fileName of requiredMigrationFiles) {
      assert.equal(
        actualMigrations.get(fileName),
        getMigrationChecksum(fileName),
        `Expected migration bookkeeping for ${fileName}.`,
      );
    }
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
      for (const fileName of requiredMigrationFiles) {
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
