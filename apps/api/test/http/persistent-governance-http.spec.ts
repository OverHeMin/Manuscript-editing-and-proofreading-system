import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/index.ts";
import { PostgresDocumentAssetRepository } from "../../src/modules/assets/index.ts";
import { PostgresHarnessDatasetRepository } from "../../src/modules/harness-datasets/index.ts";
import { PostgresHarnessIntegrationRepository } from "../../src/modules/harness-integrations/index.ts";
import { PostgresKnowledgeRetrievalRepository } from "../../src/modules/knowledge-retrieval/index.ts";
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
import {
  semanticTableColumnKey,
  semanticTableDocxBase64,
  semanticTableTableId,
} from "../../../../test-support/semantic-table-docx.ts";

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

test("persistent governance runtime persists knowledge library asset revisions across restarts", async () => {
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
        const createResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/assets/drafts`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "Persistent knowledge library draft",
              canonicalText: "Operators should check endpoint reporting.",
              knowledgeKind: "rule",
              moduleScope: "screening",
              manuscriptTypes: ["clinical_study"],
              bindings: [
                {
                  bindingKind: "module_template",
                  bindingTargetId: "module-template-screening-1",
                  bindingTargetLabel: "Persistent Screening Template",
                },
              ],
            }),
          },
        );
        const created = (await createResponse.json()) as {
          asset: { id: string };
          selected_revision: { id: string };
        };

        assert.equal(createResponse.status, 201);

        const submitResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/submit`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
            },
          },
        );
        const approveResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/approve`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reviewNote: "Approved before restart.",
            }),
          },
        );

        assert.equal(submitResponse.status, 200);
        assert.equal(approveResponse.status, 200);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const createRevisionResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/knowledge/assets/${created.asset.id}/revisions`,
            {
              method: "POST",
              headers: {
                Cookie: cookie,
              },
            },
          );
          const derived = (await createRevisionResponse.json()) as {
            selected_revision: { id: string };
          };
          const detailResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/knowledge/assets/${created.asset.id}?revisionId=${derived.selected_revision.id}`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const detail = (await detailResponse.json()) as {
            asset: {
              current_revision_id?: string;
              current_approved_revision_id?: string;
            };
            selected_revision: {
              id: string;
              status: string;
            };
            current_approved_revision?: {
              id: string;
              status: string;
            };
          };
          const historyResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/review-actions`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const history = (await historyResponse.json()) as Array<{
            revision_id?: string;
            action: string;
          }>;

          assert.equal(createRevisionResponse.status, 201);
          assert.equal(detailResponse.status, 200);
          assert.equal(detail.asset.current_revision_id, derived.selected_revision.id);
          assert.equal(
            detail.asset.current_approved_revision_id,
            created.selected_revision.id,
          );
          assert.equal(detail.selected_revision.id, derived.selected_revision.id);
          assert.equal(detail.selected_revision.status, "draft");
          assert.equal(detail.current_approved_revision?.id, created.selected_revision.id);
          assert.equal(detail.current_approved_revision?.status, "approved");
          assert.equal(historyResponse.status, 200);
          assert.deepEqual(
            history.map((record) => ({
              revision_id: record.revision_id,
              action: record.action,
            })),
            [
              {
                revision_id: created.selected_revision.id,
                action: "submitted_for_review",
              },
              {
                revision_id: created.selected_revision.id,
                action: "approved",
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

test("persistent governance runtime keeps duplicate acknowledgement audit rows across restarts", async () => {
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
        const adminCookie = await loginAsPersistentAdmin(firstServer.baseUrl);
        const reviewerCookie = await loginAsPersistentReviewer(firstServer.baseUrl);

        const createResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/assets/drafts`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "Persistent acknowledgement draft",
              canonicalText: "Submit flow should persist duplicate acknowledgements.",
              knowledgeKind: "rule",
              moduleScope: "screening",
              manuscriptTypes: ["clinical_study"],
              bindings: [
                {
                  bindingKind: "module_template",
                  bindingTargetId: "module-template-screening-1",
                  bindingTargetLabel: "Persistent Screening Template",
                },
              ],
            }),
          },
        );
        const created = (await createResponse.json()) as {
          selected_revision: { id: string };
        };
        assert.equal(createResponse.status, 201);

        const submitResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/submit`,
          {
            method: "POST",
            headers: {
              Cookie: reviewerCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              duplicateAcknowledgements: [
                {
                  matched_asset_id: "22222222-2222-2222-2222-222222222222",
                  matched_revision_id: "22222222-2222-2222-2222-222222222222-revision-1",
                  severity: "high",
                  note: "Reviewed and acceptable overlap.",
                },
                {
                  matched_asset_id: "33333333-3333-3333-3333-333333333333",
                  severity: "possible",
                },
              ],
              actorRole: "admin",
            }),
          },
        );

        assert.equal(submitResponse.status, 200);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const repository = new PostgresKnowledgeRepository({ client: seedPool });
          const acknowledgementRows =
            await repository.listDuplicateAcknowledgementsByRevisionId?.(
              created.selected_revision.id,
            );

          assert.ok(
            acknowledgementRows,
            "Expected duplicate acknowledgement rows API to be available.",
          );
          assert.equal(acknowledgementRows?.length, 1);
          assert.deepEqual(acknowledgementRows?.[0]?.matched_asset_ids, [
            "22222222-2222-2222-2222-222222222222",
            "33333333-3333-3333-3333-333333333333",
          ]);
          assert.equal(acknowledgementRows?.[0]?.highest_severity, "high");
          assert.equal(
            acknowledgementRows?.[0]?.acknowledged_by_role,
            "knowledge_reviewer",
          );
          assert.ok(
            acknowledgementRows?.[0]?.created_at,
            "Expected acknowledgement row to include created_at timestamp.",
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
              templateKind: "proofreading_instruction",
              systemInstructions:
                "Inspect the manuscript against approved editorial rules.",
              taskFrame: "Create a bounded proofreading report.",
              hardRuleSummary: "摘要 目的 -> （摘要　目的）",
              allowedContentOperations: ["issue_explanation"],
              forbiddenOperations: ["rewrite_manuscript"],
              manualReviewPolicy:
                "Escalate uncertain findings to manual review.",
              outputContract: "Return structured proofreading findings.",
              reportStyle: "clinical_report",
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
          const prompts = (await promptListResponse.json()) as Array<{
            id: string;
            name: string;
            template_kind?: string;
            hard_rule_summary?: string;
          }>;
          const skills = (await skillListResponse.json()) as Array<{ id: string; name: string }>;

          assert.equal(promptListResponse.status, 200);
          assert.equal(skillListResponse.status, 200);
          assert.deepEqual(
            prompts.map((record) => ({
              id: record.id,
              name: record.name,
              template_kind: record.template_kind,
              hard_rule_summary: record.hard_rule_summary,
            })),
            [
              {
                id: createdPrompt.id,
                name: "proofreading_mainline",
                template_kind: "proofreading_instruction",
                hard_rule_summary: "摘要 目的 -> （摘要　目的）",
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

test("persistent governance runtime keeps editorial rule sets and rules across server restarts", async () => {
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
        const createFamilyResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/templates/families`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptType: "clinical_study",
              name: "Persistent editorial family",
            }),
          },
        );
        const createdFamily = (await createFamilyResponse.json()) as { id: string };

        assert.equal(createFamilyResponse.status, 201);

        const createRuleSetResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
              templateFamilyId: createdFamily.id,
              module: "editing",
            }),
          },
        );
        const createdRuleSet = (await createRuleSetResponse.json()) as { id: string };

        assert.equal(createRuleSetResponse.status, 201);

        const createRuleResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets/${createdRuleSet.id}/rules`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "user",
              orderNo: 10,
              ruleType: "format",
              executionMode: "apply_and_inspect",
              scope: {
                sections: ["abstract"],
                block_kind: "heading",
              },
              selector: {},
              trigger: {
                kind: "exact_text",
                text: "摘要 目的",
              },
              action: {
                kind: "replace_heading",
                to: "（摘要　目的）",
              },
              confidencePolicy: "always_auto",
              severity: "error",
              enabled: true,
              exampleBefore: "摘要 目的",
              exampleAfter: "（摘要　目的）",
              manualReviewReasonTemplate: "medical_meaning_risk",
            }),
          },
        );
        const createdRule = (await createRuleResponse.json()) as { id: string };

        assert.equal(createRuleResponse.status, 201);

        const publishRuleSetResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets/${createdRuleSet.id}/publish`,
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

        assert.equal(publishRuleSetResponse.status, 200);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const ruleSetListResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/editorial-rules/rule-sets`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const ruleListResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/editorial-rules/rule-sets/${createdRuleSet.id}/rules`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const ruleSets = (await ruleSetListResponse.json()) as Array<{
            id: string;
            status: string;
          }>;
          const rules = (await ruleListResponse.json()) as Array<{
            id: string;
            action: {
              kind: string;
              to?: string;
            };
            example_before?: string;
            example_after?: string;
          }>;

          assert.equal(ruleSetListResponse.status, 200);
          assert.equal(ruleListResponse.status, 200);
          assert.deepEqual(ruleSets, [
            {
              id: createdRuleSet.id,
              template_family_id: createdFamily.id,
              module: "editing",
              version_no: 1,
              status: "published",
            },
          ]);
          assert.deepEqual(rules, [
            {
              id: createdRule.id,
              rule_set_id: createdRuleSet.id,
              order_no: 10,
              rule_object: "generic",
              rule_type: "format",
              execution_mode: "apply_and_inspect",
              scope: {
                sections: ["abstract"],
                block_kind: "heading",
              },
              selector: {},
              trigger: {
                kind: "exact_text",
                text: "摘要 目的",
              },
              action: {
                kind: "replace_heading",
                to: "（摘要　目的）",
              },
              authoring_payload: {},
              confidence_policy: "always_auto",
              severity: "error",
              enabled: true,
              example_before: "摘要 目的",
              example_after: "（摘要　目的）",
              manual_review_reason_template: "medical_meaning_risk",
            },
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

test("persistent governance runtime reloads connection-backed model bindings across server restarts", async () => {
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
        const providerResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/system-settings/ai-providers`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "Persistent DeepSeek",
              provider_kind: "deepseek",
              connection_metadata: {
                test_model_name: "deepseek-chat",
              },
              credentials: {
                apiKey: "sk-deepseek-persistent-12345678",
              },
            }),
          },
        );
        const provider = (await providerResponse.json()) as { id: string };

        assert.equal(providerResponse.status, 201);

        const createResponse = await fetch(`${firstServer.baseUrl}/api/v1/model-registry`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actorRole: "editor",
            provider: "openai",
            modelName: "deepseek-persistent-primary",
            modelVersion: "2026-04-10",
            allowedModules: ["editing"],
            isProdAllowed: true,
            connectionId: provider.id,
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
              moduleDefaults: {
                editing: created.id,
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
            connection_id?: string;
          }>;
          const providersResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/system-settings/ai-providers`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const providers = (await providersResponse.json()) as Array<{
            id: string;
            provider_kind: string;
          }>;

          assert.equal(listResponse.status, 200);
          assert.equal(providersResponse.status, 200);
          assert.deepEqual(
            models.map((record) => ({
              id: record.id,
              model_name: record.model_name,
              connection_id: record.connection_id,
            })),
            [
              {
                id: created.id,
                model_name: "deepseek-persistent-primary",
                connection_id: provider.id,
              },
            ],
          );
          assert.deepEqual(
            providers.map((record) => ({
              id: record.id,
              provider_kind: record.provider_kind,
            })),
            [
              {
                id: provider.id,
                provider_kind: "deepseek",
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

        const ruleSetResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              templateFamilyId: family.id,
              module: "editing",
            }),
          },
        );
        const ruleSet = (await ruleSetResponse.json()) as { id: string };
        assert.equal(ruleSetResponse.status, 201);

        const ruleResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/rules`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              orderNo: 10,
              ruleType: "format",
              executionMode: "apply_and_inspect",
              scope: {
                section: "abstract",
              },
              trigger: {
                kind: "heading_equals",
                text: "摘要 目的",
              },
              action: {
                kind: "replace_heading",
                to: "（摘要　目的）",
              },
              confidencePolicy: "always_auto",
              severity: "warning",
              exampleBefore: "摘要 目的",
              exampleAfter: "（摘要　目的）",
            }),
          },
        );
        assert.equal(ruleResponse.status, 201);

        const publishRuleSetResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/publish`,
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
        assert.equal(publishRuleSetResponse.status, 200);

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
              templateKind: "editing_instruction",
              systemInstructions:
                "Apply published editorial rules before bounded AI editing.",
              taskFrame: "Use the active editorial rule set for editing.",
              hardRuleSummary: "摘要 目的 -> （摘要　目的）",
              allowedContentOperations: ["sentence_rewrite"],
              forbiddenOperations: ["fabrication"],
              manualReviewPolicy: "Escalate uncertain meaning changes.",
              outputContract: "Return a governed editing payload.",
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
                ruleSetId: ruleSet.id,
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

        const createExecutionLogResponse = await fetch(
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
                triggeredBy: "persistent.admin",
                runtimeId: "persistent-runtime-1",
                sandboxProfileId: "persistent-sandbox-1",
                agentProfileId: "persistent-agent-profile-1",
                runtimeBindingId: "persistent-binding-1",
                toolPermissionPolicyId: "persistent-policy-1",
                knowledgeItemIds: ["11111111-1111-1111-1111-111111111111"],
                evaluationSuiteIds: ["persistent-suite-1"],
              },
            }),
          },
        );
        const executionLog = (await createExecutionLogResponse.json()) as {
          id: string;
        };

        assert.equal(createExecutionLogResponse.status, 201);

        const completeExecutionLogResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/agent-execution/${executionLog.id}/complete`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              executionSnapshotId: "snapshot-persistent-link-placeholder",
            }),
          },
        );

        assert.equal(completeExecutionLogResponse.status, 200);

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
                agentExecutionLogId: executionLog.id,
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
        const snapshot = (await snapshotResponse.json()) as {
          id: string;
          agent_execution_log_id?: string;
          agent_execution: {
            observation_status: string;
            log_id?: string;
            log?: {
              id: string;
              status: string;
              orchestration_status: string;
              completion_summary: {
                derived_status: string;
              };
              recovery_summary: {
                category: string;
                recovery_readiness: string;
              };
            };
          };
          runtime_binding_readiness: {
            observation_status: string;
            report?: {
              status: string;
              issues: Array<{ code: string }>;
            };
          };
        };

        assert.equal(snapshotResponse.status, 201);
        assert.equal(snapshot.agent_execution_log_id, executionLog.id);
        assert.equal(snapshot.agent_execution.observation_status, "reported");
        assert.equal(snapshot.agent_execution.log_id, executionLog.id);
        assert.equal(snapshot.agent_execution.log?.id, executionLog.id);
        assert.equal(snapshot.agent_execution.log?.status, "completed");
        assert.equal(
          snapshot.agent_execution.log?.orchestration_status,
          "pending",
        );
        assert.equal(
          snapshot.agent_execution.log?.completion_summary.derived_status,
          "business_completed_follow_up_pending",
        );
        assert.equal(
          snapshot.agent_execution.log?.recovery_summary.category,
          "recoverable_now",
        );
        assert.equal(
          snapshot.agent_execution.log?.recovery_summary.recovery_readiness,
          "ready_now",
        );
        assert.equal(
          snapshot.runtime_binding_readiness.observation_status,
          "reported",
        );
        assert.equal(snapshot.runtime_binding_readiness.report?.status, "missing");
        assert.ok(
          snapshot.runtime_binding_readiness.report?.issues.some(
            (issue) => issue.code === "missing_active_binding",
          ),
        );

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
          const snapshotLoaded = (await snapshotLoadedResponse.json()) as {
            id: string;
            agent_execution_log_id?: string;
            agent_execution: {
              observation_status: string;
              log_id?: string;
              log?: {
                id: string;
                status: string;
                orchestration_status: string;
                completion_summary: {
                  derived_status: string;
                };
                recovery_summary: {
                  category: string;
                  recovery_readiness: string;
                };
              };
            };
            runtime_binding_readiness: {
              observation_status: string;
              report?: {
                status: string;
                issues: Array<{ code: string }>;
              };
            };
          };
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
            prompt_template: { template_kind: string };
            rule_set: { id: string };
            rules: Array<{ action: { kind: string } }>;
            resolved_model: { id: string };
            runtime_binding_readiness: {
              observation_status: string;
              report?: {
                status: string;
                issues: Array<{ code: string }>;
              };
            };
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
          assert.equal(snapshotLoaded.agent_execution_log_id, executionLog.id);
          assert.equal(
            snapshotLoaded.agent_execution.observation_status,
            "reported",
          );
          assert.equal(snapshotLoaded.agent_execution.log_id, executionLog.id);
          assert.equal(snapshotLoaded.agent_execution.log?.id, executionLog.id);
          assert.equal(
            snapshotLoaded.agent_execution.log?.completion_summary.derived_status,
            "business_completed_follow_up_pending",
          );
          assert.equal(
            snapshotLoaded.agent_execution.log?.recovery_summary.category,
            "recoverable_now",
          );
          assert.equal(
            snapshotLoaded.runtime_binding_readiness.observation_status,
            "reported",
          );
          assert.equal(
            snapshotLoaded.runtime_binding_readiness.report?.status,
            "missing",
          );
          assert.ok(
            snapshotLoaded.runtime_binding_readiness.report?.issues.some(
              (issue) => issue.code === "missing_active_binding",
            ),
          );
          assert.equal(resolved.profile.id, profile.id);
          assert.equal(resolved.rule_set.id, ruleSet.id);
          assert.equal(resolved.rules[0]?.action.kind, "replace_heading");
          assert.equal(
            resolved.prompt_template.template_kind,
            "editing_instruction",
          );
          assert.equal(resolved.resolved_model.id, model.id);
          assert.equal(
            resolved.runtime_binding_readiness.observation_status,
            "reported",
          );
          assert.equal(resolved.runtime_binding_readiness.report?.status, "missing");
          assert.ok(
            resolved.runtime_binding_readiness.report?.issues.some(
              (issue) => issue.code === "missing_active_binding",
            ),
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

        const familyResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/templates/families`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptType: "clinical_study",
              name: "Persistent agent tooling family",
            }),
          },
        );
        const family = (await familyResponse.json()) as { id: string };

        assert.equal(familyResponse.status, 201);

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
              prompt: "Persistent agent tooling template",
            }),
          },
        );
        const moduleTemplateDraft = (await moduleTemplateDraftResponse.json()) as {
          id: string;
        };

        assert.equal(moduleTemplateDraftResponse.status, 201);

        const publishModuleTemplateResponse = await fetch(
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

        assert.equal(publishModuleTemplateResponse.status, 200);

        const ruleSetResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              templateFamilyId: family.id,
              module: "editing",
            }),
          },
        );
        const ruleSet = (await ruleSetResponse.json()) as { id: string };

        assert.equal(ruleSetResponse.status, 201);

        const ruleResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/rules`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "editor",
              orderNo: 10,
              ruleType: "format",
              executionMode: "apply_and_inspect",
              scope: {
                section: "abstract",
              },
              trigger: {
                kind: "heading_equals",
                text: "摘要 目的",
              },
              action: {
                kind: "replace_heading",
                to: "（摘要　目的）",
              },
              confidencePolicy: "always_auto",
              severity: "warning",
            }),
          },
        );

        assert.equal(ruleResponse.status, 201);

        const publishRuleSetResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/publish`,
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

        assert.equal(publishRuleSetResponse.status, 200);

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
              templateKind: "editing_instruction",
              systemInstructions:
                "Apply published editorial rules before bounded AI editing.",
              taskFrame: "Use the active editorial rule set for editing.",
              hardRuleSummary: "摘要 目的 -> （摘要　目的）",
              allowedContentOperations: ["sentence_rewrite"],
              forbiddenOperations: ["fabrication"],
              manualReviewPolicy: "Escalate uncertain meaning changes.",
              outputContract: "Return a governed editing payload.",
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

        const executionProfileResponse = await fetch(
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
                ruleSetId: ruleSet.id,
                promptTemplateId: prompt.id,
                skillPackageIds: [skill.id],
                knowledgeBindingMode: "profile_only",
              },
            }),
          },
        );
        const executionProfile = (await executionProfileResponse.json()) as {
          id: string;
        };

        assert.equal(executionProfileResponse.status, 201);

        const publishExecutionProfileResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/execution-governance/profiles/${executionProfile.id}/publish`,
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

        assert.equal(publishExecutionProfileResponse.status, 200);

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
                templateFamilyId: family.id,
                runtimeId: runtime.id,
                sandboxProfileId: sandbox.id,
                agentProfileId: agentProfile.id,
                toolPermissionPolicyId: policy.id,
                promptTemplateId: prompt.id,
                skillPackageIds: [skill.id],
                executionProfileId: executionProfile.id,
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
        const executionLog = (await executionLogResponse.json()) as {
          id: string;
          completion_summary: {
            derived_status: string;
            business_completed: boolean;
            follow_up_required: boolean;
            fully_settled: boolean;
            attention_required: boolean;
          };
          recovery_summary: {
            category: string;
            recovery_readiness: string;
            recovery_ready_at?: string;
            reason: string;
          };
          runtime_binding_readiness: {
            observation_status: string;
            report?: {
              status: string;
              binding?: { id: string };
            };
          };
        };

        assert.equal(executionLogResponse.status, 201);
        assert.equal(
          executionLog.completion_summary.derived_status,
          "business_in_progress",
        );
        assert.equal(executionLog.completion_summary.business_completed, false);
        assert.equal(executionLog.completion_summary.follow_up_required, false);
        assert.equal(executionLog.completion_summary.fully_settled, false);
        assert.equal(executionLog.completion_summary.attention_required, false);
        assert.equal(executionLog.recovery_summary.category, "not_recoverable");
        assert.equal(
          executionLog.recovery_summary.recovery_readiness,
          "not_recoverable",
        );
        assert.equal(
          executionLog.recovery_summary.reason,
          "Business execution is running, so governed follow-up is not recoverable yet.",
        );
        assert.equal(
          executionLog.runtime_binding_readiness.observation_status,
          "reported",
        );
        assert.equal(executionLog.runtime_binding_readiness.report?.status, "ready");
        assert.equal(
          executionLog.runtime_binding_readiness.report?.binding?.id,
          binding.id,
        );

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
            `${secondServer.baseUrl}/api/v1/runtime-bindings/by-scope/editing/clinical_study/${family.id}?activeOnly=true`,
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

          const activeReadinessResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/runtime-bindings/by-scope/editing/clinical_study/${family.id}/active-readiness`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const activeReadiness = (await activeReadinessResponse.json()) as {
            status: string;
            binding?: {
              id: string;
            };
            execution_profile_alignment: {
              status: string;
            };
          };

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
            completion_summary: {
              derived_status: string;
              business_completed: boolean;
              follow_up_required: boolean;
              fully_settled: boolean;
              attention_required: boolean;
            };
            recovery_summary: {
              category: string;
              recovery_readiness: string;
              recovery_ready_at?: string;
              reason: string;
            };
            runtime_binding_readiness: {
              observation_status: string;
              report?: {
                status: string;
                binding?: { id: string };
              };
            };
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
          assert.equal(activeReadinessResponse.status, 200);
          assert.equal(activeReadiness.status, "ready");
          assert.equal(activeReadiness.binding?.id, binding.id);
          assert.equal(activeReadiness.execution_profile_alignment.status, "aligned");
          assert.equal(getExecutionLogResponse.status, 200);
          assert.equal(persistedExecutionLog.id, executionLog.id);
          assert.equal(persistedExecutionLog.status, "completed");
          assert.equal(
            persistedExecutionLog.execution_snapshot_id,
            "persistent-snapshot-1",
          );
          assert.equal(
            persistedExecutionLog.completion_summary.derived_status,
            "business_completed_settled",
          );
          assert.equal(
            persistedExecutionLog.completion_summary.business_completed,
            true,
          );
          assert.equal(
            persistedExecutionLog.completion_summary.follow_up_required,
            false,
          );
          assert.equal(
            persistedExecutionLog.completion_summary.fully_settled,
            true,
          );
          assert.equal(
            persistedExecutionLog.completion_summary.attention_required,
            false,
          );
          assert.equal(
            persistedExecutionLog.recovery_summary.category,
            "not_recoverable",
          );
          assert.equal(
            persistedExecutionLog.recovery_summary.recovery_readiness,
            "not_recoverable",
          );
          assert.equal(
            persistedExecutionLog.recovery_summary.reason,
            "No governed follow-up orchestration is required for this execution.",
          );
          assert.equal(
            persistedExecutionLog.runtime_binding_readiness.observation_status,
            "reported",
          );
          assert.equal(
            persistedExecutionLog.runtime_binding_readiness.report?.status,
            "ready",
          );
          assert.equal(
            persistedExecutionLog.runtime_binding_readiness.report?.binding?.id,
            binding.id,
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

test("persistent governance runtime extracts reviewed snapshot diffs into pending rule candidates", async () => {
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
        const cookie = await loginAsPersistentReviewer(firstServer.baseUrl);
        const extractResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning/candidates/extract`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              deidentificationPassed: true,
              source: {
                kind: "reviewed_case_snapshot",
                reviewedCaseSnapshotId:
                  persistentHarnessHandoffFixtureIds.reviewedCaseSnapshotId,
                beforeFragment: "摘要 目的",
                afterFragment: "（摘要　目的）",
                evidenceSummary:
                  "Persistent reviewed snapshot shows abstract heading normalization.",
              },
            }),
          },
        );
        const extractedCandidate = (await extractResponse.json()) as {
          id: string;
          status: string;
          type: string;
          governed_provenance_kind?: string;
          suggested_rule_object?: string;
          candidate_payload?: {
            action?: {
              kind?: string;
              to?: string;
            };
          };
        };

        assert.equal(
          extractResponse.status,
          201,
          JSON.stringify(extractedCandidate, null, 2),
        );
        assert.equal(extractedCandidate.type, "rule_candidate");
        assert.equal(extractedCandidate.status, "pending_review");
        assert.equal(
          extractedCandidate.governed_provenance_kind,
          "reviewed_case_snapshot",
        );
        assert.equal(extractedCandidate.suggested_rule_object, "abstract");
        assert.equal(
          extractedCandidate.candidate_payload?.action?.kind,
          "replace_heading",
        );
        assert.equal(
          extractedCandidate.candidate_payload?.action?.to,
          "（摘要　目的）",
        );

        const reviewQueueResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning/candidates/review-queue`,
          {
            headers: {
              Cookie: cookie,
            },
          },
        );
        const reviewQueue = (await reviewQueueResponse.json()) as Array<{
          id: string;
          status: string;
          suggested_rule_object?: string;
        }>;

        assert.equal(reviewQueueResponse.status, 200);
        assert.ok(
          reviewQueue.some((candidate) =>
            candidate.id === extractedCandidate.id &&
            candidate.status === "pending_review" &&
            candidate.suggested_rule_object === "abstract"),
          "Expected extracted reviewed-snapshot candidate to appear in the pending review queue.",
        );
      } finally {
        await stopServer(firstServer.server).catch(() => undefined);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent governance runtime rejects rule candidate extraction without evidence summary", async () => {
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
        const cookie = await loginAsPersistentReviewer(firstServer.baseUrl);
        const extractResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning/candidates/extract`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              deidentificationPassed: true,
              source: {
                kind: "reviewed_case_snapshot",
                reviewedCaseSnapshotId:
                  persistentHarnessHandoffFixtureIds.reviewedCaseSnapshotId,
                beforeFragment: "摘要 目的",
                afterFragment: "（摘要　目的）",
                evidenceSummary: "   ",
              },
            }),
          },
        );
        const body = (await extractResponse.json()) as {
          error?: string;
          message?: string;
        };

        assert.equal(extractResponse.status, 400);
        assert.equal(body.error, "invalid_request");
        assert.match(body.message ?? "", /evidence/i);
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

