import test from "node:test";
import assert from "node:assert/strict";
import {
  createManuscriptWorkbenchController,
} from "../src/features/manuscript-workbench/index.ts";

test("manuscript workbench controller uploads a manuscript and hydrates workspace", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/manuscripts/upload") {
        return {
          status: 201,
          body: {
            manuscript: {
              id: "manuscript-1",
              title: "Uploaded review",
              manuscript_type: "review",
              status: "uploaded",
              created_by: "user-1",
              created_at: "2026-03-31T09:00:00.000Z",
              updated_at: "2026-03-31T09:00:00.000Z",
            },
            asset: {
              id: "asset-original-1",
              manuscript_id: "manuscript-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/review/review.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "user-1",
              version_no: 1,
              is_current: true,
              file_name: "review.docx",
              created_at: "2026-03-31T09:00:00.000Z",
              updated_at: "2026-03-31T09:00:00.000Z",
            },
            job: {
              id: "job-upload-1",
              manuscript_id: "manuscript-1",
              module: "upload",
              job_type: "manuscript_upload",
              status: "queued",
              requested_by: "user-1",
              attempt_count: 0,
              created_at: "2026-03-31T09:00:00.000Z",
              updated_at: "2026-03-31T09:00:00.000Z",
            },
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-1",
            title: "Uploaded review",
            manuscript_type: "review",
            status: "uploaded",
            created_by: "user-1",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T09:00:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/manuscripts/manuscript-1/assets"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "asset-original-1",
              manuscript_id: "manuscript-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/review/review.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "user-1",
              version_no: 1,
              is_current: true,
              file_name: "review.docx",
              created_at: "2026-03-31T09:00:00.000Z",
              updated_at: "2026-03-31T09:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.uploadManuscriptAndLoad({
    title: "Uploaded review",
    manuscriptType: "review",
    createdBy: "forged-user",
    fileName: "review.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/review/review.docx",
  });

  assert.equal(result.upload.job.id, "job-upload-1");
  assert.equal(result.workspace.manuscript.id, "manuscript-1");
  assert.equal(result.workspace.assets.length, 1);
  assert.equal(result.workspace.currentAsset?.id, "asset-original-1");
  assert.equal(result.workspace.suggestedParentAsset?.id, "asset-original-1");
  assert.equal(result.workspace.latestProofreadingDraftAsset, null);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/manuscripts/upload",
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
    ],
  );
  assert.deepEqual(requests[0]?.body, {
    title: "Uploaded review",
    manuscriptType: "review",
    createdBy: "forged-user",
    fileName: "review.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/review/review.docx",
  });
});

test("manuscript workbench controller forwards inline file content uploads without requiring a storage key", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/manuscripts/upload") {
        return {
          status: 201,
          body: {
            manuscript: {
              id: "manuscript-inline-1",
              title: "Inline upload",
              manuscript_type: "clinical_study",
              status: "uploaded",
              created_by: "user-1",
              created_at: "2026-03-31T11:00:00.000Z",
              updated_at: "2026-03-31T11:00:00.000Z",
            },
            asset: {
              id: "asset-inline-1",
              manuscript_id: "manuscript-inline-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/2026/03/31/inline-upload.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "user-1",
              version_no: 1,
              is_current: true,
              file_name: "inline-upload.docx",
              created_at: "2026-03-31T11:00:00.000Z",
              updated_at: "2026-03-31T11:00:00.000Z",
            },
            job: {
              id: "job-inline-1",
              manuscript_id: "manuscript-inline-1",
              module: "upload",
              job_type: "manuscript_upload",
              status: "queued",
              requested_by: "user-1",
              attempt_count: 0,
              created_at: "2026-03-31T11:00:00.000Z",
              updated_at: "2026-03-31T11:00:00.000Z",
            },
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-inline-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-inline-1",
            title: "Inline upload",
            manuscript_type: "clinical_study",
            status: "uploaded",
            created_by: "user-1",
            created_at: "2026-03-31T11:00:00.000Z",
            updated_at: "2026-03-31T11:00:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/manuscripts/manuscript-inline-1/assets"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "asset-inline-1",
              manuscript_id: "manuscript-inline-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/2026/03/31/inline-upload.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "user-1",
              version_no: 1,
              is_current: true,
              file_name: "inline-upload.docx",
              created_at: "2026-03-31T11:00:00.000Z",
              updated_at: "2026-03-31T11:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  await controller.uploadManuscriptAndLoad({
    title: "Inline upload",
    manuscriptType: "clinical_study",
    createdBy: "forged-user",
    fileName: "inline-upload.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileContentBase64: "SGVsbG8gV29ybGQ=",
  });

  assert.deepEqual(requests[0]?.body, {
    title: "Inline upload",
    manuscriptType: "clinical_study",
    createdBy: "forged-user",
    fileName: "inline-upload.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileContentBase64: "SGVsbG8gV29ybGQ=",
  });
});

