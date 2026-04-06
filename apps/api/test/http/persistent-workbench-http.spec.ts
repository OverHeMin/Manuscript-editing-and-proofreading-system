import { mkdtemp, readFile, rm } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import { createPersistentGovernanceRuntime } from "../../src/http/persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "../../src/http/persistent-auth-runtime.ts";
import {
  PostgresAgentProfileRepository,
} from "../../src/modules/agent-profiles/index.ts";
import {
  PostgresAgentRuntimeRepository,
} from "../../src/modules/agent-runtime/index.ts";
import {
  PostgresExecutionGovernanceRepository,
} from "../../src/modules/execution-governance/index.ts";
import {
  PostgresKnowledgeRepository,
} from "../../src/modules/knowledge/index.ts";
import {
  PostgresModelRegistryRepository,
  PostgresModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/index.ts";
import {
  PostgresPromptSkillRegistryRepository,
} from "../../src/modules/prompt-skill-registry/index.ts";
import {
  PostgresRuntimeBindingRepository,
} from "../../src/modules/runtime-bindings/index.ts";
import {
  PostgresSandboxProfileRepository,
} from "../../src/modules/sandbox-profiles/index.ts";
import {
  PostgresModuleTemplateRepository,
  PostgresTemplateFamilyRepository,
} from "../../src/modules/templates/index.ts";
import {
  PostgresToolPermissionPolicyRepository,
} from "../../src/modules/tool-permission-policies/index.ts";
import { PostgresVerificationOpsRepository } from "../../src/modules/verification-ops/index.ts";
import { PostgresUserRepository } from "../../src/users/postgres-user-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "./support/http-test-server.ts";

interface PersistentWorkbenchSeededIds {
  manuscriptId: string;
  originalAssetId: string;
  humanFinalAssetId: string;
  reviewedCaseSnapshotId: string;
  screeningSuiteId: string;
  proofreadingSuiteId: string;
  screeningKnowledgeId: string;
  proofreadingKnowledgeId: string;
  screeningModelId: string;
  proofreadingModelId: string;
}

const seededIds: PersistentWorkbenchSeededIds = {
  manuscriptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  originalAssetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  humanFinalAssetId: "abababab-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  reviewedCaseSnapshotId: "cdcdcdcd-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  screeningSuiteId: "aaaaaaaa-1111-4333-8444-555555555555",
  proofreadingSuiteId: "12121212-9999-4333-8444-555555555555",
  screeningKnowledgeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  proofreadingKnowledgeId: "eeeeeeee-cccc-4ccc-8ccc-cccccccccccc",
  screeningModelId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  proofreadingModelId: "ffffffff-dddd-4ddd-8ddd-dddddddddddd",
};

test("persistent workbench upload routes keep manuscripts, assets, jobs, and exports across server restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-persistent-workbench-"));
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent workbench database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);

      const firstServer = await startPersistentWorkbenchServer(databaseUrl, {
        uploadRootDir,
      });
      try {
        const cookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.user",
        );
        const uploadResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/manuscripts/upload`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "Persistent HTTP Upload",
              manuscriptType: "clinical_study",
              createdBy: "forged-user",
              fileName: "persistent-http-upload.docx",
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              fileContentBase64: "UGVyc2lzdGVudCBkb3dubG9hZCBieXRlcw==",
            }),
          },
        );
        const uploaded = (await uploadResponse.json()) as {
          manuscript: { id: string; created_by: string };
          asset: { id: string; created_by: string; asset_type: string };
          job: { id: string; requested_by: string; module: string };
        };

        assert.equal(
          uploadResponse.status,
          201,
          `Expected upload to succeed, received ${uploadResponse.status}: ${JSON.stringify(uploaded)}`,
        );
        assert.equal(uploaded.manuscript.created_by, "persistent-user");
        assert.equal(uploaded.asset.created_by, "persistent-user");
        assert.equal(uploaded.job.requested_by, "persistent-user");

        await stopServer(firstServer.server);

        const secondServer = await startPersistentWorkbenchServer(databaseUrl, {
          uploadRootDir,
        });
        try {
          const manuscriptResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const manuscript = (await manuscriptResponse.json()) as {
            id: string;
            module_execution_overview?: {
              screening: { observation_status: string };
              editing: { observation_status: string };
              proofreading: { observation_status: string };
            };
          };

          const assetsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/assets`,
            {
              headers: { Cookie: cookie },
            },
          );
          const assets = (await assetsResponse.json()) as Array<{
            id: string;
            asset_type: string;
          }>;

          const jobResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/jobs/${uploaded.job.id}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const job = (await jobResponse.json()) as {
            id: string;
            requested_by: string;
            module: string;
            execution_tracking?: { observation_status: string };
          };

          const exportResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/document-pipeline/export-current-asset`,
            {
              method: "POST",
              headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                manuscriptId: uploaded.manuscript.id,
                preferredAssetType: "original",
              }),
            },
          );
          const exported = (await exportResponse.json()) as {
            manuscript_id: string;
            asset: { id: string };
            download: {
              storage_key: string;
              url: string;
            };
          };
          assert.ok(
            exported.download.url,
            "Expected export payload to include a download URL.",
          );
          const downloadResponse = await fetch(
            `${secondServer.baseUrl}${exported.download.url}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const downloadedBody = Buffer.from(
            await downloadResponse.arrayBuffer(),
          ).toString("utf8");
          const storedPath = path.join(
            uploadRootDir,
            ...exported.download.storage_key.split("/"),
          );
          const storedBody = await readFile(storedPath, "utf8");

          assert.equal(manuscriptResponse.status, 200);
          assert.equal(assetsResponse.status, 200);
          assert.equal(jobResponse.status, 200);
          assert.equal(exportResponse.status, 200);
          assert.equal(downloadResponse.status, 200);
          assert.equal(manuscript.id, uploaded.manuscript.id);
          assert.equal(
            manuscript.module_execution_overview?.screening.observation_status,
            "not_started",
          );
          assert.equal(
            manuscript.module_execution_overview?.editing.observation_status,
            "not_started",
          );
          assert.equal(
            manuscript.module_execution_overview?.proofreading.observation_status,
            "not_started",
          );
          assert.deepEqual(
            assets.map((asset) => ({
              id: asset.id,
              asset_type: asset.asset_type,
            })),
            [
              {
                id: uploaded.asset.id,
                asset_type: "original",
              },
            ],
          );
          assert.equal(job.id, uploaded.job.id);
          assert.equal(job.requested_by, "persistent-user");
          assert.equal(job.module, "upload");
          assert.equal(job.execution_tracking?.observation_status, "not_tracked");
          assert.equal(exported.manuscript_id, uploaded.manuscript.id);
          assert.equal(exported.asset.id, uploaded.asset.id);
          assert.equal(
            exported.download.url,
            `/api/v1/document-assets/${uploaded.asset.id}/download`,
          );
          assert.equal(downloadedBody, "Persistent download bytes");
          assert.equal(storedBody, "Persistent download bytes");
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

