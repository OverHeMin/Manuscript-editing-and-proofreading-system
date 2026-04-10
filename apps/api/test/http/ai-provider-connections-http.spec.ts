import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { createApiHttpServer } from "../../src/http/api-http-server.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/ai-provider-credential-crypto.ts";
import type { AiProviderConnectivityProbeResult } from "../../src/modules/ai-provider-connections/openai-chat-compatible-connectivity-probe.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { startHttpTestServer, stopHttpTestServer } from "./support/http-test-server.ts";

test("GET /api/v1/system-settings/ai-providers is available to admins", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migration = runMigrateProcess(databaseUrl);
    assert.equal(
      migration.status,
      0,
      `Expected migrate to succeed for ai provider http tests.\n${migration.stdout}\n${migration.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentAdmin(serverHandle.baseUrl);
        const response = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            headers: {
              Cookie: adminCookie,
            },
          },
        );

        const body = (await response.json()) as Array<unknown>;
        assert.equal(response.status, 200);
        assert.ok(Array.isArray(body));
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("POST /api/v1/system-settings/ai-providers lets admins create connections", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migration = runMigrateProcess(databaseUrl);
    assert.equal(
      migration.status,
      0,
      `Expected migrate to succeed for ai provider http tests.\n${migration.stdout}\n${migration.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentAdmin(serverHandle.baseUrl);
        const createResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Edge Bridge",
              provider_kind: "openai_compatible",
              base_url: "https://api.openai.com",
              connection_metadata: { test_model_name: "gpt-4" },
              credentials: { apiKey: "secret" },
            }),
          },
        );

        const created = (await createResponse.json()) as {
          id: string;
          name: string;
        };
        assert.equal(createResponse.status, 201);
        assert.equal(created.name, "Edge Bridge");
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("POST /api/v1/system-settings/ai-providers/:id updates an existing connection", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migration = runMigrateProcess(databaseUrl);
    assert.equal(
      migration.status,
      0,
      `Expected migrate to succeed for ai provider http tests.\n${migration.stdout}\n${migration.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentAdmin(serverHandle.baseUrl);
        const createResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Edge Bridge",
              provider_kind: "openai_compatible",
              connection_metadata: { test_model_name: "gpt-4" },
              credentials: { apiKey: "secret" },
            }),
          },
        );

        assert.equal(createResponse.status, 201);
        const created = (await createResponse.json()) as {
          id: string;
          name: string;
        };

        const updateResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers/${created.id}`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Edge Bridge Updated",
            }),
          },
        );

        const updated = (await updateResponse.json()) as {
          id: string;
          name: string;
        };
        assert.equal(updateResponse.status, 200);
        assert.equal(updated.name, "Edge Bridge Updated");
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("POST /api/v1/system-settings/ai-providers/:id/rotate-credential rotates a connection credential", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migration = runMigrateProcess(databaseUrl);
    assert.equal(
      migration.status,
      0,
      `Expected migrate to succeed for ai provider http tests.\n${migration.stdout}\n${migration.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentAdmin(serverHandle.baseUrl);
        const createResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Edge Bridge",
              provider_kind: "openai_compatible",
              connection_metadata: { test_model_name: "gpt-4" },
              credentials: { apiKey: "secret" },
            }),
          },
        );
        const created = (await createResponse.json()) as {
          id: string;
        };

        const rotateResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers/${created.id}/rotate-credential`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              credentials: { apiKey: "rotated-secret" },
            }),
          },
        );

        assert.equal(rotateResponse.status, 200);
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("POST /api/v1/system-settings/ai-providers/:id/test runs connectivity assertions", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migration = runMigrateProcess(databaseUrl);
    assert.equal(
      migration.status,
      0,
      `Expected migrate to succeed for ai provider http tests.\n${migration.stdout}\n${migration.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentAdmin(serverHandle.baseUrl);
        const createResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Edge Bridge",
              provider_kind: "openai_compatible",
              connection_metadata: { test_model_name: "gpt-4" },
              credentials: { apiKey: "secret" },
            }),
          },
        );
        const created = (await createResponse.json()) as {
          id: string;
        };

        const testResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers/${created.id}/test`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connection_metadata: { test_model_name: "gpt-4" },
            }),
          },
        );

        assert.equal(testResponse.status, 200);
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("non-admin access to ai-provider routes is forbidden", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migration = runMigrateProcess(databaseUrl);
    assert.equal(
      migration.status,
      0,
      `Expected migrate to succeed for ai provider http tests.\n${migration.stdout}\n${migration.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentSystemSettingsUsers(seedPool);

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl);
      try {
        const reviewerCookie = await loginAsPersistentReviewer(serverHandle.baseUrl);
        const response = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
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

const stopServer = stopHttpTestServer;

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

async function startPersistentSystemSettingsServer(databaseUrl: string) {
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
      aiProviderCredentialCrypto: new AiProviderCredentialCrypto({
        AI_PROVIDER_MASTER_KEY: Buffer.alloc(32, 0x41).toString("base64"),
      }),
      aiProviderConnectivityProbe: {
        async testConnection(): Promise<AiProviderConnectivityProbeResult> {
          return {
            status: "passed",
            testedAt: new Date("2026-04-10T00:00:00.000Z"),
          };
        },
      },
    }),
  });

  server.on("close", () => {
    void pool.end();
  });

  return startHttpTestServer(server);
}

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
