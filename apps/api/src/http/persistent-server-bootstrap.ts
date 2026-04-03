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
  log?: (message: string) => void;
}

const appRoot = path.resolve(import.meta.dirname, "../..");

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
        pool,
        authRuntime,
      }) ??
      createPersistentGovernanceRuntime({
        client: pool as unknown as Pool,
        authRuntime: authRuntime as Parameters<
          typeof createPersistentGovernanceRuntime
        >[0]["authRuntime"],
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
