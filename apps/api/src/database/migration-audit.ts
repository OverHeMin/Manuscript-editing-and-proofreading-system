import { Client } from "pg";
import {
  getRepositoryMigrationLedger,
  getRepositoryMigrationLedgerMap,
  isAcceptedLegacyMigrationChecksum,
} from "./migration-ledger.ts";

export type MigrationAuditStatus = "clean" | "repairable" | "blocked";
export type MigrationAuditReason =
  | "legacy-checksum-mismatch"
  | "checksum-mismatch"
  | "unknown-database-version";

export interface MigrationAuditFinding {
  version: string;
  reason: MigrationAuditReason;
  expectedChecksum: string | null;
  databaseChecksum: string;
}

export interface MigrationAuditResult {
  status: MigrationAuditStatus;
  pendingMigrations: string[];
  repairableMigrations: MigrationAuditFinding[];
  blockingMigrations: MigrationAuditFinding[];
}

export async function auditDatabaseMigrations(client: Client): Promise<MigrationAuditResult> {
  const repositoryMigrationLedger = getRepositoryMigrationLedger();
  const repositoryMigrationLedgerMap = getRepositoryMigrationLedgerMap();
  const appliedMigrations = await readAppliedMigrations(client);
  const repairableMigrations: MigrationAuditFinding[] = [];
  const blockingMigrations: MigrationAuditFinding[] = [];

  for (const appliedMigration of appliedMigrations) {
    const migrationEntry = repositoryMigrationLedgerMap.get(appliedMigration.version);

    if (!migrationEntry) {
      blockingMigrations.push({
        version: appliedMigration.version,
        reason: "unknown-database-version",
        expectedChecksum: null,
        databaseChecksum: appliedMigration.checksum,
      });
      continue;
    }

    if (appliedMigration.checksum === migrationEntry.checksum) {
      continue;
    }

    if (isAcceptedLegacyMigrationChecksum(appliedMigration.version, appliedMigration.checksum)) {
      repairableMigrations.push({
        version: appliedMigration.version,
        reason: "legacy-checksum-mismatch",
        expectedChecksum: migrationEntry.checksum,
        databaseChecksum: appliedMigration.checksum,
      });
      continue;
    }

    blockingMigrations.push({
      version: appliedMigration.version,
      reason: "checksum-mismatch",
      expectedChecksum: migrationEntry.checksum,
      databaseChecksum: appliedMigration.checksum,
    });
  }

  const appliedVersions = new Set(appliedMigrations.map((migration) => migration.version));
  const pendingMigrations = repositoryMigrationLedger
    .filter((migration) => !appliedVersions.has(migration.version))
    .map((migration) => migration.version);

  return {
    status:
      blockingMigrations.length > 0
        ? "blocked"
        : repairableMigrations.length > 0
          ? "repairable"
          : "clean",
    pendingMigrations,
    repairableMigrations,
    blockingMigrations,
  };
}

async function readAppliedMigrations(
  client: Client,
): Promise<Array<{ version: string; checksum: string }>> {
  const tableExists = await client.query<{ relation_name: string | null }>(
    `
      select to_regclass('public.schema_migrations') as relation_name
    `,
  );

  if (!tableExists.rows[0]?.relation_name) {
    return [];
  }

  const appliedResult = await client.query<{ version: string; checksum: string }>(
    `
      select version, checksum
      from schema_migrations
      order by version
    `,
  );

  return appliedResult.rows;
}
