import { once } from "node:events";
import { mkdtemp, rm, stat } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import {
  createApiHttpServer,
  createInMemoryApiRuntime,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";
import {
  createWorkbenchRuntime,
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
    const manuscript = (await manuscriptResponse.json()) as {
      id: string;
      module_execution_overview?: {
        screening: { observation_status: string };
        editing: { observation_status: string };
        proofreading: { observation_status: string };
      };
      mainline_readiness_summary?: {
        observation_status: string;
        derived_status?: string;
        next_module?: string;
      };
      mainline_attention_handoff_pack?: {
        observation_status: string;
        attention_status?: string;
        handoff_status?: string;
        to_module?: string;
        attention_items: Array<{ kind: string }>;
      };
      mainline_attempt_ledger?: {
        observation_status: string;
        total_attempts: number;
        visible_attempts: number;
        items: Array<{ job_id: string }>;
      };
    };

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
    const job = (await jobResponse.json()) as {
      id: string;
      execution_tracking?: { observation_status: string };
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
    assert.equal(
      manuscript.mainline_readiness_summary?.observation_status,
      "reported",
    );
    assert.equal(
      manuscript.mainline_readiness_summary?.derived_status,
      "ready_for_next_step",
    );
    assert.equal(
      manuscript.mainline_readiness_summary?.next_module,
      "screening",
    );
    assert.equal(
      manuscript.mainline_attention_handoff_pack?.observation_status,
      "reported",
    );
    assert.equal(
      manuscript.mainline_attention_handoff_pack?.attention_status,
      "clear",
    );
    assert.equal(
      manuscript.mainline_attention_handoff_pack?.handoff_status,
      "ready_now",
    );
    assert.equal(
      manuscript.mainline_attention_handoff_pack?.to_module,
      "screening",
    );
    assert.deepEqual(
      manuscript.mainline_attention_handoff_pack?.attention_items,
      [],
    );
    assert.equal(
      manuscript.mainline_attempt_ledger?.observation_status,
      "reported",
    );
    assert.equal(manuscript.mainline_attempt_ledger?.total_attempts, 0);
    assert.equal(manuscript.mainline_attempt_ledger?.visible_attempts, 0);
    assert.deepEqual(manuscript.mainline_attempt_ledger?.items, []);
    assert.equal(job.execution_tracking?.observation_status, "not_tracked");
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

test("workbench http manuscript and export surfaces stay hidden from non-mainline public-beta roles", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-workbench-surface-"));
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const userCookie = await loginAsDemoUser(baseUrl, "dev.user");
    const uploadResponse = await fetch(`${baseUrl}/api/v1/manuscripts/upload`, {
      method: "POST",
      headers: {
        Cookie: userCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Protected Manuscript Surface",
        manuscriptType: "review",
        createdBy: "forged-user",
        fileName: "protected-surface.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "UHVibGljIGJldGEgc3VyZmFjZSBjaGVjaw==",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      manuscript: {
        id: string;
      };
      asset: {
        id: string;
      };
      job: {
        id: string;
      };
    };
    const reviewerCookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");

    assert.equal(uploadResponse.status, 201);

    const manuscriptResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}`,
      {
        headers: {
          Cookie: reviewerCookie,
        },
      },
    );
    const templateSelectionResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/template-selection`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          journalTemplateId: "journal-template-public-beta-1",
        }),
      },
    );
    const assetsResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/assets`,
      {
        headers: {
          Cookie: reviewerCookie,
        },
      },
    );
    const jobResponse = await fetch(`${baseUrl}/api/v1/jobs/${uploaded.job.id}`, {
      headers: {
        Cookie: reviewerCookie,
      },
    });
    const exportResponse = await fetch(
      `${baseUrl}/api/v1/document-pipeline/export-current-asset`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: uploaded.manuscript.id,
        }),
      },
    );
    const downloadResponse = await fetch(
      `${baseUrl}/api/v1/document-assets/${uploaded.asset.id}/download`,
      {
        headers: {
          Cookie: reviewerCookie,
        },
      },
    );
    const blockedUploadResponse = await fetch(`${baseUrl}/api/v1/manuscripts/upload`, {
      method: "POST",
      headers: {
        Cookie: reviewerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Reviewer Upload Should Stay Hidden",
        manuscriptType: "review",
        createdBy: "forged-reviewer",
        fileName: "blocked-upload.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "QQ==",
      }),
    });

    assert.equal(manuscriptResponse.status, 403);
    assert.equal(templateSelectionResponse.status, 403);
    assert.equal(assetsResponse.status, 403);
    assert.equal(jobResponse.status, 403);
    assert.equal(exportResponse.status, 403);
    assert.equal(downloadResponse.status, 403);
    assert.equal(blockedUploadResponse.status, 403);
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("workbench http routes accept manuscript batch uploads and expose queued batch progress", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-workbench-batch-http-"));
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.user");
    const uploadResponse = await fetch(`${baseUrl}/api/v1/manuscripts/upload-batch`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        createdBy: "forged-user",
        items: [
          {
            title: "Batch HTTP Review A",
            manuscriptType: "review",
            fileName: "batch-http-a.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            fileContentBase64: "QQ==",
          },
          {
            title: "Batch HTTP Review B",
            manuscriptType: "clinical_study",
            fileName: "batch-http-b.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            fileContentBase64: "Qg==",
          },
        ],
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      batch_job: {
        id: string;
        requested_by: string;
        module: string;
        job_type: string;
      };
      items: Array<{
        manuscript: { id: string; created_by: string };
        asset: { id: string; created_by: string };
        job: { id: string; requested_by: string };
      }>;
    };

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploaded.batch_job.requested_by, "dev-user");
    assert.equal(uploaded.batch_job.module, "upload");
    assert.equal(uploaded.batch_job.job_type, "manuscript_upload_batch");
    assert.equal(uploaded.items.length, 2);
    assert.equal(uploaded.items[0]?.manuscript.created_by, "dev-user");
    assert.equal(uploaded.items[1]?.job.requested_by, "dev-user");

    const jobResponse = await fetch(`${baseUrl}/api/v1/jobs/${uploaded.batch_job.id}`, {
      headers: {
        Cookie: cookie,
      },
    });
    const job = (await jobResponse.json()) as {
      id: string;
      batch_progress?: {
        lifecycle_status: string;
        settlement_status: string;
        total_count: number;
        queued_count: number;
        running_count: number;
        succeeded_count: number;
        failed_count: number;
        cancelled_count: number;
        remaining_count: number;
        items: Array<{ status: string }>;
      };
    };

    assert.equal(jobResponse.status, 200);
    assert.equal(job.id, uploaded.batch_job.id);
    assert.equal(job.batch_progress?.lifecycle_status, "queued");
    assert.equal(job.batch_progress?.settlement_status, "in_progress");
    assert.equal(job.batch_progress?.total_count, 2);
    assert.equal(job.batch_progress?.queued_count, 2);
    assert.equal(job.batch_progress?.running_count, 0);
    assert.equal(job.batch_progress?.succeeded_count, 0);
    assert.equal(job.batch_progress?.failed_count, 0);
    assert.equal(job.batch_progress?.cancelled_count, 0);
    assert.equal(job.batch_progress?.remaining_count, 2);
    assert.deepEqual(
      job.batch_progress?.items.map((item) => item.status),
      ["queued", "queued"],
    );
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("workbench http routes expose the knowledge library revision lifecycle", async () => {
  const { server, baseUrl } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const createResponse = await fetch(`${baseUrl}/api/v1/knowledge/assets/drafts`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "HTTP knowledge library draft",
        canonicalText: "Screening should confirm endpoint reporting.",
        knowledgeKind: "rule",
        moduleScope: "screening",
        manuscriptTypes: ["clinical_study"],
        sections: ["methods"],
        bindings: [
          {
            bindingKind: "module_template",
            bindingTargetId: "template-screening-1",
            bindingTargetLabel: "Screening Template",
          },
        ],
      }),
    });
    const created = (await createResponse.json()) as {
      asset: { id: string; current_revision_id?: string };
      selected_revision: { id: string };
    };

    assert.equal(createResponse.status, 201);
    assert.equal(created.asset.id, "knowledge-1");
    assert.equal(created.selected_revision.id, "knowledge-1-revision-1");

    const submitResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/submit`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
      },
    );
    const approveResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewNote: "Approved from workbench lifecycle test.",
        }),
      },
    );

    assert.equal(submitResponse.status, 200);
    assert.equal(approveResponse.status, 200);

    const createRevisionResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/${created.asset.id}/revisions`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
      },
    );
    const derived = (await createRevisionResponse.json()) as {
      asset: { id: string };
      selected_revision: { id: string; status: string };
    };

    assert.equal(createRevisionResponse.status, 201);
    assert.equal(derived.selected_revision.id, "knowledge-1-revision-2");
    assert.equal(derived.selected_revision.status, "draft");

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${derived.selected_revision.id}/draft`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "HTTP knowledge library draft updated",
          canonicalText: "Screening should confirm endpoint reporting before review.",
          bindings: [
            {
              bindingKind: "module_template",
              bindingTargetId: "template-screening-1",
              bindingTargetLabel: "Screening Template",
            },
          ],
        }),
      },
    );
    const detailResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/${created.asset.id}?revisionId=${derived.selected_revision.id}`,
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
        title: string;
        status: string;
      };
      current_approved_revision?: {
        id: string;
      };
    };
    const historyResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/review-actions`,
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
    const libraryResponse = await fetch(`${baseUrl}/api/v1/knowledge/library`, {
      headers: {
        Cookie: cookie,
      },
    });
    const library = (await libraryResponse.json()) as {
      query_mode: string;
      items: Array<{ asset_id: string; status: string }>;
    };

    assert.equal(updateResponse.status, 200);
    assert.equal(detailResponse.status, 200);
    assert.equal(detail.asset.current_revision_id, "knowledge-1-revision-2");
    assert.equal(detail.asset.current_approved_revision_id, "knowledge-1-revision-1");
    assert.equal(detail.selected_revision.id, "knowledge-1-revision-2");
    assert.equal(detail.selected_revision.title, "HTTP knowledge library draft updated");
    assert.equal(detail.selected_revision.status, "draft");
    assert.equal(detail.current_approved_revision?.id, "knowledge-1-revision-1");
    assert.equal(historyResponse.status, 200);
    assert.deepEqual(
      history.map((record) => ({
        revision_id: record.revision_id,
        action: record.action,
      })),
      [
        {
          revision_id: "knowledge-1-revision-1",
          action: "submitted_for_review",
        },
        {
          revision_id: "knowledge-1-revision-1",
          action: "approved",
        },
      ],
    );
    assert.equal(libraryResponse.status, 200);
    assert.ok(
      library.items.some(
        (record) => record.asset_id === "knowledge-1" && record.status === "draft",
      ),
      "Expected knowledge library list to expose the derived draft revision as the authoring projection.",
    );
  } finally {
    await stopServer(server);
  }
});

