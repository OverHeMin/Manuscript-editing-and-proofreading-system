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
  PostgresKnowledgeRepository,
  PostgresKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/index.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "./support/http-test-server.ts";

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

test("persistent governance runtime keeps model registry entries and routing policy across server restarts", async () => {
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
        const createResponse = await fetch(`${firstServer.baseUrl}/api/v1/model-registry`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actorRole: "editor",
            provider: "openai",
            modelName: "gpt-5.4",
            modelVersion: "2026-03-01",
            allowedModules: ["screening", "editing", "proofreading"],
            isProdAllowed: true,
          }),
        });
        const created = (await createResponse.json()) as { id: string };

        assert.equal(createResponse.status, 201);

        const routingResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/model-registry/routing-policy`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              systemDefaultModelId: created.id,
              moduleDefaults: {
                screening: created.id,
                editing: created.id,
                proofreading: created.id,
              },
            }),
          },
        );

        assert.equal(routingResponse.status, 200);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const listResponse = await fetch(`${secondServer.baseUrl}/api/v1/model-registry`, {
            headers: {
              Cookie: cookie,
            },
          });
          const models = (await listResponse.json()) as Array<{
            id: string;
            model_name: string;
          }>;
          const policyResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/model-registry/routing-policy`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const policy = (await policyResponse.json()) as {
            system_default_model_id?: string;
            module_defaults: Record<string, string>;
          };

          assert.equal(listResponse.status, 200);
          assert.deepEqual(
            models.map((record) => ({
              id: record.id,
              model_name: record.model_name,
            })),
            [
              {
                id: created.id,
                model_name: "gpt-5.4",
              },
            ],
          );
          assert.equal(policyResponse.status, 200);
          assert.equal(policy.system_default_model_id, created.id);
          assert.deepEqual(policy.module_defaults, {
            screening: created.id,
            editing: created.id,
            proofreading: created.id,
          });
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

test("persistent governance runtime keeps execution profiles and snapshots across server restarts", async () => {
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
        const familyResponse = await fetch(`${firstServer.baseUrl}/api/v1/templates/families`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            manuscriptType: "clinical_study",
            name: "Persistent execution family",
          }),
        });
        const family = (await familyResponse.json()) as { id: string };

        const moduleTemplateDraftResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/templates/module-drafts`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              templateFamilyId: family.id,
              module: "editing",
              manuscriptType: "clinical_study",
              prompt: "Persistent execution editing template",
            }),
          },
        );
        const moduleTemplateDraft = (await moduleTemplateDraftResponse.json()) as {
          id: string;
          version_no: number;
        };
        await fetch(
          `${firstServer.baseUrl}/api/v1/templates/module-templates/${moduleTemplateDraft.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
            }),
          },
        );

        const promptResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              name: "persistent_editing_mainline",
              version: "1.0.0",
              module: "editing",
              manuscriptTypes: ["clinical_study"],
            }),
          },
        );
        const prompt = (await promptResponse.json()) as { id: string };
        await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/prompt-templates/${prompt.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
            }),
          },
        );

        const skillResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              name: "persistent_editing_skills",
              version: "1.0.0",
              appliesToModules: ["editing"],
            }),
          },
        );
        const skill = (await skillResponse.json()) as { id: string };
        await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/skill-packages/${skill.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
            }),
          },
        );

        const modelResponse = await fetch(`${firstServer.baseUrl}/api/v1/model-registry`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actorRole: "editor",
            provider: "openai",
            modelName: "persistent-gpt-5.4",
            allowedModules: ["editing"],
            isProdAllowed: true,
          }),
        });
        const model = (await modelResponse.json()) as { id: string };
        await fetch(`${firstServer.baseUrl}/api/v1/model-registry/routing-policy`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actorRole: "editor",
            moduleDefaults: {
              editing: model.id,
            },
          }),
        });

        const profileResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/execution-governance/profiles`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              input: {
                module: "editing",
                manuscriptType: "clinical_study",
                templateFamilyId: family.id,
                moduleTemplateId: moduleTemplateDraft.id,
                promptTemplateId: prompt.id,
                skillPackageIds: [skill.id],
                knowledgeBindingMode: "profile_plus_dynamic",
              },
            }),
          },
        );
        const profile = (await profileResponse.json()) as { id: string };
        await fetch(
          `${firstServer.baseUrl}/api/v1/execution-governance/profiles/${profile.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
            }),
          },
        );

        const snapshotResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/execution-tracking/snapshots`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                manuscriptId: "11111111-1111-1111-1111-111111111111",
                module: "editing",
                jobId: "persistent-job-1",
                executionProfileId: profile.id,
                moduleTemplateId: moduleTemplateDraft.id,
                moduleTemplateVersionNo: moduleTemplateDraft.version_no,
                promptTemplateId: prompt.id,
                promptTemplateVersion: "1.0.0",
                skillPackageIds: [skill.id],
                skillPackageVersions: ["1.0.0"],
                modelId: model.id,
                knowledgeHits: [
                  {
                    knowledgeItemId: "11111111-1111-1111-1111-111111111111",
                    matchSource: "dynamic_routing",
                    matchReasons: ["persistent"],
                  },
                ],
              },
            }),
          },
        );
        const snapshot = (await snapshotResponse.json()) as { id: string };

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const profilesResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/execution-governance/profiles`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const profiles = (await profilesResponse.json()) as Array<{
            id: string;
            status: string;
          }>;
          const snapshotLoadedResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/execution-tracking/snapshots/${snapshot.id}`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const snapshotLoaded = (await snapshotLoadedResponse.json()) as { id: string };
          const resolveResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/execution-governance/resolve`,
            {
              method: "POST",
              headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                module: "editing",
                manuscriptType: "clinical_study",
                templateFamilyId: family.id,
              }),
            },
          );
          const resolved = (await resolveResponse.json()) as {
            profile: { id: string };
            resolved_model: { id: string };
          };

          assert.equal(profilesResponse.status, 200);
          assert.equal(snapshotLoadedResponse.status, 200);
          assert.equal(resolveResponse.status, 200);
          assert.deepEqual(
            profiles.map((record) => ({
              id: record.id,
              status: record.status,
            })),
            [
              {
                id: profile.id,
                status: "active",
              },
            ],
          );
          assert.equal(snapshotLoaded.id, snapshot.id);
          assert.equal(resolved.profile.id, profile.id);
          assert.equal(resolved.resolved_model.id, model.id);
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

