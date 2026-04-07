import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "./support/http-test-server.ts";

test("persistent governance runtime lets admins manage system-settings users", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary system-settings database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentAdmin(serverHandle.baseUrl);

        const listResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users`,
          {
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        const listedUsers = (await listResponse.json()) as Array<{
          id: string;
          username: string;
          role: string;
          status: string;
        }>;

        assert.equal(listResponse.status, 200);
        assert.deepEqual(
          listedUsers.map((record) => ({
            id: record.id,
            username: record.username,
            role: record.role,
            status: record.status,
          })),
          [
            {
              id: "persistent-admin",
              username: "persistent.admin",
              role: "admin",
              status: "active",
            },
            {
              id: "persistent-editor",
              username: "persistent.editor",
              role: "editor",
              status: "active",
            },
            {
              id: "persistent-reviewer",
              username: "persistent.reviewer",
              role: "knowledge_reviewer",
              status: "active",
            },
          ],
        );

        const createResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: " Proofreader.Liu ",
              displayName: "Liu Proofreader",
              role: "proofreader",
              password: "new-password",
            }),
          },
        );
        const createdUser = (await createResponse.json()) as {
          id: string;
          username: string;
          displayName: string;
          role: string;
          status: string;
        };

        assert.equal(createResponse.status, 201);
        assert.equal(createdUser.username, "proofreader.liu");
        assert.equal(createdUser.displayName, "Liu Proofreader");
        assert.equal(createdUser.role, "proofreader");
        assert.equal(createdUser.status, "active");

        const updateResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users/${createdUser.id}/profile`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              displayName: "Liu Senior Proofreader",
              role: "editor",
            }),
          },
        );
        const updatedUser = (await updateResponse.json()) as {
          displayName: string;
          role: string;
        };

        assert.equal(updateResponse.status, 200);
        assert.equal(updatedUser.displayName, "Liu Senior Proofreader");
        assert.equal(updatedUser.role, "editor");

        const resetPasswordResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users/${createdUser.id}/reset-password`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nextPassword: "proofreader-reset-2",
            }),
          },
        );
        const passwordResetUser = (await resetPasswordResponse.json()) as {
          id: string;
        };

        assert.equal(resetPasswordResponse.status, 200);
        assert.equal(passwordResetUser.id, createdUser.id);

        const disableResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users/${createdUser.id}/disable`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        const disabledUser = (await disableResponse.json()) as {
          status: string;
        };

        assert.equal(disableResponse.status, 200);
        assert.equal(disabledUser.status, "disabled");

        const enableResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users/${createdUser.id}/enable`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        const enabledUser = (await enableResponse.json()) as {
          status: string;
        };

        assert.equal(enableResponse.status, 200);
        assert.equal(enabledUser.status, "active");
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent governance runtime rejects non-admin system-settings access", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary system-settings database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const reviewerCookie = await loginAsPersistentReviewer(serverHandle.baseUrl);
        const response = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users`,
          {
            headers: {
              Cookie: reviewerCookie,
            },
          },
        );
        const body = (await response.json()) as { error: string };

        assert.equal(response.status, 403);
        assert.equal(body.error, "forbidden");
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent governance runtime rejects disabling the last active admin", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary system-settings database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentAdmin(serverHandle.baseUrl);
        const response = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/users/persistent-admin/disable`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        const body = (await response.json()) as { error: string };

        assert.equal(response.status, 409);
        assert.equal(body.error, "state_conflict");
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

async function seedPersistentSystemSettingsUsers(pool: Pool): Promise<void> {
  const userRepository = new PostgresUserRepository({ client: pool });

  await userRepository.save({
    id: "persistent-admin",
    username: "persistent.admin",
    displayName: "Persistent Admin",
    role: "admin",
    passwordHash: "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
  await userRepository.save({
    id: "persistent-editor",
    username: "persistent.editor",
    displayName: "Persistent Editor",
    role: "editor",
    passwordHash: "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
  await userRepository.save({
    id: "persistent-reviewer",
    username: "persistent.reviewer",
    displayName: "Persistent Reviewer",
    role: "knowledge_reviewer",
    passwordHash: "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
}

async function startPersistentSystemSettingsServer(databaseUrl: string): Promise<{
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

const stopServer = stopHttpTestServer;

async function loginAsPersistentAdmin(baseUrl: string): Promise<string> {
  return loginWithCredentials(baseUrl, "persistent.admin");
}

async function loginAsPersistentReviewer(baseUrl: string): Promise<string> {
  return loginWithCredentials(baseUrl, "persistent.reviewer");
}

async function loginWithCredentials(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password: "demo-password",
    }),
  });

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, `Expected login for "${username}" to return a session cookie.`);
  return setCookie.split(";")[0] ?? "";
}