test("workbench http rich-space routes support search, uploads, and semantic confirmation", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-knowledge-rich-http-"));
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const createResponse = await fetch(`${baseUrl}/api/v1/knowledge/assets/drafts`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "HTTP rich-space knowledge draft",
        canonicalText: "Screening should review rich text, tables, and images.",
        knowledgeKind: "reference",
        moduleScope: "screening",
        manuscriptTypes: ["clinical_study"],
      }),
    });
    const created = (await createResponse.json()) as {
      asset: { id: string };
      selected_revision: { id: string };
    };

    assert.equal(createResponse.status, 201);

    const uploadResponse = await fetch(`${baseUrl}/api/v1/knowledge/uploads`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: "knowledge-figure.png",
        mimeType: "image/png",
        fileContentBase64: Buffer.from("rich-space-image").toString("base64"),
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      upload_id: string;
      storage_key: string;
      file_name: string;
      mime_type: string;
      byte_length: number;
      uploaded_at: string;
    };

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploaded.file_name, "knowledge-figure.png");
    assert.equal(uploaded.mime_type, "image/png");
    assert.ok(uploaded.storage_key.length > 0);
    assert.ok(uploaded.uploaded_at.length > 0);

    const storedUpload = await stat(path.join(uploadRootDir, ...uploaded.storage_key.split("/")));
    assert.ok(storedUpload.isFile(), "Expected uploaded image to be materialized on disk.");

    const replaceResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/content-blocks/replace`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blocks: [
            {
              blockType: "text_block",
              orderNo: 1,
              contentPayload: {
                text: "Rich-space knowledge supports tables and uploaded images.",
              },
            },
            {
              blockType: "image_block",
              orderNo: 2,
              contentPayload: {
                uploadId: uploaded.upload_id,
              },
            },
          ],
        }),
      },
    );
    const replaced = (await replaceResponse.json()) as {
      content_blocks: Array<{
        block_type: string;
        content_payload: {
          upload_id?: string;
          storage_key?: string;
          file_name?: string;
          mime_type?: string;
          byte_length?: number;
        };
      }>;
      semantic_layer?: { status: string };
    };

    assert.equal(replaceResponse.status, 200);
    assert.equal(replaced.content_blocks.length, 2);
    assert.equal(
      replaced.content_blocks[1]?.content_payload.storage_key,
      uploaded.storage_key,
    );
    assert.equal(replaced.semantic_layer?.status, "stale");

    const regenerateResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/semantic-layer/regenerate`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    const regenerated = (await regenerateResponse.json()) as {
      semantic_layer?: {
        status: string;
        page_summary?: string;
      };
    };

    assert.equal(regenerateResponse.status, 200);
    assert.equal(regenerated.semantic_layer?.status, "pending_confirmation");
    assert.match(regenerated.semantic_layer?.page_summary ?? "", /rich-space/i);

    const confirmResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/semantic-layer/confirm`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageSummary: "Operator confirmed rich-space retrieval guidance.",
          retrievalTerms: ["operator-confirmed-tag", "rich-space"],
          retrievalSnippets: ["Prefer this item for semantic retrieval."],
        }),
      },
    );
    const confirmed = (await confirmResponse.json()) as {
      semantic_layer?: {
        status: string;
        page_summary?: string;
        retrieval_terms?: string[];
      };
    };

    assert.equal(confirmResponse.status, 200);
    assert.equal(confirmed.semantic_layer?.status, "confirmed");
    assert.equal(
      confirmed.semantic_layer?.page_summary,
      "Operator confirmed rich-space retrieval guidance.",
    );
    assert.deepEqual(confirmed.semantic_layer?.retrieval_terms, [
      "operator-confirmed-tag",
      "rich-space",
    ]);

    const detailResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/${created.asset.id}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const detail = (await detailResponse.json()) as {
      selected_revision: {
        content_blocks: Array<{
          content_payload: {
            storage_key?: string;
          };
        }>;
        semantic_layer?: {
          status: string;
          page_summary?: string;
        };
      };
    };

    assert.equal(detailResponse.status, 200);
    assert.equal(detail.selected_revision.semantic_layer?.status, "confirmed");
    assert.equal(
      detail.selected_revision.semantic_layer?.page_summary,
      "Operator confirmed rich-space retrieval guidance.",
    );
    assert.equal(
      detail.selected_revision.content_blocks[1]?.content_payload.storage_key,
      uploaded.storage_key,
    );

    const keywordListResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/library?search=rich-space&queryMode=keyword`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const keywordList = (await keywordListResponse.json()) as {
      query_mode: string;
      items: Array<{ asset_id: string }>;
    };

    assert.equal(keywordListResponse.status, 200);
    assert.equal(keywordList.query_mode, "keyword");
    assert.deepEqual(keywordList.items.map((item) => item.asset_id), [created.asset.id]);

    const semanticListResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/library?search=operator-confirmed-tag&queryMode=semantic`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const semanticList = (await semanticListResponse.json()) as {
      query_mode: string;
      items: Array<{ asset_id: string; semantic_status?: string }>;
    };

    assert.equal(semanticListResponse.status, 200);
    assert.equal(semanticList.query_mode, "semantic");
    assert.deepEqual(semanticList.items.map((item) => item.asset_id), [created.asset.id]);
    assert.equal(semanticList.items[0]?.semantic_status, "confirmed");
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("in-memory api runtime wires knowledge uploads for rich-space authoring", async () => {
  const uploadRootDir = await mkdtemp(
    path.join(os.tmpdir(), "medsys-knowledge-runtime-upload-"),
  );

  try {
    const runtime = createInMemoryApiRuntime({
      appEnv: "local",
      seedDemoData: false,
      uploadRootDir,
    });

    const response = await runtime.knowledgeApi.uploadImage({
      input: {
        fileName: "runtime-knowledge-figure.png",
        mimeType: "image/png",
        fileContentBase64: Buffer.from("runtime-rich-space-image").toString("base64"),
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.upload_id, "knowledge-upload-1");
    assert.equal(response.body.file_name, "runtime-knowledge-figure.png");
    assert.equal(response.body.mime_type, "image/png");
    assert.ok(response.body.storage_key.length > 0);

    const storedUpload = await stat(
      path.join(uploadRootDir, ...response.body.storage_key.split("/")),
    );
    assert.ok(
      storedUpload.isFile(),
      "Expected in-memory runtime uploads to be materialized on disk.",
    );
  } finally {
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("workbench http routes expose duplicate-check matches and acknowledgement-aware submit flows", async () => {
  const { server, baseUrl } = await startWorkbenchServer();

  try {
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const reviewerCookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const createExactResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/drafts`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Primary endpoint reporting requirements",
          canonicalText:
            "Clinical studies must report primary endpoints and statistical methods.",
          summary: "Exact duplicate baseline",
          knowledgeKind: "rule",
          moduleScope: "screening",
          manuscriptTypes: ["clinical_study"],
          aliases: ["endpoint reporting"],
          bindings: [
            {
              bindingKind: "module_template",
              bindingTargetId: "template-screening-1",
              bindingTargetLabel: "Screening Template",
            },
          ],
        }),
      },
    );
    const exact = (await createExactResponse.json()) as {
      asset: { id: string };
      selected_revision: { id: string };
    };
    assert.equal(createExactResponse.status, 201);

    const submitExactResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${exact.selected_revision.id}/submit`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          duplicateAcknowledgements: [
            {
              matched_asset_id: "seed-asset-ignore",
              severity: "possible",
            },
          ],
          actorRole: "admin",
        }),
      },
    );
    assert.equal(submitExactResponse.status, 200);
    const approveExactResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${exact.selected_revision.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewNote: "Approve exact baseline.",
        }),
      },
    );
    assert.equal(approveExactResponse.status, 200);

    const createHighResponse = await fetch(`${baseUrl}/api/v1/knowledge/assets/drafts`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Primary endpoint and stats reporting guidance",
        canonicalText:
          "Clinical studies should report primary endpoint definitions and statistical methods clearly.",
        summary: "High overlap baseline",
        knowledgeKind: "rule",
        moduleScope: "screening",
        manuscriptTypes: ["clinical_study"],
        aliases: ["stats reporting guidance"],
        bindings: [
          {
            bindingKind: "module_template",
            bindingTargetId: "template-screening-1",
            bindingTargetLabel: "Screening Template",
          },
        ],
      }),
    });
    const high = (await createHighResponse.json()) as {
      asset: { id: string };
      selected_revision: { id: string };
    };
    assert.equal(createHighResponse.status, 201);
    const submitHighResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${high.selected_revision.id}/submit`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
        },
      },
    );
    assert.equal(submitHighResponse.status, 200);
    const approveHighResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${high.selected_revision.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewNote: "Approve high baseline.",
        }),
      },
    );
    assert.equal(approveHighResponse.status, 200);

    const createPossibleResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/drafts`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Terminology consistency checklist",
          canonicalText:
            "Use consistent medical terminology and avoid mixed abbreviations.",
          summary: "Possible overlap baseline",
          knowledgeKind: "rule",
          moduleScope: "screening",
          manuscriptTypes: ["clinical_study"],
          aliases: ["shared-alias-tag"],
          bindings: [
            {
              bindingKind: "module_template",
              bindingTargetId: "template-screening-1",
              bindingTargetLabel: "Screening Template",
            },
          ],
        }),
      },
    );
    const possible = (await createPossibleResponse.json()) as {
      asset: { id: string };
      selected_revision: { id: string };
    };
    assert.equal(createPossibleResponse.status, 201);
    const submitPossibleResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${possible.selected_revision.id}/submit`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
        },
      },
    );
    assert.equal(submitPossibleResponse.status, 200);
    const approvePossibleResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${possible.selected_revision.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewNote: "Approve possible baseline.",
        }),
      },
    );
    assert.equal(approvePossibleResponse.status, 200);

    const duplicateCheckResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/duplicate-check`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Primary endpoint reporting requirements",
          canonicalText:
            "Clinical studies must report primary endpoints and statistical methods.",
          summary: "Candidate summary",
          knowledgeKind: "rule",
          moduleScope: "screening",
          manuscriptTypes: ["clinical_study"],
          aliases: ["shared-alias-tag"],
          bindings: ["template-screening-1"],
        }),
      },
    );
    const duplicateMatches = (await duplicateCheckResponse.json()) as Array<{
      severity: string;
      score: number;
      matched_asset_id: string;
      matched_revision_id: string;
      matched_title: string;
      matched_status: string;
      reasons: string[];
    }>;

    assert.equal(duplicateCheckResponse.status, 200);
    assert.ok(
      duplicateMatches.some((match) => match.severity === "exact"),
      "Expected duplicate-check response to include at least one exact match.",
    );
    assert.ok(
      duplicateMatches.some((match) => match.severity === "high"),
      "Expected duplicate-check response to include at least one high match.",
    );
    assert.ok(
      duplicateMatches.some((match) => match.severity === "possible"),
      "Expected duplicate-check response to include at least one possible match.",
    );

    const exactMatch = duplicateMatches.find(
      (match) => match.matched_asset_id === exact.asset.id,
    );
    const highMatch = duplicateMatches.find(
      (match) => match.matched_asset_id === high.asset.id,
    );
    const possibleMatch = duplicateMatches.find(
      (match) => match.matched_asset_id === possible.asset.id,
    );

    assert.equal(exactMatch?.severity, "exact");
    assert.equal(highMatch?.severity, "high");
    assert.equal(possibleMatch?.severity, "possible");
    assert.equal(exactMatch?.matched_status, "approved");
    assert.equal(highMatch?.matched_status, "approved");
    assert.equal(possibleMatch?.matched_status, "approved");
    assert.ok(
      exactMatch?.reasons.includes("canonical_text_exact_match"),
      "Expected exact match to include canonical exact reason.",
    );
    assert.ok(
      highMatch?.reasons.includes("canonical_text_high_overlap"),
      "Expected high match to include canonical overlap reason.",
    );
    assert.ok(
      possibleMatch?.reasons.includes("alias_overlap"),
      "Expected possible match to include alias overlap reason.",
    );

    const createLegacyDraftResponse = await fetch(`${baseUrl}/api/v1/knowledge/drafts`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Legacy submit compatibility draft",
        canonicalText: "Legacy submit path should remain backwards compatible.",
        knowledgeKind: "rule",
        moduleScope: "screening",
        manuscriptTypes: ["clinical_study"],
      }),
    });
    const legacyDraft = (await createLegacyDraftResponse.json()) as { id: string };
    assert.equal(createLegacyDraftResponse.status, 201);

    const legacySubmitResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${legacyDraft.id}/submit`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
        },
      },
    );
    assert.equal(legacySubmitResponse.status, 200);
  } finally {
    await stopServer(server);
  }
});