test("manuscript workbench controller runs proofreading draft and finalize flows while reloading workspace", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  let assetPhase: "draft" | "final" = "draft";
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/modules/proofreading/draft") {
        assetPhase = "draft";
        return {
          status: 201,
          body: {
            job: {
              id: "job-proof-draft-1",
              module: "proofreading",
              job_type: "proofreading_draft",
              status: "completed",
              requested_by: "proofreader-1",
              attempt_count: 1,
              created_at: "2026-03-31T10:00:00.000Z",
              updated_at: "2026-03-31T10:01:00.000Z",
            },
            asset: {
              id: "asset-proof-draft-1",
              manuscript_id: "manuscript-1",
              asset_type: "proofreading_draft_report",
              status: "active",
              storage_key: "runs/proofreading/draft.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-edited-1",
              source_module: "proofreading",
              source_job_id: "job-proof-draft-1",
              created_by: "proofreader-1",
              version_no: 3,
              is_current: false,
              file_name: "proof-draft.md",
              created_at: "2026-03-31T10:01:00.000Z",
              updated_at: "2026-03-31T10:01:00.000Z",
            },
            template_id: "template-proof-1",
            knowledge_item_ids: ["knowledge-proof-1"],
            model_id: "model-proof-1",
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/modules/proofreading/finalize"
      ) {
        assetPhase = "final";
        return {
          status: 201,
          body: {
            job: {
              id: "job-proof-final-1",
              module: "proofreading",
              job_type: "proofreading_finalize",
              status: "completed",
              requested_by: "proofreader-1",
              attempt_count: 1,
              created_at: "2026-03-31T10:02:00.000Z",
              updated_at: "2026-03-31T10:03:00.000Z",
            },
            asset: {
              id: "asset-proof-final-1",
              manuscript_id: "manuscript-1",
              asset_type: "final_proof_annotated_docx",
              status: "active",
              storage_key: "runs/proofreading/final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-proof-draft-1",
              source_module: "proofreading",
              source_job_id: "job-proof-final-1",
              created_by: "proofreader-1",
              version_no: 4,
              is_current: true,
              file_name: "proof-final.docx",
              created_at: "2026-03-31T10:03:00.000Z",
              updated_at: "2026-03-31T10:03:00.000Z",
            },
            template_id: "template-proof-1",
            knowledge_item_ids: ["knowledge-proof-1"],
            model_id: "model-proof-1",
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-1",
            title: "Proofreading candidate",
            manuscript_type: "review",
            status: "processing",
            created_by: "editor-1",
            current_editing_asset_id: "asset-edited-1",
            ...(assetPhase === "final"
              ? { current_proofreading_asset_id: "asset-proof-final-1" }
              : {}),
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T10:03:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/manuscripts/manuscript-1/assets"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "asset-edited-1",
              manuscript_id: "manuscript-1",
              asset_type: "edited_docx",
              status: "active",
              storage_key: "runs/editing/final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "editing",
              created_by: "editor-1",
              version_no: 2,
              is_current: assetPhase !== "final",
              file_name: "editing-final.docx",
              created_at: "2026-03-31T09:30:00.000Z",
              updated_at: "2026-03-31T09:30:00.000Z",
            },
            {
              id: "asset-proof-draft-1",
              manuscript_id: "manuscript-1",
              asset_type: "proofreading_draft_report",
              status: assetPhase === "draft" ? "active" : "superseded",
              storage_key: "runs/proofreading/draft.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-edited-1",
              source_module: "proofreading",
              source_job_id: "job-proof-draft-1",
              created_by: "proofreader-1",
              version_no: 3,
              is_current: false,
              file_name: "proof-draft.md",
              created_at: "2026-03-31T10:01:00.000Z",
              updated_at: "2026-03-31T10:01:00.000Z",
            },
            ...(assetPhase === "final"
              ? [
                  {
                    id: "asset-proof-final-1",
                    manuscript_id: "manuscript-1",
                    asset_type: "final_proof_annotated_docx",
                    status: "active",
                    storage_key: "runs/proofreading/final.docx",
                    mime_type:
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    parent_asset_id: "asset-proof-draft-1",
                    source_module: "proofreading",
                    source_job_id: "job-proof-final-1",
                    created_by: "proofreader-1",
                    version_no: 4,
                    is_current: true,
                    file_name: "proof-final.docx",
                    created_at: "2026-03-31T10:03:00.000Z",
                    updated_at: "2026-03-31T10:03:00.000Z",
                  },
                ]
              : []),
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const draftResult = await controller.runModuleAndLoad({
    mode: "proofreading",
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-edited-1",
    actorRole: "proofreader",
    storageKey: "runs/proofreading/draft.md",
    fileName: "proof-draft.md",
  });

  assert.equal(draftResult.runResult.asset.id, "asset-proof-draft-1");
  assert.equal(draftResult.workspace.currentAsset?.id, "asset-edited-1");
  assert.equal(
    draftResult.workspace.latestProofreadingDraftAsset?.id,
    "asset-proof-draft-1",
  );
  assert.equal(draftResult.workspace.suggestedParentAsset?.id, "asset-edited-1");

  const finalizeResult = await controller.finalizeProofreadingAndLoad({
    manuscriptId: "manuscript-1",
    draftAssetId: "asset-proof-draft-1",
    actorRole: "proofreader",
    storageKey: "runs/proofreading/final.docx",
    fileName: "proof-final.docx",
  });

  assert.equal(finalizeResult.runResult.asset.id, "asset-proof-final-1");
  assert.equal(finalizeResult.workspace.currentAsset?.id, "asset-proof-final-1");
  assert.equal(
    finalizeResult.workspace.latestProofreadingDraftAsset?.id,
    "asset-proof-draft-1",
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/modules/proofreading/draft",
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
      "POST /api/v1/modules/proofreading/finalize",
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
    ],
  );
});

test("manuscript workbench controller exports the current asset through the document pipeline route", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "POST" &&
        input.url === "/api/v1/document-pipeline/export-current-asset"
      ) {
        return {
          status: 200,
          body: {
            manuscript_id: "manuscript-1",
            asset: {
              id: "asset-proof-final-1",
              manuscript_id: "manuscript-1",
              asset_type: "final_proof_annotated_docx",
              status: "active",
              storage_key: "runs/manuscript-1/proofreading/final",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-proof-draft-1",
              source_module: "proofreading",
              source_job_id: "job-proof-final-1",
              created_by: "proofreader-1",
              version_no: 4,
              is_current: true,
              file_name: "proofreading-final.docx",
              created_at: "2026-03-31T10:02:00.000Z",
              updated_at: "2026-03-31T10:02:00.000Z",
            },
            download: {
              storage_key: "runs/manuscript-1/proofreading/final",
              file_name: "proofreading-final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              url: "/api/v1/document-assets/asset-proof-final-1/download",
            },
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const exported = await controller.exportCurrentAsset({
    manuscriptId: "manuscript-1",
  });

  assert.equal(exported.asset.id, "asset-proof-final-1");
  assert.equal(exported.download.file_name, "proofreading-final.docx");
  assert.equal(
    exported.download.mime_type,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(
    exported.download.url,
    "/api/v1/document-assets/asset-proof-final-1/download",
  );
  assert.deepEqual(requests, [
    {
      method: "POST",
      url: "/api/v1/document-pipeline/export-current-asset",
      body: {
        manuscriptId: "manuscript-1",
      },
    },
  ]);
});
