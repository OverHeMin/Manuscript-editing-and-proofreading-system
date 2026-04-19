import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Worker,
  isMainThread,
  workerData,
} from "node:worker_threads";
import { getDatabaseUrl } from "../../../src/database/config.ts";
import { createMigrationChecksum } from "../../../src/database/migration-checksum.ts";
import { resolveApiPackageRoot } from "../../../src/database/package-root.ts";
import { runMigrationCli } from "../../../src/database/scripts/migrate.ts";
import { runMigrationDoctorCli } from "../../../src/database/scripts/migration-doctor.ts";

const packageRoot = resolveApiPackageRoot(import.meta.dirname);
const migrationScriptPath = path.join(packageRoot, "src", "database", "scripts", "migrate.ts");
const migrationDoctorScriptPath = path.join(
  packageRoot,
  "src",
  "database",
  "scripts",
  "migration-doctor.ts",
);
const workerResultDirectory = path.join(
  packageRoot,
  ".codex-tmp",
  "database-script-worker-results",
);
const databaseScriptTimeoutMs = 30_000;
const databaseScriptPollIntervalMs = 100;

interface DatabaseScriptResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

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
): DatabaseScriptResult {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  const resultFilePath = createWorkerResultFilePath();

  const worker = new Worker(new URL(import.meta.url), {
    workerData: {
      databaseUrl,
      args,
      resultFilePath,
      scriptPath,
      signalBuffer: signal.buffer,
    } satisfies DatabaseScriptWorkerInput,
  });

  const startedAt = Date.now();

  while (Atomics.load(signal, 0) === 0 && Date.now() - startedAt < databaseScriptTimeoutMs) {
    Atomics.wait(signal, 0, 0, databaseScriptPollIntervalMs);
  }

  if (Atomics.load(signal, 0) === 0) {
    void worker.terminate();
    rmSync(resultFilePath, { force: true });

    return {
      status: null,
      stdout: "",
      stderr: `Database script worker timed out after ${databaseScriptTimeoutMs}ms.`,
    };
  }

  void worker.terminate();

  try {
    return JSON.parse(readFileSync(resultFilePath, "utf8")) as DatabaseScriptResult;
  } catch (error) {
    return {
      status: null,
      stdout: "",
      stderr: `Database script worker completed without returning a readable result.\n${formatWorkerError(error)}`,
    };
  } finally {
    rmSync(resultFilePath, { force: true });
  }
}

interface DatabaseScriptWorkerInput {
  databaseUrl: string;
  args: string[];
  resultFilePath: string;
  scriptPath: string;
  signalBuffer: SharedArrayBuffer;
}

if (!isMainThread && workerData) {
  void runDatabaseScriptWorker(workerData as DatabaseScriptWorkerInput);
}

async function runDatabaseScriptWorker(
  input: DatabaseScriptWorkerInput,
): Promise<void> {
  const signal = new Int32Array(input.signalBuffer);
  const complete = (result: DatabaseScriptResult) => {
    try {
      writeFileSync(input.resultFilePath, JSON.stringify(result), "utf8");
    } finally {
      Atomics.store(signal, 0, 1);
      Atomics.notify(signal, 0);
    }
  };

  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalExitCode = process.exitCode;
  let stdout = "";
  let stderr = "";
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.env.DATABASE_URL = input.databaseUrl;
  process.exitCode = 0;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stderr.write;

  try {
    if (input.scriptPath === migrationScriptPath) {
      await runMigrationCli({ skipPrismaValidate: true });
    } else if (input.scriptPath === migrationDoctorScriptPath) {
      await runMigrationDoctorCli(input.args);
    } else {
      throw new Error(`Unsupported database script: ${input.scriptPath}`);
    }

    complete({
      status: process.exitCode ?? 0,
      stdout,
      stderr,
    });
  } catch (error) {
    complete({
      status: normalizeWorkerFailureStatus(process.exitCode),
      stdout,
      stderr: `${stderr}${formatWorkerError(error)}`,
    });
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    process.exitCode = originalExitCode;
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
}

function formatWorkerError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.stack ?? error.message}\n`;
  }

  return `${String(error)}\n`;
}

function createWorkerResultFilePath(): string {
  mkdirSync(workerResultDirectory, { recursive: true });
  return path.join(workerResultDirectory, `${process.pid}-${randomUUID()}.json`);
}

function normalizeWorkerFailureStatus(exitCode: number | undefined): number {
  return exitCode && exitCode !== 0 ? exitCode : 1;
}
