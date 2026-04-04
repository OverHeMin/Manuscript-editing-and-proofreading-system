import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import { PostgresDocumentAssetRepository } from "../../src/modules/assets/index.ts";
import { PostgresHarnessDatasetRepository } from "../../src/modules/harness-datasets/index.ts";
import {
  PostgresKnowledgeRepository,
  PostgresKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/index.ts";
import { PostgresReviewedCaseSnapshotRepository } from "../../src/modules/learning/index.ts";
import { PostgresManuscriptRepository } from "../../src/modules/manuscripts/index.ts";
import { PostgresVerificationOpsRepository } from "../../src/modules/verification-ops/index.ts";
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

test("persistent governance runtime keeps model routing governance policies across server restarts", async () => {
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

        const createModel = async (input: {
          provider: string;
          modelName: string;
          modelVersion: string;
          allowedModules: string[];
        }) => {
          const response = await fetch(`${firstServer.baseUrl}/api/v1/model-registry`, {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              provider: input.provider,
              modelName: input.modelName,
              modelVersion: input.modelVersion,
              allowedModules: input.allowedModules,
              isProdAllowed: true,
            }),
          });
          const body = (await response.json()) as { id: string };

          assert.equal(response.status, 201);
          return body;
        };

        const primaryModel = await createModel({
          provider: "openai",
          modelName: "persistent-routing-primary",
          modelVersion: "2026-04-03",
          allowedModules: ["screening", "editing", "proofreading"],
        });
        const fallbackModel = await createModel({
          provider: "google",
          modelName: "persistent-routing-fallback",
          modelVersion: "2026-04-03",
          allowedModules: ["screening", "editing", "proofreading"],
        });

        const createPolicyResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/model-routing-governance/policies`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              input: {
                scopeKind: "template_family",
                scopeValue: "persistent-routing-family-1",
                primaryModelId: primaryModel.id,
                fallbackModelIds: [fallbackModel.id],
                evidenceLinks: [
                  { kind: "evaluation_run", id: "persistent-routing-run-1" },
                ],
                notes: "Persist the initial routing governance draft.",
              },
            }),
          },
        );
        const createdDraft = (await createPolicyResponse.json()) as {
          policy_id: string;
          version: {
            id: string;
          };
        };

        assert.equal(createPolicyResponse.status, 201);

        const submitResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/submit`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              reason: "Submit the persistent routing draft.",
            }),
          },
        );
        const approveResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/approve`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              reason: "Approve the persistent routing draft.",
            }),
          },
        );
        const activateResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/model-routing-governance/versions/${createdDraft.version.id}/activate`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              reason: "Activate the persistent routing draft.",
            }),
          },
        );

        assert.equal(submitResponse.status, 200);
        assert.equal(approveResponse.status, 200);
        assert.equal(activateResponse.status, 200);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const listResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/model-routing-governance/policies`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const policies = (await listResponse.json()) as Array<{
            policy_id: string;
            scope_kind: string;
            scope_value: string;
            active_version?: {
              status: string;
              primary_model_id: string;
              scope_kind: string;
              fallback_model_ids: string[];
            };
          }>;
          const persistedPolicy = policies.find(
            (policy) => policy.policy_id === createdDraft.policy_id,
          );

          assert.equal(listResponse.status, 200);
          assert.equal(persistedPolicy?.scope_kind, "template_family");
          assert.equal(persistedPolicy?.scope_value, "persistent-routing-family-1");
          assert.equal(persistedPolicy?.active_version?.status, "active");
          assert.equal(
            persistedPolicy?.active_version?.primary_model_id,
            primaryModel.id,
          );
          assert.equal(
            persistedPolicy?.active_version?.scope_kind,
            "template_family",
          );
          assert.deepEqual(persistedPolicy?.active_version?.fallback_model_ids, [
            fallbackModel.id,
          ]);
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

const persistentHarnessHandoffFixtureIds = {
  manuscriptId: "33333333-3333-4333-8333-333333333333",
  originalAssetId: "44444444-4444-4444-8444-444444444444",
  humanFinalAssetId: "55555555-5555-4555-8555-555555555555",
  snapshotAssetId: "66666666-6666-4666-8666-666666666666",
  reviewedCaseSnapshotId: "77777777-7777-4777-8777-777777777777",
  verificationEvidenceId: "88888888-8888-4888-8888-888888888888",
  evaluationSuiteId: "99999999-9999-4999-8999-999999999999",
  evaluationSampleSetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
  evaluationSampleSetItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbba",
  evaluationRunId: "cccccccc-cccc-4ccc-8ccc-ccccccccccca",
  evaluationEvidencePackId: "dddddddd-dddd-4ddd-8ddd-ddddddddddda",
} as const;

const persistentHarnessWorkbenchFixtureIds = {
  draftFamilyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeea",
  draftVersionId: "ffffffff-ffff-4fff-8fff-fffffffffffa",
  publishedFamilyId: "12121212-1212-4212-8212-121212121212",
  publishedVersionId: "34343434-3434-4334-8334-343434343434",
  rubricId: "56565656-5656-4565-8565-565656565656",
  jsonPublicationId: "78787878-7878-4787-8787-787878787878",
} as const;

test("persistent governance runtime creates additive harness dataset draft handoffs from governed sources", async () => {
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
      await seedPersistentHarnessDatasetHandoffData(seedPool);

      const firstServer = await startPersistentGovernanceServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentAdmin(firstServer.baseUrl);

        const snapshotResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning-governance/reviewed-case-snapshots/${persistentHarnessHandoffFixtureIds.reviewedCaseSnapshotId}/harness-dataset-candidates`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                familyName: "Persistent reviewed snapshot gold set",
                measureFocus: "proofreading issue detection",
                publicationNotes:
                  "Seeded draft harness candidate from a reviewed snapshot.",
              },
            }),
          },
        );
        const snapshotCandidate = (await snapshotResponse.json()) as {
          source_kind: string;
          source_id: string;
          draft_family_id: string;
          draft_version_id: string;
          status: string;
          item_count: number;
          requires_manual_rubric_assignment: boolean;
        };

        assert.equal(snapshotResponse.status, 201);
        assert.equal(snapshotCandidate.source_kind, "reviewed_case_snapshot");
        assert.equal(
          snapshotCandidate.source_id,
          persistentHarnessHandoffFixtureIds.reviewedCaseSnapshotId,
        );
        assert.equal(snapshotCandidate.status, "draft");
        assert.equal(snapshotCandidate.item_count, 1);
        assert.equal(snapshotCandidate.requires_manual_rubric_assignment, true);

        const humanFinalResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/human-final-assets/${persistentHarnessHandoffFixtureIds.humanFinalAssetId}/harness-dataset-candidates`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                familyName: "Persistent human final gold set",
                module: "proofreading",
                measureFocus: "human-final proofreading conformance",
                publicationNotes:
                  "Seeded draft harness candidate from a human final asset.",
              },
            }),
          },
        );
        const humanFinalCandidate = (await humanFinalResponse.json()) as {
          source_kind: string;
          source_id: string;
          draft_family_id: string;
          draft_version_id: string;
          status: string;
          item_count: number;
          requires_manual_rubric_assignment: boolean;
        };

        assert.equal(humanFinalResponse.status, 201);
        assert.equal(humanFinalCandidate.source_kind, "human_final_asset");
        assert.equal(
          humanFinalCandidate.source_id,
          persistentHarnessHandoffFixtureIds.humanFinalAssetId,
        );
        assert.equal(humanFinalCandidate.status, "draft");
        assert.equal(humanFinalCandidate.item_count, 1);
        assert.equal(humanFinalCandidate.requires_manual_rubric_assignment, true);

        const evidencePackResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evidence-packs/${persistentHarnessHandoffFixtureIds.evaluationEvidencePackId}/harness-dataset-candidates`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                familyName: "Persistent evidence pack gold set",
                measureFocus: "proofreading regression adjudication",
                publicationNotes:
                  "Seeded draft harness candidate from a finalized evaluation evidence pack.",
              },
            }),
          },
        );
        const evidencePackCandidate = (await evidencePackResponse.json()) as {
          source_kind: string;
          source_id: string;
          draft_family_id: string;
          draft_version_id: string;
          status: string;
          item_count: number;
          requires_manual_rubric_assignment: boolean;
        };

        assert.equal(evidencePackResponse.status, 201);
        assert.equal(
          evidencePackCandidate.source_kind,
          "evaluation_evidence_pack",
        );
        assert.equal(
          evidencePackCandidate.source_id,
          persistentHarnessHandoffFixtureIds.evaluationEvidencePackId,
        );
        assert.equal(evidencePackCandidate.status, "draft");
        assert.equal(evidencePackCandidate.item_count, 1);
        assert.equal(evidencePackCandidate.requires_manual_rubric_assignment, true);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const harnessDatasetRepository = new PostgresHarnessDatasetRepository({
            client: seedPool,
          });

          const persistedSnapshotFamily =
            await harnessDatasetRepository.findGoldSetFamilyById(
              snapshotCandidate.draft_family_id,
            );
          const persistedSnapshotVersion =
            await harnessDatasetRepository.findGoldSetVersionById(
              snapshotCandidate.draft_version_id,
            );
          const persistedHumanFinalVersion =
            await harnessDatasetRepository.findGoldSetVersionById(
              humanFinalCandidate.draft_version_id,
            );
          const persistedEvidencePackVersion =
            await harnessDatasetRepository.findGoldSetVersionById(
              evidencePackCandidate.draft_version_id,
            );

          assert.equal(persistedSnapshotFamily?.scope.module, "proofreading");
          assert.deepEqual(persistedSnapshotFamily?.scope.manuscript_types, [
            "clinical_study",
          ]);
          assert.equal(persistedSnapshotVersion?.status, "draft");
          assert.equal(
            persistedSnapshotVersion?.items[0]?.source_kind,
            "reviewed_case_snapshot",
          );
          assert.equal(
            persistedSnapshotVersion?.rubric_definition_id,
            undefined,
          );
          assert.equal(
            persistedHumanFinalVersion?.items[0]?.source_kind,
            "human_final_asset",
          );
          assert.equal(
            persistedHumanFinalVersion?.deidentification_gate_passed,
            false,
          );
          assert.equal(
            persistedEvidencePackVersion?.items[0]?.source_kind,
            "evaluation_evidence_pack",
          );
          assert.equal(
            persistedEvidencePackVersion?.human_review_gate_passed,
            true,
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

test("persistent governance runtime lists harness dataset workbench state and exports published gold sets locally", async () => {
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
      await seedPersistentHarnessDatasetHandoffData(seedPool);
      await seedPersistentHarnessDatasetWorkbenchData(seedPool);

      const serverHandle = await startPersistentGovernanceServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentAdmin(serverHandle.baseUrl);

        const overviewResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/harness-datasets/workbench`,
          {
            headers: {
              Cookie: cookie,
            },
          },
        );
        const overview = (await overviewResponse.json()) as {
          export_root_dir: string;
          versions: Array<{
            id: string;
            status: string;
            family_name: string;
            rubric_assignment: {
              status: string;
              rubric_name?: string;
            };
            items: Array<{
              source_kind: string;
              source_id: string;
            }>;
            publications: Array<{
              export_format: string;
            }>;
          }>;
        };

        assert.equal(overviewResponse.status, 200);
        assert.match(
          overview.export_root_dir,
          /[\\/]\.local-data[\\/]harness-exports[\\/]development$/,
        );
        assert.equal(overview.versions.length, 2);
        assert.deepEqual(
          overview.versions.map((version) => ({
            id: version.id,
            status: version.status,
            familyName: version.family_name,
            rubricStatus: version.rubric_assignment.status,
          })),
          [
            {
              id: persistentHarnessWorkbenchFixtureIds.draftVersionId,
              status: "draft",
              familyName: "Proofreading gold set",
              rubricStatus: "missing",
            },
            {
              id: persistentHarnessWorkbenchFixtureIds.publishedVersionId,
              status: "published",
              familyName: "Editing gold set",
              rubricStatus: "published",
            },
          ],
        );
        assert.equal(
          overview.versions[1]?.rubric_assignment.rubric_name,
          "Editing rubric",
        );
        assert.deepEqual(
          overview.versions[1]?.items.map((item) => item.source_kind),
          ["human_final_asset", "evaluation_evidence_pack"],
        );
        assert.deepEqual(
          overview.versions[1]?.publications.map((publication) => publication.export_format),
          ["json"],
        );

        const exportResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/harness-datasets/gold-set-versions/${persistentHarnessWorkbenchFixtureIds.publishedVersionId}/export`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              format: "jsonl",
            }),
          },
        );
        const exportResult = (await exportResponse.json()) as {
          publication: {
            gold_set_version_id: string;
            export_format: string;
            status: string;
            output_uri?: string;
          };
          output_path: string;
        };

        assert.equal(exportResponse.status, 201);
        assert.equal(
          exportResult.publication.gold_set_version_id,
          persistentHarnessWorkbenchFixtureIds.publishedVersionId,
        );
        assert.equal(exportResult.publication.export_format, "jsonl");
        assert.equal(exportResult.publication.status, "succeeded");
        assert.equal(exportResult.publication.output_uri, exportResult.output_path);
        const exportedJsonl = await readFile(exportResult.output_path, "utf8");
        const exportedLines = exportedJsonl
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as { source_kind: string; source_id: string });
        assert.deepEqual(
          exportedLines.map((line) => line.source_kind),
          ["human_final_asset", "evaluation_evidence_pack"],
        );

        const harnessDatasetRepository = new PostgresHarnessDatasetRepository({
          client: seedPool,
        });
        const publications =
          await harnessDatasetRepository.listDatasetPublicationsByVersionId(
            persistentHarnessWorkbenchFixtureIds.publishedVersionId,
          );
        assert.equal(publications.length, 2);
        assert.deepEqual(
          publications
            .map((publication) => publication.export_format)
            .sort((left, right) => left.localeCompare(right)),
          ["json", "jsonl"],
        );
      } finally {
        await stopServer(serverHandle.server);
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

async function seedPersistentHarnessDatasetHandoffData(pool: Pool): Promise<void> {
  const manuscriptRepository = new PostgresManuscriptRepository({ client: pool });
  const assetRepository = new PostgresDocumentAssetRepository({ client: pool });
  const reviewedCaseSnapshotRepository = new PostgresReviewedCaseSnapshotRepository({
    client: pool,
  });
  const verificationOpsRepository = new PostgresVerificationOpsRepository({
    client: pool,
  });

  await manuscriptRepository.save({
    id: persistentHarnessHandoffFixtureIds.manuscriptId,
    title: "Persistent Harness Handoff Manuscript",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "persistent-admin",
    created_at: "2026-04-01T08:00:00.000Z",
    updated_at: "2026-04-01T08:00:00.000Z",
  });
  await assetRepository.save({
    id: persistentHarnessHandoffFixtureIds.originalAssetId,
    manuscript_id: persistentHarnessHandoffFixtureIds.manuscriptId,
    asset_type: "original",
    status: "active",
    storage_key: "persistent/harness/original.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_module: "upload",
    created_by: "persistent-admin",
    version_no: 1,
    is_current: false,
    file_name: "persistent-harness-original.docx",
    created_at: "2026-04-01T08:01:00.000Z",
    updated_at: "2026-04-01T08:01:00.000Z",
  });
  await assetRepository.save({
    id: persistentHarnessHandoffFixtureIds.humanFinalAssetId,
    manuscript_id: persistentHarnessHandoffFixtureIds.manuscriptId,
    asset_type: "human_final_docx",
    status: "active",
    storage_key: "persistent/harness/human-final.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    parent_asset_id: persistentHarnessHandoffFixtureIds.originalAssetId,
    source_module: "manual",
    created_by: "persistent-admin",
    version_no: 2,
    is_current: true,
    file_name: "persistent-harness-human-final.docx",
    created_at: "2026-04-01T08:02:00.000Z",
    updated_at: "2026-04-01T08:02:00.000Z",
  });
  await assetRepository.save({
    id: persistentHarnessHandoffFixtureIds.snapshotAssetId,
    manuscript_id: persistentHarnessHandoffFixtureIds.manuscriptId,
    asset_type: "learning_snapshot_attachment",
    status: "active",
    storage_key: "persistent/harness/reviewed-snapshot.bin",
    mime_type: "application/octet-stream",
    parent_asset_id: persistentHarnessHandoffFixtureIds.humanFinalAssetId,
    source_module: "learning",
    created_by: "persistent-admin",
    version_no: 1,
    is_current: false,
    file_name: "persistent-reviewed-snapshot.bin",
    created_at: "2026-04-01T08:03:00.000Z",
    updated_at: "2026-04-01T08:03:00.000Z",
  });
  await reviewedCaseSnapshotRepository.save({
    id: persistentHarnessHandoffFixtureIds.reviewedCaseSnapshotId,
    manuscript_id: persistentHarnessHandoffFixtureIds.manuscriptId,
    module: "proofreading",
    manuscript_type: "clinical_study",
    human_final_asset_id: persistentHarnessHandoffFixtureIds.humanFinalAssetId,
    deidentification_passed: true,
    snapshot_asset_id: persistentHarnessHandoffFixtureIds.snapshotAssetId,
    created_by: "persistent-admin",
    created_at: "2026-04-01T08:03:30.000Z",
  });
  await verificationOpsRepository.saveEvaluationSuite({
    id: persistentHarnessHandoffFixtureIds.evaluationSuiteId,
    name: "Persistent Harness Evaluation Suite",
    suite_type: "regression",
    status: "active",
    verification_check_profile_ids: [],
    module_scope: ["proofreading"],
    requires_production_baseline: false,
    supports_ab_comparison: false,
    hard_gate_policy: {
      must_use_deidentified_samples: true,
      requires_parsable_output: false,
    },
    score_weights: {
      structure: 0,
      terminology: 0,
      knowledge_coverage: 0,
      risk_detection: 0,
      human_edit_burden: 0,
      cost_and_latency: 0,
    },
    admin_only: true,
  });
  await verificationOpsRepository.saveEvaluationSampleSet({
    id: persistentHarnessHandoffFixtureIds.evaluationSampleSetId,
    name: "Persistent Harness Sample Set",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
    sample_count: 1,
    source_policy: {
      source_kind: "reviewed_case_snapshot",
      requires_deidentification_pass: true,
      requires_human_final_asset: true,
    },
    status: "published",
    admin_only: true,
  });
  await verificationOpsRepository.saveEvaluationSampleSetItem({
    id: persistentHarnessHandoffFixtureIds.evaluationSampleSetItemId,
    sample_set_id: persistentHarnessHandoffFixtureIds.evaluationSampleSetId,
    manuscript_id: persistentHarnessHandoffFixtureIds.manuscriptId,
    snapshot_asset_id: persistentHarnessHandoffFixtureIds.snapshotAssetId,
    reviewed_case_snapshot_id:
      persistentHarnessHandoffFixtureIds.reviewedCaseSnapshotId,
    module: "proofreading",
    manuscript_type: "clinical_study",
    risk_tags: ["consistency"],
  });
  await verificationOpsRepository.saveVerificationEvidence({
    id: persistentHarnessHandoffFixtureIds.verificationEvidenceId,
    kind: "artifact",
    label: "Persistent harness evaluation evidence",
    artifact_asset_id: persistentHarnessHandoffFixtureIds.humanFinalAssetId,
    created_at: "2026-04-01T08:04:00.000Z",
  });
  await verificationOpsRepository.saveEvaluationRun({
    id: persistentHarnessHandoffFixtureIds.evaluationRunId,
    suite_id: persistentHarnessHandoffFixtureIds.evaluationSuiteId,
    sample_set_id: persistentHarnessHandoffFixtureIds.evaluationSampleSetId,
    run_item_count: 1,
    status: "passed",
    evidence_ids: [persistentHarnessHandoffFixtureIds.verificationEvidenceId],
    started_at: "2026-04-01T08:05:00.000Z",
    finished_at: "2026-04-01T08:06:00.000Z",
  });
  await verificationOpsRepository.saveEvaluationEvidencePack({
    id: persistentHarnessHandoffFixtureIds.evaluationEvidencePackId,
    experiment_run_id: persistentHarnessHandoffFixtureIds.evaluationRunId,
    summary_status: "recommended",
    score_summary: "Persistent harness evidence pack.",
    created_at: "2026-04-01T08:06:30.000Z",
  });
}

async function seedPersistentHarnessDatasetWorkbenchData(pool: Pool): Promise<void> {
  const harnessDatasetRepository = new PostgresHarnessDatasetRepository({
    client: pool,
  });

  await harnessDatasetRepository.saveGoldSetFamily({
    id: persistentHarnessWorkbenchFixtureIds.draftFamilyId,
    name: "Proofreading gold set",
    scope: {
      module: "proofreading",
      manuscript_types: ["clinical_study"],
      measure_focus: "issue detection",
    },
    admin_only: true,
    created_at: "2026-04-04T09:00:00.000Z",
    updated_at: "2026-04-04T09:00:00.000Z",
  });
  await harnessDatasetRepository.saveGoldSetVersion({
    id: persistentHarnessWorkbenchFixtureIds.draftVersionId,
    family_id: persistentHarnessWorkbenchFixtureIds.draftFamilyId,
    version_no: 1,
    status: "draft",
    item_count: 1,
    deidentification_gate_passed: true,
    human_review_gate_passed: true,
    items: [
      {
        source_kind: "reviewed_case_snapshot",
        source_id: persistentHarnessHandoffFixtureIds.reviewedCaseSnapshotId,
        manuscript_id: persistentHarnessHandoffFixtureIds.manuscriptId,
        manuscript_type: "clinical_study",
        deidentification_passed: true,
        human_reviewed: true,
      },
    ],
    created_by: "persistent.admin",
    created_at: "2026-04-04T09:05:00.000Z",
  });

  await harnessDatasetRepository.saveGoldSetFamily({
    id: persistentHarnessWorkbenchFixtureIds.publishedFamilyId,
    name: "Editing gold set",
    scope: {
      module: "editing",
      manuscript_types: ["review"],
      measure_focus: "conformance",
    },
    admin_only: true,
    created_at: "2026-04-04T10:00:00.000Z",
    updated_at: "2026-04-04T10:00:00.000Z",
  });
  await harnessDatasetRepository.saveRubricDefinition({
    id: persistentHarnessWorkbenchFixtureIds.rubricId,
    name: "Editing rubric",
    version_no: 2,
    status: "published",
    scope: {
      module: "editing",
      manuscript_types: ["review"],
    },
    scoring_dimensions: [
      {
        key: "conformance",
        label: "Conformance",
        weight: 1,
      },
    ],
    created_by: "persistent.admin",
    created_at: "2026-04-04T10:10:00.000Z",
    published_by: "persistent.admin",
    published_at: "2026-04-04T10:20:00.000Z",
  });
  await harnessDatasetRepository.saveGoldSetVersion({
    id: persistentHarnessWorkbenchFixtureIds.publishedVersionId,
    family_id: persistentHarnessWorkbenchFixtureIds.publishedFamilyId,
    version_no: 2,
    status: "published",
    rubric_definition_id: persistentHarnessWorkbenchFixtureIds.rubricId,
    item_count: 2,
    deidentification_gate_passed: true,
    human_review_gate_passed: true,
    items: [
      {
        source_kind: "human_final_asset",
        source_id: persistentHarnessHandoffFixtureIds.humanFinalAssetId,
        manuscript_id: persistentHarnessHandoffFixtureIds.manuscriptId,
        manuscript_type: "review",
        deidentification_passed: true,
        human_reviewed: true,
        risk_tags: ["terminology"],
      },
      {
        source_kind: "evaluation_evidence_pack",
        source_id: persistentHarnessHandoffFixtureIds.evaluationEvidencePackId,
        manuscript_id: persistentHarnessHandoffFixtureIds.manuscriptId,
        manuscript_type: "review",
        deidentification_passed: true,
        human_reviewed: true,
      },
    ],
    created_by: "persistent.admin",
    created_at: "2026-04-04T10:30:00.000Z",
    published_by: "persistent.admin",
    published_at: "2026-04-04T11:00:00.000Z",
  });
  await harnessDatasetRepository.saveDatasetPublication({
    id: persistentHarnessWorkbenchFixtureIds.jsonPublicationId,
    gold_set_version_id: persistentHarnessWorkbenchFixtureIds.publishedVersionId,
    export_format: "json",
    status: "succeeded",
    output_uri:
      ".local-data/harness-exports/development/34343434-3434-4334-8334-343434343434.json",
    deidentification_gate_passed: true,
    created_at: "2026-04-04T11:02:00.000Z",
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
