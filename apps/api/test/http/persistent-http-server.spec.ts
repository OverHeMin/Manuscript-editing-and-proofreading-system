import test from "node:test";
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import {
  createPersistentServiceHealthProvider,
  type HttpServiceHealthProvider,
} from "../../src/http/service-health.ts";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { runPersistentStartupPreflight } from "../../src/ops/persistent-startup-preflight.ts";
import { resolvePersistentRuntimeContract } from "../../src/ops/persistent-runtime-contract.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "./support/http-test-server.ts";

test("non-local api runtime requires an explicit persistent auth runtime", () => {
  assert.throws(
    () =>
      createApiHttpServer({
        appEnv: "production",
        allowedOrigins: [],
        seedDemoKnowledgeReviewData: false,
      }),
    /persistent auth runtime/i,
  );
});

test("persistent auth runtime issues a durable session row on login", async () => {
  await withPersistentServer(async ({ baseUrl, client }) => {
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "persistent.reviewer",
        password: "demo-password",
      }),
    });

    assert.equal(loginResponse.status, 200);
    const setCookie = loginResponse.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.match(setCookie, /medsys_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Path=\//i);

    const sessions = await client.query<{
      user_id: string;
      provider: string;
      revoked_at: Date | null;
    }>(
      `
        select user_id, provider, revoked_at
        from auth_sessions
      `,
    );

    assert.equal(sessions.rowCount, 1);
    assert.deepEqual(sessions.rows[0], {
      user_id: "persistent-knowledge-reviewer",
      provider: "local",
      revoked_at: null,
    });
  });
});

test("persistent auth runtime exposes the current session and revokes it on logout", async () => {
  await withPersistentServer(async ({ baseUrl, client }) => {
    const cookie = await loginAsPersistentUser(baseUrl);
    const sessionResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: {
        Cookie: cookie,
      },
    });
    const sessionBody = (await sessionResponse.json()) as {
      user: {
        id: string;
        username: string;
        displayName: string;
        role: string;
      };
    };

    assert.equal(sessionResponse.status, 200);
    assert.deepEqual(sessionBody.user, {
      id: "persistent-knowledge-reviewer",
      username: "persistent.reviewer",
      displayName: "Persistent Reviewer",
      role: "knowledge_reviewer",
    });

    const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
    });

    assert.equal(logoutResponse.status, 204);
    assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Max-Age=0/i);

    const sessions = await client.query<{
      revoked_at: Date | null;
    }>(
      `
        select revoked_at
        from auth_sessions
      `,
    );

    assert.equal(sessions.rowCount, 1);
    assert.ok(sessions.rows[0]?.revoked_at instanceof Date);

    const afterLogoutResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: {
        Cookie: cookie,
      },
    });
    const afterLogoutBody = (await afterLogoutResponse.json()) as { error: string };

    assert.equal(afterLogoutResponse.status, 401);
    assert.equal(afterLogoutBody.error, "unauthorized");
  });
});

test("persistent auth runtime restores the server-side user identity on protected writes", async () => {
  await withPersistentServer(async ({ baseUrl }) => {
    const cookie = await loginAsPersistentUser(baseUrl);
    const response = await fetch(`${baseUrl}/api/v1/learning/reviewed-case-snapshots`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: "manuscript-demo-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: "human-final-demo-1",
        deidentificationPassed: true,
        requestedBy: "forged-requested-by",
        storageKey: "learning/manuscript-demo-1/persistent-snapshot.bin",
      }),
    });
    const body = (await response.json()) as {
      id: string;
      created_by: string;
    };

    assert.equal(response.status, 201);
    assert.ok(body.id);
    assert.equal(body.created_by, "persistent-knowledge-reviewer");
  });
});

test("persistent auth runtime rejects session reads after an admin disables the user", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent http database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      const userRepository = new PostgresUserRepository({ client: seedPool });
      await userRepository.save({
        id: "persistent-admin",
        username: "persistent.admin",
        displayName: "Persistent Admin",
        role: "admin",
        passwordHash:
          "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
      });
      await userRepository.save({
        id: "persistent-knowledge-reviewer",
        username: "persistent.reviewer",
        displayName: "Persistent Reviewer",
        role: "knowledge_reviewer",
        passwordHash:
          "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
      });

      const serverHandle = await startPersistentGovernanceServer(databaseUrl);
      try {
        const userCookie = await loginAsPersistentUser(serverHandle.baseUrl);
        const adminCookie = await loginAsPersistentAdmin(serverHandle.baseUrl);

        const disableResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users/persistent-knowledge-reviewer/disable`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
            },
          },
        );

        assert.equal(disableResponse.status, 200);

        const sessionResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/auth/session`,
          {
            headers: {
              Cookie: userCookie,
            },
          },
        );
        const sessionBody = (await sessionResponse.json()) as { error: string };

        assert.equal(sessionResponse.status, 401);
        assert.equal(sessionBody.error, "unauthorized");
      } finally {
        await stopHttpTestServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent readiness returns ready after startup preflight succeeds", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const contract = resolvePersistentRuntimeContract({
      APP_ENV: "development",
      DATABASE_URL: databaseUrl,
    });
    const startupPreflight = await runPersistentStartupPreflight({
      contract,
    });

    assert.equal(startupPreflight.status, "ready");

    await withPersistentServer(
      async ({ baseUrl }) => {
        const healthResponse = await fetch(`${baseUrl}/healthz`);
        const readyResponse = await fetch(`${baseUrl}/readyz`);
        const readyBody = (await readyResponse.json()) as {
          status: string;
          components: Record<string, string>;
        };

        assert.equal(healthResponse.status, 200);
        assert.equal(readyResponse.status, 200);
        assert.deepEqual(readyBody, {
          status: "ready",
          components: {
            runtimeContract: "ok",
            database: "ok",
            uploadRoot: "ok",
          },
        });
      },
      {
        databaseUrl,
        serviceHealth: createPersistentServiceHealthProvider({
          contract,
          startupPreflight,
        }),
      },
    );
  });
});

