import test from "node:test";
import assert from "node:assert/strict";
import {
  loginAsDemoUser,
  startWorkbenchServer,
  stopServer,
} from "./support/workbench-runtime.ts";

test("workbench http routes upload a manuscript and expose manuscript, asset, job, and export reads", async () => {
  const { server, baseUrl } = await startWorkbenchServer();

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
        storageKey: "uploads/http/uploaded-through-http.docx",
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
    };

    assert.equal(manuscriptResponse.status, 200);
    assert.equal(assetsResponse.status, 200);
    assert.equal(jobResponse.status, 200);
    assert.equal(exportResponse.status, 200);
    assert.equal(manuscript.id, uploaded.manuscript.id);
    assert.deepEqual(assets.map((asset) => asset.id), [uploaded.asset.id]);
    assert.equal(job.id, uploaded.job.id);
    assert.equal(exported.manuscript_id, uploaded.manuscript.id);
    assert.equal(exported.asset.id, uploaded.asset.id);
  } finally {
    await stopServer(server);
  }
});

test("workbench http screening route runs with the authenticated screener context", async () => {
  const { server, baseUrl, seededIds } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.screener");
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
  } finally {
    await stopServer(server);
  }
});

test("workbench http editing route runs with the authenticated editor context", async () => {
  const { server, baseUrl, seededIds } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.editor");
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
  } finally {
    await stopServer(server);
  }
});

test("workbench http proofreading routes create a draft and then finalize against the pinned draft context", async () => {
  const { server, baseUrl, seededIds } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
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
  } finally {
    await stopServer(server);
  }
});