test("persistent workbench screening routes keep governed execution evidence across server restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent workbench database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);
      const firstServer = await startPersistentWorkbenchServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.screener",
        );
        const screeningResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/screening/run`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              parentAssetId: seededIds.originalAssetId,
              requestedBy: "forged-screener",
              actorRole: "admin",
              storageKey: "persistent/runs/screening/report.md",
              fileName: "persistent-screening-report.md",
            }),
          },
        );
        const screening = (await screeningResponse.json()) as {
          job: { id: string; requested_by: string; module: string };
          asset: {
            id: string;
            asset_type: string;
            created_by: string;
            parent_asset_id?: string;
          };
          knowledge_item_ids: string[];
          model_id: string;
          snapshot_id?: string;
          agent_execution_log_id?: string;
        };

        assert.equal(
          screeningResponse.status,
          201,
          `Expected screening to succeed, received ${screeningResponse.status}: ${JSON.stringify(screening)}`,
        );
        assert.equal(screening.job.requested_by, "persistent-screener");
        assert.equal(screening.job.module, "screening");
        assert.equal(screening.asset.asset_type, "screening_report");
        assert.equal(screening.asset.created_by, "persistent-screener");
        assert.equal(screening.asset.parent_asset_id, seededIds.originalAssetId);
        assert.deepEqual(screening.knowledge_item_ids, [
          seededIds.screeningKnowledgeId,
        ]);
        assert.equal(screening.model_id, seededIds.screeningModelId);
        assert.ok(screening.snapshot_id);
        assert.ok(screening.agent_execution_log_id);

        await stopServer(firstServer.server);

        const secondServer = await startPersistentWorkbenchServer(databaseUrl);
        try {
          const restartedAdminCookie = await loginAsPersistentUser(
            secondServer.baseUrl,
            "persistent.admin",
          );
          const manuscriptResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const manuscript = (await manuscriptResponse.json()) as {
            current_screening_asset_id?: string;
            module_execution_overview?: {
              screening?: {
                observation_status: string;
                latest_snapshot?: { id: string };
                settlement?: { derived_status: string };
              };
            };
          };

          const assetsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/assets`,
            {
              headers: { Cookie: cookie },
            },
          );
          const assets = (await assetsResponse.json()) as Array<{
            id: string;
            asset_type: string;
          }>;

          const jobResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/jobs/${screening.job.id}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const job = (await jobResponse.json()) as {
            id: string;
            payload?: Record<string, unknown>;
            execution_tracking?: {
              observation_status: string;
              snapshot?: { id: string };
              settlement?: { derived_status: string };
            };
          };

          const exportResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/document-pipeline/export-current-asset`,
            {
              method: "POST",
              headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                manuscriptId: seededIds.manuscriptId,
                preferredAssetType: "screening_report",
              }),
            },
          );
          const exported = (await exportResponse.json()) as {
            asset: { id: string };
          };

          assert.equal(manuscriptResponse.status, 200);
          assert.equal(assetsResponse.status, 200);
          assert.equal(jobResponse.status, 200);
          assert.equal(exportResponse.status, 200);
          assert.equal(manuscript.current_screening_asset_id, screening.asset.id);
          assert.deepEqual(
            [...assets.map((asset) => asset.id)].sort(),
            [seededIds.originalAssetId, screening.asset.id].sort(),
          );
          assert.equal(job.id, screening.job.id);
          assert.equal(job.payload?.outputAssetId, screening.asset.id);
          assert.equal(
            manuscript.module_execution_overview?.screening?.observation_status,
            "reported",
          );
          assert.equal(
            manuscript.module_execution_overview?.screening?.latest_snapshot?.id,
            screening.snapshot_id,
          );
          assert.equal(
            manuscript.module_execution_overview?.screening?.settlement
              ?.derived_status,
            "business_completed_settled",
          );
          assert.equal(job.execution_tracking?.observation_status, "reported");
          assert.equal(
            job.execution_tracking?.snapshot?.id,
            screening.snapshot_id,
          );
          assert.equal(
            job.execution_tracking?.settlement?.derived_status,
            "business_completed_settled",
          );
          assert.equal(exported.asset.id, screening.asset.id);

          const runsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.screeningSuiteId}/runs`,
            {
              headers: { Cookie: restartedAdminCookie },
            },
          );
          const runs = (await runsResponse.json()) as Array<{
            id: string;
            status: string;
            evidence_ids: string[];
            release_check_profile_id?: string;
            sample_set_id?: string;
            run_item_count: number;
            governed_source?: {
              source_kind: string;
              manuscript_id: string;
              source_module: string;
              agent_execution_log_id: string;
              execution_snapshot_id: string;
              output_asset_id: string;
            };
          }>;
          assert.equal(runsResponse.status, 200);
          assert.equal(runs.length, 1);
          assert.equal(runs[0]?.status, "passed");
          assert.equal(runs[0]?.release_check_profile_id, "cccccccc-9999-4333-8444-555555555555");
          assert.equal(runs[0]?.sample_set_id, undefined);
          assert.equal(runs[0]?.run_item_count, 0);
          assert.equal(runs[0]?.evidence_ids.length, 1);
          assert.deepEqual(runs[0]?.governed_source, {
            source_kind: "governed_module_execution",
            manuscript_id: seededIds.manuscriptId,
            source_module: "screening",
            agent_execution_log_id: screening.agent_execution_log_id,
            execution_snapshot_id: screening.snapshot_id,
            output_asset_id: screening.asset.id,
          });

          const runItemsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${runs[0]!.id}/items`,
            {
              headers: { Cookie: restartedAdminCookie },
            },
          );
          assert.equal(runItemsResponse.status, 200);
          assert.deepEqual(await runItemsResponse.json(), []);

          const runEvidenceResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${runs[0]!.id}/evidence`,
            {
              headers: { Cookie: restartedAdminCookie },
            },
          );
          const runEvidence = (await runEvidenceResponse.json()) as Array<{
            id: string;
            check_profile_id?: string;
            uri?: string;
          }>;
          assert.equal(runEvidenceResponse.status, 200);
          assert.equal(runEvidence.length, 1);
          assert.equal(runEvidence[0]?.id, runs[0]?.evidence_ids[0]);
          assert.equal(
            runEvidence[0]?.check_profile_id,
            "bbbbbbbb-9999-4333-8444-555555555555",
          );
          assert.equal(
            runEvidence[0]?.uri,
            `/api/v1/document-assets/${screening.asset.id}/download`,
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

test("persistent proofreading publish-human-final route survives restart and becomes the exported current asset", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent workbench database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);

      const firstServer = await startPersistentWorkbenchServer(databaseUrl);
      try {
        const cookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.proofreader",
        );
        const adminCookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.admin",
        );

        const draftResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/draft`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              parentAssetId: seededIds.originalAssetId,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/proofreading/draft.md",
              fileName: "persistent-proofreading-draft.md",
            }),
          },
        );
        const draft = (await draftResponse.json()) as {
          asset: {
            id: string;
          };
          snapshot_id?: string;
          agent_execution_log_id?: string;
        };
        assert.equal(draftResponse.status, 201);

        const draftRunsResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.proofreadingSuiteId}/runs`,
          {
            headers: { Cookie: adminCookie },
          },
        );
        assert.equal(draftRunsResponse.status, 200);
        assert.deepEqual(await draftRunsResponse.json(), []);

        const finalizeResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/finalize`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              draftAssetId: draft.asset.id,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/proofreading/final.docx",
              fileName: "persistent-proofreading-final.docx",
            }),
          },
        );
        const finalized = (await finalizeResponse.json()) as {
          asset: {
            id: string;
          };
          snapshot_id?: string;
          agent_execution_log_id?: string;
        };
        assert.equal(finalizeResponse.status, 201);

        const publishResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/publish-human-final`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              finalAssetId: finalized.asset.id,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/proofreading/human-final.docx",
              fileName: "persistent-human-final.docx",
            }),
          },
        );
        const published = (await publishResponse.json()) as {
          job: { id: string };
          asset: { id: string; asset_type: string };
        };
        assert.equal(publishResponse.status, 201);
        assert.equal(published.asset.asset_type, "human_final_docx");

        await stopServer(firstServer.server);

        const secondServer = await startPersistentWorkbenchServer(databaseUrl);
        try {
          const restartedAdminCookie = await loginAsPersistentUser(
            secondServer.baseUrl,
            "persistent.admin",
          );
          const manuscriptResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const manuscript = (await manuscriptResponse.json()) as {
            current_proofreading_asset_id?: string;
          };

          const assetsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/assets`,
            {
              headers: { Cookie: cookie },
            },
          );
          const assets = (await assetsResponse.json()) as Array<{
            id: string;
            asset_type: string;
          }>;

          const jobResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/jobs/${published.job.id}`,
            {
              headers: { Cookie: cookie },
            },
          );
          const job = (await jobResponse.json()) as {
            id: string;
            module: string;
            job_type: string;
            payload?: Record<string, unknown>;
          };

          const exportResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/document-pipeline/export-current-asset`,
            {
              method: "POST",
              headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                manuscriptId: seededIds.manuscriptId,
              }),
            },
          );
          const exported = (await exportResponse.json()) as {
            asset: { id: string; asset_type: string };
          };

          assert.equal(manuscriptResponse.status, 200);
          assert.equal(manuscript.current_proofreading_asset_id, published.asset.id);
          assert.equal(assetsResponse.status, 200);
          assert.ok(
            assets.some(
              (asset) =>
                asset.id === published.asset.id && asset.asset_type === "human_final_docx",
            ),
          );
          assert.equal(jobResponse.status, 200);
          assert.equal(job.id, published.job.id);
          assert.equal(job.module, "manual");
          assert.equal(job.job_type, "publish_human_final");
          assert.equal(job.payload?.sourceAssetId, finalized.asset.id);
          assert.equal(exportResponse.status, 200);
          assert.equal(exported.asset.id, published.asset.id);
          assert.equal(exported.asset.asset_type, "human_final_docx");

          const runsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.proofreadingSuiteId}/runs`,
            {
              headers: { Cookie: restartedAdminCookie },
            },
          );
          const runs = (await runsResponse.json()) as Array<{
            id: string;
            status: string;
            evidence_ids: string[];
            release_check_profile_id?: string;
            sample_set_id?: string;
            run_item_count: number;
            governed_source?: {
              source_kind: string;
              manuscript_id: string;
              source_module: string;
              agent_execution_log_id: string;
              execution_snapshot_id: string;
              output_asset_id: string;
            };
          }>;
          assert.equal(runsResponse.status, 200);
          assert.equal(runs.length, 1);
          assert.equal(runs[0]?.status, "passed");
          assert.equal(runs[0]?.release_check_profile_id, "12121212-7777-4333-8444-555555555555");
          assert.equal(runs[0]?.sample_set_id, undefined);
          assert.equal(runs[0]?.run_item_count, 0);
          assert.equal(runs[0]?.evidence_ids.length, 1);
          assert.deepEqual(runs[0]?.governed_source, {
            source_kind: "governed_module_execution",
            manuscript_id: seededIds.manuscriptId,
            source_module: "proofreading",
            agent_execution_log_id: draft.agent_execution_log_id,
            execution_snapshot_id: finalized.snapshot_id,
            output_asset_id: finalized.asset.id,
          });

          const runItemsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${runs[0]!.id}/items`,
            {
              headers: { Cookie: restartedAdminCookie },
            },
          );
          assert.equal(runItemsResponse.status, 200);
          assert.deepEqual(await runItemsResponse.json(), []);

          const runEvidenceResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${runs[0]!.id}/evidence`,
            {
              headers: { Cookie: restartedAdminCookie },
            },
          );
          const runEvidence = (await runEvidenceResponse.json()) as Array<{
            id: string;
            check_profile_id?: string;
            uri?: string;
          }>;
          assert.equal(runEvidenceResponse.status, 200);
          assert.equal(runEvidence.length, 1);
          assert.equal(runEvidence[0]?.id, runs[0]?.evidence_ids[0]);
          assert.equal(
            runEvidence[0]?.check_profile_id,
            "12121212-8888-4333-8444-555555555555",
          );
          assert.equal(
            runEvidence[0]?.uri,
            `/api/v1/document-assets/${finalized.asset.id}/download`,
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

test("persistent learning review snapshots and governed provenance survive restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent workbench database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);

      const firstServer = await startPersistentWorkbenchServer(databaseUrl);
      try {
        const proofreaderCookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.proofreader",
        );
        const reviewerCookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.knowledge_reviewer",
        );

        const draftResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/draft`,
          {
            method: "POST",
            headers: {
              Cookie: proofreaderCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              parentAssetId: seededIds.originalAssetId,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/learning-proofreading/draft.md",
              fileName: "persistent-learning-draft.md",
            }),
          },
        );
        const draft = (await draftResponse.json()) as {
          asset: { id: string };
        };
        assert.equal(draftResponse.status, 201);

        const finalizeResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/finalize`,
          {
            method: "POST",
            headers: {
              Cookie: proofreaderCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              draftAssetId: draft.asset.id,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/learning-proofreading/final.docx",
              fileName: "persistent-learning-final.docx",
            }),
          },
        );
        const finalized = (await finalizeResponse.json()) as {
          asset: { id: string };
        };
        assert.equal(finalizeResponse.status, 201);

        const publishResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/publish-human-final`,
          {
            method: "POST",
            headers: {
              Cookie: proofreaderCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              finalAssetId: finalized.asset.id,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/learning-proofreading/human-final.docx",
              fileName: "persistent-learning-human-final.docx",
            }),
          },
        );
        const published = (await publishResponse.json()) as {
          asset: { id: string };
        };
        assert.equal(publishResponse.status, 201);

        const snapshotResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning/reviewed-case-snapshots`,
          {
            method: "POST",
            headers: {
              Cookie: reviewerCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              module: "proofreading",
              manuscriptType: "clinical_study",
              humanFinalAssetId: published.asset.id,
              annotatedAssetId: finalized.asset.id,
              deidentificationPassed: true,
              requestedBy: "forged-reviewer",
              storageKey: "persistent/learning/reviewed-case-snapshot.bin",
            }),
          },
        );
        const snapshot = (await snapshotResponse.json()) as {
          id: string;
          created_by: string;
        };
        assert.equal(snapshotResponse.status, 201);
        assert.equal(snapshot.created_by, "persistent-knowledge-reviewer");

        await stopServer(firstServer.server);

        const secondServer = await startPersistentWorkbenchServer(databaseUrl);
        try {
          const candidateResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/learning/candidates/governed`,
            {
              method: "POST",
              headers: {
                Cookie: reviewerCookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                snapshotId: snapshot.id,
                type: "rule_candidate",
                title: "Persistent learning rule candidate",
                proposalText: "Carry governed learning provenance across restart.",
                requestedBy: "forged-reviewer",
                deidentificationPassed: true,
                governedSource: {
                  sourceKind: "evaluation_experiment",
                  reviewedCaseSnapshotId: snapshot.id,
                  evaluationRunId: "persistent-eval-1",
                  evidencePackId: "persistent-evidence-1",
                  sourceAssetId: published.asset.id,
                },
              }),
            },
          );
          const candidate = (await candidateResponse.json()) as {
            id: string;
            status: string;
            governed_provenance_kind?: string;
          };
          assert.equal(candidateResponse.status, 201);
          assert.equal(candidate.status, "pending_review");
          assert.equal(candidate.governed_provenance_kind, "evaluation_experiment");

          await stopServer(secondServer.server);

          const thirdServer = await startPersistentWorkbenchServer(databaseUrl);
          try {
            const approveResponse = await fetch(
              `${thirdServer.baseUrl}/api/v1/learning/candidates/${candidate.id}/approve`,
              {
                method: "POST",
                headers: {
                  Cookie: reviewerCookie,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  actorRole: "admin",
                }),
              },
            );
            const approved = (await approveResponse.json()) as {
              id: string;
              status: string;
            };

            assert.equal(approveResponse.status, 200);
            assert.equal(approved.id, candidate.id);
            assert.equal(approved.status, "approved");
          } finally {
            await stopServer(thirdServer.server);
          }
        } finally {
          await stopServer(secondServer.server).catch(() => undefined);
        }
      } finally {
        await stopServer(firstServer.server).catch(() => undefined);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent learning writebacks can submit knowledge drafts into review across restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent workbench database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);

      const firstServer = await startPersistentWorkbenchServer(databaseUrl);
      try {
        const proofreaderCookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.proofreader",
        );
        const reviewerCookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.knowledge_reviewer",
        );
        const adminCookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.admin",
        );

        const draftResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/draft`,
          {
            method: "POST",
            headers: {
              Cookie: proofreaderCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              parentAssetId: seededIds.originalAssetId,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/knowledge-handoff-proofreading/draft.md",
              fileName: "persistent-knowledge-handoff-draft.md",
            }),
          },
        );
        const draft = (await draftResponse.json()) as {
          asset: { id: string };
        };
        assert.equal(draftResponse.status, 201);

        const finalizeResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/finalize`,
          {
            method: "POST",
            headers: {
              Cookie: proofreaderCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              draftAssetId: draft.asset.id,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/knowledge-handoff-proofreading/final.docx",
              fileName: "persistent-knowledge-handoff-final.docx",
            }),
          },
        );
        const finalized = (await finalizeResponse.json()) as {
          asset: { id: string };
        };
        assert.equal(finalizeResponse.status, 201);

        const publishResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/modules/proofreading/publish-human-final`,
          {
            method: "POST",
            headers: {
              Cookie: proofreaderCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              finalAssetId: finalized.asset.id,
              requestedBy: "forged-proofreader",
              actorRole: "admin",
              storageKey: "persistent/runs/knowledge-handoff-proofreading/human-final.docx",
              fileName: "persistent-knowledge-handoff-human-final.docx",
            }),
          },
        );
        const published = (await publishResponse.json()) as {
          asset: { id: string };
        };
        assert.equal(publishResponse.status, 201);

        const snapshotResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning/reviewed-case-snapshots`,
          {
            method: "POST",
            headers: {
              Cookie: reviewerCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              manuscriptId: seededIds.manuscriptId,
              module: "proofreading",
              manuscriptType: "clinical_study",
              humanFinalAssetId: published.asset.id,
              annotatedAssetId: finalized.asset.id,
              deidentificationPassed: true,
              requestedBy: "forged-reviewer",
              storageKey: "persistent/learning/knowledge-handoff-reviewed-case-snapshot.bin",
            }),
          },
        );
        const snapshot = (await snapshotResponse.json()) as {
          id: string;
        };
        assert.equal(snapshotResponse.status, 201);

        const candidateResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning/candidates/governed`,
          {
            method: "POST",
            headers: {
              Cookie: reviewerCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              snapshotId: snapshot.id,
              type: "rule_candidate",
              title: "Persistent knowledge handoff candidate",
              proposalText:
                "Route governed learning writebacks into the knowledge review queue.",
              requestedBy: "forged-reviewer",
              deidentificationPassed: true,
              governedSource: {
                sourceKind: "evaluation_experiment",
                reviewedCaseSnapshotId: snapshot.id,
                evaluationRunId: "persistent-knowledge-handoff-eval-1",
                evidencePackId: "persistent-knowledge-handoff-evidence-1",
                sourceAssetId: published.asset.id,
              },
            }),
          },
        );
        const candidate = (await candidateResponse.json()) as {
          id: string;
        };
        assert.equal(candidateResponse.status, 201);

        const approveCandidateResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning/candidates/${candidate.id}/approve`,
          {
            method: "POST",
            headers: {
              Cookie: reviewerCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
            }),
          },
        );
        assert.equal(approveCandidateResponse.status, 200);

        const createWritebackResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning-governance/writebacks`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              input: {
                learningCandidateId: candidate.id,
                targetType: "knowledge_item",
                createdBy: "forged-admin",
              },
            }),
          },
        );
        const writeback = (await createWritebackResponse.json()) as {
          id: string;
          status: string;
        };
        assert.equal(createWritebackResponse.status, 201);
        assert.equal(writeback.status, "draft");

        const applyWritebackResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/learning-governance/writebacks/${writeback.id}/apply`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              input: {
                targetType: "knowledge_item",
                appliedBy: "forged-admin",
                title: "Persistent knowledge handoff rule",
                canonicalText:
                  "Governed learning writebacks must reach the knowledge review queue before publication.",
                knowledgeKind: "rule",
                moduleScope: "learning",
                manuscriptTypes: ["clinical_study"],
                summary: "Persistent knowledge handoff summary",
              },
            }),
          },
        );
        const appliedWriteback = (await applyWritebackResponse.json()) as {
          status: string;
          created_draft_asset_id?: string;
        };
        assert.equal(applyWritebackResponse.status, 200);
        assert.equal(appliedWriteback.status, "applied");
        assert.ok(appliedWriteback.created_draft_asset_id);

        const submitResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/knowledge/${appliedWriteback.created_draft_asset_id}/submit`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        const submittedKnowledgeItem = (await submitResponse.json()) as {
          id: string;
          title: string;
          status: string;
        };
        assert.equal(submitResponse.status, 200);
        assert.equal(submittedKnowledgeItem.id, appliedWriteback.created_draft_asset_id);
        assert.equal(submittedKnowledgeItem.status, "pending_review");

        await stopServer(firstServer.server);

        const secondServer = await startPersistentWorkbenchServer(databaseUrl);
        try {
          const queueResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/knowledge/review-queue`,
            {
              headers: {
                Cookie: reviewerCookie,
              },
            },
          );
          const queue = (await queueResponse.json()) as Array<{
            id: string;
            title: string;
            status: string;
          }>;

          assert.equal(queueResponse.status, 200);
          const queuedKnowledgeItem = queue.find(
            (item) => item.id === submittedKnowledgeItem.id,
          );
          assert.ok(queuedKnowledgeItem);
          assert.equal(queuedKnowledgeItem.id, submittedKnowledgeItem.id);
          assert.equal(queuedKnowledgeItem.title, "Persistent knowledge handoff rule");
          assert.equal(queuedKnowledgeItem.status, "pending_review");

          const approveKnowledgeResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/knowledge/${submittedKnowledgeItem.id}/approve`,
            {
              method: "POST",
              headers: {
                Cookie: reviewerCookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                reviewNote: "Approved after persistent learning-to-knowledge restart check.",
              }),
            },
          );
          assert.equal(approveKnowledgeResponse.status, 200);

          await stopServer(secondServer.server);

          const thirdServer = await startPersistentWorkbenchServer(databaseUrl);
          try {
            const queueAfterApprovalResponse = await fetch(
              `${thirdServer.baseUrl}/api/v1/knowledge/review-queue`,
              {
                headers: {
                  Cookie: reviewerCookie,
                },
              },
            );
            const queueAfterApproval =
              (await queueAfterApprovalResponse.json()) as Array<{ id: string }>;
            const historyResponse = await fetch(
              `${thirdServer.baseUrl}/api/v1/knowledge/${submittedKnowledgeItem.id}/review-actions`,
              {
                headers: {
                  Cookie: reviewerCookie,
                },
              },
            );
            const history = (await historyResponse.json()) as Array<{
              action: string;
              review_note?: string;
            }>;

            assert.equal(queueAfterApprovalResponse.status, 200);
            assert.equal(
              queueAfterApproval.some((item) => item.id === submittedKnowledgeItem.id),
              false,
            );
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
                  review_note:
                    "Approved after persistent learning-to-knowledge restart check.",
                },
              ],
            );
          } finally {
            await stopServer(thirdServer.server);
          }
        } finally {
          await stopServer(secondServer.server).catch(() => undefined);
        }
      } finally {
        await stopServer(firstServer.server).catch(() => undefined);
      }
    } finally {
      await seedPool.end();
    }
  });
});