test("persistent readiness returns not_ready without dropping liveness", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const contract = resolvePersistentRuntimeContract({
      APP_ENV: "development",
      DATABASE_URL: databaseUrl,
    });

    await withPersistentServer(
      async ({ baseUrl }) => {
        const healthResponse = await fetch(`${baseUrl}/healthz`);
        const readyResponse = await fetch(`${baseUrl}/readyz`);
        const readyBody = (await readyResponse.json()) as {
          status: string;
          components: Record<string, string>;
        };

        assert.equal(healthResponse.status, 200);
        assert.equal(readyResponse.status, 503);
        assert.deepEqual(readyBody, {
          status: "not_ready",
          components: {
            runtimeContract: "ok",
            database: "failed",
            uploadRoot: "ok",
          },
        });
      },
      {
        databaseUrl,
        serviceHealth: createPersistentServiceHealthProvider({
          contract,
          startupPreflight: {
            status: "ready",
            components: {
              runtimeContract: { status: "ok" },
              database: { status: "ok" },
              uploadRoot: { status: "ok", path: contract.uploadRootDir },
            },
          },
          runPreflight: async () => ({
            status: "not_ready",
            components: {
              runtimeContract: { status: "ok" },
              database: {
                status: "failed",
                message: "Database is not reachable.",
              },
              uploadRoot: {
                status: "ok",
                path: contract.uploadRootDir,
              },
            },
          }),
        }),
      },
    );
  });
});

async function withPersistentServer(
  run: (context: { server: ApiHttpServer; baseUrl: string; client: Client }) => Promise<void>,
  options: {
    databaseUrl?: string;
    serviceHealth?: HttpServiceHealthProvider;
  } = {},
): Promise<void> {
  const runWithDatabase = async (databaseUrl: string) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent http database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    const userRepository = new PostgresUserRepository({ client });
    await userRepository.save({
      id: "persistent-knowledge-reviewer",
      username: "persistent.reviewer",
      displayName: "Persistent Reviewer",
      role: "knowledge_reviewer",
      passwordHash:
        "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
    });

    const server = createApiHttpServer({
      appEnv: "development",
      allowedOrigins: ["http://127.0.0.1:4173"],
      seedDemoKnowledgeReviewData: true,
      authRuntime: createPersistentHttpAuthRuntime({
        client,
      }),
      serviceHealth: options.serviceHealth,
    });

    try {
      const started = await startHttpTestServer(server);
      await run({
        server: started.server,
        baseUrl: started.baseUrl,
        client,
      });
    } finally {
      await stopHttpTestServer(server);
      await client.end();
    }
  };

  if (options.databaseUrl) {
    await runWithDatabase(options.databaseUrl);
    return;
  }

  await withTemporaryDatabase(runWithDatabase);
}

async function loginAsPersistentUser(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "persistent.reviewer",
      password: "demo-password",
    }),
  });

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Expected auth login to return a persistent session cookie.");
  return setCookie.split(";")[0] ?? "";
}

async function loginAsPersistentAdmin(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "persistent.admin",
      password: "demo-password",
    }),
  });

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Expected admin login to return a persistent session cookie.");
  return setCookie.split(";")[0] ?? "";
}

async function startPersistentGovernanceServer(databaseUrl: string): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
}> {
  const pool = new Pool({ connectionString: databaseUrl });
  const authRuntime = createPersistentHttpAuthRuntime({
    client: pool,
  });
  const server = createApiHttpServer({
    appEnv: "development",
    allowedOrigins: ["http://127.0.0.1:4173"],
    seedDemoKnowledgeReviewData: false,
    runtime: createPersistentGovernanceRuntime({
      client: pool,
      authRuntime,
    }),
  });

  server.on("close", () => {
    void pool.end();
  });

  return startHttpTestServer(server);
}
