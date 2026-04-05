import test from "node:test";
import assert from "node:assert/strict";
import {
  startPersistentServer,
} from "../../src/http/persistent-server-bootstrap.ts";

test("persistent server bootstrap runs preflight before runtime creation and listen", async () => {
  const callLog: string[] = [];
  const fakePool = {
    endCalls: 0,
    end() {
      this.endCalls += 1;
      return Promise.resolve();
    },
  };
  const fakeServer = {
    closeHandler: undefined as undefined | (() => void),
    on(event: string, handler: () => void) {
      if (event === "close") {
        this.closeHandler = handler;
      }
      return this;
    },
  };

  const started = await startPersistentServer({
    env: {
      APP_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    },
    loadEnvDefaults: () => {
      callLog.push("load-env-defaults");
    },
    createPool: ({ connectionString }) => {
      callLog.push(`create-pool:${connectionString}`);
      return fakePool;
    },
    runPreflight: async ({ contract, pool }) => {
      callLog.push(`preflight:${contract.appEnv}:${pool === fakePool}`);
      return {
        status: "ready",
        components: {
          runtimeContract: { status: "ok" },
          database: { status: "ok" },
          uploadRoot: { status: "ok", path: contract.uploadRootDir },
        },
      };
    },
    createAuthRuntime: ({ config, pool }) => {
      callLog.push(`auth:${config.appEnv}:${pool === fakePool}`);
      return { kind: "auth-runtime" };
    },
    createRuntime: ({ pool, authRuntime }) => {
      const typedAuthRuntime = authRuntime as { kind: string };
      callLog.push(`runtime:${pool === fakePool}:${typedAuthRuntime.kind}`);
      return { kind: "governance-runtime" };
    },
    createServer: ({ config, authRuntime, runtime }) => {
      const typedAuthRuntime = authRuntime as { kind: string };
      const typedRuntime = runtime as { kind: string };
      callLog.push(
        `server:${config.host}:${typedAuthRuntime.kind}:${typedRuntime.kind}`,
      );
      return fakeServer;
    },
    listenServer: async ({ config, server }) => {
      callLog.push(`listen:${config.host}:${config.port}:${server === fakeServer}`);
    },
    log: () => {
      callLog.push("log");
    },
  });

  assert.equal(started.pool, fakePool);
  assert.equal(started.server, fakeServer);
  assert.equal(started.preflight.status, "ready");
  assert.deepEqual(callLog, [
    "load-env-defaults",
    "create-pool:postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    "preflight:development:true",
    "auth:development:true",
    "runtime:true:auth-runtime",
    "server:0.0.0.0:auth-runtime:governance-runtime",
    "listen:0.0.0.0:3001:true",
    "log",
  ]);
});

test("persistent server bootstrap rejects when preflight is not ready and never listens", async () => {
  const callLog: string[] = [];
  const fakePool = {
    end() {
      callLog.push("pool-end");
      return Promise.resolve();
    },
  };

  await assert.rejects(
    () =>
      startPersistentServer({
        env: {
          APP_ENV: "production",
          DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
          ONLYOFFICE_JWT_SECRET: "real-secret",
        },
        loadEnvDefaults: () => {
          callLog.push("load-env-defaults");
        },
        createPool: () => {
          callLog.push("create-pool");
          return fakePool;
        },
        runPreflight: async () => {
          callLog.push("preflight");
          return {
            status: "not_ready",
            components: {
              runtimeContract: { status: "ok" },
              database: {
                status: "failed",
                message: "Database is not reachable.",
              },
              uploadRoot: {
                status: "ok",
                path: "/srv/medical/uploads",
              },
            },
          };
        },
        createAuthRuntime: () => {
          callLog.push("auth");
          return { kind: "auth-runtime" };
        },
        createRuntime: () => {
          callLog.push("runtime");
          return { kind: "governance-runtime" };
        },
        createServer: () => {
          callLog.push("server");
          return {};
        },
        listenServer: async () => {
          callLog.push("listen");
        },
        log: () => {
          callLog.push("log");
        },
      }),
    /database is not reachable/i,
  );

  assert.deepEqual(callLog, [
    "load-env-defaults",
    "create-pool",
    "preflight",
    "pool-end",
  ]);
});

