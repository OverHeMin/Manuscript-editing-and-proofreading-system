import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { Client } from "pg";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

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

async function withPersistentServer(
  run: (context: { server: ApiHttpServer; baseUrl: string; client: Client }) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
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
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    assert.ok(address && typeof address !== "string", "Expected a tcp server address.");

    try {
      await run({
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
        client,
      });
    } finally {
      server.close();
      await once(server, "close");
      await client.end();
    }
  });
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
