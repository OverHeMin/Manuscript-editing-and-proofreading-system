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
