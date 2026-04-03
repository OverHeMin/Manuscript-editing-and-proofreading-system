import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import {
  resolvePersistentRuntimeContract,
  type PersistentRuntimeContract,
} from "./persistent-runtime-contract.ts";
import { loadAppEnvDefaults } from "./env-defaults.ts";

export interface PersistentStartupCheckOk {
  status: "ok";
  path?: string;
}

export interface PersistentStartupCheckFailed {
  status: "failed";
  message: string;
  path?: string;
}

export type PersistentStartupCheckResult =
  | PersistentStartupCheckOk
  | PersistentStartupCheckFailed;

export interface PersistentStartupPreflightResult {
  status: "ready" | "not_ready";
  components: {
    runtimeContract: PersistentStartupCheckOk;
    database: PersistentStartupCheckResult;
    uploadRoot: PersistentStartupCheckResult;
  };
}

export interface RunPersistentStartupPreflightOptions {
  contract: PersistentRuntimeContract;
  databaseProbe?: (input: {
    connectionString: string;
  }) => Promise<PersistentStartupCheckResult>;
  ensureUploadRoot?: (input: {
    path: string;
  }) => Promise<PersistentStartupCheckResult>;
}

const appRoot = path.resolve(import.meta.dirname, "../..");

export async function runPersistentStartupPreflight(
  options: RunPersistentStartupPreflightOptions,
): Promise<PersistentStartupPreflightResult> {
  const databaseProbe = options.databaseProbe ?? probeDatabaseReadiness;
  const ensureUploadRoot = options.ensureUploadRoot ?? ensureUploadRootReady;

  const [database, uploadRoot] = await Promise.all([
    databaseProbe({
      connectionString: options.contract.databaseUrl,
    }),
    ensureUploadRoot({
      path: options.contract.uploadRootDir,
    }),
  ]);

  return {
    status:
      database.status === "ok" && uploadRoot.status === "ok"
        ? "ready"
        : "not_ready",
    components: {
      runtimeContract: { status: "ok" },
      database,
      uploadRoot,
    },
  };
}

export async function probeDatabaseReadiness(input: {
  connectionString: string;
}): Promise<PersistentStartupCheckResult> {
  const client = new Client({
    connectionString: input.connectionString,
  });

  try {
    await client.connect();
    await client.query("select 1");
    return { status: "ok" };
  } catch (error) {
    return {
      status: "failed",
      message:
        error instanceof Error ? error.message : "Database readiness probe failed.",
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function ensureUploadRootReady(input: {
  path: string;
}): Promise<PersistentStartupCheckResult> {
  const markerFilePath = path.join(
    input.path,
    `.startup-preflight-${process.pid}-${Date.now()}.tmp`,
  );

  try {
    await mkdir(input.path, {
      recursive: true,
    });
    await writeFile(markerFilePath, "ok", "utf8");
    await rm(markerFilePath, {
      force: true,
    });

    return {
      status: "ok",
      path: input.path,
    };
  } catch (error) {
    return {
      status: "failed",
      path: input.path,
      message:
        error instanceof Error ? error.message : "Upload root readiness probe failed.",
    };
  }
}

export function formatPersistentStartupPreflightFailure(
  result: PersistentStartupPreflightResult,
): string {
  const failures = [
    result.components.database,
    result.components.uploadRoot,
  ].filter((component): component is PersistentStartupCheckFailed => component.status === "failed");

  if (failures.length === 0) {
    return "Persistent startup preflight failed for an unknown reason.";
  }

  return failures.map((failure) => failure.message).join(" ");
}

export async function runPersistentStartupPreflightCli(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  loadAppEnvDefaults(appRoot);

  const contract = resolvePersistentRuntimeContract(env);
  const result = await runPersistentStartupPreflight({
    contract,
  });

  if (result.status !== "ready") {
    throw new Error(formatPersistentStartupPreflightFailure(result));
  }

  console.log(`[api] persistent startup preflight OK (${contract.appEnv})`);
}

if (isDirectExecution()) {
  runPersistentStartupPreflightCli().catch((error) => {
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
