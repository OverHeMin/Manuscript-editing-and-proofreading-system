import { once } from "node:events";
import { mkdtemp, rm, stat } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import {
  loginAsDemoUser,
  startWorkbenchServer,
  stopServer,
} from "./support/workbench-runtime.ts";

test("workbench http routes upload a manuscript and expose manuscript, asset, job, and export reads", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-workbench-http-"));
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.user");
    const uploadResponse = await fetch(`${baseUrl}/api/v1/manuscripts/upload`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Uploaded Through HTTP",
        manuscriptType: "review",
        createdBy: "forged-user",
        fileName: "uploaded-through-http.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "RG93bmxvYWQgbWUgdGhyb3VnaCBIVFRQ",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      manuscript: {
        id: string;
        created_by: string;
      };
      asset: {
        id: string;
        created_by: string;
        asset_type: string;
      };
      job: {
        id: string;
        requested_by: string;
        module: string;
      };
    };

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploaded.manuscript.created_by, "dev-user");
    assert.equal(uploaded.asset.created_by, "dev-user");
    assert.equal(uploaded.asset.asset_type, "original");
    assert.equal(uploaded.job.requested_by, "dev-user");
    assert.equal(uploaded.job.module, "upload");

    const manuscriptResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const manuscript = (await manuscriptResponse.json()) as { id: string };

    const assetsResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/assets`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const assets = (await assetsResponse.json()) as Array<{ id: string }>;

    const jobResponse = await fetch(`${baseUrl}/api/v1/jobs/${uploaded.job.id}`, {
      headers: {
        Cookie: cookie,
      },
    });
    const job = (await jobResponse.json()) as { id: string };

    const exportResponse = await fetch(
      `${baseUrl}/api/v1/document-pipeline/export-current-asset`,
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
      asset: {
        id: string;
      };
      download: {
        storage_key: string;
        url: string;
      };
    };
    assert.ok(exported.download.url, "Expected export payload to include a download URL.");

    const downloadResponse = await fetch(`${baseUrl}${exported.download.url}`, {
      headers: {
        Cookie: cookie,
      },
    });
    const downloadedBody = Buffer.from(await downloadResponse.arrayBuffer()).toString("utf8");

    assert.equal(manuscriptResponse.status, 200);
    assert.equal(assetsResponse.status, 200);
    assert.equal(jobResponse.status, 200);
    assert.equal(exportResponse.status, 200);
    assert.equal(downloadResponse.status, 200);
    assert.equal(manuscript.id, uploaded.manuscript.id);
    assert.deepEqual(assets.map((asset) => asset.id), [uploaded.asset.id]);
    assert.equal(job.id, uploaded.job.id);
    assert.equal(exported.manuscript_id, uploaded.manuscript.id);
    assert.equal(exported.asset.id, uploaded.asset.id);
    assert.equal(
      exported.download.url,
      `/api/v1/document-assets/${uploaded.asset.id}/download`,
    );
    assert.match(
      downloadResponse.headers.get("content-type") ?? "",
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i,
    );
    assert.match(
      downloadResponse.headers.get("content-disposition") ?? "",
      /filename="?uploaded-through-http\.docx"?/i,
    );
    assert.equal(downloadedBody, "Download me through HTTP");
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("workbench http screening route runs with the authenticated screener context", async () => {
  const { server, baseUrl, seededIds } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.screener");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const response = await fetch(`${baseUrl}/api/v1/modules/screening/run`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: seededIds.manuscriptId,
        parentAssetId: seededIds.originalAssetId,
        requestedBy: "forged-requester",
        actorRole: "admin",
        storageKey: "runs/http/screening/report.md",
        fileName: "screening-report.md",
      }),
    });
    const body = (await response.json()) as {
      job: {
        module: string;
        requested_by: string;
      };
      asset: {
        id: string;
        asset_type: string;
        created_by: string;
        parent_asset_id?: string;
      };
      knowledge_item_ids: string[];
      model_id: string;
      agent_execution_log_id?: string;
      snapshot_id?: string;
    };

    assert.equal(response.status, 201);
    assert.equal(body.job.module, "screening");
    assert.equal(body.job.requested_by, "dev-screener");
    assert.equal(body.asset.asset_type, "screening_report");
    assert.equal(body.asset.created_by, "dev-screener");
    assert.equal(body.asset.parent_asset_id, seededIds.originalAssetId);
    assert.deepEqual(body.knowledge_item_ids, [seededIds.screeningKnowledgeId]);
    assert.equal(body.model_id, seededIds.screeningModelId);
    assert.ok(body.agent_execution_log_id);
    assert.ok(body.snapshot_id);

    const runsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.screeningSuiteId}/runs`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    const runs = (await runsResponse.json()) as Array<{
      id: string;
      sample_set_id?: string;
      release_check_profile_id?: string;
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
    assert.equal(runs[0]?.sample_set_id, undefined);
    assert.equal(runs[0]?.release_check_profile_id, "release-profile-screening-1");
    assert.equal(runs[0]?.run_item_count, 0);
    assert.deepEqual(runs[0]?.governed_source, {
      source_kind: "governed_module_execution",
      manuscript_id: seededIds.manuscriptId,
      source_module: "screening",
      agent_execution_log_id: body.agent_execution_log_id,
      execution_snapshot_id: body.snapshot_id,
      output_asset_id: body.asset.id,
    });

    const runItemsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${runs[0]!.id}/items`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    assert.equal(runItemsResponse.status, 200);
    assert.deepEqual(await runItemsResponse.json(), []);
  } finally {
    await stopServer(server);
  }
});

test("workbench http editing route runs with the authenticated editor context", async () => {
  const { server, baseUrl, seededIds } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.editor");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const response = await fetch(`${baseUrl}/api/v1/modules/editing/run`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: seededIds.manuscriptId,
        parentAssetId: seededIds.originalAssetId,
        requestedBy: "forged-requester",
        actorRole: "admin",
        storageKey: "runs/http/editing/final.docx",
        fileName: "editing-final.docx",
      }),
    });
    const body = (await response.json()) as {
      job: {
        module: string;
        requested_by: string;
      };
      asset: {
        id: string;
        asset_type: string;
        created_by: string;
        parent_asset_id?: string;
      };
      knowledge_item_ids: string[];
      model_id: string;
      agent_execution_log_id?: string;
      snapshot_id?: string;
    };

    assert.equal(response.status, 201);
    assert.equal(body.job.module, "editing");
    assert.equal(body.job.requested_by, "dev-editor");
    assert.equal(body.asset.asset_type, "edited_docx");
    assert.equal(body.asset.created_by, "dev-editor");
    assert.equal(body.asset.parent_asset_id, seededIds.originalAssetId);
    assert.deepEqual(body.knowledge_item_ids, [seededIds.editingKnowledgeId]);
    assert.equal(body.model_id, seededIds.editingModelId);
    assert.ok(body.agent_execution_log_id);
    assert.ok(body.snapshot_id);

    const runsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.editingSuiteId}/runs`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    const runs = (await runsResponse.json()) as Array<{
      id: string;
      sample_set_id?: string;
      release_check_profile_id?: string;
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
    assert.equal(runs[0]?.sample_set_id, undefined);
    assert.equal(runs[0]?.release_check_profile_id, "release-profile-editing-1");
    assert.equal(runs[0]?.run_item_count, 0);
    assert.deepEqual(runs[0]?.governed_source, {
      source_kind: "governed_module_execution",
      manuscript_id: seededIds.manuscriptId,
      source_module: "editing",
      agent_execution_log_id: body.agent_execution_log_id,
      execution_snapshot_id: body.snapshot_id,
      output_asset_id: body.asset.id,
    });

    const runItemsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${runs[0]!.id}/items`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    assert.equal(runItemsResponse.status, 200);
    assert.deepEqual(await runItemsResponse.json(), []);
  } finally {
    await stopServer(server);
  }
});

test("workbench http proofreading routes create a draft and then finalize against the pinned draft context", async () => {
  const { server, baseUrl, seededIds } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const draftResponse = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/draft`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: seededIds.manuscriptId,
          parentAssetId: seededIds.originalAssetId,
          requestedBy: "forged-requester",
          actorRole: "admin",
          storageKey: "runs/http/proofreading/draft.md",
          fileName: "proofreading-draft.md",
        }),
      },
    );
    const draft = (await draftResponse.json()) as {
      asset: {
        id: string;
        asset_type: string;
      };
      snapshot_id?: string;
      agent_execution_log_id?: string;
      model_id: string;
      knowledge_item_ids: string[];
    };

    assert.equal(draftResponse.status, 201);
    assert.equal(draft.asset.asset_type, "proofreading_draft_report");
    assert.equal(draft.model_id, seededIds.proofreadingModelId);
    assert.deepEqual(draft.knowledge_item_ids, [seededIds.proofreadingKnowledgeId]);
    assert.ok(draft.snapshot_id);
    assert.ok(draft.agent_execution_log_id);

    const draftRunsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.proofreadingSuiteId}/runs`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    assert.equal(draftRunsResponse.status, 200);
    assert.deepEqual(await draftRunsResponse.json(), []);

    const finalizeResponse = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/finalize`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: seededIds.manuscriptId,
          draftAssetId: draft.asset.id,
          requestedBy: "forged-requester",
          actorRole: "admin",
          storageKey: "runs/http/proofreading/final.docx",
          fileName: "proofreading-final.docx",
        }),
      },
    );
    const finalized = (await finalizeResponse.json()) as {
      asset: {
        id: string;
        asset_type: string;
        parent_asset_id?: string;
      };
      snapshot_id?: string;
      agent_execution_log_id?: string;
      job: {
        payload?: Record<string, unknown>;
      };
      model_id: string;
      knowledge_item_ids: string[];
    };

    assert.equal(finalizeResponse.status, 201);
    assert.equal(finalized.asset.asset_type, "final_proof_annotated_docx");
    assert.equal(finalized.asset.parent_asset_id, draft.asset.id);
    assert.equal(finalized.model_id, seededIds.proofreadingModelId);
    assert.deepEqual(finalized.knowledge_item_ids, [
      seededIds.proofreadingKnowledgeId,
    ]);
    assert.ok(finalized.snapshot_id);
    assert.equal(
      finalized.agent_execution_log_id,
      draft.agent_execution_log_id,
    );
    assert.equal(finalized.job.payload?.draftSnapshotId, draft.snapshot_id);

    const finalizedRunsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.proofreadingSuiteId}/runs`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    const finalizedRuns = (await finalizedRunsResponse.json()) as Array<{
      id: string;
      sample_set_id?: string;
      release_check_profile_id?: string;
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
    assert.equal(finalizedRunsResponse.status, 200);
    assert.equal(finalizedRuns.length, 1);
    assert.equal(
      finalizedRuns[0]?.release_check_profile_id,
      "release-profile-proofreading-1",
    );
    assert.equal(finalizedRuns[0]?.sample_set_id, undefined);
    assert.equal(finalizedRuns[0]?.run_item_count, 0);
    assert.deepEqual(finalizedRuns[0]?.governed_source, {
      source_kind: "governed_module_execution",
      manuscript_id: seededIds.manuscriptId,
      source_module: "proofreading",
      agent_execution_log_id: draft.agent_execution_log_id,
      execution_snapshot_id: finalized.snapshot_id,
      output_asset_id: finalized.asset.id,
    });

    const finalizedRunItemsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${finalizedRuns[0]!.id}/items`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    assert.equal(finalizedRunItemsResponse.status, 200);
    assert.deepEqual(await finalizedRunItemsResponse.json(), []);
  } finally {
    await stopServer(server);
  }
});

