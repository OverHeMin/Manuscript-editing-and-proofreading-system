import path from "node:path";
import { Pool } from "pg";
import { createApiHttpServer, type ApiHttpServer } from "./api-http-server.ts";
import { createPersistentGovernanceRuntime } from "./persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "./persistent-auth-runtime.ts";
import { resolvePersistentServerConfig } from "./persistent-server-config.ts";
import {
  createPersistentServiceHealthProvider,
  type HttpServiceHealthProvider,
} from "./service-health.ts";
import {
  formatPersistentStartupPreflightFailure,
  runPersistentStartupPreflight,
  type PersistentStartupPreflightResult,
} from "../ops/persistent-startup-preflight.ts";
import {
  formatGovernedExecutionOrchestrationBootInspectionSummary,
  formatGovernedExecutionOrchestrationRecoverySummary,
  runPersistentGovernedExecutionOrchestrationInspection,
  runPersistentGovernedExecutionOrchestrationRecovery,
  type AgentExecutionOrchestrationInspectionReport,
  type AgentExecutionOrchestrationRecoveryOptions,
  type AgentExecutionOrchestrationRecoverySummary,
} from "../ops/recover-governed-execution-orchestration.ts";
import {
  resolvePersistentRuntimeContract,
  type PersistentRuntimeContract,
} from "../ops/persistent-runtime-contract.ts";
import { loadAppEnvDefaults } from "../ops/env-defaults.ts";

type PoolLike = {
  end: () => Promise<void>;
};

export interface PersistentServerBootstrapResult<
  TServer = ApiHttpServer,
  TPool extends PoolLike = Pool,
> {
  contract: PersistentRuntimeContract;
  config: ReturnType<typeof resolvePersistentServerConfig>;
  pool: TPool;
  preflight: PersistentStartupPreflightResult;
  serviceHealth: HttpServiceHealthProvider;
  authRuntime: unknown;
  runtime: unknown;
  server: TServer;
}

export interface StartPersistentServerOptions<
  TServer = ApiHttpServer,
  TPool extends PoolLike = Pool,
> {
  env?: NodeJS.ProcessEnv;
  loadEnvDefaults?: () => void;
  createPool?: (input: { connectionString: string }) => TPool;
  runPreflight?: (input: {
    contract: PersistentRuntimeContract;
    pool: TPool;
  }) => Promise<PersistentStartupPreflightResult>;
  createAuthRuntime?: (input: {
    config: ReturnType<typeof resolvePersistentServerConfig>;
    pool: TPool;
  }) => unknown;
  createRuntime?: (input: {
    config: ReturnType<typeof resolvePersistentServerConfig>;
    pool: TPool;
    authRuntime: unknown;
  }) => unknown;
  createServer?: (input: {
    config: ReturnType<typeof resolvePersistentServerConfig>;
    authRuntime: unknown;
    runtime: unknown;
    serviceHealth: HttpServiceHealthProvider;
  }) => TServer;
  listenServer?: (input: {
    config: ReturnType<typeof resolvePersistentServerConfig>;
    server: TServer;
  }) => Promise<void>;
  runGovernedExecutionOrchestrationRecovery?: (input: {
    env: NodeJS.ProcessEnv;
    recoveryOptions?: AgentExecutionOrchestrationRecoveryOptions;
  }) => Promise<AgentExecutionOrchestrationRecoverySummary>;
  runGovernedExecutionOrchestrationInspection?: (input: {
    env: NodeJS.ProcessEnv;
  }) => Promise<AgentExecutionOrchestrationInspectionReport>;
  log?: (message: string) => void;
}

const appRoot = path.resolve(import.meta.dirname, "../..");
const GOVERNED_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_ENV =
  "AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT";
const GOVERNED_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET_ENV =
  "AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET";

export async function startPersistentServer<
  TServer = ApiHttpServer,
  TPool extends PoolLike = Pool,
