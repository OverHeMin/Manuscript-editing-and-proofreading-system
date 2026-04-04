import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createMigrationChecksum } from "../../src/database/migration-checksum.ts";
import {
  getMigrationChecksum,
  runMigrateProcess,
  runMigrationDoctorProcess,
} from "./support/migrate-process.ts";
import { withTemporaryDatabase } from "./support/postgres.ts";

const migrationsDirectory = path.join(import.meta.dirname, "../../src/database/migrations");
const repositoryMigrationFiles = [
  "0001_initial.sql",
  "0002_model_registry_version_guard.sql",
  "0003_document_assets_file_name.sql",
  "0004_auth_persistence.sql",
  "0005_governed_registry_persistence.sql",
  "0006_prompt_skill_registry_persistence.sql",
  "0007_model_routing_policy_persistence.sql",
  "0008_execution_runtime_persistence.sql",
  "0009_agent_tooling_persistence.sql",
  "0010_learning_review_persistence.sql",
  "0011_verification_ops_persistence.sql",
  "0012_template_family_active_uniqueness.sql",
  "0013_governed_evaluation_run_seeding.sql",
  "0014_agent_tooling_verification_expectations.sql",
  "0015_model_routing_governance_persistence.sql",
  "0016_harness_dataset_governance.sql",
  "0017_retrieval_quality_harness.sql",
  "0018_retrieval_quality_verification_ops.sql",
  "0019_local_first_harness_adapter_platform.sql",
  "0020_agent_execution_model_routing_resolution.sql",
] as const;
const legacyAgentToolingChecksum =
  "f177959ca7039fb15a05b667277235d9fe95ad04bb90d8c9af6783109ab535cd";

test("migration doctor reports clean migrated databases with no drift", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, `Expected migrate to succeed.\n${migrate.stdout}\n${migrate.stderr}`);

    const doctor = runMigrationDoctorProcess({ databaseUrl });
    assert.equal(
      doctor.status,
      0,
      `Expected migration doctor to succeed for clean databases.\n${doctor.stdout}\n${doctor.stderr}`,
    );

    const result = parseDoctorJson(doctor.stdout);
    assert.equal(result.status, "clean");
    assert.deepEqual(result.blockingMigrations, []);
    assert.deepEqual(result.repairableMigrations, []);
    assert.deepEqual(result.pendingMigrations, []);
  });
});

test("migration doctor classifies accepted legacy checksum mismatches as repairable", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, `Expected migrate to succeed.\n${migrate.stdout}\n${migrate.stderr}`);

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(
        `
          update schema_migrations
          set checksum = $1
          where version = '0009_agent_tooling_persistence.sql'
        `,
        [legacyAgentToolingChecksum],
      );
    } finally {
      await client.end();
    }

    const doctor = runMigrationDoctorProcess({ databaseUrl });
    assert.equal(
      doctor.status,
      0,
      `Expected migration doctor to classify known legacy mismatches without blocking.\n${doctor.stdout}\n${doctor.stderr}`,
    );

    const result = parseDoctorJson(doctor.stdout);
    assert.equal(result.status, "repairable");
    assert.deepEqual(result.blockingMigrations, []);
    assert.deepEqual(result.pendingMigrations, []);
    assert.deepEqual(result.repairableMigrations, [
      {
        databaseChecksum: legacyAgentToolingChecksum,
        expectedChecksum: getMigrationChecksum("0009_agent_tooling_persistence.sql"),
        reason: "legacy-checksum-mismatch",
        version: "0009_agent_tooling_persistence.sql",
      },
    ]);
  });
});

test("migration doctor blocks unknown checksum mismatches", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, `Expected migrate to succeed.\n${migrate.stdout}\n${migrate.stderr}`);

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

    const doctor = runMigrationDoctorProcess({ databaseUrl });
    assert.notEqual(doctor.status, 0, "Expected blocked migration drift to produce a non-zero exit.");

    const result = parseDoctorJson(doctor.stdout);
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.repairableMigrations, []);
    assert.deepEqual(result.pendingMigrations, []);
    assert.deepEqual(result.blockingMigrations, [
      {
        databaseChecksum: "tampered-checksum",
        expectedChecksum: getMigrationChecksum("0001_initial.sql"),
        reason: "checksum-mismatch",
        version: "0001_initial.sql",
      },
    ]);
  });
});

test("migration doctor blocks unknown database migration versions", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, `Expected migrate to succeed.\n${migrate.stdout}\n${migrate.stderr}`);

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await client.query(
        `
          insert into schema_migrations (version, checksum)
          values ('9999_manual_hotfix.sql', 'manual-hotfix-checksum')
        `,
      );
    } finally {
      await client.end();
    }

    const doctor = runMigrationDoctorProcess({ databaseUrl });
    assert.notEqual(doctor.status, 0, "Expected unknown database migrations to block release auditing.");

    const result = parseDoctorJson(doctor.stdout);
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.repairableMigrations, []);
    assert.deepEqual(result.pendingMigrations, []);
    assert.deepEqual(result.blockingMigrations, [
      {
        databaseChecksum: "manual-hotfix-checksum",
        expectedChecksum: null,
        reason: "unknown-database-version",
        version: "9999_manual_hotfix.sql",
      },
    ]);
  });
});

test("migration doctor reports pending repository migrations without treating them as history corruption", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await applyRepositoryMigrationsUntil(client, "0020_agent_execution_model_routing_resolution.sql");
    } finally {
      await client.end();
    }

    const doctor = runMigrationDoctorProcess({ databaseUrl });
    assert.equal(
      doctor.status,
      0,
      `Expected pending repository migrations to remain non-blocking in migration doctor.\n${doctor.stdout}\n${doctor.stderr}`,
    );

    const result = parseDoctorJson(doctor.stdout);
    assert.equal(result.status, "clean");
    assert.deepEqual(result.repairableMigrations, []);
    assert.deepEqual(result.blockingMigrations, []);
    assert.deepEqual(result.pendingMigrations, ["0020_agent_execution_model_routing_resolution.sql"]);
  });
});

async function applyRepositoryMigrationsUntil(client: Client, stopBeforeVersion: string): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  for (const version of repositoryMigrationFiles) {
    if (version === stopBeforeVersion) {
      break;
    }

    const migrationSql = readFileSync(path.join(migrationsDirectory, version), "utf8");
    const checksum = createMigrationChecksum(migrationSql);

    await client.query("begin");

    try {
      await client.query(migrationSql);
      await client.query(
        `
          insert into schema_migrations (version, checksum)
          values ($1, $2)
        `,
        [version, checksum],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

function parseDoctorJson(stdout: string): {
  status: string;
  pendingMigrations: string[];
  repairableMigrations: Array<{
    version: string;
    reason: string;
    expectedChecksum: string | null;
    databaseChecksum: string;
  }>;
  blockingMigrations: Array<{
    version: string;
    reason: string;
    expectedChecksum: string | null;
    databaseChecksum: string;
  }>;
} {
  assert.notEqual(stdout.trim(), "", "Expected migration doctor to emit JSON to stdout.");
  return JSON.parse(stdout) as ReturnType<typeof parseDoctorJson>;
}