test("persistent server bootstrap can schedule fail-open governed orchestration recovery on boot", async () => {
  const callLog: string[] = [];
  const fakePool = {
    end() {
      return Promise.resolve();
    },
  };

  await startPersistentServer({
    env: {
      APP_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
      AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT: "true",
    },
    loadEnvDefaults: () => undefined,
    createPool: () => fakePool,
    runPreflight: async ({ contract }) => ({
      status: "ready",
      components: {
        runtimeContract: { status: "ok" },
        database: { status: "ok" },
        uploadRoot: { status: "ok", path: contract.uploadRootDir },
      },
    }),
    createAuthRuntime: () => ({ kind: "auth-runtime" }),
    createRuntime: () => ({ kind: "governance-runtime" }),
    createServer: () => ({}),
    listenServer: async () => {
      callLog.push("listen");
    },
    runGovernedExecutionOrchestrationRecovery: async ({ env }) => {
      callLog.push(`recovery:${env.APP_ENV}`);
      return {
        processed_count: 2,
        completed_count: 1,
        retryable_count: 1,
        failed_count: 0,
        deferred_count: 0,
      };
    },
    log: (message) => {
      callLog.push(message);
    },
  });

  assert.deepEqual(callLog, [
    "listen",
    "[api] persistent runtime listening on http://0.0.0.0:3001 (development, PostgreSQL-backed auth and governance registries)",
  ]);

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(callLog, [
    "listen",
    "[api] persistent runtime listening on http://0.0.0.0:3001 (development, PostgreSQL-backed auth and governance registries)",
    "recovery:development",
    "[api] governed execution orchestration recovery processed=2 completed=1 retryable=1 failed=0 deferred=0",
  ]);
});