>(
  options: StartPersistentServerOptions<TServer, TPool> = {},
): Promise<PersistentServerBootstrapResult<TServer, TPool>> {
  const env = options.env ?? process.env;
  const loadEnvDefaultsForStart =
    options.loadEnvDefaults ?? (() => loadAppEnvDefaults(appRoot));

  loadEnvDefaultsForStart();

  const contract = resolvePersistentRuntimeContract(env);
  const config = resolvePersistentServerConfig(env);
  const pool =
    options.createPool?.({
      connectionString: config.databaseUrl,
    }) ??
    ((new Pool({
      connectionString: config.databaseUrl,
    }) as unknown) as TPool);

  try {
    const preflight =
      (await options.runPreflight?.({
        contract,
        pool,
      })) ??
      (await runPersistentStartupPreflight({
        contract,
      }));

    if (preflight.status !== "ready") {
      throw new Error(formatPersistentStartupPreflightFailure(preflight));
    }

    const authRuntime =
      options.createAuthRuntime?.({
        config,
        pool,
      }) ??
      createPersistentHttpAuthRuntime({
        client: pool as unknown as Pool,
        secureCookies: config.appEnv === "staging" || config.appEnv === "production",
      });

    const runtime =
      options.createRuntime?.({
        config,
        pool,
        authRuntime,
      }) ??
      createPersistentGovernanceRuntime({
        client: pool as unknown as Pool,
        authRuntime: authRuntime as Parameters<
          typeof createPersistentGovernanceRuntime
        >[0]["authRuntime"],
        uploadRootDir: config.uploadRootDir,
      });

    const serviceHealth = createPersistentServiceHealthProvider({
      contract,
      startupPreflight: preflight,
    });

    const server =
      options.createServer?.({
        config,
        authRuntime,
        runtime,
        serviceHealth,
      }) ??
      ((createApiHttpServer({
        appEnv: config.appEnv,
        allowedOrigins: config.allowedOrigins,
        seedDemoKnowledgeReviewData: false,
        serviceHealth,
        uploadRootDir: config.uploadRootDir,
        runtime: runtime as NonNullable<
          Parameters<typeof createApiHttpServer>[0]
        >["runtime"],
      }) as unknown) as TServer);

    attachPoolCloseHandler(server, pool);

    if (options.listenServer) {
      await options.listenServer({
        config,
        server,
      });
    } else {
      await new Promise<void>((resolve) => {
        (server as ApiHttpServer).listen(config.port, config.host, () => {
          resolve();
        });
      });
    }

    const log = options.log ?? console.log;
    log(
      `[api] persistent runtime listening on http://${config.host}:${config.port} ` +
        `(${config.appEnv}, PostgreSQL-backed auth and governance registries)`,
    );
    scheduleGovernedExecutionOrchestrationRecoveryOnBoot({
      env,
      log,
      runRecovery:
        options.runGovernedExecutionOrchestrationRecovery ??
        ((input) =>
          runPersistentGovernedExecutionOrchestrationRecovery(input.env, {
            loadEnvDefaults: () => undefined,
          }, input.recoveryOptions)),
      runInspection:
        options.runGovernedExecutionOrchestrationInspection ??
        ((input) =>
          runPersistentGovernedExecutionOrchestrationInspection(input.env, {
            loadEnvDefaults: () => undefined,
          })),
    });

    return {
      contract,
      config,
      pool,
      preflight,
      serviceHealth,
      authRuntime,
      runtime,
      server,
    };
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }
}

function attachPoolCloseHandler<TServer, TPool extends PoolLike>(
  server: TServer,
  pool: TPool,
): void {
  const maybeEventedServer = server as {
    on?: (event: string, handler: () => void) => unknown;
  };

  maybeEventedServer.on?.("close", () => {
    void pool.end();
  });
}

function scheduleGovernedExecutionOrchestrationRecoveryOnBoot(input: {
  env: NodeJS.ProcessEnv;
  log: (message: string) => void;
  runRecovery: (input: {
    env: NodeJS.ProcessEnv;
    recoveryOptions?: AgentExecutionOrchestrationRecoveryOptions;
  }) => Promise<AgentExecutionOrchestrationRecoverySummary>;
  runInspection: (input: {
    env: NodeJS.ProcessEnv;
  }) => Promise<AgentExecutionOrchestrationInspectionReport>;
}): void {
  if (!isGovernedExecutionOrchestrationRecoveryOnBootEnabled(input.env)) {
    return;
  }

  const recoveryOptions =
    resolveGovernedExecutionOrchestrationRecoveryOnBootOptions(input.env);

  setTimeout(() => {
    void runGovernedExecutionOrchestrationRecoveryOnBootPass({
      env: input.env,
      log: input.log,
      recoveryOptions,
      runRecovery: input.runRecovery,
      runInspection: input.runInspection,
    });
  }, 0);
}

async function runGovernedExecutionOrchestrationRecoveryOnBootPass(input: {
  env: NodeJS.ProcessEnv;
  log: (message: string) => void;
  recoveryOptions?: AgentExecutionOrchestrationRecoveryOptions;
  runRecovery: (input: {
    env: NodeJS.ProcessEnv;
    recoveryOptions?: AgentExecutionOrchestrationRecoveryOptions;
  }) => Promise<AgentExecutionOrchestrationRecoverySummary>;
  runInspection: (input: {
    env: NodeJS.ProcessEnv;
  }) => Promise<AgentExecutionOrchestrationInspectionReport>;
}): Promise<void> {
  try {
    const summary = await input.runRecovery({
      env: input.env,
      recoveryOptions: input.recoveryOptions,
    });
    input.log(formatGovernedExecutionOrchestrationRecoverySummary(summary));
  } catch (error) {
    input.log(
      `[api] governed execution orchestration recovery failed-open: ${formatError(error)}`,
    );
    return;
  }

  try {
    const report = await input.runInspection({
      env: input.env,
    });
    input.log(formatGovernedExecutionOrchestrationBootInspectionSummary(report));
  } catch (error) {
    input.log(
      `[api] governed execution orchestration boot inspection failed-open: ${formatError(error)}`,
    );
  }
}

function isGovernedExecutionOrchestrationRecoveryOnBootEnabled(
  env: NodeJS.ProcessEnv,
): boolean {
  const value =
    env[GOVERNED_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_ENV]?.trim().toLowerCase();

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function resolveGovernedExecutionOrchestrationRecoveryOnBootOptions(
  env: NodeJS.ProcessEnv,
): AgentExecutionOrchestrationRecoveryOptions | undefined {
  const budget = readOptionalPositiveIntegerEnv(
    env,
    GOVERNED_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET_ENV,
  );
  if (budget == null) {
    return undefined;
  }

  return {
    budget,
  };
}

function readOptionalPositiveIntegerEnv(
  env: NodeJS.ProcessEnv,
  key: string,
): number | undefined {
  const rawValue = env[key]?.trim();
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