test("persistent verification ops routes keep finalized evaluation evidence usable across restarts", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent verification database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);
      await seedPersistentVerificationLearningFixtures(seedPool);

      const firstServer = await startPersistentWorkbenchServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentUser(
          firstServer.baseUrl,
          "persistent.admin",
        );

        const createSampleSetResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-sample-sets`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              input: {
                name: "Persistent Evaluation Samples",
                module: "proofreading",
                sampleItemInputs: [
                  {
                    reviewedCaseSnapshotId: seededIds.reviewedCaseSnapshotId,
                    riskTags: ["terminology"],
                  },
                ],
              },
            }),
          },
        );
        assert.equal(createSampleSetResponse.status, 201);
        const sampleSet = (await createSampleSetResponse.json()) as {
          id: string;
        };

        const publishSampleSetResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-sample-sets/${sampleSet.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
            }),
          },
        );
        assert.equal(publishSampleSetResponse.status, 200);

        const createCheckProfileResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/check-profiles`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              input: {
                name: "Persistent Browser QA",
                checkType: "browser_qa",
              },
            }),
          },
        );
        assert.equal(createCheckProfileResponse.status, 201);
        const checkProfile = (await createCheckProfileResponse.json()) as {
          id: string;
        };

        const publishCheckProfileResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/check-profiles/${checkProfile.id}/publish`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
            }),
          },
        );
        assert.equal(publishCheckProfileResponse.status, 200);

        const createSuiteResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-suites`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              input: {
                name: "Persistent Proofreading Regression Suite",
                suiteType: "regression",
                verificationCheckProfileIds: [checkProfile.id],
                moduleScope: ["proofreading"],
                requiresProductionBaseline: true,
                supportsAbComparison: true,
                hardGatePolicy: {
                  mustUseDeidentifiedSamples: true,
                  requiresParsableOutput: true,
                },
                scoreWeights: {
                  structure: 25,
                  terminology: 20,
                  knowledgeCoverage: 20,
                  riskDetection: 20,
                  humanEditBurden: 10,
                  costAndLatency: 5,
                },
              },
            }),
          },
        );
        assert.equal(createSuiteResponse.status, 201);
        const suite = (await createSuiteResponse.json()) as {
          id: string;
        };

        const activateSuiteResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/activate`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
            }),
          },
        );
        assert.equal(activateSuiteResponse.status, 200);

        const createRunResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-runs`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              input: {
                suiteId: suite.id,
                sampleSetId: sampleSet.id,
                baselineBinding: {
                  lane: "baseline",
                  modelId: seededIds.proofreadingModelId,
                  runtimeId: "persistent-runtime-prod-1",
                  promptTemplateId: "12121212-2222-4333-8444-555555555555",
                  skillPackageIds: ["12121212-7777-4888-8999-aaaaaaaaaaaa"],
                  moduleTemplateId: "12121212-ffff-4fff-8fff-ffffffffffff",
                },
                candidateBinding: {
                  lane: "candidate",
                  modelId: "persistent-proofreading-candidate-model",
                  runtimeId: "persistent-runtime-prod-1",
                  promptTemplateId: "12121212-2222-4333-8444-555555555555",
                  skillPackageIds: ["12121212-7777-4888-8999-aaaaaaaaaaaa"],
                  moduleTemplateId: "12121212-ffff-4fff-8fff-ffffffffffff",
                },
              },
            }),
          },
        );
        assert.equal(createRunResponse.status, 201);
        const run = (await createRunResponse.json()) as {
          id: string;
          run_item_count: number;
        };
        assert.equal(run.run_item_count, 1);

        const runItemsResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/items`,
          {
            headers: {
              Cookie: adminCookie,
            },
          },
        );
        assert.equal(runItemsResponse.status, 200);
        const runItems = (await runItemsResponse.json()) as Array<{ id: string }>;
        assert.equal(runItems.length, 1);

        const recordRunItemResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-run-items/${runItems[0]?.id}/result`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              input: {
                runItemId: runItems[0]?.id,
                resultAssetId: seededIds.humanFinalAssetId,
                hardGatePassed: true,
                weightedScore: 93,
                diffSummary: "Persistent candidate reduced human edit burden.",
              },
            }),
          },
        );
        assert.equal(recordRunItemResponse.status, 200);

        const recordEvidenceResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evidence`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              input: {
                kind: "url",
                label: "Persistent browser QA",
                uri: "https://example.test/persistent/browser-qa",
              },
            }),
          },
        );
        assert.equal(recordEvidenceResponse.status, 201);
        const evidence = (await recordEvidenceResponse.json()) as { id: string };

        const completeRunResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/complete`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
              status: "passed",
              evidenceIds: [evidence.id],
            }),
          },
        );
        assert.equal(completeRunResponse.status, 200);

        const finalizeRunResponse = await fetch(
          `${firstServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/finalize`,
          {
            method: "POST",
            headers: {
              Cookie: adminCookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              actorRole: "admin",
            }),
          },
        );
        assert.equal(finalizeRunResponse.status, 200);
        const finalized = (await finalizeRunResponse.json()) as {
          evidence_pack: {
            id: string;
            summary_status: string;
          };
          recommendation: {
            status: string;
          };
        };
        assert.equal(finalized.evidence_pack.summary_status, "recommended");
        assert.equal(finalized.recommendation.status, "recommended");

        await stopServer(firstServer.server);

        const secondServer = await startPersistentWorkbenchServer(databaseUrl);
        try {
          const finalizedResultResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/finalized-result`,
            {
              headers: {
                Cookie: adminCookie,
              },
            },
          );
          assert.equal(finalizedResultResponse.status, 200);
          const finalizedResult = (await finalizedResultResponse.json()) as {
            evidence_pack: {
              id: string;
              summary_status: string;
            };
            recommendation: {
              status: string;
            };
            evidence: Array<{ id: string; label: string; uri?: string }>;
          };
          assert.equal(finalizedResult.evidence_pack.id, finalized.evidence_pack.id);
          assert.equal(
            finalizedResult.evidence_pack.summary_status,
            finalized.evidence_pack.summary_status,
          );
          assert.equal(
            finalizedResult.recommendation.status,
            finalized.recommendation.status,
          );
          assert.equal("evidence" in finalizedResult, false);

          const suiteFinalizedResultsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/finalized-results?history_window=latest_10`,
            {
              headers: {
                Cookie: adminCookie,
              },
            },
          );
          assert.equal(suiteFinalizedResultsResponse.status, 200);
          const suiteFinalizedResults =
            (await suiteFinalizedResultsResponse.json()) as Array<{
              run: { id: string };
              evidence_pack: {
                id: string;
                summary_status: string;
              };
              recommendation: {
                status: string;
              };
              evidence: Array<{ id: string; label: string; uri?: string }>;
            }>;
          assert.equal(suiteFinalizedResults.length, 1);
          assert.equal(suiteFinalizedResults[0]?.run.id, run.id);
          assert.equal(
            suiteFinalizedResults[0]?.evidence_pack.id,
            finalized.evidence_pack.id,
          );
          assert.equal(
            suiteFinalizedResults[0]?.recommendation.status,
            finalized.recommendation.status,
          );
          assert.equal(suiteFinalizedResults[0]?.evidence.length, 1);
          assert.equal(suiteFinalizedResults[0]?.evidence[0]?.id, evidence.id);
          assert.equal(
            suiteFinalizedResults[0]?.evidence[0]?.label,
            "Persistent browser QA",
          );
          assert.equal(
            suiteFinalizedResults[0]?.evidence[0]?.uri,
            "https://example.test/persistent/browser-qa",
          );

          const runEvidenceResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/evidence`,
            {
              headers: {
                Cookie: adminCookie,
              },
            },
          );
          assert.equal(runEvidenceResponse.status, 200);
          const runEvidence = (await runEvidenceResponse.json()) as Array<{
            id: string;
            label: string;
            uri?: string;
          }>;
          assert.equal(runEvidence.length, 1);
          assert.equal(runEvidence[0]?.label, "Persistent browser QA");
          assert.equal(
            runEvidence[0]?.uri,
            "https://example.test/persistent/browser-qa",
          );

          const evidenceByIdResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evidence/${evidence.id}`,
            {
              headers: {
                Cookie: adminCookie,
              },
            },
          );
          assert.equal(evidenceByIdResponse.status, 200);
          const evidenceById = (await evidenceByIdResponse.json()) as {
            id: string;
            label: string;
            uri?: string;
          };
          assert.equal(evidenceById.id, evidence.id);
          assert.equal(evidenceById.label, "Persistent browser QA");
          assert.equal(
            evidenceById.uri,
            "https://example.test/persistent/browser-qa",
          );

          const persistedRunsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/runs`,
            {
              headers: {
                Cookie: adminCookie,
              },
            },
          );
          assert.equal(persistedRunsResponse.status, 200);
          const persistedRuns = (await persistedRunsResponse.json()) as Array<{
            id: string;
            status: string;
            evidence_ids: string[];
          }>;
          assert.deepEqual(
            persistedRuns.map((record) => ({
              id: record.id,
              status: record.status,
              evidence_ids: record.evidence_ids,
            })),
            [
              {
                id: run.id,
                status: "passed",
                evidence_ids: [evidence.id],
              },
            ],
          );

          const persistedRunItemsResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/items`,
            {
              headers: {
                Cookie: adminCookie,
              },
            },
          );
          assert.equal(persistedRunItemsResponse.status, 200);
          const persistedRunItems =
            (await persistedRunItemsResponse.json()) as Array<{
              weighted_score?: number;
              result_asset_id?: string;
            }>;
          assert.equal(persistedRunItems.length, 1);
          assert.equal(persistedRunItems[0]?.weighted_score, 93);
          assert.equal(
            persistedRunItems[0]?.result_asset_id,
            seededIds.humanFinalAssetId,
          );

          const createLearningCandidateResponse = await fetch(
            `${secondServer.baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/learning-candidates`,
            {
              method: "POST",
              headers: {
                Cookie: adminCookie,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                actorRole: "admin",
                input: {
                  runId: run.id,
                  evidencePackId: finalized.evidence_pack.id,
                  reviewedCaseSnapshotId: seededIds.reviewedCaseSnapshotId,
                  candidateType: "prompt_optimization_candidate",
                  title: "Persistent evaluation promotion candidate",
                  proposalText:
                    "Promote the persistent proofreading candidate after restart-safe evidence review.",
                  createdBy: "forged-admin",
                  sourceAssetId: seededIds.humanFinalAssetId,
                },
              }),
            },
          );
          assert.equal(createLearningCandidateResponse.status, 201);
          const learningCandidate = (await createLearningCandidateResponse.json()) as {
            status: string;
            created_by: string;
            governed_evaluation_run_id?: string;
            governed_evidence_pack_id?: string;
          };
          assert.equal(learningCandidate.status, "pending_review");
          assert.equal(learningCandidate.created_by, "persistent-admin");
          assert.equal(learningCandidate.governed_evaluation_run_id, run.id);
          assert.equal(
            learningCandidate.governed_evidence_pack_id,
            finalized.evidence_pack.id,
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

test("persistent verification ops finalized-results route enforces latest_10 and last_7_days windows", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary persistent verification database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const seedPool = new Pool({ connectionString: databaseUrl });
    try {
      await seedPersistentWorkbenchData(seedPool);
      const verificationOpsRepository = new PostgresVerificationOpsRepository({
        client: seedPool,
      });
      await seedPersistentSuiteFinalizations(
        verificationOpsRepository,
        seededIds.screeningSuiteId,
        12,
      );

      const { server, baseUrl } = await startPersistentWorkbenchServer(databaseUrl);
      try {
        const adminCookie = await loginAsPersistentUser(baseUrl, "persistent.admin");

        const latestWindowResponse = await fetch(
          `${baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.screeningSuiteId}/finalized-results?history_window=latest_10`,
          {
            headers: { Cookie: adminCookie },
          },
        );
        assert.equal(latestWindowResponse.status, 200);
        const latestWindow = (await latestWindowResponse.json()) as Array<{
          run: { id: string };
          evidence: Array<{ id: string }>;
        }>;
        assert.equal(latestWindow.length, 10);
        assert.equal(latestWindow[0]?.run.id, "window-run-12");
        assert.equal(latestWindow[9]?.run.id, "window-run-03");
        assert.ok(latestWindow.every((entry) => entry.evidence.length === 1));

        const lastSevenDaysResponse = await fetch(
          `${baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.screeningSuiteId}/finalized-results?history_window=last_7_days`,
          {
            headers: { Cookie: adminCookie },
          },
        );
        assert.equal(lastSevenDaysResponse.status, 200);
        const lastSevenDays = (await lastSevenDaysResponse.json()) as Array<{
          run: { id: string };
        }>;
        assert.deepEqual(
          lastSevenDays.map((entry) => entry.run.id),
          [
            "window-run-12",
            "window-run-11",
            "window-run-10",
            "window-run-09",
            "window-run-08",
            "window-run-07",
            "window-run-06",
            "window-run-05",
          ],
        );
      } finally {
        await stopServer(server);
      }
    } finally {
      await seedPool.end();
    }
  });
});