test("persistent governance runtime keeps agent-tooling governance records across server restarts", async () => {
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

        const toolResponse = await fetch(`${firstServer.baseUrl}/api/v1/tool-gateway`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actorRole: "editor",
            input: {
              name: "knowledge.search",
              scope: "knowledge",
            },
          }),
        });
        const tool = (await toolResponse.json()) as { id: string; access_mode: string };

        assert.equal(toolResponse.status, 201);
        assert.equal(tool.access_mode, "read");

        const toolUpdateResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/tool-gateway/${tool.id}`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "knowledge_reviewer",
              input: {
                accessMode: "write",
              },
            }),
          },
        );
        const updatedTool = (await toolUpdateResponse.json()) as {
          id: string;
          access_mode: string;
        };

        assert.equal(toolUpdateResponse.status, 200);
        assert.equal(updatedTool.access_mode, "write");

        const policyResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/tool-permission-policies`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              input: {
                name: "Persistent Agent Policy",
                allowedToolIds: [tool.id],
                highRiskToolIds: [tool.id],
              },
            }),
          },
        );
        const policy = (await policyResponse.json()) as { id: string };

        assert.equal(policyResponse.status, 201);

        const activatePolicyResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/tool-permission-policies/${policy.id}/activate`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
            }),
          },
        );

        assert.equal(activatePolicyResponse.status, 200);

        const sandboxResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/sandbox-profiles`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              input: {
                name: "Persistent Editing Workspace",
                sandboxMode: "workspace_write",
                networkAccess: false,
                approvalRequired: true,
                allowedToolIds: [tool.id],
              },
            }),
          },
        );
        const sandbox = (await sandboxResponse.json()) as { id: string };

        assert.equal(sandboxResponse.status, 201);

        const activateSandboxResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/sandbox-profiles/${sandbox.id}/activate`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
            }),
          },
        );

        assert.equal(activateSandboxResponse.status, 200);

        const runtimeResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/agent-runtime`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              input: {
                name: "Persistent Editing Runtime",
                adapter: "deepagents",
                sandboxProfileId: sandbox.id,
                allowedModules: ["editing"],
                runtimeSlot: "editing",
              },
            }),
          },
        );
        const runtime = (await runtimeResponse.json()) as { id: string };

        assert.equal(runtimeResponse.status, 201);

        const publishRuntimeResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/agent-runtime/${runtime.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
            }),
          },
        );

        assert.equal(publishRuntimeResponse.status, 200);

        const agentProfileResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/agent-profiles`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              input: {
                name: "Persistent Editing Executor",
                roleKey: "subagent",
                moduleScope: ["editing"],
                manuscriptTypes: ["clinical_study"],
              },
            }),
          },
        );
        const agentProfile = (await agentProfileResponse.json()) as { id: string };

        assert.equal(agentProfileResponse.status, 201);

        const publishAgentProfileResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/agent-profiles/${agentProfile.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
            }),
          },
        );

        assert.equal(publishAgentProfileResponse.status, 200);

        const promptResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              name: "persistent_agent_runtime_prompt",
              version: "1.0.0",
              module: "editing",
              manuscriptTypes: ["clinical_study"],
            }),
          },
        );
        const prompt = (await promptResponse.json()) as { id: string };

        assert.equal(promptResponse.status, 201);

        const publishPromptResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/prompt-templates/${prompt.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
            }),
          },
        );

        assert.equal(publishPromptResponse.status, 200);

        const skillResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              name: "persistent_agent_runtime_skills",
              version: "1.0.0",
              appliesToModules: ["editing"],
              dependencyTools: ["knowledge.search"],
            }),
          },
        );
        const skill = (await skillResponse.json()) as { id: string };

        assert.equal(skillResponse.status, 201);

        const publishSkillResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/prompt-skill-registry/skill-packages/${skill.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
            }),
          },
        );

        assert.equal(publishSkillResponse.status, 200);

        const bindingResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/runtime-bindings`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              input: {
                module: "editing",
                manuscriptType: "clinical_study",
                templateFamilyId: "persistent-agent-family",
                runtimeId: runtime.id,
                sandboxProfileId: sandbox.id,
                agentProfileId: agentProfile.id,
                toolPermissionPolicyId: policy.id,
                promptTemplateId: prompt.id,
                skillPackageIds: [skill.id],
              },
            }),
          },
        );
        const binding = (await bindingResponse.json()) as { id: string };

        assert.equal(bindingResponse.status, 201);

        const activateBindingResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/runtime-bindings/${binding.id}/activate`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
            }),
          },
        );

        assert.equal(activateBindingResponse.status, 200);

        const executionLogResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/agent-execution`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                manuscriptId: "11111111-1111-1111-1111-111111111111",
                module: "editing",
                triggeredBy: "persistent-admin",
                runtimeId: runtime.id,
                sandboxProfileId: sandbox.id,
                agentProfileId: agentProfile.id,
                runtimeBindingId: binding.id,
                toolPermissionPolicyId: policy.id,
                knowledgeItemIds: ["11111111-1111-1111-1111-111111111111"],
              },
            }),
          },
        );
        const executionLog = (await executionLogResponse.json()) as { id: string };

        assert.equal(executionLogResponse.status, 201);

        const completeExecutionLogResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/agent-execution/${executionLog.id}/complete`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              executionSnapshotId: "persistent-snapshot-1",
              verificationEvidenceIds: ["persistent-evidence-1"],
            }),
          },
        );

        assert.equal(completeExecutionLogResponse.status, 200);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const getToolResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/tool-gateway/${tool.id}`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const persistedTool = (await getToolResponse.json()) as {
            id: string;
            access_mode: string;
          };

          const listRuntimeResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/agent-runtime/by-module/editing?activeOnly=true`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const runtimes = (await listRuntimeResponse.json()) as Array<{
            id: string;
            status: string;
          }>;

          const listBindingsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/runtime-bindings/by-scope/editing/clinical_study/persistent-agent-family?activeOnly=true`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const bindings = (await listBindingsResponse.json()) as Array<{
            id: string;
            status: string;
          }>;

          const getExecutionLogResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/agent-execution/${executionLog.id}`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const persistedExecutionLog = (await getExecutionLogResponse.json()) as {
            id: string;
            status: string;
            execution_snapshot_id?: string;
          };

          assert.equal(getToolResponse.status, 200);
          assert.equal(persistedTool.id, tool.id);
          assert.equal(persistedTool.access_mode, "write");
          assert.equal(listRuntimeResponse.status, 200);
          assert.deepEqual(
            runtimes.map((record) => ({
              id: record.id,
              status: record.status,
            })),
            [
              {
                id: runtime.id,
                status: "active",
              },
            ],
          );
          assert.equal(listBindingsResponse.status, 200);
          assert.deepEqual(
            bindings.map((record) => ({
              id: record.id,
              status: record.status,
            })),
            [
              {
                id: binding.id,
                status: "active",
              },
            ],
          );
          assert.equal(getExecutionLogResponse.status, 200);
          assert.equal(persistedExecutionLog.id, executionLog.id);
          assert.equal(persistedExecutionLog.status, "completed");
          assert.equal(
            persistedExecutionLog.execution_snapshot_id,
            "persistent-snapshot-1",
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

  return startHttpTestServer(server);
}

const stopServer = stopHttpTestServer;

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
