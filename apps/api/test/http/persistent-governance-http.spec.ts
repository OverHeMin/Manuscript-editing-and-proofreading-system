import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import {
  PostgresKnowledgeRepository,
  PostgresKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/index.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

test("persistent governance runtime serves review state from PostgreSQL across server restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent governance database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentGovernanceData(seedPool);

      const firstServer = await startPersistentGovernanceServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentReviewer(firstServer.baseUrl);
        const initialQueueResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/review-queue`,
          {
            headers: {
              Cookie: cookie,
            },
          },
        );
        const initialQueue = (await initialQueueResponse.json()) as Array<{
          id: string;
          title: string;
          status: string;
        }>;

        assert.equal(initialQueueResponse.status, 200);
        assert.deepEqual(
          initialQueue.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
          })),
          [
            {
              id: "11111111-1111-1111-1111-111111111111",
              title: "Persistent endpoint rule",
              status: "pending_review",
            },
          ],
        );

        const approveResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/11111111-1111-1111-1111-111111111111/approve`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reviewNote: "Approved after persistent restart check.",
            }),
          },
        );

        assert.equal(approveResponse.status, 200);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const queueAfterRestartResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/knowledge/review-queue`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const queueAfterRestart = (await queueAfterRestartResponse.json()) as Array<unknown>;
          const historyResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/knowledge/11111111-1111-1111-1111-111111111111/review-actions`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const history = (await historyResponse.json()) as Array<{
            action: string;
            review_note?: string;
          }>;

          assert.equal(queueAfterRestartResponse.status, 200);
          assert.deepEqual(queueAfterRestart, []);
          assert.equal(historyResponse.status, 200);
          assert.deepEqual(
            history.map((record) => ({
              action: record.action,
              review_note: record.review_note,
            })),
            [
              {
                action: "submitted_for_review",
                review_note: undefined,
              },
              {
                action: "approved",
                review_note: "Approved after persistent restart check.",
              },
            ],
          );
        } finally {
          await stopServer(secondServer.server);
        }
      } finally {
        await stopServer(firstServer.server).catch(() => undefined);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent governance runtime keeps prompt and skill registry assets across server restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent governance database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentGovernanceData(seedPool);

      const firstServer = await startPersistentGovernanceServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentAdmin(firstServer.baseUrl);
        const createPromptResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
              name: "proofreading_mainline",
              version: "1.0.0",
              module: "proofreading",
              manuscriptTypes: ["review"],
            }),
          },
        );
        const createSkillResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
              name: "editing_skills",
              version: "1.0.0",
              appliesToModules: ["editing"],
              dependencyTools: ["python-docx"],
            }),
          },
        );
        const createdPrompt = (await createPromptResponse.json()) as { id: string };
        const createdSkill = (await createSkillResponse.json()) as { id: string };

        assert.equal(createPromptResponse.status, 201);
        assert.equal(createSkillResponse.status, 201);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const promptListResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const skillListResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const prompts = (await promptListResponse.json()) as Array<{ id: string; name: string }>;
          const skills = (await skillListResponse.json()) as Array<{ id: string; name: string }>;

          assert.equal(promptListResponse.status, 200);
          assert.equal(skillListResponse.status, 200);
          assert.deepEqual(
            prompts.map((record) => ({ id: record.id, name: record.name })),
            [
              {
                id: createdPrompt.id,
                name: "proofreading_mainline",
              },
            ],
          );
          assert.deepEqual(
            skills.map((record) => ({ id: record.id, name: record.name })),
            [
              {
                id: createdSkill.id,
                name: "editing_skills",
              },
            ],
          );
        } finally {
          await stopServer(secondServer.server);
        }
      } finally {
        await stopServer(firstServer.server).catch(() => undefined);
      }
    } finally {
      await seedPool.end();
    }
  });
});

async function seedPersistentGovernanceData(pool: Pool): Promise<void> {
  const userRepository = new PostgresUserRepository({ client: pool });
  const knowledgeRepository = new PostgresKnowledgeRepository({ client: pool });
  const reviewActionRepository = new PostgresKnowledgeReviewActionRepository({
    client: pool,
  });

  await userRepository.save({
    id: "persistent-knowledge-reviewer",
    username: "persistent.reviewer",
    displayName: "Persistent Reviewer",
    role: "knowledge_reviewer",
    passwordHash:
      "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
  await userRepository.save({
    id: "persistent-admin",
    username: "persistent.admin",
    displayName: "Persistent Admin",
    role: "admin",
    passwordHash:
      "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
  await knowledgeRepository.save({
    id: "11111111-1111-1111-1111-111111111111",
    title: "Persistent endpoint rule",
    canonical_text: "Clinical study submissions must disclose the primary endpoint.",
    knowledge_kind: "rule",
    status: "pending_review",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
  });
  await reviewActionRepository.save({
    id: "22222222-2222-2222-2222-222222222222",
    knowledge_item_id: "11111111-1111-1111-1111-111111111111",
    action: "submitted_for_review",
    actor_role: "user",
    created_at: "2026-03-30T09:00:00.000Z",
  });
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
  assert.ok(setCookie, "Expected persistent admin login to return a session cookie.");
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
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string", "Expected a tcp server address.");

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
  };
}

async function stopServer(server: ApiHttpServer): Promise<void> {
  if (!server.listening) {
    return;
  }

  server.close();
  await once(server, "close");
}

async function loginAsPersistentReviewer(baseUrl: string): Promise<string> {
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
  assert.ok(setCookie, "Expected persistent login to return a session cookie.");
  return setCookie.split(";")[0] ?? "";
}