async function seedPersistentSuiteFinalizations(
  verificationOpsRepository: PostgresVerificationOpsRepository,
  suiteId: string,
  count: number,
): Promise<void> {
  for (let index = 1; index <= count; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const timestamp = new Date(Date.UTC(2026, 3, index, 12, 0, 0)).toISOString();
    const runId = `window-run-${suffix}`;
    const evidenceId = `window-evidence-${suffix}`;
    const evidencePackId = `window-pack-${suffix}`;

    await verificationOpsRepository.saveVerificationEvidence({
      id: evidenceId,
      kind: "url",
      label: `Window evidence ${suffix}`,
      uri: `https://example.test/window/${suffix}`,
      created_at: timestamp,
    });
    await verificationOpsRepository.saveEvaluationRun({
      id: runId,
      suite_id: suiteId,
      run_item_count: 0,
      status: "passed",
      evidence_ids: [evidenceId],
      started_at: timestamp,
      finished_at: timestamp,
    });
    await verificationOpsRepository.saveEvaluationEvidencePack({
      id: evidencePackId,
      experiment_run_id: runId,
      summary_status: "recommended",
      score_summary: `Window summary ${suffix}`,
      created_at: timestamp,
    });
    await verificationOpsRepository.saveEvaluationPromotionRecommendation({
      id: `window-recommendation-${suffix}`,
      experiment_run_id: runId,
      evidence_pack_id: evidencePackId,
      status: "recommended",
      decision_reason: `Window recommendation ${suffix}`,
      created_at: timestamp,
    });
  }
}