const persistentRetrievalQualityFixtureIds = {
  manuscriptId: "90909090-9090-4090-8090-909090909090",
  knowledgeItemId: "91919191-9191-4191-8191-919191919191",
  goldSetFamilyId: "92929292-9292-4292-8292-929292929292",
  goldSetVersionId: "93939393-9393-4393-8393-939393939393",
  rubricId: "94949494-9494-4494-8494-949494949494",
} as const;

const persistentHarnessIntegrationFixtureIds = {
  promptfooRedactionProfileId: "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1",
  promptfooAdapterId: "a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2",
  promptfooFlagChangeId: "a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3",
  langfuseRedactionProfileId: "b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1",
  langfuseAdapterId: "b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2",
  langfuseFlagChangeId: "b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b3b3",
  parentAssetId: "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1",
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

test("persistent governance runtime records governed retrieval snapshots and retrieval-quality evidence additively", async () => {
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
        const governedFixture = await createPersistentRetrievalQualityFixture({
          baseUrl: firstServer.baseUrl,
          cookie,
          pool: seedPool,
        });

        const retrievalContextResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/retrieval-context`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: persistentRetrievalQualityFixtureIds.manuscriptId,
              module: "editing",
            }),
          },
        );
        const retrievalContext = (await retrievalContextResponse.json()) as {
          template_family_id: string;
          knowledge_item_ids: string[];
          retrieval_status: string;
          retrieval_snapshot_id?: string;
          retrieval_failure_reason?: string;
        };

        assert.equal(retrievalContextResponse.status, 200);
        assert.equal(retrievalContext.template_family_id, governedFixture.familyId);
        assert.ok(
          retrievalContext.knowledge_item_ids.includes(
            persistentRetrievalQualityFixtureIds.knowledgeItemId,
          ),
          `Expected retrieval context knowledge items to include manually curated knowledge ${persistentRetrievalQualityFixtureIds.knowledgeItemId}, received ${JSON.stringify(retrievalContext.knowledge_item_ids)}.`,
        );
        assert.equal(retrievalContext.retrieval_status, "recorded");
        assert.ok(
          retrievalContext.retrieval_snapshot_id,
          retrievalContext.retrieval_failure_reason ??
            "Expected governed retrieval context to return a retrieval snapshot id.",
        );

        const retrievalSnapshotResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/retrieval-snapshots/${retrievalContext.retrieval_snapshot_id}`,
          {
            headers: {
              Cookie: cookie,
            },
          },
        );
        const retrievalSnapshot = (await retrievalSnapshotResponse.json()) as {
          id: string;
          module: string;
          template_family_id?: string;
          retrieved_items: Array<{
            knowledge_item_id: string;
          }>;
          reranked_items: Array<{
            knowledge_item_id: string;
          }>;
        };

        assert.equal(retrievalSnapshotResponse.status, 200);
        assert.equal(retrievalSnapshot.id, retrievalContext.retrieval_snapshot_id);
        assert.equal(retrievalSnapshot.module, "editing");
        assert.equal(retrievalSnapshot.template_family_id, governedFixture.familyId);
        assert.ok(
          retrievalSnapshot.retrieved_items.some(
            (item) =>
              item.knowledge_item_id ===
              persistentRetrievalQualityFixtureIds.knowledgeItemId,
          ),
          `Expected retrieval snapshot to include manually curated knowledge ${persistentRetrievalQualityFixtureIds.knowledgeItemId} in retrieved items.`,
        );
        assert.ok(
          retrievalSnapshot.reranked_items.some(
            (item) =>
              item.knowledge_item_id ===
              persistentRetrievalQualityFixtureIds.knowledgeItemId,
          ),
          `Expected retrieval snapshot to include manually curated knowledge ${persistentRetrievalQualityFixtureIds.knowledgeItemId} in reranked items.`,
        );

        const checkProfileResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/check-profiles`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                name: "Persistent retrieval quality check",
                checkType: "retrieval_quality",
              },
            }),
          },
        );
        const checkProfile = (await checkProfileResponse.json()) as {
          id: string;
          check_type: string;
        };

        assert.equal(checkProfileResponse.status, 201);
        assert.equal(checkProfile.check_type, "retrieval_quality");

        const publishCheckProfileResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/check-profiles/${checkProfile.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          },
        );

        assert.equal(publishCheckProfileResponse.status, 200);

        const retrievalQualityRunResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/templates/families/${governedFixture.familyId}/retrieval-quality-runs`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                module: "editing",
                goldSetVersionId:
                  persistentRetrievalQualityFixtureIds.goldSetVersionId,
                retrievalSnapshotIds: [
                  retrievalContext.retrieval_snapshot_id,
                ],
                retrieverConfig: {
                  strategy: "template_pack",
                  topK: 1,
                  filters: {
                    lane: "persistent_http",
                  },
                },
                metricSummary: {
                  answerRelevancy: 0.91,
                  contextPrecision: 0.87,
                },
              },
            }),
          },
        );
        const retrievalQualityRun =
          (await retrievalQualityRunResponse.json()) as {
            id: string;
            gold_set_version_id: string;
            template_family_id?: string;
            retrieval_snapshot_ids: string[];
            metric_summary: {
              answer_relevancy: number;
            };
          };

        assert.equal(retrievalQualityRunResponse.status, 201);
        assert.equal(
          retrievalQualityRun.gold_set_version_id,
          persistentRetrievalQualityFixtureIds.goldSetVersionId,
        );
        assert.equal(
          retrievalQualityRun.template_family_id,
          governedFixture.familyId,
        );
        assert.deepEqual(retrievalQualityRun.retrieval_snapshot_ids, [
          retrievalContext.retrieval_snapshot_id,
        ]);
        assert.equal(
          retrievalQualityRun.metric_summary.answer_relevancy,
          0.91,
        );

        const latestRetrievalQualityRunResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/templates/families/${governedFixture.familyId}/retrieval-quality-runs/latest`,
          {
            headers: {
              Cookie: cookie,
            },
          },
        );
        const latestRetrievalQualityRun =
          (await latestRetrievalQualityRunResponse.json()) as {
            id: string;
            retrieval_snapshot_ids: string[];
          };

        assert.equal(latestRetrievalQualityRunResponse.status, 200);
        assert.equal(latestRetrievalQualityRun.id, retrievalQualityRun.id);
        assert.deepEqual(latestRetrievalQualityRun.retrieval_snapshot_ids, [
          retrievalContext.retrieval_snapshot_id,
        ]);

        const evidenceResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evidence`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                kind: "url",
                label: "Persistent retrieval quality evidence",
                uri: `local://retrieval-quality-runs/${retrievalQualityRun.id}`,
                checkProfileId: checkProfile.id,
                retrievalSnapshotId:
                  retrievalContext.retrieval_snapshot_id,
                retrievalQualityRunId: retrievalQualityRun.id,
              },
            }),
          },
        );
        const evidence = (await evidenceResponse.json()) as {
          id: string;
          check_profile_id?: string;
          retrieval_snapshot_id?: string;
          retrieval_quality_run_id?: string;
        };

        assert.equal(evidenceResponse.status, 201);
        assert.equal(evidence.check_profile_id, checkProfile.id);
        assert.equal(
          evidence.retrieval_snapshot_id,
          retrievalContext.retrieval_snapshot_id,
        );
        assert.equal(evidence.retrieval_quality_run_id, retrievalQualityRun.id);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const secondCookie = await loginAsPersistentAdmin(secondServer.baseUrl);
          const persistedSnapshotResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/knowledge/retrieval-snapshots/${retrievalContext.retrieval_snapshot_id}`,
            {
              headers: {
                Cookie: secondCookie,
              },
            },
          );
          const persistedSnapshot = (await persistedSnapshotResponse.json()) as {
            id: string;
            retrieved_items: Array<{
              knowledge_item_id: string;
            }>;
          };
          const persistedEvidenceResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evidence/${evidence.id}`,
            {
              headers: {
                Cookie: secondCookie,
              },
            },
          );
          const persistedEvidence = (await persistedEvidenceResponse.json()) as {
            retrieval_snapshot_id?: string;
            retrieval_quality_run_id?: string;
          };
          const retrievalRepository = new PostgresKnowledgeRetrievalRepository({
            client: seedPool,
          });
          const persistedQualityRun =
            await retrievalRepository.findRetrievalQualityRunById(
              retrievalQualityRun.id,
            );

          assert.equal(persistedSnapshotResponse.status, 200);
          assert.equal(persistedSnapshot.id, retrievalContext.retrieval_snapshot_id);
          assert.ok(
            persistedSnapshot.retrieved_items.some(
              (item) =>
                item.knowledge_item_id ===
                persistentRetrievalQualityFixtureIds.knowledgeItemId,
            ),
            `Expected persisted retrieval snapshot to include manually curated knowledge ${persistentRetrievalQualityFixtureIds.knowledgeItemId}.`,
          );
          assert.equal(persistedEvidenceResponse.status, 200);
          assert.equal(
            persistedEvidence.retrieval_snapshot_id,
            retrievalContext.retrieval_snapshot_id,
          );
          assert.equal(
            persistedEvidence.retrieval_quality_run_id,
            retrievalQualityRun.id,
          );
          assert.equal(persistedQualityRun?.template_family_id, governedFixture.familyId);
          assert.deepEqual(persistedQualityRun?.retrieval_snapshot_ids, [
            retrievalContext.retrieval_snapshot_id,
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

test("persistent governance runtime launches governed harness runs explicitly from active runtime bindings", async () => {
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
        const evaluationSuite = await createPersistentHarnessEvaluationSuite({
          baseUrl: firstServer.baseUrl,
          cookie,
          name: "Persistent governed harness suite",
        });
        const governedFixture = await createPersistentRetrievalQualityFixture({
          baseUrl: firstServer.baseUrl,
          cookie,
          pool: seedPool,
          evaluationSuiteIds: [evaluationSuite.id],
        });
        await seedPersistentHarnessAdapter({
          pool: seedPool,
          redactionProfileId: persistentHarnessIntegrationFixtureIds
            .promptfooRedactionProfileId,
          adapterId: persistentHarnessIntegrationFixtureIds.promptfooAdapterId,
          flagChangeId: persistentHarnessIntegrationFixtureIds.promptfooFlagChangeId,
          kind: "promptfoo",
          displayName: "Promptfoo local suite",
          executionMode: "local_cli",
          flagKey: "harness.promptfoo.enabled",
          enabled: true,
          config: {
            suite: "retrieval-quality",
          },
        });

        const launchResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/harness-integrations/governed-runs`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                adapterId: persistentHarnessIntegrationFixtureIds.promptfooAdapterId,
                module: "editing",
                manuscriptType: "clinical_study",
                templateFamilyId: governedFixture.familyId,
                evaluationSuiteId: evaluationSuite.id,
                goldSetVersionId:
                  persistentRetrievalQualityFixtureIds.goldSetVersionId,
                inputReference: "run-input://retrieval-quality/persistent-http",
              },
            }),
          },
        );
        const launched = (await launchResponse.json()) as {
          execution: {
            id: string;
            adapter_id: string;
            dataset_id?: string;
            input_reference: string;
            status: string;
          };
          evidence?: {
            id: string;
            uri?: string;
          };
          binding: {
            id: string;
            evaluation_suite_ids: string[];
          };
        };

        assert.equal(launchResponse.status, 201);
        assert.equal(
          launched.execution.adapter_id,
          persistentHarnessIntegrationFixtureIds.promptfooAdapterId,
        );
        assert.equal(
          launched.execution.dataset_id,
          persistentRetrievalQualityFixtureIds.goldSetVersionId,
        );
        assert.equal(
          launched.execution.input_reference,
          "run-input://retrieval-quality/persistent-http",
        );
        assert.equal(launched.execution.status, "succeeded");
        assert.deepEqual(launched.binding.evaluation_suite_ids, [
          evaluationSuite.id,
        ]);
        assert.equal(
          launched.evidence?.uri,
          `local://harness-executions/${launched.execution.id}`,
        );

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl);
        try {
          const secondCookie = await loginAsPersistentAdmin(secondServer.baseUrl);
          const adaptersResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/harness-integrations/adapters`,
            {
              headers: {
                Cookie: secondCookie,
              },
            },
          );
          const adapters = (await adaptersResponse.json()) as Array<{
            id: string;
            kind: string;
            execution_mode: string;
            fail_open: boolean;
          }>;
          const executionsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/harness-integrations/adapters/${persistentHarnessIntegrationFixtureIds.promptfooAdapterId}/executions`,
            {
              headers: {
                Cookie: secondCookie,
              },
            },
          );
          const executions = (await executionsResponse.json()) as Array<{
            id: string;
            status: string;
            dataset_id?: string;
          }>;

          assert.equal(adaptersResponse.status, 200);
          assert.deepEqual(
            adapters.map((record) => ({
              id: record.id,
              kind: record.kind,
              execution_mode: record.execution_mode,
              fail_open: record.fail_open,
            })),
            [
              {
                id: persistentHarnessIntegrationFixtureIds.promptfooAdapterId,
                kind: "promptfoo",
                execution_mode: "local_cli",
                fail_open: true,
              },
            ],
          );
          assert.equal(executionsResponse.status, 200);
          assert.deepEqual(
            executions.map((record) => ({
              id: record.id,
              status: record.status,
              dataset_id: record.dataset_id,
            })),
            [
              {
                id: launched.execution.id,
                status: "succeeded",
                dataset_id: persistentRetrievalQualityFixtureIds.goldSetVersionId,
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

test("persistent governance runtime records degraded harness executions when a self-hosted trace sink is unavailable", async () => {
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

      const serverHandle = await startPersistentGovernanceServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentAdmin(serverHandle.baseUrl);
        const evaluationSuite = await createPersistentHarnessEvaluationSuite({
          baseUrl: serverHandle.baseUrl,
          cookie,
          name: "Persistent tracing harness suite",
        });
        const governedFixture = await createPersistentRetrievalQualityFixture({
          baseUrl: serverHandle.baseUrl,
          cookie,
          pool: seedPool,
          evaluationSuiteIds: [evaluationSuite.id],
        });
        await seedPersistentHarnessAdapter({
          pool: seedPool,
          redactionProfileId: persistentHarnessIntegrationFixtureIds
            .langfuseRedactionProfileId,
          adapterId: persistentHarnessIntegrationFixtureIds.langfuseAdapterId,
          flagChangeId: persistentHarnessIntegrationFixtureIds.langfuseFlagChangeId,
          kind: "langfuse_oss",
          displayName: "Self-hosted Langfuse trace sink",
          executionMode: "self_hosted_http",
          flagKey: "harness.langfuse.enabled",
          enabled: true,
        });

        const launchResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/harness-integrations/governed-runs`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                adapterId: persistentHarnessIntegrationFixtureIds.langfuseAdapterId,
                module: "editing",
                manuscriptType: "clinical_study",
                templateFamilyId: governedFixture.familyId,
                evaluationSuiteId: evaluationSuite.id,
                goldSetVersionId:
                  persistentRetrievalQualityFixtureIds.goldSetVersionId,
                inputReference: "run-input://trace/persistent-http",
              },
            }),
          },
        );
        const launched = (await launchResponse.json()) as {
          execution: {
            id: string;
            status: string;
            degradation_reason?: string;
          };
        };

        assert.equal(launchResponse.status, 201);
        assert.equal(launched.execution.status, "degraded");
        assert.equal(
          launched.execution.degradation_reason,
          "self-hosted trace sink unavailable",
        );

        const harnessRepository = new PostgresHarnessIntegrationRepository({
          client: seedPool,
        });
        const persistedAudits = await harnessRepository.listExecutionAuditsByAdapterId(
          persistentHarnessIntegrationFixtureIds.langfuseAdapterId,
        );

        assert.deepEqual(
          persistedAudits.map((record) => ({
            id: record.id,
            status: record.status,
            degradation_reason: record.degradation_reason,
          })),
          [
            {
              id: launched.execution.id,
              status: "degraded",
              degradation_reason: "self-hosted trace sink unavailable",
            },
          ],
        );
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent governance runtime keeps module execution succeeded when harness tracing adapters are unavailable", async () => {
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

      const serverHandle = await startPersistentGovernanceServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentAdmin(serverHandle.baseUrl);
        await createPersistentHarnessEvaluationSuite({
          baseUrl: serverHandle.baseUrl,
          cookie,
          name: "Persistent module tracing suite",
        });
        const governedFixture = await createPersistentRetrievalQualityFixture({
          baseUrl: serverHandle.baseUrl,
          cookie,
          pool: seedPool,
        });
        await seedPersistentHarnessAdapter({
          pool: seedPool,
          redactionProfileId: persistentHarnessIntegrationFixtureIds
            .langfuseRedactionProfileId,
          adapterId: persistentHarnessIntegrationFixtureIds.langfuseAdapterId,
          flagChangeId: persistentHarnessIntegrationFixtureIds.langfuseFlagChangeId,
          kind: "langfuse_oss",
          displayName: "Self-hosted Langfuse trace sink",
          executionMode: "self_hosted_http",
          flagKey: "harness.langfuse.enabled",
          enabled: true,
        });
        await seedPersistentEditingParentAsset(seedPool, governedFixture.familyId);

        const editingResponse = await fetch(
          `${serverHandle.baseUrl}/api/v1/modules/editing/run`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: persistentRetrievalQualityFixtureIds.manuscriptId,
              parentAssetId: persistentHarnessIntegrationFixtureIds.parentAssetId,
              storageKey: "persistent/harness/editing-output.docx",
              fileName: "persistent-editing-output.docx",
            }),
          },
        );
        const editingRun = (await editingResponse.json()) as {
          job: {
            status: string;
          };
          asset: {
            asset_type: string;
          };
        };

        assert.equal(editingResponse.status, 201);
        assert.equal(editingRun.job.status, "completed");
        assert.equal(editingRun.asset.asset_type, "edited_docx");
      } finally {
        await stopServer(serverHandle.server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent governance runtime preserves semantic table evidence for editing jobs across server restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const uploadRootDir = await mkdtemp(
      path.join(os.tmpdir(), "medsys-persistent-governance-table-"),
    );
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent governance database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentGovernanceData(seedPool);

      const firstServer = await startPersistentGovernanceServer(databaseUrl, {
        uploadRootDir,
      });
      try {
        const cookie = await loginAsPersistentAdmin(firstServer.baseUrl);
        const governedFixture = await createPersistentRetrievalQualityFixture({
          baseUrl: firstServer.baseUrl,
          cookie,
          pool: seedPool,
        });
        await seedPersistentEditingParentAsset(seedPool, governedFixture.familyId);
        await writeSemanticTableFixtureDocx(
          uploadRootDir,
          "persistent/harness/editing-parent.docx",
        );

        const editingResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/editing/run`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: persistentRetrievalQualityFixtureIds.manuscriptId,
              parentAssetId: persistentHarnessIntegrationFixtureIds.parentAssetId,
              storageKey: "persistent/harness/table-semantic-editing-output.docx",
              fileName: "table-semantic-editing-output.docx",
            }),
          },
        );
        const editingRun = (await editingResponse.json()) as {
          job: { id: string; status: string };
        };

        assert.equal(
          editingResponse.status,
          201,
          `Expected editing run to succeed, received ${editingResponse.status}: ${JSON.stringify(editingRun)}`,
        );
        assert.equal(editingRun.job.status, "completed");

        await stopServer(firstServer.server);

        const secondServer = await startPersistentGovernanceServer(databaseUrl, {
          uploadRootDir,
        });
        try {
          const restartedJobResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/jobs/${editingRun.job.id}`,
            {
              headers: {
                Cookie: cookie,
              },
            },
          );
          const restartedJob = (await restartedJobResponse.json()) as {
            payload?: {
              tableInspectionFindings?: Array<{
                semantic_hit?: {
                  table_id?: string;
                  column_key?: string;
                  override_source?: string;
                };
              }>;
            };
          };

          assert.equal(restartedJobResponse.status, 200);
          assert.equal(
            restartedJob.payload?.tableInspectionFindings?.[0]?.semantic_hit?.table_id,
            semanticTableTableId,
          );
          assert.equal(
            restartedJob.payload?.tableInspectionFindings?.[0]?.semantic_hit?.column_key,
            semanticTableColumnKey,
          );
          assert.equal(
            restartedJob.payload?.tableInspectionFindings?.[0]?.semantic_hit
              ?.override_source,
            "base",
          );
        } finally {
          await stopServer(secondServer.server);
        }
      } finally {
        await stopServer(firstServer.server).catch(() => undefined);
      }
    } finally {
      await seedPool.end();
      await rm(uploadRootDir, { recursive: true, force: true });
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

async function createPersistentHarnessEvaluationSuite(input: {
  baseUrl: string;
  cookie: string;
  name: string;
}): Promise<{
  id: string;
  status: string;
}> {
  const createResponse = await fetch(
    `${input.baseUrl}/api/v1/verification-ops/evaluation-suites`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          name: input.name,
          suiteType: "regression",
          verificationCheckProfileIds: [],
          moduleScope: ["editing"],
          hardGatePolicy: {
            mustUseDeidentifiedSamples: true,
            requiresParsableOutput: false,
          },
        },
      }),
    },
  );
  const created = (await createResponse.json()) as {
    id: string;
  };

  assert.equal(createResponse.status, 201);

  const activateResponse = await fetch(
    `${input.baseUrl}/api/v1/verification-ops/evaluation-suites/${created.id}/activate`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  const activated = (await activateResponse.json()) as {
    id: string;
    status: string;
  };

  assert.equal(activateResponse.status, 200);
  assert.equal(activated.status, "active");

  return activated;
}

async function seedPersistentHarnessAdapter(input: {
  pool: Pool;
  redactionProfileId: string;
  adapterId: string;
  flagChangeId: string;
  kind: "promptfoo" | "langfuse_oss";
  displayName: string;
  executionMode: "local_cli" | "self_hosted_http";
  flagKey: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}): Promise<void> {
  const repository = new PostgresHarnessIntegrationRepository({
    client: input.pool,
  });

  await repository.saveRedactionProfile({
    id: input.redactionProfileId,
    name: `${input.kind}-persistent-profile`,
    redaction_mode:
      input.kind === "langfuse_oss" ? "metadata_only" : "structured_only",
    structured_fields: ["module", "manuscript_type", "template_family_id"],
    allow_raw_payload_export: false,
    created_at: "2026-04-04T12:20:00.000Z",
    updated_at: "2026-04-04T12:20:00.000Z",
  });
  await repository.saveAdapter({
    id: input.adapterId,
    kind: input.kind,
    display_name: input.displayName,
    execution_mode: input.executionMode,
    fail_open: true,
    redaction_profile_id: input.redactionProfileId,
    feature_flag_keys: [input.flagKey],
    result_envelope_version: "1.0.0",
    config: input.config,
    created_at: "2026-04-04T12:21:00.000Z",
    updated_at: "2026-04-04T12:21:00.000Z",
  });
  await repository.saveFeatureFlagChange({
    id: input.flagChangeId,
    adapter_id: input.adapterId,
    flag_key: input.flagKey,
    enabled: input.enabled,
    changed_by: "persistent.admin",
    change_reason: "Enable harness adapter for bounded runtime tests.",
    created_at: "2026-04-04T12:22:00.000Z",
  });
}

async function seedPersistentEditingParentAsset(
  pool: Pool,
  templateFamilyId: string,
): Promise<void> {
  const assetRepository = new PostgresDocumentAssetRepository({
    client: pool,
  });
  const manuscriptRepository = new PostgresManuscriptRepository({
    client: pool,
  });

  await assetRepository.save({
    id: persistentHarnessIntegrationFixtureIds.parentAssetId,
    manuscript_id: persistentRetrievalQualityFixtureIds.manuscriptId,
    asset_type: "original",
    status: "active",
    storage_key: "persistent/harness/editing-parent.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_module: "upload",
    created_by: "persistent-admin",
    version_no: 1,
    is_current: true,
    file_name: "persistent-editing-parent.docx",
    created_at: "2026-04-04T12:23:00.000Z",
    updated_at: "2026-04-04T12:23:00.000Z",
  });

  const manuscript = await manuscriptRepository.findById(
    persistentRetrievalQualityFixtureIds.manuscriptId,
  );
  assert.ok(manuscript, "Expected retrieval-quality manuscript fixture to exist.");

  await manuscriptRepository.save({
    ...manuscript,
    current_template_family_id: templateFamilyId,
    updated_at: "2026-04-04T12:23:30.000Z",
  });
}

async function createPersistentRetrievalQualityFixture(input: {
  baseUrl: string;
  cookie: string;
  pool: Pool;
  evaluationSuiteIds?: string[];
}): Promise<{
  familyId: string;
  moduleTemplateId: string;
}> {
  const familyResponse = await fetch(`${input.baseUrl}/api/v1/templates/families`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      manuscriptType: "clinical_study",
      name: "Persistent retrieval family",
    }),
  });
  const family = (await familyResponse.json()) as { id: string };

  assert.equal(familyResponse.status, 201);

  const moduleTemplateResponse = await fetch(
    `${input.baseUrl}/api/v1/templates/module-drafts`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateFamilyId: family.id,
        module: "editing",
        manuscriptType: "clinical_study",
        prompt: "Persistent retrieval editing template",
        checklist: ["Keep retrieval evidence additive."],
      }),
    },
  );
  const moduleTemplate = (await moduleTemplateResponse.json()) as { id: string };

  assert.equal(moduleTemplateResponse.status, 201);

  const publishModuleTemplateResponse = await fetch(
    `${input.baseUrl}/api/v1/templates/module-templates/${moduleTemplate.id}/publish`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(publishModuleTemplateResponse.status, 200);

  const ruleSetResponse = await fetch(`${input.baseUrl}/api/v1/editorial-rules/rule-sets`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actorRole: "editor",
      templateFamilyId: family.id,
      module: "editing",
    }),
  });
  const ruleSet = (await ruleSetResponse.json()) as { id: string };

  assert.equal(ruleSetResponse.status, 201);

  const ruleResponse = await fetch(
    `${input.baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/rules`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        orderNo: 10,
        ruleType: "format",
        executionMode: "apply_and_inspect",
        scope: {
          section: "abstract",
        },
        trigger: {
          kind: "heading_equals",
          text: "摘要 目的",
        },
        action: {
          kind: "replace_heading",
          to: "（摘要　目的）",
        },
        confidencePolicy: "always_auto",
        severity: "warning",
      }),
    },
  );

  assert.equal(ruleResponse.status, 201);

  const tableRuleResponse = await fetch(
    `${input.baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/rules`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        orderNo: 20,
        ruleObject: "table",
        ruleType: "format",
        executionMode: "inspect",
        scope: {
          sections: ["results"],
        },
        selector: {
          semantic_target: "header_cell",
          header_path_includes: ["Treatment group", "n (%)"],
        },
        trigger: {
          kind: "table_shape",
          layout: "three_line_table",
        },
        action: {
          kind: "emit_finding",
          message: "Persistent governance table-semantic integration check.",
        },
        confidencePolicy: "manual_only",
        severity: "warning",
      }),
    },
  );

  assert.equal(tableRuleResponse.status, 201);

  const publishRuleSetResponse = await fetch(
    `${input.baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/publish`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(publishRuleSetResponse.status, 200);

  const promptResponse = await fetch(
    `${input.baseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        name: "persistent_retrieval_prompt",
        version: "1.0.0",
        module: "editing",
        manuscriptTypes: ["clinical_study"],
        templateKind: "editing_instruction",
        systemInstructions:
          "Apply published editorial rules before bounded AI editing.",
        taskFrame: "Use the active editorial rule set for editing.",
        hardRuleSummary: "摘要 目的 -> （摘要　目的）",
        allowedContentOperations: ["sentence_rewrite"],
        forbiddenOperations: ["fabrication"],
        manualReviewPolicy: "Escalate uncertain meaning changes.",
        outputContract: "Return a governed editing payload.",
      }),
    },
  );
  const prompt = (await promptResponse.json()) as { id: string };

  assert.equal(promptResponse.status, 201);

  const publishPromptResponse = await fetch(
    `${input.baseUrl}/api/v1/prompt-skill-registry/prompt-templates/${prompt.id}/publish`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(publishPromptResponse.status, 200);

  const skillResponse = await fetch(
    `${input.baseUrl}/api/v1/prompt-skill-registry/skill-packages`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        name: "persistent_retrieval_skills",
        version: "1.0.0",
        appliesToModules: ["editing"],
      }),
    },
  );
  const skill = (await skillResponse.json()) as { id: string };

  assert.equal(skillResponse.status, 201);

  const publishSkillResponse = await fetch(
    `${input.baseUrl}/api/v1/prompt-skill-registry/skill-packages/${skill.id}/publish`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(publishSkillResponse.status, 200);

  const modelResponse = await fetch(`${input.baseUrl}/api/v1/model-registry`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actorRole: "editor",
      provider: "openai",
      modelName: "persistent-retrieval-model",
      allowedModules: ["editing"],
      isProdAllowed: true,
    }),
  });
  const model = (await modelResponse.json()) as { id: string };

  assert.equal(modelResponse.status, 201);

  const updateRoutingPolicyResponse = await fetch(
    `${input.baseUrl}/api/v1/model-registry/routing-policy`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        moduleDefaults: {
          editing: model.id,
        },
      }),
    },
  );

  assert.equal(updateRoutingPolicyResponse.status, 200);

  const profileResponse = await fetch(
    `${input.baseUrl}/api/v1/execution-governance/profiles`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        input: {
          module: "editing",
          manuscriptType: "clinical_study",
          templateFamilyId: family.id,
          moduleTemplateId: moduleTemplate.id,
          ruleSetId: ruleSet.id,
          promptTemplateId: prompt.id,
          skillPackageIds: [skill.id],
          knowledgeBindingMode: "profile_plus_dynamic",
        },
      }),
    },
  );
  const profile = (await profileResponse.json()) as { id: string };

  assert.equal(profileResponse.status, 201);

  const publishProfileResponse = await fetch(
    `${input.baseUrl}/api/v1/execution-governance/profiles/${profile.id}/publish`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(publishProfileResponse.status, 200);

  const toolResponse = await fetch(`${input.baseUrl}/api/v1/tool-gateway`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actorRole: "editor",
      input: {
        name: "persistent.retrieval.lookup",
        scope: "knowledge",
      },
    }),
  });
  const tool = (await toolResponse.json()) as { id: string };

  assert.equal(toolResponse.status, 201);

  const policyResponse = await fetch(
    `${input.baseUrl}/api/v1/tool-permission-policies`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
        input: {
          name: "Persistent retrieval tool policy",
          allowedToolIds: [tool.id],
        },
      }),
    },
  );
  const policy = (await policyResponse.json()) as { id: string };

  assert.equal(policyResponse.status, 201);

  const activatePolicyResponse = await fetch(
    `${input.baseUrl}/api/v1/tool-permission-policies/${policy.id}/activate`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(activatePolicyResponse.status, 200);

  const sandboxResponse = await fetch(`${input.baseUrl}/api/v1/sandbox-profiles`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actorRole: "editor",
      input: {
        name: "Persistent retrieval sandbox",
        sandboxMode: "workspace_write",
        networkAccess: false,
        approvalRequired: true,
        allowedToolIds: [tool.id],
      },
    }),
  });
  const sandbox = (await sandboxResponse.json()) as { id: string };

  assert.equal(sandboxResponse.status, 201);

  const activateSandboxResponse = await fetch(
    `${input.baseUrl}/api/v1/sandbox-profiles/${sandbox.id}/activate`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(activateSandboxResponse.status, 200);

  const runtimeResponse = await fetch(`${input.baseUrl}/api/v1/agent-runtime`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actorRole: "editor",
      input: {
        name: "Persistent retrieval runtime",
        adapter: "deepagents",
        sandboxProfileId: sandbox.id,
        allowedModules: ["editing"],
        runtimeSlot: "editing",
      },
    }),
  });
  const runtime = (await runtimeResponse.json()) as { id: string };

  assert.equal(runtimeResponse.status, 201);

  const publishRuntimeResponse = await fetch(
    `${input.baseUrl}/api/v1/agent-runtime/${runtime.id}/publish`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(publishRuntimeResponse.status, 200);

  const agentProfileResponse = await fetch(`${input.baseUrl}/api/v1/agent-profiles`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actorRole: "editor",
      input: {
        name: "Persistent retrieval executor",
        roleKey: "subagent",
        moduleScope: ["editing"],
        manuscriptTypes: ["clinical_study"],
      },
    }),
  });
  const agentProfile = (await agentProfileResponse.json()) as { id: string };

  assert.equal(agentProfileResponse.status, 201);

  const publishAgentProfileResponse = await fetch(
    `${input.baseUrl}/api/v1/agent-profiles/${agentProfile.id}/publish`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(publishAgentProfileResponse.status, 200);

  const bindingResponse = await fetch(`${input.baseUrl}/api/v1/runtime-bindings`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actorRole: "editor",
      input: {
        module: "editing",
        manuscriptType: "clinical_study",
        templateFamilyId: family.id,
        runtimeId: runtime.id,
        sandboxProfileId: sandbox.id,
        agentProfileId: agentProfile.id,
        toolPermissionPolicyId: policy.id,
        promptTemplateId: prompt.id,
        skillPackageIds: [skill.id],
        evaluationSuiteIds: input.evaluationSuiteIds,
      },
    }),
  });
  const binding = (await bindingResponse.json()) as { id: string };

  assert.equal(bindingResponse.status, 201);

  const activateBindingResponse = await fetch(
    `${input.baseUrl}/api/v1/runtime-bindings/${binding.id}/activate`,
    {
      method: "POST",
      headers: {
        Cookie: input.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actorRole: "editor",
      }),
    },
  );

  assert.equal(activateBindingResponse.status, 200);

  const manuscriptRepository = new PostgresManuscriptRepository({
    client: input.pool,
  });
  await manuscriptRepository.save({
    id: persistentRetrievalQualityFixtureIds.manuscriptId,
    title: "Persistent retrieval manuscript",
    manuscript_type: "clinical_study",
    status: "completed",
    current_template_family_id: family.id,
    created_by: "persistent-admin",
    created_at: "2026-04-04T12:00:00.000Z",
    updated_at: "2026-04-04T12:00:00.000Z",
  });

  const knowledgeRepository = new PostgresKnowledgeRepository({
    client: input.pool,
  });
  await knowledgeRepository.save({
    id: persistentRetrievalQualityFixtureIds.knowledgeItemId,
    title: "Persistent retrieval knowledge item",
    canonical_text:
      "Editing runs must preserve governed retrieval evidence as additive context only.",
    summary: "Used to prove retrieval context snapshots stay additive.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
      sections: ["discussion"],
      risk_tags: ["grounding"],
    },
    template_bindings: [moduleTemplate.id],
  });

  const harnessDatasetRepository = new PostgresHarnessDatasetRepository({
    client: input.pool,
  });
  await harnessDatasetRepository.saveGoldSetFamily({
    id: persistentRetrievalQualityFixtureIds.goldSetFamilyId,
    name: "Persistent retrieval gold set",
    scope: {
      module: "editing",
      manuscript_types: ["clinical_study"],
      measure_focus: "retrieval grounding",
      template_family_id: family.id,
    },
    admin_only: true,
    created_at: "2026-04-04T12:10:00.000Z",
    updated_at: "2026-04-04T12:10:00.000Z",
  });
  await harnessDatasetRepository.saveRubricDefinition({
    id: persistentRetrievalQualityFixtureIds.rubricId,
    name: "Persistent retrieval rubric",
    version_no: 1,
    status: "published",
    scope: {
      module: "editing",
      manuscript_types: ["clinical_study"],
    },
    scoring_dimensions: [
      {
        key: "grounding",
        label: "Grounding",
        weight: 1,
      },
    ],
    created_by: "persistent-admin",
    created_at: "2026-04-04T12:12:00.000Z",
    published_by: "persistent-admin",
    published_at: "2026-04-04T12:13:00.000Z",
  });
  await harnessDatasetRepository.saveGoldSetVersion({
    id: persistentRetrievalQualityFixtureIds.goldSetVersionId,
    family_id: persistentRetrievalQualityFixtureIds.goldSetFamilyId,
    version_no: 1,
    status: "published",
    rubric_definition_id: persistentRetrievalQualityFixtureIds.rubricId,
    item_count: 1,
    deidentification_gate_passed: true,
    human_review_gate_passed: true,
    items: [
      {
        source_kind: "reviewed_case_snapshot",
        source_id: "persistent-retrieval-reviewed-snapshot-1",
        manuscript_id: persistentRetrievalQualityFixtureIds.manuscriptId,
        manuscript_type: "clinical_study",
        deidentification_passed: true,
        human_reviewed: true,
        risk_tags: ["grounding"],
      },
    ],
    created_by: "persistent-admin",
    created_at: "2026-04-04T12:14:00.000Z",
    published_by: "persistent-admin",
    published_at: "2026-04-04T12:15:00.000Z",
  });

  return {
    familyId: family.id,
    moduleTemplateId: moduleTemplate.id,
  };
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

async function startPersistentGovernanceServer(
  databaseUrl: string,
  input: {
    uploadRootDir?: string;
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
      uploadRootDir: input.uploadRootDir,
      aiProviderCredentialCrypto: new AiProviderCredentialCrypto({
        AI_PROVIDER_MASTER_KEY: Buffer.alloc(32, 0x41).toString("base64"),
      }),
    }),
    uploadRootDir: input.uploadRootDir,
  });

  server.on("close", () => {
    void pool.end();
  });

  return startHttpTestServer(server);
}

const stopServer = stopHttpTestServer;

async function writeSemanticTableFixtureDocx(
  rootDir: string,
  storageKey: string,
): Promise<void> {
  const absolutePath = path.join(rootDir, ...storageKey.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(semanticTableDocxBase64, "base64"));
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
