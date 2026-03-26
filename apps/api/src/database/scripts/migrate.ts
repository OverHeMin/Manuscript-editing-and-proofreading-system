import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { getAdminDatabaseUrl, getDatabaseName, getDatabaseUrl } from "../config.ts";
import { seedRoles } from "../seeds/roles.seed.ts";

const packageRoot = path.resolve(import.meta.dirname, "../../..");
const migrationsDirectory = path.join(packageRoot, "src", "database", "migrations");
const prismaSchemaPath = path.join(packageRoot, "prisma", "schema.prisma");
const MIGRATION_LOCK_KEY = "medical_api_schema_migrations";
const LEGACY_MIGRATION_CHECKSUMS = new Map<string, Set<string>>([
  [
    "0001_initial.sql",
    new Set(["6140ea1d2280a0712aae27ae1f284131bf1eeb239446ea46ef49298fb8b30920"]),
  ],
]);

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

function getMigrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
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
  const appliedResult = await client.query<{ version: string; checksum: string }>(
    "select version, checksum from schema_migrations",
  );
  const appliedMigrations = new Map(
    appliedResult.rows.map((row) => [row.version, row.checksum]),
  );

  for (const migrationFile of getMigrationFiles()) {
    const migrationSql = readFileSync(path.join(migrationsDirectory, migrationFile), "utf8");
    const checksum = createHash("sha256").update(migrationSql).digest("hex");
    const appliedChecksum = appliedMigrations.get(migrationFile);

    if (appliedChecksum) {
      const acceptedLegacyChecksums = LEGACY_MIGRATION_CHECKSUMS.get(migrationFile);

      if (appliedChecksum === checksum) {
        continue;
      }

      if (acceptedLegacyChecksums?.has(appliedChecksum)) {
        await client.query(
          `
            update schema_migrations
            set checksum = $1
            where version = $2
          `,
          [checksum, migrationFile],
        );
        appliedMigrations.set(migrationFile, checksum);
        console.log(`Normalized legacy checksum for ${migrationFile}`);
        continue;
      }

      throw new Error(`Migration checksum mismatch for ${migrationFile}.`);
    }

    await client.query("begin");

    try {
      await client.query(migrationSql);
      await client.query(
        `
          insert into schema_migrations (version, checksum)
          values ($1, $2)
        `,
        [migrationFile, checksum],
      );
      await client.query("commit");
      console.log(`Applied migration ${migrationFile}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

async function main(): Promise<void> {
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