test("workbench http export download route materializes a proofreading final docx artifact", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-workbench-download-"));
  const { server, baseUrl, seededIds } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const draftResponse = await fetch(`${baseUrl}/api/v1/modules/proofreading/draft`, {
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
        storageKey: "runs/http-download/proofreading/draft.md",
        fileName: "proofreading-draft.md",
      }),
    });
    const draft = (await draftResponse.json()) as {
      asset: {
        id: string;
      };
    };
    assert.equal(draftResponse.status, 201);

    const finalizeResponse = await fetch(`${baseUrl}/api/v1/modules/proofreading/finalize`, {
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
        storageKey: "runs/http-download/proofreading/final.docx",
        fileName: "proofreading-final.docx",
      }),
    });
    const finalized = (await finalizeResponse.json()) as {
      asset: {
        id: string;
      };
    };
    assert.equal(finalizeResponse.status, 201);

    const exportResponse = await fetch(
      `${baseUrl}/api/v1/document-pipeline/export-current-asset`,
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
      asset: {
        id: string;
      };
      download: {
        storage_key: string;
        file_name?: string;
        url: string;
      };
    };
    assert.ok(exported.download.url, "Expected export payload to include a download URL.");

    const downloadResponse = await fetch(`${baseUrl}${exported.download.url}`, {
      headers: {
        Cookie: cookie,
      },
    });
    const downloadedBytes = Buffer.from(await downloadResponse.arrayBuffer());

    assert.equal(exportResponse.status, 200);
    assert.equal(exported.asset.id, finalized.asset.id);
    assert.equal(
      exported.download.url,
      `/api/v1/document-assets/${finalized.asset.id}/download`,
    );
    assert.equal(downloadResponse.status, 200);
    assert.equal(exported.download.file_name, "proofreading-final.docx");
    assert.match(
      downloadResponse.headers.get("content-type") ?? "",
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i,
    );
    assert.match(
      downloadResponse.headers.get("content-disposition") ?? "",
      /filename="?proofreading-final\.docx"?/i,
    );
    assert.equal(downloadedBytes.subarray(0, 2).toString("utf8"), "PK");

    const materializedPath = path.join(
      uploadRootDir,
      ...exported.download.storage_key.split("/"),
    );
    const materializedStats = await stat(materializedPath);
    assert.equal(materializedStats.isFile(), true);
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("verification ops http routes support an admin evaluation flow and learning handoff", async () => {
  const { server, baseUrl } = await startDefaultDemoServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const createSampleSetResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-sample-sets`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            name: "Demo Editing Evaluation Samples",
            module: "editing",
            sampleItemInputs: [
              {
                reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
                riskTags: ["structure"],
              },
            ],
          },
        }),
      },
    );
    assert.equal(createSampleSetResponse.status, 201);
    const sampleSet = (await createSampleSetResponse.json()) as {
      id: string;
      status: string;
      sample_count: number;
    };
    assert.equal(sampleSet.status, "draft");
    assert.equal(sampleSet.sample_count, 1);

    const publishSampleSetResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-sample-sets/${sampleSet.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
        }),
      },
    );
    assert.equal(publishSampleSetResponse.status, 200);

    const createCheckProfileResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/check-profiles`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            name: "Demo Browser QA Check",
            checkType: "browser_qa",
          },
        }),
      },
    );
    assert.equal(createCheckProfileResponse.status, 201);
    const checkProfile = (await createCheckProfileResponse.json()) as {
      id: string;
      status: string;
    };
    assert.equal(checkProfile.status, "draft");

    const publishCheckProfileResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/check-profiles/${checkProfile.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
        }),
      },
    );
    assert.equal(publishCheckProfileResponse.status, 200);

    const createSuiteResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            name: "Demo Editing Regression Suite",
            suiteType: "regression",
            verificationCheckProfileIds: [checkProfile.id],
            moduleScope: ["editing"],
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
      status: string;
    };
    assert.equal(suite.status, "draft");

    const activateSuiteResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/activate`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
        }),
      },
    );
    assert.equal(activateSuiteResponse.status, 200);

    const createRunResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            suiteId: suite.id,
            sampleSetId: sampleSet.id,
            baselineBinding: {
              lane: "baseline",
              modelId: "demo-model-prod-1",
              runtimeId: "demo-runtime-prod-1",
              promptTemplateId: "demo-prompt-prod-1",
              skillPackageIds: ["demo-skill-prod-1"],
              moduleTemplateId: "demo-template-prod-1",
            },
            candidateBinding: {
              lane: "candidate",
              modelId: "demo-model-candidate-1",
              runtimeId: "demo-runtime-prod-1",
              promptTemplateId: "demo-prompt-prod-1",
              skillPackageIds: ["demo-skill-prod-1"],
              moduleTemplateId: "demo-template-prod-1",
            },
          },
        }),
      },
    );
    assert.equal(createRunResponse.status, 201);
    const run = (await createRunResponse.json()) as {
      id: string;
      status: string;
      run_item_count: number;
    };
    assert.equal(run.status, "queued");
    assert.equal(run.run_item_count, 1);

    const listRunItemsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/items`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(listRunItemsResponse.status, 200);
    const runItems = (await listRunItemsResponse.json()) as Array<{
      id: string;
      lane: string;
    }>;
    assert.equal(runItems.length, 1);
    assert.equal(runItems[0]?.lane, "candidate");

    const recordRunItemResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-run-items/${runItems[0]?.id}/result`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            runItemId: runItems[0]?.id,
            resultAssetId: "human-final-demo-1",
            hardGatePassed: true,
            weightedScore: 91,
            diffSummary: "Candidate improves editing structure stability.",
          },
        }),
      },
    );
    assert.equal(recordRunItemResponse.status, 200);

    const recordEvidenceResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evidence`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            kind: "url",
            label: "Demo evaluation browser QA",
            uri: "https://example.test/evidence/browser-qa",
          },
        }),
      },
    );
    assert.equal(recordEvidenceResponse.status, 201);
    const evidence = (await recordEvidenceResponse.json()) as { id: string };

    const completeRunResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/complete`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
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
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/finalize`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
        }),
      },
    );
    assert.equal(finalizeRunResponse.status, 200);
    const finalized = (await finalizeRunResponse.json()) as {
      run: {
        id: string;
        status: string;
      };
      evidence_pack: {
        id: string;
        summary_status: string;
      };
      recommendation: {
        status: string;
      };
    };
    assert.equal(finalized.run.id, run.id);
    assert.equal(finalized.run.status, "passed");
    assert.equal(finalized.evidence_pack.summary_status, "recommended");
    assert.equal(finalized.recommendation.status, "recommended");

    const finalizedResultResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/finalized-result`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(finalizedResultResponse.status, 200);
    const finalizedResult = (await finalizedResultResponse.json()) as {
      evidence_pack: { id: string; summary_status: string };
      recommendation: { status: string };
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

    const suiteFinalizedResultsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/finalized-results`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(suiteFinalizedResultsResponse.status, 200);
    const suiteFinalizedResults =
      (await suiteFinalizedResultsResponse.json()) as Array<{
        run: { id: string };
        evidence_pack: { id: string; summary_status: string };
        recommendation: { status: string };
      }>;
    assert.equal(suiteFinalizedResults.length, 1);
    assert.equal(suiteFinalizedResults[0]?.run.id, run.id);
    assert.equal(suiteFinalizedResults[0]?.evidence_pack.id, finalized.evidence_pack.id);
    assert.equal(
      suiteFinalizedResults[0]?.recommendation.status,
      finalized.recommendation.status,
    );

    const runEvidenceResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/evidence`,
      {
        headers: {
          Cookie: cookie,
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
    assert.equal(runEvidence[0]?.label, "Demo evaluation browser QA");
    assert.equal(runEvidence[0]?.uri, "https://example.test/evidence/browser-qa");

    const evidenceByIdResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evidence/${evidence.id}`,
      {
        headers: {
          Cookie: cookie,
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
    assert.equal(evidenceById.label, "Demo evaluation browser QA");
    assert.equal(evidenceById.uri, "https://example.test/evidence/browser-qa");

    const createLearningCandidateResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/learning-candidates`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            runId: run.id,
            evidencePackId: finalized.evidence_pack.id,
            reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
            candidateType: "prompt_optimization_candidate",
            title: "Demo evaluation prompt promotion",
            proposalText: "Promote the candidate editing prompt after regression approval.",
            createdBy: "forged-admin",
            sourceAssetId: "human-final-demo-1",
          },
        }),
      },
    );
    assert.equal(createLearningCandidateResponse.status, 201);
    const learningCandidate = (await createLearningCandidateResponse.json()) as {
      type: string;
      status: string;
      created_by: string;
      governed_evaluation_run_id?: string;
      governed_evidence_pack_id?: string;
    };
    assert.equal(learningCandidate.type, "prompt_optimization_candidate");
    assert.equal(learningCandidate.status, "pending_review");
    assert.equal(learningCandidate.created_by, "dev-admin");
    assert.equal(learningCandidate.governed_evaluation_run_id, run.id);
    assert.equal(
      learningCandidate.governed_evidence_pack_id,
      finalized.evidence_pack.id,
    );
  } finally {
    await stopServer(server);
  }
});

async function startDefaultDemoServer(): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
}> {
  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
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

test("workbench http proofreading publish route creates a human-final asset and advances export resolution", async () => {
  const { server, baseUrl, seededIds } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const draftResponse = await fetch(`${baseUrl}/api/v1/modules/proofreading/draft`, {
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
        storageKey: "runs/http-human-final/proofreading/draft.md",
        fileName: "proofreading-draft.md",
      }),
    });
    const draft = (await draftResponse.json()) as {
      asset: {
        id: string;
      };
    };
    assert.equal(draftResponse.status, 201);

    const finalizeResponse = await fetch(`${baseUrl}/api/v1/modules/proofreading/finalize`, {
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
        storageKey: "runs/http-human-final/proofreading/final.docx",
        fileName: "proofreading-final.docx",
      }),
    });
    const finalized = (await finalizeResponse.json()) as {
      asset: {
        id: string;
      };
    };
    assert.equal(finalizeResponse.status, 201);

    const publishResponse = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/publish-human-final`,
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
          storageKey: "runs/http-human-final/proofreading/human-final.docx",
          fileName: "human-final.docx",
        }),
      },
    );
    const published = (await publishResponse.json()) as {
      job: {
        id: string;
        module: string;
        job_type: string;
        requested_by: string;
        payload?: Record<string, unknown>;
      };
      asset: {
        id: string;
        asset_type: string;
        created_by: string;
        source_module: string;
        parent_asset_id?: string;
      };
    };

    const manuscriptResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const manuscript = (await manuscriptResponse.json()) as {
      current_proofreading_asset_id?: string;
    };

    const exportResponse = await fetch(
      `${baseUrl}/api/v1/document-pipeline/export-current-asset`,
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
      asset: {
        id: string;
        asset_type: string;
      };
    };

    assert.equal(publishResponse.status, 201);
    assert.equal(published.job.module, "manual");
    assert.equal(published.job.job_type, "publish_human_final");
    assert.equal(published.job.requested_by, "dev-proofreader");
    assert.equal(published.job.payload?.sourceAssetId, finalized.asset.id);
    assert.equal(published.asset.asset_type, "human_final_docx");
    assert.equal(published.asset.created_by, "dev-proofreader");
    assert.equal(published.asset.source_module, "manual");
    assert.equal(published.asset.parent_asset_id, finalized.asset.id);
    assert.equal(manuscriptResponse.status, 200);
    assert.equal(manuscript.current_proofreading_asset_id, published.asset.id);
    assert.equal(exportResponse.status, 200);
    assert.equal(exported.asset.id, published.asset.id);
    assert.equal(exported.asset.asset_type, "human_final_docx");
  } finally {
    await stopServer(server);
  }
});
