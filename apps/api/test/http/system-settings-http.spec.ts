import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import {
  AiProviderCredentialCrypto,
  type AiProviderConnectivityProbe,
} from "../../src/modules/ai-provider-connections/index.ts";
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

test("persistent governance runtime exposes ai provider overview readiness under the system-settings namespace", async () => {
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

      const serverHandle = await startPersistentSystemSettingsServer(databaseUrl, {
        aiProviderConnectivityProbe: {
          testConnection: async () => ({
            status: "passed",
            testedAt: new Date("2026-04-10T10:00:00.000Z"),
          }),
        },
      });
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
              name: "Qwen Production",
              provider_kind: "qwen",
              connection_metadata: {
                test_model_name: "qwen-max",
              },
              credentials: {
                apiKey: "sk-qwen-production-1234",
              },
              enabled: true,
            }),
          },
        );
        const createdConnection = (await createResponse.json()) as {
          id: string;
          compatibility_mode?: string;
          credential_summary?: { mask?: string };
          readiness?: { status?: string; credential_configured?: boolean };
        };

        assert.equal(createResponse.status, 201);
        assert.equal(createdConnection.compatibility_mode, "openai_chat_compatible");
        assert.equal(createdConnection.credential_summary?.mask, "sk-***1234");
        assert.equal(createdConnection.readiness?.status, "ready");
        assert.equal(createdConnection.readiness?.credential_configured, true);

        const updateResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers/${createdConnection.id}`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Qwen Production Main",
              connection_metadata: {
                test_model_name: "qwen-plus",
              },
              enabled: true,
            }),
          },
        );
        assert.equal(updateResponse.status, 200);

        const rotateResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers/${createdConnection.id}/rotate-credential`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              credentials: {
                apiKey: "sk-qwen-production-5678",
              },
            }),
          },
        );
        assert.equal(rotateResponse.status, 200);

        const testResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers/${createdConnection.id}/test`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connection_metadata: {
                test_model_name: "qwen-plus",
              },
            }),
          },
        );
        assert.equal(testResponse.status, 200);

        const listResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        const listedConnections = (await listResponse.json()) as Array<{
          id: string;
          compatibility_mode?: string;
          connection_metadata?: { test_model_name?: string };
          credential_summary?: { mask?: string };
          readiness?: {
            status?: string;
            credential_configured?: boolean;
            summary?: string;
          };
        }>;
        const listedConnection = listedConnections.find(
          (record) => record.id === createdConnection.id,
        );

        assert.equal(listResponse.status, 200);
        assert.ok(listedConnection);
        assert.equal(listedConnection.compatibility_mode, "openai_chat_compatible");
        assert.equal(listedConnection.connection_metadata?.test_model_name, "qwen-plus");
        assert.equal(listedConnection.credential_summary?.mask, "sk-***5678");
        assert.equal(listedConnection.readiness?.status, "ready");
        assert.equal(listedConnection.readiness?.credential_configured, true);
        assert.ok(
          typeof listedConnection.readiness?.summary === "string" &&
            listedConnection.readiness.summary.length > 0,
        );
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent governance runtime manages registered models under the system-settings ai-access namespace", async () => {
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

        const qwenConnectionResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Qwen Production",
              provider_kind: "qwen",
              enabled: true,
            }),
          },
        );
        const qwenConnection = (await qwenConnectionResponse.json()) as {
          id: string;
        };
        assert.equal(qwenConnectionResponse.status, 201);

        const deepseekConnectionResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "DeepSeek Primary",
              provider_kind: "deepseek",
              enabled: true,
            }),
          },
        );
        const deepseekConnection = (await deepseekConnectionResponse.json()) as {
          id: string;
        };
        assert.equal(deepseekConnectionResponse.status, 201);

        const createPrimaryModelResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/models`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              provider: "qwen",
              modelName: "qwen-max",
              allowedModules: ["screening", "editing"],
              isProdAllowed: true,
              connectionId: qwenConnection.id,
            }),
          },
        );
        const primaryModel = (await createPrimaryModelResponse.json()) as {
          id: string;
          model_name?: string;
          connection_id?: string;
        };

        assert.equal(createPrimaryModelResponse.status, 201);
        assert.equal(primaryModel.model_name, "qwen-max");
        assert.equal(primaryModel.connection_id, qwenConnection.id);

        const createSecondaryModelResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/models`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              provider: "deepseek",
              modelName: "deepseek-chat",
              allowedModules: ["editing", "proofreading"],
              isProdAllowed: false,
              fallbackModelId: primaryModel.id,
              connectionId: deepseekConnection.id,
            }),
          },
        );

        assert.equal(createSecondaryModelResponse.status, 201);

        const listModelsResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/models`,
          {
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        const listedModels = (await listModelsResponse.json()) as Array<{
          id: string;
          model_name: string;
          connection_name?: string;
          fallback_model_name?: string;
        }>;

        assert.equal(listModelsResponse.status, 200);
        assert.deepEqual(
          listedModels.map((record) => ({
            id: record.id,
            model_name: record.model_name,
            connection_name: record.connection_name,
            fallback_model_name: record.fallback_model_name,
          })),
          [
            {
              id: listedModels[0]?.id ?? "",
              model_name: "deepseek-chat",
              connection_name: "DeepSeek Primary",
              fallback_model_name: "qwen-max",
            },
            {
              id: primaryModel.id,
              model_name: "qwen-max",
              connection_name: "Qwen Production",
              fallback_model_name: undefined,
            },
          ],
        );

        const missingConnectionResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/models`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              provider: "qwen",
              modelName: "qwen-missing",
              allowedModules: ["screening"],
              isProdAllowed: false,
              connectionId: "00000000-0000-0000-0000-000000009999",
            }),
          },
        );
        const missingConnectionBody = (await missingConnectionResponse.json()) as {
          error: string;
        };

        assert.equal(missingConnectionResponse.status, 404);
        assert.equal(missingConnectionBody.error, "not_found");

        const disabledConnectionResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Disabled Provider",
              provider_kind: "qwen",
              enabled: false,
            }),
          },
        );
        const disabledConnection = (await disabledConnectionResponse.json()) as {
          id: string;
        };
        assert.equal(disabledConnectionResponse.status, 201);

        const createDisabledModelResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/models`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              provider: "qwen",
              modelName: "qwen-disabled",
              allowedModules: ["screening"],
              isProdAllowed: false,
              connectionId: disabledConnection.id,
            }),
          },
        );
        const disabledConnectionBody = (await createDisabledModelResponse.json()) as {
          error: string;
        };

        assert.equal(createDisabledModelResponse.status, 409);
        assert.equal(disabledConnectionBody.error, "state_conflict");
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent governance runtime manages module defaults with bounded temperature under system-settings ai-access", async () => {
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

        const createProvider = async (name: string, providerKind: "qwen" | "deepseek" | "openai") => {
          const response = await fetch(
            `${serverHandle.baseUrl}/api/v1/system-settings/ai-providers`,
            {
              method: "POST",
              headers: {
                Cookie: adminCookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name,
                provider_kind: providerKind,
                enabled: true,
              }),
            },
          );
          const body = (await response.json()) as { id: string };
          assert.equal(response.status, 201);
          return body;
        };

        const screeningConnection = await createProvider("Qwen Screening", "qwen");
        const editingConnection = await createProvider("DeepSeek Editing", "deepseek");
        const proofreadingConnection = await createProvider(
          "OpenAI Proofreading",
          "openai",
        );

        const createModel = async (input: {
          provider: "qwen" | "deepseek" | "openai" | "anthropic";
          modelName: string;
          allowedModules: Array<"screening" | "editing" | "proofreading">;
          connectionId?: string;
        }) => {
          const response = await fetch(
            `${serverHandle.baseUrl}/api/v1/system-settings/models`,
            {
              method: "POST",
              headers: {
                Cookie: adminCookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                provider: input.provider,
                modelName: input.modelName,
                allowedModules: input.allowedModules,
                isProdAllowed: true,
                connectionId: input.connectionId,
              }),
            },
          );
          const body = (await response.json()) as { id: string };
          assert.equal(response.status, 201);
          return body;
        };

        const screeningModel = await createModel({
          provider: "qwen",
          modelName: "qwen-screening",
          allowedModules: ["screening"],
          connectionId: screeningConnection.id,
        });
        const editingModel = await createModel({
          provider: "deepseek",
          modelName: "deepseek-editing",
          allowedModules: ["editing"],
          connectionId: editingConnection.id,
        });
        const proofreadingModel = await createModel({
          provider: "openai",
          modelName: "gpt-proofreading",
          allowedModules: ["proofreading"],
          connectionId: proofreadingConnection.id,
        });
        const fallbackModel = await createModel({
          provider: "anthropic",
          modelName: "claude-fallback",
          allowedModules: ["screening", "editing", "proofreading"],
        });

        const saveScreeningDefaultResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/module-defaults`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              module_key: "screening",
              primary_model_id: screeningModel.id,
              fallback_model_id: fallbackModel.id,
              temperature: 0.1,
            }),
          },
        );
        assert.equal(saveScreeningDefaultResponse.status, 200);

        const saveEditingDefaultResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/module-defaults`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              module_key: "editing",
              primary_model_id: editingModel.id,
              fallback_model_id: fallbackModel.id,
              temperature: 0.2,
            }),
          },
        );
        assert.equal(saveEditingDefaultResponse.status, 200);

        const saveProofreadingDefaultResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/module-defaults`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              module_key: "proofreading",
              primary_model_id: proofreadingModel.id,
              fallback_model_id: fallbackModel.id,
              temperature: 0.3,
            }),
          },
        );
        assert.equal(saveProofreadingDefaultResponse.status, 200);

        const listDefaultsResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/module-defaults`,
          {
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        const moduleDefaults = (await listDefaultsResponse.json()) as Array<{
          module_key: "screening" | "editing" | "proofreading";
          primary_model_id?: string;
          fallback_model_id?: string;
          temperature?: number | null;
        }>;

        assert.equal(listDefaultsResponse.status, 200);
        assert.deepEqual(
          moduleDefaults.map((record) => ({
            module_key: record.module_key,
            primary_model_id: record.primary_model_id,
            fallback_model_id: record.fallback_model_id,
            temperature: record.temperature,
          })),
          [
            {
              module_key: "screening",
              primary_model_id: screeningModel.id,
              fallback_model_id: fallbackModel.id,
              temperature: 0.1,
            },
            {
              module_key: "editing",
              primary_model_id: editingModel.id,
              fallback_model_id: fallbackModel.id,
              temperature: 0.2,
            },
            {
              module_key: "proofreading",
              primary_model_id: proofreadingModel.id,
              fallback_model_id: fallbackModel.id,
              temperature: 0.3,
            },
          ],
        );

        const invalidTemperatureResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/system-settings/module-defaults`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              module_key: "screening",
              primary_model_id: screeningModel.id,
              fallback_model_id: fallbackModel.id,
              temperature: 1.4,
            }),
          },
        );
        const invalidTemperatureBody = (await invalidTemperatureResponse.json()) as {
          error: string;
        };

        assert.equal(invalidTemperatureResponse.status, 400);
        assert.equal(invalidTemperatureBody.error, "invalid_request");
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

async function startPersistentSystemSettingsServer(
  databaseUrl: string,
  options: {
    aiProviderConnectivityProbe?: AiProviderConnectivityProbe;
  } = {},
): Promise<{
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
      aiProviderCredentialCrypto: new AiProviderCredentialCrypto({
        AI_PROVIDER_MASTER_KEY: Buffer.alloc(32, 0x41).toString("base64"),
      }),
      aiProviderConnectivityProbe: options.aiProviderConnectivityProbe,
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
