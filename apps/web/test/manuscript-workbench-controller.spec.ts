import test from "node:test";
import assert from "node:assert/strict";
import {
  createManuscriptWorkbenchController,
  resolveWorkbenchReadOnlyExecutionContext,
} from "../src/features/manuscript-workbench/index.ts";

test("manuscript workbench controller uploads a manuscript and hydrates workspace", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const hydratedUploadJob = {
    id: "job-upload-1",
    manuscript_id: "manuscript-1",
    module: "upload",
    job_type: "manuscript_upload",
    status: "queued",
    requested_by: "user-1",
    attempt_count: 0,
    created_at: "2026-03-31T09:00:00.000Z",
    updated_at: "2026-03-31T09:00:00.000Z",
    execution_tracking: {
      observation_status: "not_tracked" as const,
    },
  };
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

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-upload-1") {
        return {
          status: 200,
          body: hydratedUploadJob as TResponse,
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

  assert.deepEqual(result.upload.job, hydratedUploadJob);
  assert.equal(result.workspace.manuscript.id, "manuscript-1");
  assert.equal(result.workspace.assets.length, 1);
  assert.equal(result.workspace.currentAsset?.id, "asset-original-1");
  assert.equal(result.workspace.suggestedParentAsset?.id, "asset-original-1");
  assert.equal(result.workspace.latestProofreadingDraftAsset, null);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/manuscripts/upload",
      "GET /api/v1/jobs/job-upload-1",
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

test("manuscript workbench controller keeps the manuscript document separate from report-style current assets", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-screen-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-screen-1",
            title: "Screening manuscript",
            manuscript_type: "review",
            status: "processing",
            created_by: "editor-1",
            current_screening_asset_id: "asset-screening-report-1",
            created_at: "2026-04-15T09:00:00.000Z",
            updated_at: "2026-04-15T09:05:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/manuscripts/manuscript-screen-1/assets"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "asset-screening-report-1",
              manuscript_id: "manuscript-screen-1",
              asset_type: "screening_report",
              status: "active",
              storage_key: "runs/screening/report.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-original-1",
              source_module: "screening",
              created_by: "editor-1",
              version_no: 2,
              is_current: true,
              file_name: "screening-report.md",
              created_at: "2026-04-15T09:05:00.000Z",
              updated_at: "2026-04-15T09:05:00.000Z",
            },
            {
              id: "asset-original-1",
              manuscript_id: "manuscript-screen-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/screening-manuscript.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "editor-1",
              version_no: 1,
              is_current: true,
              file_name: "screening-manuscript.docx",
              created_at: "2026-04-15T09:00:00.000Z",
              updated_at: "2026-04-15T09:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const workspace = await controller.loadWorkspace("manuscript-screen-1");

  assert.equal(workspace.currentAsset?.id, "asset-screening-report-1");
  assert.equal(workspace.currentManuscriptAsset?.id, "asset-original-1");
  assert.equal(workspace.suggestedParentAsset?.id, "asset-original-1");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/manuscripts/manuscript-screen-1",
      "GET /api/v1/manuscripts/manuscript-screen-1/assets",
    ],
  );
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

test("manuscript workbench controller uploads a manuscript batch and hydrates the first workspace plus batch progress", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const hydratedBatchJob = {
    id: "job-batch-1",
    module: "upload",
    job_type: "manuscript_upload_batch",
    status: "queued",
    requested_by: "user-1",
    attempt_count: 0,
    created_at: "2026-04-09T09:00:00.000Z",
    updated_at: "2026-04-09T09:00:00.000Z",
    batch_progress: {
      lifecycle_status: "queued" as const,
      settlement_status: "in_progress" as const,
      total_count: 2,
      queued_count: 2,
      running_count: 0,
      succeeded_count: 0,
      failed_count: 0,
      cancelled_count: 0,
      remaining_count: 2,
      restart_posture: {
        status: "fresh" as const,
        reason: "Batch has not required restart recovery.",
        observed_at: "2026-04-09T09:00:00.000Z",
      },
      items: [
        {
          item_id: "item-1",
          title: "Batch Review A",
          file_name: "batch-review-a.docx",
          manuscript_id: "manuscript-batch-1",
          upload_job_id: "job-upload-batch-1",
          status: "queued" as const,
          attempt_count: 0,
          updated_at: "2026-04-09T09:00:00.000Z",
        },
        {
          item_id: "item-2",
          title: "Batch Review B",
          file_name: "batch-review-b.docx",
          manuscript_id: "manuscript-batch-2",
          upload_job_id: "job-upload-batch-2",
          status: "queued" as const,
          attempt_count: 0,
          updated_at: "2026-04-09T09:00:00.000Z",
        },
      ],
    },
    execution_tracking: {
      observation_status: "not_tracked" as const,
    },
  };
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/manuscripts/upload-batch") {
        return {
          status: 201,
          body: {
            batch_job: {
              id: "job-batch-1",
              module: "upload",
              job_type: "manuscript_upload_batch",
              status: "queued",
              requested_by: "user-1",
              attempt_count: 0,
              created_at: "2026-04-09T09:00:00.000Z",
              updated_at: "2026-04-09T09:00:00.000Z",
            },
            items: [
              {
                manuscript: {
                  id: "manuscript-batch-1",
                  title: "Batch Review A",
                  manuscript_type: "review",
                  status: "uploaded",
                  created_by: "user-1",
                  created_at: "2026-04-09T09:00:00.000Z",
                  updated_at: "2026-04-09T09:00:00.000Z",
                },
                asset: {
                  id: "asset-batch-1",
                  manuscript_id: "manuscript-batch-1",
                  asset_type: "original",
                  status: "active",
                  storage_key: "uploads/batch-review-a.docx",
                  mime_type:
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  source_module: "upload",
                  created_by: "user-1",
                  version_no: 1,
                  is_current: true,
                  file_name: "batch-review-a.docx",
                  created_at: "2026-04-09T09:00:00.000Z",
                  updated_at: "2026-04-09T09:00:00.000Z",
                },
                job: {
                  id: "job-upload-batch-1",
                  manuscript_id: "manuscript-batch-1",
                  module: "upload",
                  job_type: "manuscript_upload",
                  status: "queued",
                  requested_by: "user-1",
                  attempt_count: 0,
                  created_at: "2026-04-09T09:00:00.000Z",
                  updated_at: "2026-04-09T09:00:00.000Z",
                },
              },
              {
                manuscript: {
                  id: "manuscript-batch-2",
                  title: "Batch Review B",
                  manuscript_type: "clinical_study",
                  status: "uploaded",
                  created_by: "user-1",
                  created_at: "2026-04-09T09:00:00.000Z",
                  updated_at: "2026-04-09T09:00:00.000Z",
                },
                asset: {
                  id: "asset-batch-2",
                  manuscript_id: "manuscript-batch-2",
                  asset_type: "original",
                  status: "active",
                  storage_key: "uploads/batch-review-b.docx",
                  mime_type:
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  source_module: "upload",
                  created_by: "user-1",
                  version_no: 1,
                  is_current: true,
                  file_name: "batch-review-b.docx",
                  created_at: "2026-04-09T09:00:00.000Z",
                  updated_at: "2026-04-09T09:00:00.000Z",
                },
                job: {
                  id: "job-upload-batch-2",
                  manuscript_id: "manuscript-batch-2",
                  module: "upload",
                  job_type: "manuscript_upload",
                  status: "queued",
                  requested_by: "user-1",
                  attempt_count: 0,
                  created_at: "2026-04-09T09:00:00.000Z",
                  updated_at: "2026-04-09T09:00:00.000Z",
                },
              },
            ],
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-batch-1") {
        return {
          status: 200,
          body: hydratedBatchJob as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-batch-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-batch-1",
            title: "Batch Review A",
            manuscript_type: "review",
            status: "uploaded",
            created_by: "user-1",
            created_at: "2026-04-09T09:00:00.000Z",
            updated_at: "2026-04-09T09:00:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/manuscripts/manuscript-batch-1/assets"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "asset-batch-1",
              manuscript_id: "manuscript-batch-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/batch-review-a.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "user-1",
              version_no: 1,
              is_current: true,
              file_name: "batch-review-a.docx",
              created_at: "2026-04-09T09:00:00.000Z",
              updated_at: "2026-04-09T09:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.uploadManuscriptBatchAndLoad?.({
    createdBy: "forged-user",
    items: [
      {
        title: "Batch Review A",
        manuscriptType: "review",
        fileName: "batch-review-a.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "QQ==",
      },
      {
        title: "Batch Review B",
        manuscriptType: "clinical_study",
        fileName: "batch-review-b.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "Qg==",
      },
    ],
  });

  assert.ok(result, "Expected the controller to expose batch upload support.");
  assert.deepEqual(result.upload.batch_job, hydratedBatchJob);
  assert.equal(result.workspace.manuscript.id, "manuscript-batch-1");
  assert.equal(result.workspace.currentAsset?.id, "asset-batch-1");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/manuscripts/upload-batch",
      "GET /api/v1/jobs/job-batch-1",
      "GET /api/v1/manuscripts/manuscript-batch-1",
      "GET /api/v1/manuscripts/manuscript-batch-1/assets",
    ],
  );
});