test("persistent server bootstrap forwards a bounded boot recovery budget when configured", async () => {
  const callLog: string[] = [];
  const fakePool = {
    end() {
      return Promise.resolve();
    },
  };

  await startPersistentServer({
    env: {
      APP_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
      AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT: "true",
      AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET: "2",
    },
    loadEnvDefaults: () => undefined,
    createPool: () => fakePool,
    runPreflight: async ({ contract }) => ({
      status: "ready",
      components: {
        runtimeContract: { status: "ok" },
        database: { status: "ok" },
        uploadRoot: { status: "ok", path: contract.uploadRootDir },
      },
    }),
    createAuthRuntime: () => ({ kind: "auth-runtime" }),
    createRuntime: () => ({ kind: "governance-runtime" }),
    createServer: () => ({}),
    listenServer: async () => {
      callLog.push("listen");
    },
    runGovernedExecutionOrchestrationRecovery: async ({ env, recoveryOptions }) => {
      callLog.push(
        `recovery:${env.APP_ENV}:budget=${String(recoveryOptions?.budget)}`,
      );
      return {
        processed_count: 1,
        completed_count: 1,
        retryable_count: 0,
        failed_count: 0,
        deferred_count: 0,
        eligible_count: 3,
        remaining_count: 2,
        budget: 2,
      };
    },
    log: (message) => {
      callLog.push(message);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(callLog, [
    "listen",
    "[api] persistent runtime listening on http://0.0.0.0:3001 (development, PostgreSQL-backed auth and governance registries)",
    "recovery:development:budget=2",
    "[api] governed execution orchestration recovery processed=1 completed=1 retryable=0 failed=0 deferred=0 eligible=3 remaining=2 budget=2",
  ]);
});

test("persistent server bootstrap ignores invalid boot recovery budget values fail-open", async () => {
  const callLog: string[] = [];
  const fakePool = {
    end() {
      return Promise.resolve();
    },
  };

  await startPersistentServer({
    env: {
      APP_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
      AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT: "true",
      AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT_BUDGET: "invalid",
    },
    loadEnvDefaults: () => undefined,
    createPool: () => fakePool,
    runPreflight: async ({ contract }) => ({
      status: "ready",
      components: {
        runtimeContract: { status: "ok" },
        database: { status: "ok" },
        uploadRoot: { status: "ok", path: contract.uploadRootDir },
      },
    }),
    createAuthRuntime: () => ({ kind: "auth-runtime" }),
    createRuntime: () => ({ kind: "governance-runtime" }),
    createServer: () => ({}),
    listenServer: async () => {
      callLog.push("listen");
    },
    runGovernedExecutionOrchestrationRecovery: async ({ env, recoveryOptions }) => {
      callLog.push(
        `recovery:${env.APP_ENV}:budget=${String(recoveryOptions?.budget)}`,
      );
      return {
        processed_count: 2,
        completed_count: 1,
        retryable_count: 1,
        failed_count: 0,
        deferred_count: 0,
      };
    },
    log: (message) => {
      callLog.push(message);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(callLog, [
    "listen",
    "[api] persistent runtime listening on http://0.0.0.0:3001 (development, PostgreSQL-backed auth and governance registries)",
    "recovery:development:budget=undefined",
    "[api] governed execution orchestration recovery processed=2 completed=1 retryable=1 failed=0 deferred=0",
  ]);
});

test("persistent server bootstrap logs a read-only boot residual summary after recovery", async () => {
  const callLog: string[] = [];
  const fakePool = {
    end() {
      return Promise.resolve();
    },
  };

  const options = {
    env: {
      APP_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
      AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT: "true",
    },
    loadEnvDefaults: () => undefined,
    createPool: () => fakePool,
    runPreflight: async ({ contract }: { contract: { uploadRootDir: string } }) => ({
      status: "ready" as const,
      components: {
        runtimeContract: { status: "ok" as const },
        database: { status: "ok" as const },
        uploadRoot: { status: "ok" as const, path: contract.uploadRootDir },
      },
    }),
    createAuthRuntime: () => ({ kind: "auth-runtime" }),
    createRuntime: () => ({ kind: "governance-runtime" }),
    createServer: () => ({}),
    listenServer: async () => {
      callLog.push("listen");
    },
    runGovernedExecutionOrchestrationRecovery: async ({
      env,
    }: {
      env: NodeJS.ProcessEnv;
    }) => {
      callLog.push(`recovery:${env.APP_ENV}`);
      return {
        processed_count: 1,
        completed_count: 1,
        retryable_count: 0,
        failed_count: 0,
        deferred_count: 1,
      };
    },
    runGovernedExecutionOrchestrationInspection: async ({
      env,
    }: {
      env: NodeJS.ProcessEnv;
    }) => {
      callLog.push(`inspection:${env.APP_ENV}`);
      return {
        summary: {
          total_count: 4,
          recoverable_now_count: 1,
          stale_running_count: 1,
          deferred_retry_count: 1,
          attention_required_count: 1,
          not_recoverable_count: 0,
        },
        focus: {
          actionable_count: 4,
          displayed_count: 0,
          omitted_count: 0,
          actionable_only: false,
          limit: undefined,
        },
        readiness_summary: {
          ready_now_count: 2,
          waiting_retry_eligibility_count: 1,
          waiting_running_timeout_count: 1,
          next_ready_at: "2026-04-05T09:06:00.000Z",
        },
        items: [],
      };
    },
    log: (message: string) => {
      callLog.push(message);
    },
  };

  await startPersistentServer(
    options as Parameters<typeof startPersistentServer>[0],
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(callLog, [
    "listen",
    "[api] persistent runtime listening on http://0.0.0.0:3001 (development, PostgreSQL-backed auth and governance registries)",
    "recovery:development",
    "[api] governed execution orchestration recovery processed=1 completed=1 retryable=0 failed=0 deferred=1",
    "inspection:development",
    "[api] governed execution orchestration boot residual total=4 recoverable_now=1 stale_running=1 deferred_retry=1 attention_required=1 not_recoverable=0 actionable=4 ready_now=2 waiting_retry_eligibility=1 waiting_running_timeout=1 next_ready_at=2026-04-05T09:06:00.000Z",
  ]);
});

test("persistent server bootstrap keeps startup healthy when boot residual inspection fails", async () => {
  const callLog: string[] = [];
  const fakePool = {
    end() {
      return Promise.resolve();
    },
  };

  const options = {
    env: {
      APP_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
      AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT: "true",
    },
    loadEnvDefaults: () => undefined,
    createPool: () => fakePool,
    runPreflight: async ({ contract }: { contract: { uploadRootDir: string } }) => ({
      status: "ready" as const,
      components: {
        runtimeContract: { status: "ok" as const },
        database: { status: "ok" as const },
        uploadRoot: { status: "ok" as const, path: contract.uploadRootDir },
      },
    }),
    createAuthRuntime: () => ({ kind: "auth-runtime" }),
    createRuntime: () => ({ kind: "governance-runtime" }),
    createServer: () => ({}),
    listenServer: async () => {
      callLog.push("listen");
    },
    runGovernedExecutionOrchestrationRecovery: async ({
      env,
    }: {
      env: NodeJS.ProcessEnv;
    }) => {
      callLog.push(`recovery:${env.APP_ENV}`);
      return {
        processed_count: 1,
        completed_count: 1,
        retryable_count: 0,
        failed_count: 0,
        deferred_count: 0,
      };
    },
    runGovernedExecutionOrchestrationInspection: async ({
      env,
    }: {
      env: NodeJS.ProcessEnv;
    }) => {
      callLog.push(`inspection:${env.APP_ENV}`);
      throw new Error("Synthetic inspection failure");
    },
    log: (message: string) => {
      callLog.push(message);
    },
  };

  await startPersistentServer(
    options as Parameters<typeof startPersistentServer>[0],
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(callLog, [
    "listen",
    "[api] persistent runtime listening on http://0.0.0.0:3001 (development, PostgreSQL-backed auth and governance registries)",
    "recovery:development",
    "[api] governed execution orchestration recovery processed=1 completed=1 retryable=0 failed=0 deferred=0",
    "inspection:development",
    "[api] governed execution orchestration boot inspection failed-open: Synthetic inspection failure",
  ]);
});

test("persistent server bootstrap keeps startup healthy when boot recovery fails", async () => {
  const callLog: string[] = [];
  const fakePool = {
    end() {
      return Promise.resolve();
    },
  };

  await startPersistentServer({
    env: {
      APP_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
      AGENT_EXECUTION_ORCHESTRATION_RECOVERY_ON_BOOT: "1",
    },
    loadEnvDefaults: () => undefined,
    createPool: () => fakePool,
    runPreflight: async ({ contract }) => ({
      status: "ready",
      components: {
        runtimeContract: { status: "ok" },
        database: { status: "ok" },
        uploadRoot: { status: "ok", path: contract.uploadRootDir },
      },
    }),
    createAuthRuntime: () => ({ kind: "auth-runtime" }),
    createRuntime: () => ({ kind: "governance-runtime" }),
    createServer: () => ({}),
    listenServer: async () => {
      callLog.push("listen");
    },
    runGovernedExecutionOrchestrationRecovery: async () => {
      throw new Error("Synthetic recovery failure");
    },
    log: (message) => {
      callLog.push(message);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(callLog, [
    "listen",
    "[api] persistent runtime listening on http://0.0.0.0:3001 (development, PostgreSQL-backed auth and governance registries)",
    "[api] governed execution orchestration recovery failed-open: Synthetic recovery failure",
  ]);
});
