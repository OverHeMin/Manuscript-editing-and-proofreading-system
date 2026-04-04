import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { auditDatabaseMigrations } from "../migration-audit.ts";
import { getDatabaseUrl } from "../config.ts";
import { loadAppEnvDefaults } from "../../ops/env-defaults.ts";

const packageRoot = path.resolve(import.meta.dirname, "../../..");

interface MigrationDoctorCliOptions {
  json: boolean;
}

export async function runMigrationDoctorCli(argv = process.argv.slice(2)): Promise<void> {
  loadAppEnvDefaults(packageRoot);

  const options = parseCliOptions(argv);
  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();

  try {
    const audit = await auditDatabaseMigrations(client);
    const output = options.json ? JSON.stringify(audit) : formatAuditResult(audit);
    process.stdout.write(`${output}\n`);

    if (audit.status === "blocked") {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

function parseCliOptions(argv: string[]): MigrationDoctorCliOptions {
  let json = false;

  for (const argument of argv) {
    if (argument === "--json") {
      json = true;
      continue;
    }

    throw new Error(`Unknown migration doctor option: ${argument}`);
  }

  return { json };
}

function formatAuditResult(audit: Awaited<ReturnType<typeof auditDatabaseMigrations>>): string {
  const lines = [
    `status: ${audit.status}`,
    `pending: ${audit.pendingMigrations.join(", ") || "none"}`,
    `repairable: ${formatFindings(audit.repairableMigrations)}`,
    `blocking: ${formatFindings(audit.blockingMigrations)}`,
  ];

  return lines.join("\n");
}

function formatFindings(
  findings: Array<{
    version: string;
    reason: string;
  }>,
): string {
  if (findings.length === 0) {
    return "none";
  }

  return findings.map((finding) => `${finding.version} (${finding.reason})`).join(", ");
}

if (isDirectExecution()) {
  runMigrationDoctorCli().catch((error) => {
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