test("manuscript workbench controller resolves a read-only governed execution context for the active workbench", () => {
  const executionContext = resolveWorkbenchReadOnlyExecutionContext(
    "editing",
    {
      manuscript: {
        governed_execution_context_summary: {
          observation_status: "reported",
          manuscript_type: "clinical_study",
          journal_template_selection_state: "base_family_only",
          modules: [
            {
              module: "screening",
              status: "configured",
              execution_profile_id: "profile-screening-1",
              model_routing_policy_version_id: "policy-screening-v1",
              resolved_model_id: "model-screening-1",
              model_source: "template_family_policy",
              provider_readiness_status: "ok",
              runtime_binding_readiness_status: "ready",
            },
            {
              module: "editing",
              status: "configured",
              execution_profile_id: "profile-editing-1",
              model_routing_policy_version_id: "policy-editing-v2",
              resolved_model_id: "model-editing-1",
              model_source: "template_family_policy",
              provider_readiness_status: "warning",
              runtime_binding_readiness_status: "degraded",
            },
          ],
        },
      },
    } as never,
  );

  assert.deepEqual(executionContext, {
    mode: "editing",
    executionProfileId: "profile-editing-1",
    modelRoutingPolicyVersionId: "policy-editing-v2",
    resolvedModelId: "model-editing-1",
    modelSource: "template_family_policy",
    providerReadinessStatus: "warning",
    runtimeBindingReadinessStatus: "degraded",
  });
  assert.equal(
    resolveWorkbenchReadOnlyExecutionContext(
      "submission",
      {
        manuscript: {
          governed_execution_context_summary: {
            observation_status: "reported",
            manuscript_type: "clinical_study",
            journal_template_selection_state: "base_family_only",
            modules: [],
          },
        },
      } as never,
    ),
    null,
  );
});