test("workbench http module routes reject operators outside the assigned public-beta desk", async () => {
  const { server, baseUrl, seededIds } = await startWorkbenchServer();

  try {
    const editorCookie = await loginAsDemoUser(baseUrl, "dev.editor");
    const screenerCookie = await loginAsDemoUser(baseUrl, "dev.screener");
    const proofreaderCookie = await loginAsDemoUser(baseUrl, "dev.proofreader");

    const screeningResponse = await fetch(`${baseUrl}/api/v1/modules/screening/run`, {
      method: "POST",
      headers: {
        Cookie: editorCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: seededIds.manuscriptId,
        parentAssetId: seededIds.originalAssetId,
        requestedBy: "forged-requester",
        actorRole: "admin",
        storageKey: "runs/http/forbidden-screening/report.md",
        fileName: "forbidden-screening-report.md",
      }),
    });
    const editingResponse = await fetch(`${baseUrl}/api/v1/modules/editing/run`, {
      method: "POST",
      headers: {
        Cookie: screenerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: seededIds.manuscriptId,
        parentAssetId: seededIds.originalAssetId,
        requestedBy: "forged-requester",
        actorRole: "admin",
        storageKey: "runs/http/forbidden-editing/final.docx",
        fileName: "forbidden-editing-final.docx",
      }),
    });
    const proofreadingResponse = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/draft`,
      {
        method: "POST",
        headers: {
          Cookie: editorCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: seededIds.manuscriptId,
          parentAssetId: seededIds.originalAssetId,
          requestedBy: "forged-requester",
          actorRole: "admin",
          storageKey: "runs/http/forbidden-proofreading/draft.md",
          fileName: "forbidden-proofreading-draft.md",
        }),
      },
    );
    const screeningUploadResponse = await fetch(
      `${baseUrl}/api/v1/modules/screening/run`,
      {
        method: "POST",
        headers: {
          Cookie: proofreaderCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: seededIds.manuscriptId,
          parentAssetId: seededIds.originalAssetId,
          requestedBy: "forged-requester",
          actorRole: "admin",
          storageKey: "runs/http/forbidden-screening-proofreader/report.md",
          fileName: "forbidden-screening-proofreader-report.md",
        }),
      },
    );

    assert.equal(screeningResponse.status, 403);
    assert.equal(editingResponse.status, 403);
    assert.equal(proofreadingResponse.status, 403);
    assert.equal(screeningUploadResponse.status, 403);
  } finally {
    await stopServer(server);
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
      status: string;
      evidence_ids: string[];
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
    assert.equal(runs[0]?.status, "passed");
    assert.equal(runs[0]?.sample_set_id, undefined);
    assert.equal(runs[0]?.release_check_profile_id, "release-profile-screening-1");
    assert.equal(runs[0]?.run_item_count, 0);
    assert.equal(runs[0]?.evidence_ids.length, 1);
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

    const runEvidenceResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${runs[0]!.id}/evidence`,
      {
        headers: { Cookie: adminCookie },
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
    assert.equal(runEvidence[0]?.check_profile_id, "check-profile-screening-1");
    assert.equal(
      runEvidence[0]?.uri,
      `/api/v1/document-assets/${body.asset.id}/download`,
    );
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
      status: string;
      evidence_ids: string[];
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
    assert.equal(runs[0]?.status, "passed");
    assert.equal(runs[0]?.sample_set_id, undefined);
    assert.equal(runs[0]?.release_check_profile_id, "release-profile-editing-1");
    assert.equal(runs[0]?.run_item_count, 0);
    assert.equal(runs[0]?.evidence_ids.length, 1);
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

    const runEvidenceResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${runs[0]!.id}/evidence`,
      {
        headers: { Cookie: adminCookie },
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
    assert.equal(runEvidence[0]?.check_profile_id, "check-profile-editing-1");
    assert.equal(
      runEvidence[0]?.uri,
      `/api/v1/document-assets/${body.asset.id}/download`,
    );
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
      status: string;
      evidence_ids: string[];
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
    assert.equal(finalizedRuns[0]?.status, "passed");
    assert.equal(
      finalizedRuns[0]?.release_check_profile_id,
      "release-profile-proofreading-1",
    );
    assert.equal(finalizedRuns[0]?.sample_set_id, undefined);
    assert.equal(finalizedRuns[0]?.run_item_count, 0);
    assert.equal(finalizedRuns[0]?.evidence_ids.length, 1);
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

    const finalizedRunEvidenceResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-runs/${finalizedRuns[0]!.id}/evidence`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    const finalizedRunEvidence = (await finalizedRunEvidenceResponse.json()) as Array<{
      id: string;
      check_profile_id?: string;
      uri?: string;
    }>;
    assert.equal(finalizedRunEvidenceResponse.status, 200);
    assert.equal(finalizedRunEvidence.length, 1);
    assert.equal(finalizedRunEvidence[0]?.id, finalizedRuns[0]?.evidence_ids[0]);
    assert.equal(
      finalizedRunEvidence[0]?.check_profile_id,
      "check-profile-proofreading-1",
    );
    assert.equal(
      finalizedRunEvidence[0]?.uri,
      `/api/v1/document-assets/${finalized.asset.id}/download`,
    );
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
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/finalized-results?history_window=latest_10`,
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
        evidence: Array<{ id: string; label: string; uri?: string }>;
      }>;
    assert.equal(suiteFinalizedResults.length, 1);
    assert.equal(suiteFinalizedResults[0]?.run.id, run.id);
    assert.equal(suiteFinalizedResults[0]?.evidence_pack.id, finalized.evidence_pack.id);
    assert.equal(
      suiteFinalizedResults[0]?.recommendation.status,
      finalized.recommendation.status,
    );
    assert.equal(suiteFinalizedResults[0]?.evidence.length, 1);
    assert.equal(suiteFinalizedResults[0]?.evidence[0]?.id, evidence.id);
    assert.equal(
      suiteFinalizedResults[0]?.evidence[0]?.label,
      "Demo evaluation browser QA",
    );
    assert.equal(
      suiteFinalizedResults[0]?.evidence[0]?.uri,
      "https://example.test/evidence/browser-qa",
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

test("verification ops http suite finalized-results route enforces latest_10 and all_suite windows in memory runtime", async () => {
  const { server, baseUrl, runtime } = await startWorkbenchServerWithRuntime();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    await seedInMemorySuiteFinalizations(runtime, "suite-editing-1", 12);

    const latestWindowResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/suite-editing-1/finalized-results?history_window=latest_10`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(latestWindowResponse.status, 200);
    const latestWindow = (await latestWindowResponse.json()) as Array<{
      run: { id: string };
      evidence: Array<{ id: string }>;
    }>;
    assert.equal(latestWindow.length, 10);
    assert.ok(latestWindow.every((entry) => entry.evidence.length === 1));

    const allSuiteResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/suite-editing-1/finalized-results?history_window=all_suite`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(allSuiteResponse.status, 200);
    const allSuite = (await allSuiteResponse.json()) as Array<{
      run: { id: string };
    }>;
    assert.equal(allSuite.length, 12);
    assert.ok(
      latestWindow.every((entry) => allSuite.some((candidate) => candidate.run.id === entry.run.id)),
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

async function startWorkbenchServerWithRuntime(): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
  runtime: ReturnType<typeof createWorkbenchRuntime>;
}> {
  const runtime = createWorkbenchRuntime();
  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    runtime: runtime as never,
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string", "Expected a tcp server address.");

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    runtime,
  };
}

async function seedInMemorySuiteFinalizations(
  runtime: ReturnType<typeof createWorkbenchRuntime>,
  suiteId: string,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const run = (
      await runtime.verificationOpsApi.createEvaluationRun({
        actorRole: "admin",
        input: {
          suiteId,
        },
      })
    ).body;
    const evidence = (
      await runtime.verificationOpsApi.recordVerificationEvidence({
        actorRole: "admin",
        input: {
          kind: "url",
          label: `Window evidence ${index + 1}`,
          uri: `https://example.test/window/${index + 1}`,
        },
      })
    ).body;

    await runtime.verificationOpsApi.completeEvaluationRun({
      actorRole: "admin",
      runId: run.id,
      status: "passed",
      evidenceIds: [evidence.id],
    });
    await runtime.verificationOpsApi.finalizeEvaluationRun({
      actorRole: "admin",
      runId: run.id,
    });
  }
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
