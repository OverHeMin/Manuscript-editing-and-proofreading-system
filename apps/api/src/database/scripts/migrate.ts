import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { getAdminDatabaseUrl, getDatabaseName, getDatabaseUrl } from "../config.ts";
import { auditDatabaseMigrations } from "../migration-audit.ts";
import {
  getRepositoryMigrationLedgerMap,
  readRepositoryMigrationSql,
} from "../migration-ledger.ts";
import { seedRoles } from "../seeds/roles.seed.ts";
import { loadAppEnvDefaults } from "../../ops/env-defaults.ts";

const packageRoot = path.resolve(import.meta.dirname, "../../..");
const prismaSchemaPath = path.join(packageRoot, "prisma", "schema.prisma");
const MIGRATION_LOCK_KEY = "medical_api_schema_migrations";

function runPrismaValidate(): void {
  const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
  const args =
    process.platform === "win32"
      ? ["/c", "pnpm", "exec", "prisma", "validate", "--schema", prismaSchemaPath]
      : ["exec", "prisma", "validate", "--schema", prismaSchemaPath];
  const result = spawnSync(
    command,
    args,
    {
      cwd: packageRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: getDatabaseUrl(),
      },
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function ensureDatabaseExists(): Promise<void> {
  const adminClient = new Client({ connectionString: getAdminDatabaseUrl() });
  const databaseName = getDatabaseName();

  await adminClient.connect();

  try {
    const existingDatabase = await adminClient.query<{ present: number }>(
      `
        select 1 as present
        from pg_database
        where datname = $1
      `,
      [databaseName],
    );

    if (existingDatabase.rowCount === 0) {
      const identifier = `"${databaseName.replaceAll('"', "\"\"")}"`;
      await adminClient.query(`create database ${identifier}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function acquireMigrationLock(client: Client): Promise<void> {
  await client.query("select pg_advisory_lock(hashtext($1))", [MIGRATION_LOCK_KEY]);
}

async function releaseMigrationLock(client: Client): Promise<void> {
  await client.query("select pg_advisory_unlock(hashtext($1))", [MIGRATION_LOCK_KEY]);
}

async function applyPendingMigrations(client: Client): Promise<void> {
  const audit = await auditDatabaseMigrations(client);

  if (audit.blockingMigrations.length > 0) {
    const blockingMigration = audit.blockingMigrations[0];
    if (blockingMigration.reason === "unknown-database-version") {
      throw new Error(`Unknown database migration version ${blockingMigration.version}.`);
    }

    throw new Error(`Migration checksum mismatch for ${blockingMigration.version}.`);
  }

  for (const repairableMigration of audit.repairableMigrations) {
    await client.query(
      `
        update schema_migrations
        set checksum = $1
        where version = $2
      `,
      [repairableMigration.expectedChecksum, repairableMigration.version],
    );
    console.log(`Normalized legacy checksum for ${repairableMigration.version}`);
    await reapplyAdditiveMigrationRepair(client, repairableMigration.version);
  }

  await reconcileAppliedAdditiveMigrations(client);

  const repositoryMigrationLedger = getRepositoryMigrationLedgerMap();

  for (const migrationFile of audit.pendingMigrations) {
    const migrationEntry = repositoryMigrationLedger.get(migrationFile);

    if (!migrationEntry) {
      continue;
    }

    const migrationSql = readRepositoryMigrationSql(migrationFile);

    await client.query("begin");

    try {
      await client.query(migrationSql);
      await client.query(
        `
          insert into schema_migrations (version, checksum)
          values ($1, $2)
        `,
        [migrationFile, migrationEntry.checksum],
      );
      await client.query("commit");
      console.log(`Applied migration ${migrationFile}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

async function reapplyAdditiveMigrationRepair(
  client: Client,
  version: string,
): Promise<void> {
  if (
    version !== "0025_editorial_rule_engine_persistence.sql" &&
    version !== "0027_medical_editorial_rule_authoring_workbench.sql" &&
    version !== "0028_medical_rule_library_v2_foundations.sql"
  ) {
    return;
  }

  await client.query("begin");

  try {
    await client.query(readRepositoryMigrationSql(version));
    await client.query("commit");
    console.log(`Reapplied additive migration repair for ${version}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function reconcileAppliedAdditiveMigrations(client: Client): Promise<void> {
  const additiveRepairVersions = [
    "0025_editorial_rule_engine_persistence.sql",
    "0027_medical_editorial_rule_authoring_workbench.sql",
    "0028_medical_rule_library_v2_foundations.sql",
  ];
  const result = await client.query<{ version: string }>(
    `
      select version
      from schema_migrations
      where version = any($1::text[])
      order by version
    `,
    [additiveRepairVersions],
  );

  for (const row of result.rows) {
    await reapplyAdditiveMigrationRepair(client, row.version);
  }
}

export async function runMigrationCli(): Promise<void> {
  loadAppEnvDefaults(packageRoot);
  runPrismaValidate();
  await ensureDatabaseExists();

  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();

  try {
    await acquireMigrationLock(client);
    await ensureMigrationTable(client);
    await applyPendingMigrations(client);
    await seedRoles(client);
  } finally {
    await releaseMigrationLock(client).catch(() => undefined);
    await client.end();
  }
}

if (isDirectExecution()) {
  runMigrationCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return fileURLToPath(import.meta.url) === path.resolve(entrypoint);
}