test("manuscript workbench controller runs proofreading draft and finalize flows while reloading workspace", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  let assetPhase: "draft" | "final" = "draft";
  const hydratedDraftJob = {
    id: "job-proof-draft-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_draft",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    created_at: "2026-03-31T10:00:00.000Z",
    updated_at: "2026-03-31T10:01:00.000Z",
    execution_tracking: {
      observation_status: "reported" as const,
      settlement: {
        derived_status: "business_completed_follow_up_pending" as const,
        business_completed: true,
        orchestration_completed: false,
        attention_required: false,
        reason: "Draft asset exists and governed follow-up is pending.",
      },
    },
  };
  const hydratedFinalizeJob = {
    id: "job-proof-final-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_finalize",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    created_at: "2026-03-31T10:02:00.000Z",
    updated_at: "2026-03-31T10:03:00.000Z",
    execution_tracking: {
      observation_status: "reported" as const,
      settlement: {
        derived_status: "business_completed_settled" as const,
        business_completed: true,
        orchestration_completed: true,
        attention_required: false,
        reason: "Proofreading finalize output is fully settled.",
      },
    },
  };
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

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-proof-draft-1") {
        return {
          status: 200,
          body: hydratedDraftJob as TResponse,
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

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-proof-final-1") {
        return {
          status: 200,
          body: hydratedFinalizeJob as TResponse,
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
  assert.deepEqual(draftResult.runResult.job, hydratedDraftJob);
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
  assert.deepEqual(finalizeResult.runResult.job, hydratedFinalizeJob);
  assert.equal(finalizeResult.workspace.currentAsset?.id, "asset-proof-final-1");
  assert.equal(
    finalizeResult.workspace.latestProofreadingDraftAsset?.id,
    "asset-proof-draft-1",
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/modules/proofreading/draft",
      "GET /api/v1/jobs/job-proof-draft-1",
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
      "POST /api/v1/modules/proofreading/finalize",
      "GET /api/v1/jobs/job-proof-final-1",
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

test("manuscript workbench controller publishes a proofreading human-final asset and reloads the workspace", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const hydratedPublishJob = {
    id: "job-human-final-1",
    manuscript_id: "manuscript-1",
    module: "manual",
    job_type: "publish_human_final",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    payload: {
      sourceAssetId: "asset-proof-final-1",
    },
    created_at: "2026-03-31T10:05:00.000Z",
    updated_at: "2026-03-31T10:05:00.000Z",
    execution_tracking: {
      observation_status: "reported" as const,
      settlement: {
        derived_status: "business_completed_settled" as const,
        business_completed: true,
        orchestration_completed: true,
        attention_required: false,
        reason: "Human-final publication is fully settled.",
      },
    },
  };
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "POST" &&
        input.url === "/api/v1/modules/proofreading/publish-human-final"
      ) {
        return {
          status: 201,
          body: {
            job: {
              id: "job-human-final-1",
              manuscript_id: "manuscript-1",
              module: "manual",
              job_type: "publish_human_final",
              status: "completed",
              requested_by: "proofreader-1",
              attempt_count: 1,
              payload: {
                sourceAssetId: "asset-proof-final-1",
              },
              created_at: "2026-03-31T10:05:00.000Z",
              updated_at: "2026-03-31T10:05:00.000Z",
            },
            asset: {
              id: "asset-human-final-1",
              manuscript_id: "manuscript-1",
              asset_type: "human_final_docx",
              status: "active",
              storage_key: "runs/manuscript-1/proofreading/human-final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-proof-final-1",
              source_module: "manual",
              source_job_id: "job-human-final-1",
              created_by: "proofreader-1",
              version_no: 1,
              is_current: true,
              file_name: "human-final.docx",
              created_at: "2026-03-31T10:05:00.000Z",
              updated_at: "2026-03-31T10:05:00.000Z",
            },
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-human-final-1") {
        return {
          status: 200,
          body: hydratedPublishJob as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-1",
            title: "Proofreading candidate",
            manuscript_type: "review",
            status: "completed",
            created_by: "editor-1",
            current_proofreading_asset_id: "asset-human-final-1",
            created_at: "2026-03-31T09:00:00.000Z",
            updated_at: "2026-03-31T10:05:00.000Z",
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
              id: "asset-human-final-1",
              manuscript_id: "manuscript-1",
              asset_type: "human_final_docx",
              status: "active",
              storage_key: "runs/manuscript-1/proofreading/human-final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-proof-final-1",
              source_module: "manual",
              source_job_id: "job-human-final-1",
              created_by: "proofreader-1",
              version_no: 1,
              is_current: true,
              file_name: "human-final.docx",
              created_at: "2026-03-31T10:05:00.000Z",
              updated_at: "2026-03-31T10:05:00.000Z",
            },
            {
              id: "asset-proof-final-1",
              manuscript_id: "manuscript-1",
              asset_type: "final_proof_annotated_docx",
              status: "superseded",
              storage_key: "runs/manuscript-1/proofreading/final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-proof-draft-1",
              source_module: "proofreading",
              source_job_id: "job-proof-final-1",
              created_by: "proofreader-1",
              version_no: 4,
              is_current: true,
              file_name: "proofreading-final.docx",
              created_at: "2026-03-31T10:03:00.000Z",
              updated_at: "2026-03-31T10:03:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.publishHumanFinalAndLoad({
    manuscriptId: "manuscript-1",
    finalAssetId: "asset-proof-final-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/human-final.docx",
    fileName: "human-final.docx",
  });

  assert.deepEqual(result.runResult.job, hydratedPublishJob);
  assert.equal(result.runResult.asset.id, "asset-human-final-1");
  assert.equal(result.workspace.currentAsset?.id, "asset-human-final-1");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/modules/proofreading/publish-human-final",
      "GET /api/v1/jobs/job-human-final-1",
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
    ],
  );
  assert.deepEqual(requests[0]?.body, {
    manuscriptId: "manuscript-1",
    finalAssetId: "asset-proof-final-1",
    requestedBy: "web-workbench",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/human-final.docx",
    fileName: "human-final.docx",
  });
});

test("manuscript workbench controller fails open when action-time job hydration cannot be loaded", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const rawJob = {
    id: "job-screen-1",
    module: "screening",
    job_type: "screening_run",
    status: "completed",
    requested_by: "screening-editor",
    attempt_count: 1,
    created_at: "2026-04-06T12:00:00.000Z",
    updated_at: "2026-04-06T12:01:00.000Z",
  };
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/modules/screening/run") {
        return {
          status: 201,
          body: {
            job: rawJob,
            asset: {
              id: "asset-screen-1",
              manuscript_id: "manuscript-1",
              asset_type: "screening_report",
              status: "active",
              storage_key: "runs/screening/output.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-original-1",
              source_module: "screening",
              source_job_id: "job-screen-1",
              created_by: "screening-editor",
              version_no: 2,
              is_current: true,
              file_name: "screening-output.md",
              created_at: "2026-04-06T12:01:00.000Z",
              updated_at: "2026-04-06T12:01:00.000Z",
            },
            template_id: "template-screen-1",
            knowledge_item_ids: ["knowledge-screen-1"],
            model_id: "model-screen-1",
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-screen-1") {
        throw new Error("temporary read failure");
      }

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-1",
            title: "Screening candidate",
            manuscript_type: "review",
            status: "processing",
            created_by: "editor-1",
            current_screening_asset_id: "asset-screen-1",
            created_at: "2026-04-06T11:30:00.000Z",
            updated_at: "2026-04-06T12:01:00.000Z",
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
              id: "asset-screen-1",
              manuscript_id: "manuscript-1",
              asset_type: "screening_report",
              status: "active",
              storage_key: "runs/screening/output.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-original-1",
              source_module: "screening",
              source_job_id: "job-screen-1",
              created_by: "screening-editor",
              version_no: 2,
              is_current: true,
              file_name: "screening-output.md",
              created_at: "2026-04-06T12:01:00.000Z",
              updated_at: "2026-04-06T12:01:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.runModuleAndLoad({
    mode: "screening",
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    actorRole: "editor",
    storageKey: "runs/screening/output.md",
    fileName: "screening-output.md",
  });

  assert.deepEqual(result.runResult.job, rawJob);
  assert.equal(result.workspace.currentAsset?.id, "asset-screen-1");
  assert.deepEqual(requests[0]?.body, {
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "web-workbench",
    actorRole: "editor",
    storageKey: "runs/screening/output.md",
    fileName: "screening-output.md",
  });
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/modules/screening/run",
      "GET /api/v1/jobs/job-screen-1",
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
    ],
  );
});

