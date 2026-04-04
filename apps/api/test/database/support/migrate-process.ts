import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDatabaseUrl } from "../../../src/database/config.ts";
import { createMigrationChecksum } from "../../../src/database/migration-checksum.ts";

const packageRoot = path.resolve(import.meta.dirname, "../../..");
const migrationScriptPath = path.join(
  packageRoot,
  "src",
  "database",
  "scripts",
  "migrate.ts",
);
const migrationDoctorScriptPath = path.join(
  packageRoot,
  "src",
  "database",
  "scripts",
  "migration-doctor.ts",
);

export function getMigrationChecksum(fileName: string): string {
  const migrationFilePath = path.join(
    packageRoot,
    "src",
    "database",
    "migrations",
    fileName,
  );
  const migrationSql = readFileSync(migrationFilePath, "utf8");
  return createMigrationChecksum(migrationSql);
}

export function runMigrateProcess(databaseUrl = getDatabaseUrl()): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  return runDatabaseScript(migrationScriptPath, [], databaseUrl);
}

export function runMigrationDoctorProcess(
  options: {
    args?: string[];
    databaseUrl?: string;
  } = {},
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  return runDatabaseScript(
    migrationDoctorScriptPath,
    options.args ?? ["--json"],
    options.databaseUrl ?? getDatabaseUrl(),
  );
}

function runDatabaseScript(
  scriptPath: string,
  args: string[],
  databaseUrl: string,
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", scriptPath, ...args],
    {
      cwd: packageRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    },
  );

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
