import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDatabaseUrl } from "../../../src/database/config.ts";

const packageRoot = path.resolve(import.meta.dirname, "../../..");
const migrationFilePath = path.join(
  packageRoot,
  "src",
  "database",
  "migrations",
  "0001_initial.sql",
);
const migrationScriptPath = path.join(
  packageRoot,
  "src",
  "database",
  "scripts",
  "migrate.ts",
);

export function getInitialMigrationChecksum(): string {
  const migrationSql = readFileSync(migrationFilePath, "utf8");
  return createHash("sha256").update(migrationSql).digest("hex");
}

export function runMigrateProcess(): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", migrationScriptPath],
    {
      cwd: packageRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: getDatabaseUrl(),
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