async function seedPersistentWorkbenchData(pool: Pool): Promise<void> {
  const userRepository = new PostgresUserRepository({ client: pool });
  const knowledgeRepository = new PostgresKnowledgeRepository({ client: pool });
  const templateFamilyRepository = new PostgresTemplateFamilyRepository({
    client: pool,
  });
  const moduleTemplateRepository = new PostgresModuleTemplateRepository({
    client: pool,
  });
  const promptSkillRegistryRepository = new PostgresPromptSkillRegistryRepository({
    client: pool,
  });
  const executionGovernanceRepository = new PostgresExecutionGovernanceRepository({
    client: pool,
  });
  const sandboxProfileRepository = new PostgresSandboxProfileRepository({
    client: pool,
  });
  const agentProfileRepository = new PostgresAgentProfileRepository({
    client: pool,
  });
  const agentRuntimeRepository = new PostgresAgentRuntimeRepository({
    client: pool,
  });
  const runtimeBindingRepository = new PostgresRuntimeBindingRepository({
    client: pool,
  });
  const toolPermissionPolicyRepository =
    new PostgresToolPermissionPolicyRepository({
      client: pool,
    });
  const verificationOpsRepository = new PostgresVerificationOpsRepository({
    client: pool,
  });
  const modelRegistryRepository = new PostgresModelRegistryRepository({
    client: pool,
  });
  const modelRoutingPolicyRepository = new PostgresModelRoutingPolicyRepository({
    client: pool,
  });

  await userRepository.save({
    id: "persistent-user",
    username: "persistent.user",
    displayName: "Persistent User",
    role: "user",
    passwordHash:
      "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
  await userRepository.save({
    id: "persistent-screener",
    username: "persistent.screener",
    displayName: "Persistent Screener",
    role: "screener",
    passwordHash:
      "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
  await userRepository.save({
    id: "persistent-proofreader",
    username: "persistent.proofreader",
    displayName: "Persistent Proofreader",
    role: "proofreader",
    passwordHash:
      "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW",
  });
  await userRepository.save({
    id: "persistent-knowledge-reviewer",
    username: "persistent.knowledge_reviewer",
    displayName: "Persistent Knowledge Reviewer",
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

  await templateFamilyRepository.save({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    manuscript_type: "clinical_study",
    name: "Persistent Screening Family",
    status: "active",
  });
  await moduleTemplateRepository.save({
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Persistent screening prompt",
  });
  await moduleTemplateRepository.save({
    id: "12121212-ffff-4fff-8fff-ffffffffffff",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    module: "proofreading",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Persistent proofreading prompt",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "11111111-2222-4333-8444-555555555555",
    name: "persistent_screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "12121212-2222-4333-8444-555555555555",
    name: "persistent_proofreading_mainline",
    version: "1.0.0",
    status: "published",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "66666666-7777-4888-8999-aaaaaaaaaaaa",
    name: "persistent_screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["screening"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "12121212-7777-4888-8999-aaaaaaaaaaaa",
    name: "persistent_proofreading_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["proofreading"],
  });
  await knowledgeRepository.save({
    id: seededIds.screeningKnowledgeId,
    title: "Persistent screening knowledge",
    canonical_text: "Persistent screening knowledge for governed HTTP runs.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["ffffffff-ffff-4fff-8fff-ffffffffffff"],
  });
  await knowledgeRepository.save({
    id: seededIds.proofreadingKnowledgeId,
    title: "Persistent proofreading knowledge",
    canonical_text: "Persistent proofreading knowledge for governed HTTP runs.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["12121212-ffff-4fff-8fff-ffffffffffff"],
  });
  await executionGovernanceRepository.saveProfile({
    id: "bbbb1111-2222-4333-8444-555555555555",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    module_template_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    prompt_template_id: "11111111-2222-4333-8444-555555555555",
    skill_package_ids: ["66666666-7777-4888-8999-aaaaaaaaaaaa"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await executionGovernanceRepository.saveProfile({
    id: "12121212-1111-4333-8444-555555555555",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    module_template_id: "12121212-ffff-4fff-8fff-ffffffffffff",
    prompt_template_id: "12121212-2222-4333-8444-555555555555",
    skill_package_ids: ["12121212-7777-4888-8999-aaaaaaaaaaaa"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await verificationOpsRepository.saveVerificationCheckProfile({
    id: "bbbbbbbb-9999-4333-8444-555555555555",
    name: "Persistent Screening Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [],
    admin_only: true,
  });
  await verificationOpsRepository.saveVerificationCheckProfile({
    id: "12121212-8888-4333-8444-555555555555",
    name: "Persistent Proofreading Browser QA",
    check_type: "browser_qa",
    status: "published",
    tool_ids: [],
    admin_only: true,
  });
  await verificationOpsRepository.saveReleaseCheckProfile({
    id: "cccccccc-9999-4333-8444-555555555555",
    name: "Persistent Screening Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["bbbbbbbb-9999-4333-8444-555555555555"],
    admin_only: true,
  });
  await verificationOpsRepository.saveReleaseCheckProfile({
    id: "12121212-7777-4333-8444-555555555555",
    name: "Persistent Proofreading Release Gate",
    check_type: "deploy_verification",
    status: "published",
    verification_check_profile_ids: ["12121212-8888-4333-8444-555555555555"],
    admin_only: true,
  });
  await verificationOpsRepository.saveEvaluationSuite({
    id: seededIds.screeningSuiteId,
    name: "Persistent Screening Governed Evaluation",
    suite_type: "regression",
    status: "active",
    verification_check_profile_ids: ["bbbbbbbb-9999-4333-8444-555555555555"],
    module_scope: ["screening"],
    requires_production_baseline: false,
    supports_ab_comparison: true,
    hard_gate_policy: {
      must_use_deidentified_samples: true,
      requires_parsable_output: true,
    },
    score_weights: {
      structure: 0.2,
      terminology: 0.2,
      knowledge_coverage: 0.2,
      risk_detection: 0.2,
      human_edit_burden: 0.1,
      cost_and_latency: 0.1,
    },
    admin_only: true,
  });
  await verificationOpsRepository.saveEvaluationSuite({
    id: seededIds.proofreadingSuiteId,
    name: "Persistent Proofreading Governed Evaluation",
    suite_type: "regression",
    status: "active",
    verification_check_profile_ids: ["12121212-8888-4333-8444-555555555555"],
    module_scope: ["proofreading"],
    requires_production_baseline: false,
    supports_ab_comparison: true,
    hard_gate_policy: {
      must_use_deidentified_samples: true,
      requires_parsable_output: true,
    },
    score_weights: {
      structure: 0.2,
      terminology: 0.2,
      knowledge_coverage: 0.2,
      risk_detection: 0.2,
      human_edit_burden: 0.1,
      cost_and_latency: 0.1,
    },
    admin_only: true,
  });
  await sandboxProfileRepository.save({
    id: "bbbbbbbb-1111-4222-8333-444444444444",
    name: "Persistent Screening Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });
  await sandboxProfileRepository.save({
    id: "12121212-1111-4222-8333-444444444444",
    name: "Persistent Proofreading Sandbox",
    status: "active",
    sandbox_mode: "workspace_write",
    network_access: false,
    approval_required: true,
    allowed_tool_ids: [],
    admin_only: true,
  });
  await agentRuntimeRepository.save({
    id: "cccccccc-1111-4222-8333-444444444444",
    name: "Persistent Screening Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "bbbbbbbb-1111-4222-8333-444444444444",
    allowed_modules: ["screening"],
    runtime_slot: "screening",
    admin_only: true,
  });
  await agentRuntimeRepository.save({
    id: "12121212-3333-4222-8333-444444444444",
    name: "Persistent Proofreading Runtime",
    adapter: "deepagents",
    status: "active",
    sandbox_profile_id: "12121212-1111-4222-8333-444444444444",
    allowed_modules: ["proofreading"],
    runtime_slot: "proofreading",
    admin_only: true,
  });
  await agentProfileRepository.save({
    id: "dddddddd-1111-4222-8333-444444444444",
    name: "Persistent Screening Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["screening"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });
  await agentProfileRepository.save({
    id: "12121212-4444-4222-8333-444444444444",
    name: "Persistent Proofreading Executor",
    role_key: "subagent",
    status: "published",
    module_scope: ["proofreading"],
    manuscript_types: ["clinical_study"],
    admin_only: true,
  });
  await toolPermissionPolicyRepository.save({
    id: "eeee1111-2222-4333-8444-555555555555",
    name: "Persistent Screening Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });
  await toolPermissionPolicyRepository.save({
    id: "12121212-5555-4333-8444-555555555555",
    name: "Persistent Proofreading Policy",
    status: "active",
    default_mode: "read",
    allowed_tool_ids: [],
    high_risk_tool_ids: [],
    write_requires_confirmation: false,
    admin_only: true,
  });
  await modelRegistryRepository.save({
    id: seededIds.screeningModelId,
    provider: "openai",
    model_name: "persistent-screening-model",
    model_version: "2026-03-31",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  await modelRegistryRepository.save({
    id: seededIds.proofreadingModelId,
    provider: "openai",
    model_name: "persistent-proofreading-model",
    model_version: "2026-03-31",
    allowed_modules: ["proofreading"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    system_default_model_id: undefined,
    module_defaults: {
      screening: seededIds.screeningModelId,
      proofreading: seededIds.proofreadingModelId,
    },
    template_overrides: {},
  });
  await pool.query(
    `
      insert into manuscripts (
        id,
        title,
        manuscript_type,
        status,
        created_by,
        current_template_family_id,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (id) do update
      set
        title = excluded.title,
        manuscript_type = excluded.manuscript_type,
        status = excluded.status,
        created_by = excluded.created_by,
        current_template_family_id = excluded.current_template_family_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `,
    [
      seededIds.manuscriptId,
      "Persistent Seeded Workbench Manuscript",
      "clinical_study",
      "uploaded",
      "persistent-user",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "2026-03-31T08:00:00.000Z",
      "2026-03-31T08:00:00.000Z",
    ],
  );
  await pool.query(
    `
      insert into document_assets (
        id,
        manuscript_id,
        asset_type,
        status,
        storage_key,
        mime_type,
        source_module,
        created_by,
        version_no,
        is_current,
        file_name,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13
      )
      on conflict (id) do update
      set
        manuscript_id = excluded.manuscript_id,
        asset_type = excluded.asset_type,
        status = excluded.status,
        storage_key = excluded.storage_key,
        mime_type = excluded.mime_type,
        source_module = excluded.source_module,
        created_by = excluded.created_by,
        version_no = excluded.version_no,
        is_current = excluded.is_current,
        file_name = excluded.file_name,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `,
    [
      seededIds.originalAssetId,
      seededIds.manuscriptId,
      "original",
      "active",
      "persistent/uploads/seeded-original.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "upload",
      "persistent-user",
      1,
      true,
      "seeded-original.docx",
      "2026-03-31T08:01:00.000Z",
      "2026-03-31T08:01:00.000Z",
    ],
  );
  await runtimeBindingRepository.save({
    id: "ffff1111-2222-4333-8444-555555555555",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    runtime_id: "cccccccc-1111-4222-8333-444444444444",
    sandbox_profile_id: "bbbbbbbb-1111-4222-8333-444444444444",
    agent_profile_id: "dddddddd-1111-4222-8333-444444444444",
    tool_permission_policy_id: "eeee1111-2222-4333-8444-555555555555",
    prompt_template_id: "11111111-2222-4333-8444-555555555555",
    skill_package_ids: ["66666666-7777-4888-8999-aaaaaaaaaaaa"],
    execution_profile_id: "bbbb1111-2222-4333-8444-555555555555",
    verification_check_profile_ids: ["bbbbbbbb-9999-4333-8444-555555555555"],
    evaluation_suite_ids: [seededIds.screeningSuiteId],
    release_check_profile_id: "cccccccc-9999-4333-8444-555555555555",
    status: "active",
    version: 1,
  });
  await runtimeBindingRepository.save({
    id: "12121212-6666-4333-8444-555555555555",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    runtime_id: "12121212-3333-4222-8333-444444444444",
    sandbox_profile_id: "12121212-1111-4222-8333-444444444444",
    agent_profile_id: "12121212-4444-4222-8333-444444444444",
    tool_permission_policy_id: "12121212-5555-4333-8444-555555555555",
    prompt_template_id: "12121212-2222-4333-8444-555555555555",
    skill_package_ids: ["12121212-7777-4888-8999-aaaaaaaaaaaa"],
    execution_profile_id: "12121212-1111-4333-8444-555555555555",
    verification_check_profile_ids: ["12121212-8888-4333-8444-555555555555"],
    evaluation_suite_ids: [seededIds.proofreadingSuiteId],
    release_check_profile_id: "12121212-7777-4333-8444-555555555555",
    status: "active",
    version: 1,
  });
}

async function seedPersistentVerificationLearningFixtures(
  pool: Pool,
): Promise<void> {
  await pool.query(
    `
      insert into document_assets (
        id,
        manuscript_id,
        asset_type,
        status,
        storage_key,
        mime_type,
        parent_asset_id,
        source_module,
        created_by,
        version_no,
        is_current,
        file_name,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      on conflict (id) do update
      set
        manuscript_id = excluded.manuscript_id,
        asset_type = excluded.asset_type,
        status = excluded.status,
        storage_key = excluded.storage_key,
        mime_type = excluded.mime_type,
        parent_asset_id = excluded.parent_asset_id,
        source_module = excluded.source_module,
        created_by = excluded.created_by,
        version_no = excluded.version_no,
        is_current = excluded.is_current,
        file_name = excluded.file_name,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `,
    [
      seededIds.humanFinalAssetId,
      seededIds.manuscriptId,
      "human_final_docx",
      "active",
      "persistent/learning/human-final.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      seededIds.originalAssetId,
      "manual",
      "persistent-admin",
      2,
      false,
      "persistent-human-final.docx",
      "2026-03-31T08:02:00.000Z",
      "2026-03-31T08:02:00.000Z",
    ],
  );
  await pool.query(
    `
      insert into document_assets (
        id,
        manuscript_id,
        asset_type,
        status,
        storage_key,
        mime_type,
        parent_asset_id,
        source_module,
        created_by,
        version_no,
        is_current,
        file_name,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      on conflict (id) do update
      set
        manuscript_id = excluded.manuscript_id,
        asset_type = excluded.asset_type,
        status = excluded.status,
        storage_key = excluded.storage_key,
        mime_type = excluded.mime_type,
        parent_asset_id = excluded.parent_asset_id,
        source_module = excluded.source_module,
        created_by = excluded.created_by,
        version_no = excluded.version_no,
        is_current = excluded.is_current,
        file_name = excluded.file_name,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `,
    [
      "dededede-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      seededIds.manuscriptId,
      "learning_snapshot_attachment",
      "active",
      "persistent/learning/reviewed-case-snapshot.bin",
      "application/octet-stream",
      seededIds.humanFinalAssetId,
      "learning",
      "persistent-admin",
      1,
      false,
      "persistent-reviewed-snapshot.bin",
      "2026-03-31T08:03:00.000Z",
      "2026-03-31T08:03:00.000Z",
    ],
  );
  await pool.query(
    `
      insert into reviewed_case_snapshots (
        id,
        manuscript_id,
        module,
        manuscript_type,
        human_final_asset_id,
        deidentification_passed,
        snapshot_asset_id,
        created_by,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (id) do update
      set
        manuscript_id = excluded.manuscript_id,
        module = excluded.module,
        manuscript_type = excluded.manuscript_type,
        human_final_asset_id = excluded.human_final_asset_id,
        deidentification_passed = excluded.deidentification_passed,
        snapshot_asset_id = excluded.snapshot_asset_id,
        created_by = excluded.created_by,
        created_at = excluded.created_at
    `,
    [
      seededIds.reviewedCaseSnapshotId,
      seededIds.manuscriptId,
      "proofreading",
      "clinical_study",
      seededIds.humanFinalAssetId,
      true,
      "dededede-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "persistent-admin",
      "2026-03-31T08:03:30.000Z",
    ],
  );
}

async function loginAsPersistentUser(
  baseUrl: string,
  username: string,
): Promise<string> {
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
  assert.ok(setCookie, "Expected persistent workbench login to return a session cookie.");
  return setCookie.split(";")[0] ?? "";
}

async function startPersistentWorkbenchServer(
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
    }),
    uploadRootDir: input.uploadRootDir,
  });

  server.on("close", () => {
    void pool.end();
  });

  return startHttpTestServer(server);
}

const stopServer = stopHttpTestServer;