test("manuscript workbench controller hydrates resolved template context and can correct the base family before reloading workspace", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  let selectedTemplateFamilyId = "family-1";
  let selectedJournalTemplateId: string | undefined = "journal-template-1";
  let resolvedManuscriptType: "clinical_study" | "review" = "clinical_study";
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-1",
            title: "Journal aware manuscript",
            manuscript_type: resolvedManuscriptType,
            status: "uploaded",
            created_by: "editor-1",
            current_template_family_id: selectedTemplateFamilyId,
            current_journal_template_id: selectedJournalTemplateId,
            created_at: "2026-04-07T09:00:00.000Z",
            updated_at: "2026-04-07T09:15:00.000Z",
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
              storage_key: "uploads/journal-aware.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "editor-1",
              version_no: 1,
              is_current: true,
              file_name: "journal-aware.docx",
              created_at: "2026-04-07T09:00:00.000Z",
              updated_at: "2026-04-07T09:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "clinical_study",
              name: "Clinical Study Family",
              status: "active",
            },
            {
              id: "family-2",
              manuscript_type: "review",
              name: "Review Family",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === `/api/v1/templates/families/${selectedTemplateFamilyId}/journal-templates`
      ) {
        return {
          status: 200,
          body:
            selectedTemplateFamilyId === "family-1"
              ? ([
                  {
                    id: "journal-template-1",
                    template_family_id: "family-1",
                    journal_key: "journal-one",
                    journal_name: "Journal Template One",
                    status: "active",
                  },
                  {
                    id: "journal-template-2",
                    template_family_id: "family-1",
                    journal_key: "journal-two",
                    journal_name: "Journal Template Two",
                    status: "draft",
                  },
                ] as TResponse)
              : ([] as TResponse),
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/manuscripts/manuscript-1/template-selection"
      ) {
        assert.deepEqual(input.body, {
          templateFamilyId: "family-2",
          journalTemplateId: null,
        });
        selectedTemplateFamilyId = "family-2";
        selectedJournalTemplateId = undefined;
        resolvedManuscriptType = "review";
        return {
          status: 200,
          body: {
            id: "manuscript-1",
            title: "Journal aware manuscript",
            manuscript_type: "review",
            status: "uploaded",
            created_by: "editor-1",
            current_template_family_id: "family-2",
            created_at: "2026-04-07T09:00:00.000Z",
            updated_at: "2026-04-07T09:16:00.000Z",
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const workspace = await controller.loadWorkspace("manuscript-1");
  assert.equal(workspace.templateFamily?.name, "Clinical Study Family");
  assert.deepEqual(
    workspace.availableTemplateFamilies?.map((family) => family.id),
    ["family-1", "family-2"],
  );
  assert.equal(workspace.journalTemplateProfiles.length, 2);
  assert.equal(
    workspace.selectedJournalTemplateProfile?.journal_name,
    "Journal Template One",
  );

  const updated = await controller.updateTemplateSelectionAndLoad({
    manuscriptId: "manuscript-1",
    templateFamilyId: "family-2",
    journalTemplateId: null,
  });
  assert.equal(updated.workspace.manuscript.manuscript_type, "review");
  assert.equal(updated.workspace.templateFamily?.name, "Review Family");
  assert.equal(updated.workspace.manuscript.current_journal_template_id, undefined);
  assert.equal(updated.workspace.selectedJournalTemplateProfile, null);
  assert.deepEqual(
    updated.workspace.availableTemplateFamilies?.map((family) => family.id),
    ["family-1", "family-2"],
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
      "GET /api/v1/templates/families",
      "GET /api/v1/templates/families/family-1/journal-templates",
      "POST /api/v1/manuscripts/manuscript-1/template-selection",
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
      "GET /api/v1/templates/families",
      "GET /api/v1/templates/families/family-2/journal-templates",
    ],
  );
});

test("manuscript workbench controller forwards one-time bare execution mode to screening editing and proofreading while leaving governed as the default", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/modules/screening/run") {
        return {
          status: 201,
          body: {
            job: {
              id: "job-screen-bare-1",
              module: "screening",
              job_type: "screening_run",
              status: "completed",
              requested_by: "screening-editor",
              attempt_count: 1,
              created_at: "2026-04-16T12:00:00.000Z",
              updated_at: "2026-04-16T12:00:00.000Z",
            },
            asset: {
              id: "asset-screen-bare-1",
              manuscript_id: "manuscript-1",
              asset_type: "screening_report",
              status: "active",
              storage_key: "runs/screening/output.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-original-1",
              source_module: "screening",
              source_job_id: "job-screen-bare-1",
              created_by: "screening-editor",
              version_no: 2,
              is_current: true,
              file_name: "screening-output.md",
              created_at: "2026-04-16T12:00:00.000Z",
              updated_at: "2026-04-16T12:00:00.000Z",
            },
            template_id: "template-screen-1",
            knowledge_item_ids: [],
            model_id: "model-screen-1",
          } as TResponse,
        };
      }

      if (input.method === "POST" && input.url === "/api/v1/modules/editing/run") {
        return {
          status: 201,
          body: {
            job: {
              id: "job-edit-bare-1",
              module: "editing",
              job_type: "editing_run",
              status: "completed",
              requested_by: "editing-editor",
              attempt_count: 1,
              created_at: "2026-04-16T12:01:00.000Z",
              updated_at: "2026-04-16T12:01:00.000Z",
            },
            asset: {
              id: "asset-edit-bare-1",
              manuscript_id: "manuscript-1",
              asset_type: "edited_docx",
              status: "active",
              storage_key: "runs/editing/output.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-original-1",
              source_module: "editing",
              source_job_id: "job-edit-bare-1",
              created_by: "editing-editor",
              version_no: 3,
              is_current: true,
              file_name: "editing-output.docx",
              created_at: "2026-04-16T12:01:00.000Z",
              updated_at: "2026-04-16T12:01:00.000Z",
            },
            template_id: "template-edit-1",
            knowledge_item_ids: [],
            model_id: "model-edit-1",
          } as TResponse,
        };
      }

      if (input.method === "POST" && input.url === "/api/v1/modules/proofreading/draft") {
        return {
          status: 201,
          body: {
            job: {
              id: "job-proof-bare-1",
              module: "proofreading",
              job_type: "proofreading_draft_run",
              status: "completed",
              requested_by: "proofreader-1",
              attempt_count: 1,
              created_at: "2026-04-16T12:02:00.000Z",
              updated_at: "2026-04-16T12:02:00.000Z",
            },
            asset: {
              id: "asset-proof-bare-1",
              manuscript_id: "manuscript-1",
              asset_type: "proofreading_draft_report",
              status: "active",
              storage_key: "runs/proofreading/output.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-edit-bare-1",
              source_module: "proofreading",
              source_job_id: "job-proof-bare-1",
              created_by: "proofreader-1",
              version_no: 4,
              is_current: false,
              file_name: "proofreading-output.md",
              created_at: "2026-04-16T12:02:00.000Z",
              updated_at: "2026-04-16T12:02:00.000Z",
            },
            template_id: "template-proof-1",
            knowledge_item_ids: [],
            model_id: "model-proof-1",
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-screen-bare-1") {
        return {
          status: 200,
          body: {
            id: "job-screen-bare-1",
            manuscript_id: "manuscript-1",
            module: "screening",
            job_type: "screening_run",
            status: "completed",
            requested_by: "screening-editor",
            attempt_count: 1,
            created_at: "2026-04-16T12:00:00.000Z",
            updated_at: "2026-04-16T12:00:00.000Z",
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-edit-bare-1") {
        return {
          status: 200,
          body: {
            id: "job-edit-bare-1",
            manuscript_id: "manuscript-1",
            module: "editing",
            job_type: "editing_run",
            status: "completed",
            requested_by: "editing-editor",
            attempt_count: 1,
            created_at: "2026-04-16T12:01:00.000Z",
            updated_at: "2026-04-16T12:01:00.000Z",
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/jobs/job-proof-bare-1") {
        return {
          status: 200,
          body: {
            id: "job-proof-bare-1",
            manuscript_id: "manuscript-1",
            module: "proofreading",
            job_type: "proofreading_draft_run",
            status: "completed",
            requested_by: "proofreader-1",
            attempt_count: 1,
            created_at: "2026-04-16T12:02:00.000Z",
            updated_at: "2026-04-16T12:02:00.000Z",
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-1",
            title: "Bare mode candidate",
            manuscript_type: "review",
            status: "processing",
            created_by: "editor-1",
            current_screening_asset_id: "asset-screen-bare-1",
            current_editing_asset_id: "asset-edit-bare-1",
            created_at: "2026-04-16T11:30:00.000Z",
            updated_at: "2026-04-16T12:02:00.000Z",
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-1/assets") {
        return {
          status: 200,
          body: [
            {
              id: "asset-proof-bare-1",
              manuscript_id: "manuscript-1",
              asset_type: "proofreading_draft_report",
              status: "active",
              storage_key: "runs/proofreading/output.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-edit-bare-1",
              source_module: "proofreading",
              source_job_id: "job-proof-bare-1",
              created_by: "proofreader-1",
              version_no: 4,
              is_current: false,
              file_name: "proofreading-output.md",
              created_at: "2026-04-16T12:02:00.000Z",
              updated_at: "2026-04-16T12:02:00.000Z",
            },
            {
              id: "asset-edit-bare-1",
              manuscript_id: "manuscript-1",
              asset_type: "edited_docx",
              status: "active",
              storage_key: "runs/editing/output.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-original-1",
              source_module: "editing",
              source_job_id: "job-edit-bare-1",
              created_by: "editing-editor",
              version_no: 3,
              is_current: true,
              file_name: "editing-output.docx",
              created_at: "2026-04-16T12:01:00.000Z",
              updated_at: "2026-04-16T12:01:00.000Z",
            },
            {
              id: "asset-screen-bare-1",
              manuscript_id: "manuscript-1",
              asset_type: "screening_report",
              status: "active",
              storage_key: "runs/screening/output.md",
              mime_type: "text/markdown",
              parent_asset_id: "asset-original-1",
              source_module: "screening",
              source_job_id: "job-screen-bare-1",
              created_by: "screening-editor",
              version_no: 2,
              is_current: false,
              file_name: "screening-output.md",
              created_at: "2026-04-16T12:00:00.000Z",
              updated_at: "2026-04-16T12:00:00.000Z",
            },
            {
              id: "asset-original-1",
              manuscript_id: "manuscript-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/original.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "editor-1",
              version_no: 1,
              is_current: true,
              file_name: "original.docx",
              created_at: "2026-04-16T11:30:00.000Z",
              updated_at: "2026-04-16T11:30:00.000Z",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  await controller.runModuleAndLoad({
    mode: "screening",
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    actorRole: "editor",
    storageKey: "runs/screening/output.md",
    fileName: "screening-output.md",
  });

  await controller.runModuleAndLoad({
    mode: "editing",
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    actorRole: "editor",
    storageKey: "runs/editing/output.docx",
    fileName: "editing-output.docx",
    executionMode: "bare",
  });

  await controller.runModuleAndLoad({
    mode: "proofreading",
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-edit-bare-1",
    actorRole: "proofreader",
    storageKey: "runs/proofreading/output.md",
    fileName: "proofreading-output.md",
    executionMode: "bare",
  });

  assert.deepEqual(requests[0]?.body, {
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "web-workbench",
    actorRole: "editor",
    storageKey: "runs/screening/output.md",
    fileName: "screening-output.md",
  });
  assert.deepEqual(requests[4]?.body, {
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-original-1",
    requestedBy: "web-workbench",
    actorRole: "editor",
    storageKey: "runs/editing/output.docx",
    fileName: "editing-output.docx",
    executionMode: "bare",
  });
  assert.deepEqual(requests[8]?.body, {
    manuscriptId: "manuscript-1",
    parentAssetId: "asset-edit-bare-1",
    requestedBy: "web-workbench",
    actorRole: "proofreader",
    storageKey: "runs/proofreading/output.md",
    fileName: "proofreading-output.md",
    executionMode: "bare",
  });
});

test("manuscript workbench controller falls back to the governed base family when the AI result has not been manually confirmed yet", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-ai-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-ai-1",
            title: "AI recognized manuscript",
            manuscript_type: "review",
            manuscript_type_detection_summary: {
              confidence_level: "low",
              confidence: 0.42,
              requires_operator_review: true,
            },
            governed_execution_context_summary: {
              observation_status: "reported",
              manuscript_type: "review",
              base_template_family_id: "family-review",
              journal_template_selection_state: "base_family_only",
              modules: [],
            },
            status: "uploaded",
            created_by: "editor-1",
            created_at: "2026-04-14T09:00:00.000Z",
            updated_at: "2026-04-14T09:15:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/manuscripts/manuscript-ai-1/assets"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "asset-original-ai-1",
              manuscript_id: "manuscript-ai-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/ai-recognized.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "editor-1",
              version_no: 1,
              is_current: true,
              file_name: "ai-recognized.docx",
              created_at: "2026-04-14T09:00:00.000Z",
              updated_at: "2026-04-14T09:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-review",
              manuscript_type: "review",
              name: "Review Family",
              status: "active",
            },
            {
              id: "family-clinical",
              manuscript_type: "clinical_study",
              name: "Clinical Study Family",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/templates/families/family-review/journal-templates"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "journal-template-review-1",
              template_family_id: "family-review",
              journal_key: "journal-review",
              journal_name: "Review Journal Template",
              status: "active",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const workspace = await controller.loadWorkspace("manuscript-ai-1");

  assert.equal(workspace.templateFamily?.name, "Review Family");
  assert.equal(workspace.availableTemplateFamilies?.length, 2);
  assert.equal(workspace.journalTemplateProfiles.length, 1);
  assert.equal(
    workspace.journalTemplateProfiles[0]?.journal_name,
    "Review Journal Template",
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/manuscripts/manuscript-ai-1",
      "GET /api/v1/manuscripts/manuscript-ai-1/assets",
      "GET /api/v1/templates/families",
      "GET /api/v1/templates/families/family-review/journal-templates",
    ],
  );
});

test("manuscript workbench controller can load template context for a manually selected manuscript type family", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "GET" && input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "clinical_study",
              name: "Clinical Study Family",
              status: "active",
            },
            {
              id: "family-2",
              manuscript_type: "review",
              name: "Review Family",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/templates/families/family-2/journal-templates"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "journal-template-review",
              template_family_id: "family-2",
              journal_key: "cmj",
              journal_name: "中华医学杂志",
              status: "active",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const templateContext = await controller.loadTemplateContext?.("family-2");

  assert.deepEqual(templateContext, {
    availableTemplateFamilies: [
      {
        id: "family-1",
        manuscript_type: "clinical_study",
        name: "Clinical Study Family",
        status: "active",
      },
      {
        id: "family-2",
        manuscript_type: "review",
        name: "Review Family",
        status: "active",
      },
    ],
    templateFamily: {
      id: "family-2",
      manuscript_type: "review",
      name: "Review Family",
      status: "active",
    },
    journalTemplateProfiles: [
      {
        id: "journal-template-review",
        template_family_id: "family-2",
        journal_key: "cmj",
        journal_name: "中华医学杂志",
        status: "active",
      },
    ],
  });
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/templates/families",
      "GET /api/v1/templates/families/family-2/journal-templates",
    ],
  );
});

test("manuscript workbench controller hydrates referenced knowledge titles for module snapshots", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createManuscriptWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-knowledge-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-knowledge-1",
            title: "Knowledge aware manuscript",
            manuscript_type: "review",
            status: "processing",
            created_by: "editor-1",
            module_execution_overview: {
              screening: {
                module: "screening",
                observation_status: "reported",
                latest_snapshot: {
                  id: "snapshot-screening-1",
                  manuscript_id: "manuscript-knowledge-1",
                  module: "screening",
                  job_id: "job-screening-1",
                  execution_profile_id: "execution-profile-screening-1",
                  module_template_id: "template-screening-1",
                  module_template_version_no: 2,
                  prompt_template_id: "prompt-screening-1",
                  prompt_template_version: "2026-04-01",
                  skill_package_ids: ["pkg-screening"],
                  skill_package_versions: ["2026.04"],
                  model_id: "model-screening-1",
                  knowledge_item_ids: ["knowledge-1", "knowledge-2"],
                  created_asset_ids: ["asset-screening-report-1"],
                  created_at: "2026-04-16T09:01:00.000Z",
                  agent_execution: {
                    observation_status: "not_linked",
                  },
                  runtime_binding_readiness: {
                    observation_status: "reported",
                    report: {
                      status: "ready",
                      checked_at: "2026-04-16T09:01:00.000Z",
                      issues: [],
                    },
                  },
                },
              },
              editing: {
                module: "editing",
                observation_status: "reported",
                latest_snapshot: {
                  id: "snapshot-editing-1",
                  manuscript_id: "manuscript-knowledge-1",
                  module: "editing",
                  job_id: "job-editing-1",
                  execution_profile_id: "execution-profile-editing-1",
                  module_template_id: "template-editing-1",
                  module_template_version_no: 3,
                  prompt_template_id: "prompt-editing-1",
                  prompt_template_version: "2026-04-01",
                  skill_package_ids: ["pkg-editing"],
                  skill_package_versions: ["2026.04"],
                  model_id: "model-editing-1",
                  knowledge_item_ids: ["knowledge-2"],
                  created_asset_ids: ["asset-editing-1"],
                  created_at: "2026-04-16T09:02:00.000Z",
                  agent_execution: {
                    observation_status: "not_linked",
                  },
                  runtime_binding_readiness: {
                    observation_status: "reported",
                    report: {
                      status: "ready",
                      checked_at: "2026-04-16T09:02:00.000Z",
                      issues: [],
                    },
                  },
                },
              },
              proofreading: {
                module: "proofreading",
                observation_status: "not_started",
              },
            },
            created_at: "2026-04-16T09:00:00.000Z",
            updated_at: "2026-04-16T09:02:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/manuscripts/manuscript-knowledge-1/assets"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "asset-original-knowledge-1",
              manuscript_id: "manuscript-knowledge-1",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/knowledge-aware.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "editor-1",
              version_no: 1,
              is_current: true,
              file_name: "knowledge-aware.docx",
              created_at: "2026-04-16T09:00:00.000Z",
              updated_at: "2026-04-16T09:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/knowledge/assets/knowledge-1") {
        return {
          status: 200,
          body: {
            asset: {
              id: "knowledge-1",
              status: "active",
              current_revision_id: "knowledge-1-revision-4",
              current_approved_revision_id: "knowledge-1-revision-3",
              created_at: "2026-04-10T09:00:00.000Z",
              updated_at: "2026-04-16T09:00:00.000Z",
            },
            selected_revision: {
              id: "knowledge-1-revision-4",
              asset_id: "knowledge-1",
              revision_no: 4,
              status: "draft",
              title: "Primary endpoint rule draft",
              canonical_text: "draft",
              knowledge_kind: "rule",
              routing: {
                module_scope: "screening",
                manuscript_types: ["review"],
              },
              content_blocks: [],
              bindings: [],
              created_at: "2026-04-16T09:00:00.000Z",
              updated_at: "2026-04-16T09:00:00.000Z",
            },
            current_approved_revision: {
              id: "knowledge-1-revision-3",
              asset_id: "knowledge-1",
              revision_no: 3,
              status: "approved",
              title: "Primary endpoint rule",
              canonical_text: "approved",
              knowledge_kind: "rule",
              routing: {
                module_scope: "screening",
                manuscript_types: ["review"],
              },
              content_blocks: [],
              bindings: [],
              created_at: "2026-04-15T09:00:00.000Z",
              updated_at: "2026-04-15T09:00:00.000Z",
            },
            revisions: [],
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/knowledge/assets/knowledge-2") {
        return {
          status: 200,
          body: {
            asset: {
              id: "knowledge-2",
              status: "active",
              current_revision_id: "knowledge-2-revision-2",
              current_approved_revision_id: "knowledge-2-revision-2",
              created_at: "2026-04-11T09:00:00.000Z",
              updated_at: "2026-04-16T09:00:00.000Z",
            },
            selected_revision: {
              id: "knowledge-2-revision-2",
              asset_id: "knowledge-2",
              revision_no: 2,
              status: "approved",
              title: "Style glossary",
              canonical_text: "approved",
              knowledge_kind: "reference",
              routing: {
                module_scope: "editing",
                manuscript_types: ["review"],
              },
              content_blocks: [],
              bindings: [],
              created_at: "2026-04-16T09:00:00.000Z",
              updated_at: "2026-04-16T09:00:00.000Z",
            },
            revisions: [],
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const workspace = await controller.loadWorkspace("manuscript-knowledge-1");

  assert.deepEqual(workspace.knowledgeReferences, {
    "knowledge-1": {
      id: "knowledge-1",
      title: "Primary endpoint rule",
      revisionId: "knowledge-1-revision-3",
      status: "approved",
    },
    "knowledge-2": {
      id: "knowledge-2",
      title: "Style glossary",
      revisionId: "knowledge-2-revision-2",
      status: "approved",
    },
  });
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/manuscripts/manuscript-knowledge-1",
      "GET /api/v1/manuscripts/manuscript-knowledge-1/assets",
      "GET /api/v1/knowledge/assets/knowledge-1",
      "GET /api/v1/knowledge/assets/knowledge-2",
    ],
  );
});

test("manuscript workbench controller submits operator feedback and creates a governed learning candidate handoff", async () => {
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
        input.url === "/api/v1/feedback-governance/manual-feedback-handoffs"
      ) {
        return {
          status: 201,
          body: {
            feedback: {
              id: "feedback-1",
              manuscript_id: "manuscript-1",
              module: "editing",
              snapshot_id: "snapshot-editing-1",
              feedback_type: "manual_correction",
              feedback_text: "Terminology was matched to the wrong governed rule.",
              created_by: "editor-1",
              created_at: "2026-04-18T10:00:00.000Z",
            },
            learningCandidate: {
              id: "candidate-1",
              type: "rule_candidate",
              status: "draft",
              module: "editing",
              manuscript_type: "clinical_study",
              governed_provenance_kind: "human_feedback",
              governed_feedback_record_id: "feedback-1",
              snapshot_asset_id: "asset-edited-1",
              title: "修正错误命中",
              proposal_text:
                "Terminology was matched to the wrong governed rule.",
              created_by: "editor-1",
              created_at: "2026-04-18T10:00:00.000Z",
              updated_at: "2026-04-18T10:00:00.000Z",
              review_actions: [],
            },
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.submitManualFeedbackAndCreateCandidate({
    manuscriptId: "manuscript-1",
    module: "editing",
    snapshotId: "snapshot-editing-1",
    sourceAssetId: "asset-edited-1",
    feedbackCategory: "incorrect_hit",
    feedbackText: "Terminology was matched to the wrong governed rule.",
  });

  assert.equal(result.feedback.id, "feedback-1");
  assert.equal(result.learningCandidate.id, "candidate-1");
  assert.deepEqual(requests.map((request) => `${request.method} ${request.url}`), [
    "POST /api/v1/feedback-governance/manual-feedback-handoffs",
  ]);
  assert.deepEqual(requests[0]?.body, {
    input: {
      manuscriptId: "manuscript-1",
      module: "editing",
      snapshotId: "snapshot-editing-1",
      sourceAssetId: "asset-edited-1",
      feedbackCategory: "incorrect_hit",
      feedbackText: "Terminology was matched to the wrong governed rule.",
    },
  });
});

