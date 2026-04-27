import { once } from "node:events";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
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
import { NoModelRouteConfiguredError } from "../../src/modules/ai-gateway/index.ts";
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

    const manuscriptsResponse = await fetch(`${baseUrl}/api/v1/manuscripts`, {
      headers: {
        Cookie: cookie,
      },
    });
    const manuscripts = (await manuscriptsResponse.json()) as Array<{
      id: string;
      title: string;
      module_execution_overview?: unknown;
    }>;

    assert.equal(manuscriptsResponse.status, 200);
    assert.equal(manuscripts[0]?.id, uploaded.manuscript.id);
    assert.equal(manuscripts[0]?.title, "Uploaded Through HTTP");
    assert.ok(manuscripts[0]?.module_execution_overview);

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
    const assets = (await assetsResponse.json()) as Array<{
      id: string;
      asset_type?: string;
      parent_asset_id?: string;
    }>;

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
    assert.equal(
      assets.some((asset) => asset.id === uploaded.asset.id),
      true,
    );
    assert.equal(
      assets.some(
        (asset) =>
          asset.asset_type === "normalized_docx" &&
          asset.parent_asset_id === uploaded.asset.id,
      ),
      true,
    );
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

test("workbench http doc uploads are marked for docx normalization", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-doc-upload-"));
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
        title: "Legacy Doc Upload",
        manuscriptType: "clinical_study",
        createdBy: "forged-user",
        fileName: "legacy-submission.doc",
        mimeType: "application/msword",
        fileContentBase64: "RG9jIGJpbmFyeSBwbGFjZWhvbGRlcg==",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      asset: {
        file_name?: string;
        mime_type: string;
      };
      job: {
        payload?: {
          normalization?: {
            source_type?: string;
            target_type?: string;
            conversion?: {
              required?: boolean;
              status?: string;
              backend?: string;
            };
            preview?: {
              status?: string;
            };
            derived_asset?: {
              asset_type?: string;
              file_name?: string;
            };
          };
        };
      };
    };

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploaded.asset.file_name, "legacy-submission.doc");
    assert.equal(uploaded.asset.mime_type, "application/msword");
    assert.equal(uploaded.job.payload?.normalization?.source_type, "doc");
    assert.equal(uploaded.job.payload?.normalization?.target_type, "docx");
    assert.equal(
      uploaded.job.payload?.normalization?.conversion?.required,
      true,
    );
    assert.equal(
      uploaded.job.payload?.normalization?.conversion?.backend,
      "libreoffice",
    );
    assert.equal(
      uploaded.job.payload?.normalization?.preview?.status,
      "pending_normalization",
    );
    assert.equal(
      uploaded.job.payload?.normalization?.derived_asset?.asset_type,
      "normalized_docx",
    );
    assert.equal(
      uploaded.job.payload?.normalization?.derived_asset?.file_name,
      "legacy-submission.normalized.docx",
    );
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("workbench http automatically converts doc uploads into downloadable normalized docx assets", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-doc-convert-http-"));
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
    documentNormalization: {
      libreOfficeAvailable: true,
      libreOfficeBinary: "fake-soffice",
      runCommand: async ({ args, outputDir }) => {
        const sourcePath = args.at(-1);
        assert.ok(sourcePath, "Expected libreoffice command to receive a source path.");
        await writeFile(
          path.join(outputDir, `${path.parse(sourcePath).name}.docx`),
          "converted-docx",
        );
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    },
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
        title: "Legacy Doc Auto Conversion",
        manuscriptType: "clinical_study",
        createdBy: "forged-user",
        fileName: "legacy-convert.doc",
        mimeType: "application/msword",
        fileContentBase64: "TGVnYWN5IGRvYyBieXRlcw==",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      manuscript: { id: string };
      asset: { id: string };
    };

    const assetsResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/assets`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const assetsPayload = (await assetsResponse.json()) as Array<{
      id?: string;
      asset_type?: string;
      parent_asset_id?: string;
      file_name?: string;
      mime_type?: string;
    }>;
    const normalizedAsset = assetsPayload.find(
      (asset) => asset.asset_type === "normalized_docx",
    );

    assert.equal(uploadResponse.status, 201);
    assert.equal(assetsResponse.status, 200);
    assert.equal(normalizedAsset?.parent_asset_id, uploaded.asset.id);
    assert.equal(normalizedAsset?.file_name, "legacy-convert.normalized.docx");

    const downloadResponse = await fetch(
      `${baseUrl}/api/v1/document-assets/${normalizedAsset?.id}/download`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const downloadedBody = Buffer.from(await downloadResponse.arrayBuffer()).toString(
      "utf8",
    );

    assert.equal(downloadResponse.status, 200);
    assert.equal(downloadedBody, "converted-docx");
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("workbench http routes archive manuscripts from the recent manuscript list", async () => {
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
        title: "Archive From History",
        manuscriptType: "review",
        fileName: "archive-from-history.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "QXJjaGl2ZSBmcm9tIGhpc3Rvcnk=",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      manuscript: {
        id: string;
      };
    };

    const beforeArchiveResponse = await fetch(`${baseUrl}/api/v1/manuscripts`, {
      headers: {
        Cookie: cookie,
      },
    });
    const beforeArchive = (await beforeArchiveResponse.json()) as Array<{
      id: string;
    }>;

    assert.equal(uploadResponse.status, 201);
    assert.equal(beforeArchiveResponse.status, 200);
    assert.ok(beforeArchive.some((item) => item.id === uploaded.manuscript.id));

    const archiveResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/archive`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
      },
    );
    const archived = (await archiveResponse.json()) as {
      id: string;
      status: string;
    };

    const afterArchiveResponse = await fetch(`${baseUrl}/api/v1/manuscripts`, {
      headers: {
        Cookie: cookie,
      },
    });
    const afterArchive = (await afterArchiveResponse.json()) as Array<{
      id: string;
    }>;

    assert.equal(archiveResponse.status, 200);
    assert.equal(archived.id, uploaded.manuscript.id);
    assert.equal(archived.status, "archived");
    assert.equal(afterArchiveResponse.status, 200);
    assert.equal(afterArchive.some((item) => item.id === uploaded.manuscript.id), false);
  } finally {
    await stopServer(server);
  }
});

test("workbench http automatically registers normalized assets for docx uploads", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-normalize-http-"));
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
        title: "Normalize Existing Docx",
        manuscriptType: "clinical_study",
        createdBy: "forged-user",
        fileName: "already-docx.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "RG9jeCBieXRlcw==",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      manuscript: { id: string };
      asset: {
        id: string;
        file_name?: string;
        mime_type: string;
        storage_key: string;
      };
      job: { id: string };
    };

    const assetsResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/assets`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const assetsPayload = (await assetsResponse.json()) as Array<{
        id?: string;
        asset_type?: string;
        parent_asset_id?: string;
        file_name?: string;
        mime_type?: string;
      }>;
    const normalizedAsset = assetsPayload.find(
      (asset) => asset.asset_type === "normalized_docx",
    );

    assert.equal(assetsResponse.status, 200);
    assert.equal(normalizedAsset?.asset_type, "normalized_docx");
    assert.equal(normalizedAsset?.parent_asset_id, uploaded.asset.id);
    assert.equal(
      normalizedAsset?.mime_type,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    assert.equal(normalizedAsset?.file_name, "already-docx.normalized.docx");

    const downloadResponse = await fetch(
      `${baseUrl}/api/v1/document-assets/${normalizedAsset?.id}/download`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const downloadedBody = Buffer.from(await downloadResponse.arrayBuffer());

    assert.equal(downloadResponse.status, 200);
    assert.match(
      downloadResponse.headers.get("content-type") ?? "",
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i,
    );
    assert.equal(downloadedBody.toString("utf8"), "Docx bytes");
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("proofreading pass-run detail exposes segment audit fields", async () => {
  const { server, baseUrl, seededIds, runtime } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const timestamp = "2026-04-26T09:00:00.000Z";
    await runtime.proofreadingPassRunRepository.save({
      id: "pass-run-segment-audit-1",
      manuscript_id: seededIds.manuscriptId,
      job_id: "job-proofreading-segment-audit-1",
      snapshot_id: "snapshot-proofreading-segment-audit-1",
      pass_no: 1,
      pass_kind: "medical_facts_and_terminology",
      status: "completed",
      model_id: seededIds.proofreadingModelId,
      rule_ids: [],
      knowledge_item_ids: [seededIds.proofreadingKnowledgeId],
      quality_package_ids: [],
      skill_package_ids: [],
      output: {
        summary: "Segmented audit run.",
        issues: [],
        governedEvidenceCounts: {
          failedChecks: 0,
          manualReviewItems: 0,
          qualityFindings: 0,
        },
        segmentation: {
          mode: "segmented_candidate_discovery",
          segmentCount: 1,
          totalBlockCount: 3,
          coveredBlockCount: 2,
          coverageRatio: 2 / 3,
          completedSegmentCount: 1,
          failedSegmentCount: 0,
          segments: [
            {
              segmentNo: 1,
              blockStartIndex: 0,
              blockEndIndex: 2,
              blockIndexes: [0, 2],
              blockCount: 2,
              inputPreview: [
                {
                  blockIndex: 2,
                  section: "缁撴灉",
                  blockKind: "table",
                  textPreview: "Table 1 baseline comparison",
                },
              ],
              issueCount: 0,
              status: "completed",
              attemptCount: 2,
              elapsedMs: 321,
            },
          ],
        },
      },
      retry_count: 0,
      started_at: timestamp,
      finished_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    });

    const response = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/pass-runs/pass-run-segment-audit-1`,
      {
        headers: { Cookie: cookie },
      },
    );
    const detail = (await response.json()) as {
      id: string;
      output?: {
        segmentation?: {
          segments?: Array<{
            blockIndexes?: number[];
            inputPreview?: Array<{
              blockIndex?: number;
              textPreview?: string;
            }>;
            attemptCount?: number;
            elapsedMs?: number;
            status?: string;
          }>;
        };
      };
    };

    assert.equal(response.status, 200);
    assert.equal(detail.id, "pass-run-segment-audit-1");
    assert.deepEqual(
      detail.output?.segmentation?.segments?.[0]?.blockIndexes,
      [0, 2],
    );
    assert.equal(
      detail.output?.segmentation?.segments?.[0]?.inputPreview?.[0]?.textPreview,
      "Table 1 baseline comparison",
    );
    assert.equal(detail.output?.segmentation?.segments?.[0]?.attemptCount, 2);
    assert.equal(detail.output?.segmentation?.segments?.[0]?.elapsedMs, 321);
    assert.equal(detail.output?.segmentation?.segments?.[0]?.status, "completed");
  } finally {
    await stopServer(server);
  }
});

test("workbench http asset downloads support unicode file names via RFC 5987 content disposition", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-workbench-http-unicode-"));
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
        title: "Unicode Download Through HTTP",
        manuscriptType: "review",
        createdBy: "forged-user",
        fileName: "medical-manuscript-proofreading.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "VW5pY29kZSBkb3dubG9hZCBwYXlsb2Fk",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      asset: {
        id: string;
      };
    };
    assert.equal(uploadResponse.status, 201);

    const downloadResponse = await fetch(
      `${baseUrl}/api/v1/document-assets/${uploaded.asset.id}/download`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );

    assert.equal(downloadResponse.status, 200);
    assert.match(
      downloadResponse.headers.get("content-disposition") ?? "",
      /filename\*=UTF-8''medical-manuscript-proofreading\.docx/i,
    );
    assert.equal(await downloadResponse.text(), "Unicode download payload");
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("workbench http preview-session route creates a read-only preview session for manuscript assets", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-workbench-preview-http-"));
  const originalOnlyOfficeJwtSecret = process.env.ONLYOFFICE_JWT_SECRET;
  process.env.ONLYOFFICE_JWT_SECRET = "preview-session-http-secret";
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
        title: "Preview Through HTTP",
        manuscriptType: "review",
        createdBy: "forged-user",
        fileName: "preview-through-http.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "UHJldmlldyBtZSB0aHJvdWdoIEhUVFA=",
      }),
    });
    const uploaded = (await uploadResponse.json()) as {
      manuscript: {
        id: string;
      };
      asset: {
        id: string;
      };
    };
    assert.equal(uploadResponse.status, 201);

    const previewResponse = await fetch(
      `${baseUrl}/api/v1/document-pipeline/preview-session`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: uploaded.manuscript.id,
          assetId: uploaded.asset.id,
          actorRole: "proofreader",
          comments: [
            {
              id: "comment-preview-1",
              body: "Confirm the manuscript preview opens in read-only mode.",
            },
          ],
        }),
      },
    );
    const preview = (await previewResponse.json()) as {
      manuscript_id: string;
      source_asset_id: string;
      session_id: string;
      viewer: string;
      mode: string;
      status: string;
      comment_source: string;
      save_back_enabled: boolean;
      document: {
        download_path: string;
      };
      authorization: {
        token_scheme: string;
        access_token?: string;
      };
      comments: Array<{ id: string; body: string }>;
    };

    assert.equal(previewResponse.status, 200);
    assert.equal(preview.manuscript_id, uploaded.manuscript.id);
    assert.equal(preview.source_asset_id, uploaded.asset.id);
    assert.match(preview.session_id, /^[0-9a-f-]{36}$/u);
    assert.equal(preview.viewer, "onlyoffice");
    assert.equal(preview.mode, "view");
    assert.equal(preview.status, "ready");
    assert.equal(preview.comment_source, "onlyoffice");
    assert.equal(preview.save_back_enabled, false);
    assert.equal(preview.authorization.token_scheme, "surface_session_jwt");
    assert.match(
      preview.authorization.access_token ?? "",
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u,
    );
    assert.deepEqual(preview.comments, [
      {
        id: "comment-preview-1",
        body: "Confirm the manuscript preview opens in read-only mode.",
      },
    ]);

    const unauthorizedDownloadResponse = await fetch(
      `${baseUrl}${preview.document.download_path}`,
    );
    assert.equal(unauthorizedDownloadResponse.status, 401);

    const surfaceDownloadUrl = new URL(
      `${baseUrl}${preview.document.download_path}`,
    );
    surfaceDownloadUrl.searchParams.set(
      "surfaceAccessToken",
      preview.authorization.access_token ?? "",
    );
    const surfaceDownloadResponse = await fetch(surfaceDownloadUrl);
    const downloadedBody = Buffer.from(
      await surfaceDownloadResponse.arrayBuffer(),
    ).toString("utf8");

    assert.equal(surfaceDownloadResponse.status, 200);
    assert.equal(downloadedBody, "Preview me through HTTP");
  } finally {
    await stopServer(server);
    if (originalOnlyOfficeJwtSecret == null) {
      delete process.env.ONLYOFFICE_JWT_SECRET;
    } else {
      process.env.ONLYOFFICE_JWT_SECRET = originalOnlyOfficeJwtSecret;
    }
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("workbench http preview callback acknowledges read-only onlyoffice pings", async () => {
  const { server, baseUrl } = await startWorkbenchServer();

  try {
    const callbackResponse = await fetch(
      `${baseUrl}/api/v1/document-pipeline/preview-callback?sessionId=preview-session-http-1`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: 1,
          key: "asset-preview-1",
        }),
      },
    );
    const callbackBody = (await callbackResponse.json()) as {
      error?: number;
    };

    assert.equal(callbackResponse.status, 200);
    assert.deepEqual(callbackBody, {
      error: 0,
    });
  } finally {
    await stopServer(server);
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
        body: JSON.stringify({}),
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

    assert.equal(manuscriptResponse.status, 200);
    assert.equal(templateSelectionResponse.status, 200);
    assert.equal(assetsResponse.status, 200);
    assert.equal(jobResponse.status, 200);
    assert.equal(exportResponse.status, 200);
    assert.equal(downloadResponse.status, 200);
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
    for (const item of uploaded.items) {
      const assetsResponse = await fetch(
        `${baseUrl}/api/v1/manuscripts/${item.manuscript.id}/assets`,
        {
          headers: {
            Cookie: cookie,
          },
        },
      );
      const assets = (await assetsResponse.json()) as Array<{
        asset_type?: string;
        parent_asset_id?: string;
      }>;

      assert.equal(assetsResponse.status, 200);
      assert.equal(
        assets.some(
          (asset) =>
            asset.asset_type === "normalized_docx" &&
            asset.parent_asset_id === item.asset.id,
        ),
        true,
      );
    }

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

    const tableEvidenceResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/table-evidence-packages`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledgeItemId: created.asset.id,
          revisionId: created.selected_revision.id,
          sourceKind: "word_clipboard",
          sourceEnvironment: {
            source_application: "word",
            application_version: "Microsoft Word 2021",
            browser: "chromium",
            os: "windows",
            clipboard_mime_types: ["text/html", "text/plain"],
            clipboard_html_available: true,
            ooxml_fragment_available: true,
            fallback_posture: "none",
          },
          requestedAuthoritativeStatus: "authoritative",
          tableFullFidelitySnapshot: {
            mandatory_fact_authority: {
              identity: "authoritative",
              structure: "authoritative",
              border_system: "authoritative",
              layout: "authoritative",
              paragraph_style: "authoritative",
              typography: "authoritative",
              rich_content: "authoritative",
              object_content: "authoritative",
              authority_markers: "authoritative",
            },
            facts: {
              caption: { text: "琛?1 鍩虹嚎鐗瑰緛", position: "above" },
              local_rich_text_fragments: [{ cell: "r1c1", italic: true }],
            },
          },
        }),
      },
    );
    const tableEvidence = (await tableEvidenceResponse.json()) as {
      id: string;
      authoritative_status: string;
      source_environment: { ooxml_fragment_available?: boolean };
      capture_failure_codes: string[];
    };

    assert.equal(tableEvidenceResponse.status, 201);
    assert.equal(tableEvidence.id, "knowledge-2");
    assert.equal(tableEvidence.authoritative_status, "authoritative");
    assert.equal(tableEvidence.source_environment.ooxml_fragment_available, true);
    assert.deepEqual(tableEvidence.capture_failure_codes, []);

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

test("workbench http routes expose knowledge ai intake and semantic assist suggestions without persistence", async () => {
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
        title: "AI assist baseline draft",
        canonicalText: "Clinical studies must define the primary endpoint.",
        knowledgeKind: "rule",
        moduleScope: "screening",
        manuscriptTypes: ["clinical_study"],
      }),
    });
    const created = (await createResponse.json()) as {
      asset: { id: string };
      selected_revision: { id: string };
    };

    assert.equal(createResponse.status, 201);

    const intakeResponse = await fetch(`${baseUrl}/api/v1/knowledge/library/ai-intake`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceText:
          "Clinical studies must disclose the primary endpoint in the methods section.",
        sourceLabel: "Guideline excerpt",
        operatorHints: "Focus on screening usage.",
      }),
    });
    const intakeBody = (await intakeResponse.json()) as {
      suggestedDraft: { title: string };
      warnings: string[];
    };

    const semanticAssistResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/semantic-layer/assist`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instructionText:
            "Make retrieval terms broader without changing title ownership.",
          targetScopes: ["semantic_layer", "metadata_patch"],
        }),
      },
    );
    const semanticAssistBody = (await semanticAssistResponse.json()) as {
      suggestedSemanticLayer: { pageSummary: string };
      suggestedFieldPatch: { aliases: string[] };
      warnings: string[];
    };

    const assetResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/${created.asset.id}?revisionId=${created.selected_revision.id}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const assetBody = (await assetResponse.json()) as {
      selected_revision: {
        title: string;
        summary?: string;
      };
    };

    assert.equal(intakeResponse.status, 200);
    assert.equal(intakeBody.suggestedDraft.title, "Primary endpoint rule");
    assert.ok(intakeBody.warnings.length > 0);
    assert.equal(semanticAssistResponse.status, 200);
    assert.equal(
      semanticAssistBody.suggestedSemanticLayer.pageSummary,
      "Operator-ready semantic summary.",
    );
    assert.deepEqual(semanticAssistBody.suggestedFieldPatch.aliases, [
      "endpoint definition",
    ]);
    assert.equal(assetResponse.status, 200);
    assert.equal(assetBody.selected_revision.title, "AI assist baseline draft");
    assert.equal(assetBody.selected_revision.summary, undefined);
  } finally {
    await stopServer(server);
  }
});

test("workbench http knowledge ai intake returns service unavailable when no model route is configured", async () => {
  const runtime = createWorkbenchRuntime();
  runtime.knowledgeApi.createAiIntakeSuggestion = async () => {
    throw new NoModelRouteConfiguredError("editing");
  };

  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    runtime: runtime as never,
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string", "Expected a tcp server address.");
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const intakeResponse = await fetch(`${baseUrl}/api/v1/knowledge/library/ai-intake`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceText: "Clinical studies must disclose the primary endpoint.",
      }),
    });
    const intakeBody = (await intakeResponse.json()) as {
      error: string;
      message: string;
    };

    assert.equal(intakeResponse.status, 503);
    assert.equal(intakeBody.error, "service_unavailable");
    assert.match(intakeBody.message, /model route/i);
  } finally {
    await stopServer(server);
  }
});

test("default in-memory http runtime exposes knowledge ai intake and semantic assist suggestions", async () => {
  const { server, baseUrl } = await startDefaultDemoServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const createResponse = await fetch(`${baseUrl}/api/v1/knowledge/assets/drafts`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Default runtime AI assist baseline draft",
        canonicalText: "Clinical studies must define the primary endpoint.",
        knowledgeKind: "rule",
        moduleScope: "screening",
        manuscriptTypes: ["clinical_study"],
      }),
    });
    const created = (await createResponse.json()) as {
      asset: { id: string };
      selected_revision: { id: string };
    };

    assert.equal(createResponse.status, 201);

    const intakeResponse = await fetch(`${baseUrl}/api/v1/knowledge/library/ai-intake`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceText:
          "Clinical studies must disclose the primary endpoint in the methods section.",
        sourceLabel: "Guideline excerpt",
        operatorHints: "Focus on screening usage.",
      }),
    });
    const intakeBody = (await intakeResponse.json()) as {
      suggestedDraft: { title: string };
      warnings: string[];
    };

    const semanticAssistResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${created.selected_revision.id}/semantic-layer/assist`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instructionText:
            "Make retrieval terms broader without changing title ownership.",
          targetScopes: ["semantic_layer", "metadata_patch"],
        }),
      },
    );
    const semanticAssistBody = (await semanticAssistResponse.json()) as {
      suggestedSemanticLayer: { pageSummary: string };
      suggestedFieldPatch: { aliases: string[] };
      warnings: string[];
    };

    assert.equal(intakeResponse.status, 200);
    assert.equal(intakeBody.suggestedDraft.title, "Primary endpoint rule");
    assert.ok(intakeBody.warnings.length > 0);
    assert.equal(semanticAssistResponse.status, 200);
    assert.equal(
      semanticAssistBody.suggestedSemanticLayer.pageSummary,
      "Operator-ready semantic summary.",
    );
    assert.deepEqual(semanticAssistBody.suggestedFieldPatch.aliases, [
      "endpoint definition",
    ]);
    assert.ok(semanticAssistBody.warnings.length > 0);
  } finally {
    await stopServer(server);
  }
});

test("default in-memory http runtime exposes resolvable package default-rule assets", async () => {
  const { server, baseUrl } = await startDefaultDemoServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const libraryResponse = await fetch(`${baseUrl}/api/v1/knowledge/library`, {
      headers: {
        Cookie: cookie,
      },
    });
    const library = (await libraryResponse.json()) as {
      items: Array<{
        asset_id: string;
        selected_revision_id?: string;
      }>;
    };

    const generalModulesResponse = await fetch(
      `${baseUrl}/api/v1/templates/content-modules?moduleClass=general`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const generalModules = (await generalModulesResponse.json()) as Array<{
      id: string;
      status: string;
    }>;
    const medicalModulesResponse = await fetch(
      `${baseUrl}/api/v1/templates/content-modules?moduleClass=medical_specialized`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const medicalModules = (await medicalModulesResponse.json()) as Array<{
      id: string;
      status: string;
    }>;
    const templateCompositionsResponse = await fetch(
      `${baseUrl}/api/v1/templates/template-compositions`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const templateCompositions = (await templateCompositionsResponse.json()) as Array<{
      id: string;
      general_module_ids: string[];
      medical_module_ids: string[];
      status: string;
    }>;
    const ruleSetsResponse = await fetch(`${baseUrl}/api/v1/editorial-rules/rule-sets`, {
      headers: {
        Cookie: cookie,
      },
    });
    const ruleSets = (await ruleSetsResponse.json()) as Array<{
      id: string;
      status: string;
    }>;
    const screeningRulesResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets/rule-set-screening-1/rules`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const screeningRules = (await screeningRulesResponse.json()) as Array<{
      id: string;
    }>;
    const editingRulesResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets/rule-set-editing-1/rules`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const editingRules = (await editingRulesResponse.json()) as Array<{
      id: string;
    }>;
    const proofreadingRulesResponse = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets/rule-set-proofreading-1/rules`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const proofreadingRules = (await proofreadingRulesResponse.json()) as Array<{
      id: string;
    }>;

    const generalRuleDetailResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/knowledge-general-reference-1`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const generalRuleDetail = (await generalRuleDetailResponse.json()) as {
      selected_revision: {
        id: string;
        bindings: Array<{
          binding_kind: string;
          binding_target_id: string;
        }>;
      };
    };
    const generalStructureRuleDetailResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/knowledge-general-structure-1`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const generalStructureRuleDetail = (await generalStructureRuleDetailResponse.json()) as {
      selected_revision: {
        id: string;
        bindings: Array<{
          binding_kind: string;
          binding_target_id: string;
        }>;
      };
    };
    const medicalRuleDetailResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/knowledge-medical-ethics-1`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const medicalRuleDetail = (await medicalRuleDetailResponse.json()) as {
      selected_revision: {
        id: string;
        bindings: Array<{
          binding_kind: string;
          binding_target_id: string;
        }>;
      };
    };
    const medicalStudyDesignRuleDetailResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/assets/knowledge-medical-study-design-1`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const medicalStudyDesignRuleDetail = (await medicalStudyDesignRuleDetailResponse.json()) as {
      selected_revision: {
        id: string;
        bindings: Array<{
          binding_kind: string;
          binding_target_id: string;
        }>;
      };
    };

    assert.equal(libraryResponse.status, 200);
    assert.equal(
      library.items.find((item) => item.asset_id === "knowledge-screening-1")
        ?.selected_revision_id,
      "knowledge-screening-1-revision-1",
    );
    assert.equal(
      library.items.find((item) => item.asset_id === "knowledge-general-reference-1")
        ?.selected_revision_id,
      "knowledge-general-reference-1-revision-1",
    );
    assert.equal(
      library.items.find((item) => item.asset_id === "knowledge-general-structure-1")
        ?.selected_revision_id,
      "knowledge-general-structure-1-revision-1",
    );
    assert.equal(
      library.items.find((item) => item.asset_id === "knowledge-medical-study-design-1")
        ?.selected_revision_id,
      "knowledge-medical-study-design-1-revision-1",
    );
    assert.equal(generalModulesResponse.status, 200);
    assert.equal(medicalModulesResponse.status, 200);
    assert.equal(generalModules.length, 6);
    assert.deepEqual(
      generalModules.map((item) => item.id).sort(),
      [
        "general-module-seeded-1",
        "general-module-seeded-2",
        "general-module-seeded-3",
        "general-module-seeded-4",
        "general-module-seeded-5",
        "general-module-seeded-6",
      ].sort(),
    );
    assert.equal(generalModules.every((item) => item.status === "published"), true);
    assert.equal(medicalModules.length, 5);
    assert.deepEqual(
      medicalModules.map((item) => item.id).sort(),
      [
        "medical-module-seeded-1",
        "medical-module-seeded-2",
        "medical-module-seeded-3",
        "medical-module-seeded-4",
        "medical-module-seeded-5",
      ].sort(),
    );
    assert.equal(medicalModules.every((item) => item.status === "published"), true);
    assert.equal(templateCompositionsResponse.status, 200);
    const clinicalStudyComposition = templateCompositions.find(
      (item) => item.id === "template-composition-seeded-1",
    );
    assert.ok(clinicalStudyComposition);
    assert.deepEqual(clinicalStudyComposition.general_module_ids, [
      "general-module-seeded-1",
      "general-module-seeded-2",
      "general-module-seeded-3",
      "general-module-seeded-4",
      "general-module-seeded-5",
      "general-module-seeded-6",
    ]);
    assert.deepEqual(clinicalStudyComposition.medical_module_ids, [
      "medical-module-seeded-1",
      "medical-module-seeded-2",
      "medical-module-seeded-3",
      "medical-module-seeded-4",
      "medical-module-seeded-5",
    ]);
    assert.equal(clinicalStudyComposition.status, "published");
    assert.equal(ruleSetsResponse.status, 200);
    assert.deepEqual(
      ruleSets.map((item) => item.id).sort(),
      ["rule-set-editing-1", "rule-set-proofreading-1", "rule-set-screening-1"],
    );
    assert.equal(ruleSets.every((item) => item.status === "published"), true);
    assert.equal(screeningRulesResponse.status, 200);
    assert.deepEqual(
      screeningRules.map((item) => item.id).sort(),
      [
        "rule-screening-design-1",
        "rule-screening-endpoint-1",
        "rule-screening-ethics-1",
        "rule-screening-structure-1",
      ].sort(),
    );
    assert.equal(editingRulesResponse.status, 200);
    assert.deepEqual(
      editingRules.map((item) => item.id).sort(),
      [
        "rule-editing-abstract-1",
        "rule-editing-author-line-1",
        "rule-editing-heading-1",
        "rule-editing-reference-1",
        "rule-editing-terminology-1",
        "rule-table-editing-1",
      ].sort(),
    );
    assert.equal(proofreadingRulesResponse.status, 200);
    assert.deepEqual(
      proofreadingRules.map((item) => item.id).sort(),
      [
        "rule-proofreading-baseline-table-1",
        "rule-proofreading-reference-1",
        "rule-proofreading-safety-1",
        "rule-proofreading-statistics-1",
        "rule-table-proofreading-1",
      ].sort(),
    );
    assert.equal(generalRuleDetailResponse.status, 200);
    assert.equal(generalRuleDetail.selected_revision.id, "knowledge-general-reference-1-revision-1");
    assert.equal(generalRuleDetail.selected_revision.bindings[0]?.binding_kind, "general_package");
    assert.equal(
      generalRuleDetail.selected_revision.bindings[0]?.binding_target_id,
      "general-module-seeded-1",
    );
    assert.equal(generalStructureRuleDetailResponse.status, 200);
    assert.equal(
      generalStructureRuleDetail.selected_revision.id,
      "knowledge-general-structure-1-revision-1",
    );
    assert.equal(
      generalStructureRuleDetail.selected_revision.bindings[0]?.binding_kind,
      "general_package",
    );
    assert.equal(
      generalStructureRuleDetail.selected_revision.bindings[0]?.binding_target_id,
      "general-module-seeded-5",
    );
    assert.equal(medicalRuleDetailResponse.status, 200);
    assert.equal(medicalRuleDetail.selected_revision.id, "knowledge-medical-ethics-1-revision-1");
    assert.equal(medicalRuleDetail.selected_revision.bindings[0]?.binding_kind, "medical_package");
    assert.equal(
      medicalRuleDetail.selected_revision.bindings[0]?.binding_target_id,
      "medical-module-seeded-1",
    );
    assert.equal(medicalStudyDesignRuleDetailResponse.status, 200);
    assert.equal(
      medicalStudyDesignRuleDetail.selected_revision.id,
      "knowledge-medical-study-design-1-revision-1",
    );
    assert.equal(
      medicalStudyDesignRuleDetail.selected_revision.bindings[0]?.binding_kind,
      "medical_package",
    );
    assert.equal(
      medicalStudyDesignRuleDetail.selected_revision.bindings[0]?.binding_target_id,
      "medical-module-seeded-3",
    );
  } finally {
    await stopServer(server);
  }
});

test("workbench http keeps legacy single-desk roles bounded while editor spans the manuscript mainline", async () => {
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

    assert.equal(screeningResponse.status, 201);
    assert.equal(editingResponse.status, 403);
    assert.equal(proofreadingResponse.status, 201);
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
        id: string;
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

test("workbench http bare screening run becomes current while keeping earlier governed output in history", async () => {
  const { server, baseUrl, runtime } = await startWorkbenchServerWithRuntime();
  const { seededIds } = runtime;

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.screener");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const governedResponse = await fetch(`${baseUrl}/api/v1/modules/screening/run`, {
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
        storageKey: "runs/http/screening/governed-report.md",
        fileName: "screening-governed-report.md",
      }),
    });
    const governed = (await governedResponse.json()) as {
      job: { id: string };
      asset: { id: string };
    };
    assert.equal(governedResponse.status, 201);

    const storedManuscript = await runtime.manuscriptRepository.findById(
      seededIds.manuscriptId,
    );
    assert.ok(storedManuscript);
    await runtime.manuscriptRepository.save({
      ...storedManuscript,
      current_template_family_id: undefined,
    });

    const bareResponse = await fetch(`${baseUrl}/api/v1/modules/screening/run`, {
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
        storageKey: "runs/http/screening/bare-report.md",
        fileName: "screening-bare-report.md",
        executionMode: "bare",
      }),
    });
    const bare = (await bareResponse.json()) as {
      job: { id: string; requested_by: string };
      asset: { id: string; asset_type: string; parent_asset_id?: string };
      knowledge_item_ids: string[];
      model_id: string;
      agent_execution_log_id?: string;
      snapshot_id?: string;
    };

    assert.equal(bareResponse.status, 201);
    assert.equal(bare.job.requested_by, "dev-screener");
    assert.equal(bare.asset.asset_type, "screening_report");
    assert.equal(bare.asset.parent_asset_id, seededIds.originalAssetId);
    assert.deepEqual(bare.knowledge_item_ids, []);
    assert.equal(bare.model_id, seededIds.screeningModelId);
    assert.equal(bare.agent_execution_log_id, undefined);
    assert.ok(bare.snapshot_id);

    const manuscriptResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}`,
      {
        headers: { Cookie: cookie },
      },
    );
    const manuscript = (await manuscriptResponse.json()) as {
      current_screening_asset_id?: string;
    };

    const assetsResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/assets`,
      {
        headers: { Cookie: cookie },
      },
    );
    const assets = (await assetsResponse.json()) as Array<{ id: string }>;

    const bareJobResponse = await fetch(`${baseUrl}/api/v1/jobs/${bare.job.id}`, {
      headers: { Cookie: cookie },
    });
    const bareJob = (await bareJobResponse.json()) as {
      payload?: Record<string, unknown>;
      execution_tracking?: {
        settlement?: { derived_status: string };
      };
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
          preferredAssetType: "screening_report",
        }),
      },
    );
    const exported = (await exportResponse.json()) as {
      asset: { id: string };
      download: { url: string };
    };

    const runsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.screeningSuiteId}/runs`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    const runs = (await runsResponse.json()) as Array<{ id: string }>;

    assert.equal(manuscriptResponse.status, 200);
    assert.equal(assetsResponse.status, 200);
    assert.equal(bareJobResponse.status, 200);
    assert.equal(exportResponse.status, 200);
    assert.equal(runsResponse.status, 200);
    assert.equal(manuscript.current_screening_asset_id, bare.asset.id);
    assert.deepEqual(
      [...assets.map((asset) => asset.id)].sort(),
      [seededIds.originalAssetId, governed.asset.id, bare.asset.id].sort(),
    );
    assert.equal(bareJob.payload?.executionMode, "bare");
    assert.equal(bareJob.payload?.outputAssetId, bare.asset.id);
    assert.equal(exported.asset.id, bare.asset.id);
    assert.ok(exported.download.url);
    assert.equal(runs.length, 1);
  } finally {
    await stopServer(server);
  }
});

test("workbench http exposes manuscript harness matrix for module control visibility", async () => {
  const { server, baseUrl, runtime } = await startWorkbenchServerWithRuntime();
  const { seededIds } = runtime;

  try {
    const screenerCookie = await loginAsDemoUser(baseUrl, "dev.screener");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");

    const initialResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/harness-matrix`,
      {
        headers: {
          Cookie: screenerCookie,
        },
      },
    );
    const initial = (await initialResponse.json()) as {
      manuscript_id: string;
      modules: Array<{
        module: string;
        status: string;
        latest_snapshot?: { id: string };
        matrix_items: Array<{ key: string; state: string }>;
      }>;
    };

    assert.equal(initialResponse.status, 200);
    assert.equal(initial.manuscript_id, seededIds.manuscriptId);
    assert.deepEqual(
      initial.modules.map((module) => [module.module, module.status]),
      [
        ["screening", "not_run"],
        ["editing", "not_run"],
        ["proofreading", "not_run"],
      ],
    );
    assert.ok(
      initial.modules.every((module) =>
        module.matrix_items.some(
          (item) => item.key === "module.execution" && item.state === "expected_not_run",
        ),
      ),
    );

    const runResponse = await fetch(`${baseUrl}/api/v1/modules/screening/run`, {
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
        storageKey: "runs/http/harness-matrix/screening-report.md",
        fileName: "harness-matrix-screening-report.md",
      }),
    });
    const run = (await runResponse.json()) as {
      snapshot_id?: string;
      asset: { id: string };
    };

    assert.equal(runResponse.status, 201);
    assert.ok(run.snapshot_id);

    const submitResponse = await fetch(`${baseUrl}/api/v1/review-items/governed-hits`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: seededIds.manuscriptId,
        manuscriptType: "clinical_study",
        module: "screening",
        snapshotId: run.snapshot_id,
        sourceAssetId: run.asset.id,
        feedbackCategory: "missed_hit",
        feedbackText: "Harness matrix should expose this manual missed item.",
        candidatePosture: "inspect_only",
        decisionSource: "manual_feedback",
        relatedKnowledgeItemIds: [seededIds.screeningKnowledgeId],
      }),
    });

    assert.equal(submitResponse.status, 201);
    const submitted = (await submitResponse.json()) as {
      item: {
        id: string;
      };
    };
    const routeSubmitResponse = await fetch(`${baseUrl}/api/v1/review-items/governed-hits`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: seededIds.manuscriptId,
        manuscriptType: "clinical_study",
        module: "screening",
        snapshotId: run.snapshot_id,
        sourceAssetId: run.asset.id,
        feedbackCategory: "missing_knowledge",
        feedbackText: "Harness matrix should route this finding into rule learning.",
        candidatePosture: "inspect_only",
        decisionSource: "manual_feedback",
        relatedKnowledgeItemIds: [seededIds.screeningKnowledgeId],
      }),
    });
    assert.equal(routeSubmitResponse.status, 201);
    const routeSubmitted = (await routeSubmitResponse.json()) as {
      item: {
        id: string;
      };
    };

    const matrixResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/harness-matrix`,
      {
        headers: {
          Cookie: screenerCookie,
        },
      },
    );
    const matrix = (await matrixResponse.json()) as {
      modules: Array<{
        module: string;
        status: string;
        latest_snapshot?: { id: string; model_id: string; knowledge_item_ids: string[] };
        matrix_items: Array<{
          key: string;
          state: string;
          source_kind?: string;
          title?: string;
          evidence?: {
            source_status?: string;
            review_status?: string;
          };
        }>;
      }>;
    };
    const screening = matrix.modules.find((module) => module.module === "screening");

    assert.equal(matrixResponse.status, 200);
    assert.equal(screening?.status, "tracked");
    assert.equal(screening?.latest_snapshot?.id, run.snapshot_id);
    assert.equal(screening?.latest_snapshot?.model_id, seededIds.screeningModelId);
    assert.deepEqual(screening?.latest_snapshot?.knowledge_item_ids, [
      seededIds.screeningKnowledgeId,
    ]);
    assert.ok(
      screening?.matrix_items.some(
        (item) =>
          item.key === `knowledge.${seededIds.screeningKnowledgeId}` &&
          item.state === "hit",
      ),
    );
    assert.ok(
      screening?.matrix_items.some(
        (item) =>
          item.source_kind === "governed_hit" &&
          item.state === "manual_added" &&
          item.title?.length,
      ),
    );

    const decideResponse = await fetch(
      `${baseUrl}/api/v1/review-items/${submitted.item.id}/decide`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceKind: "governed_hit",
          action: "reject_as_false_positive",
        }),
      },
    );
    assert.equal(decideResponse.status, 200);
    const routeResponse = await fetch(
      `${baseUrl}/api/v1/review-items/${routeSubmitted.item.id}/decide`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceKind: "governed_hit",
          action: "route_to_rule_candidate",
          title: "Harness routed rule candidate",
          proposalText: "Create a rule candidate from the Harness routed finding.",
        }),
      },
    );
    assert.equal(routeResponse.status, 200);

    const decidedMatrixResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/harness-matrix`,
      {
        headers: {
          Cookie: screenerCookie,
        },
      },
    );
    const decidedMatrix = (await decidedMatrixResponse.json()) as typeof matrix;
    const decidedScreening = decidedMatrix.modules.find(
      (module) => module.module === "screening",
    );

    assert.equal(decidedMatrixResponse.status, 200);
    assert.ok(
      decidedScreening?.matrix_items.some(
        (item) =>
          item.source_kind === "governed_hit" &&
          item.state === "false_positive" &&
          item.title?.length,
      ),
    );
    assert.ok(
      decidedScreening?.matrix_items.some(
        (item) =>
          item.source_kind === "governed_hit" &&
          item.evidence?.source_status === "routed_rule_candidate" &&
          item.evidence?.review_status === "routed",
      ),
    );
  } finally {
    await stopServer(server);
  }
});

test("workbench http exposes internal-test production readiness without pretending stable", async () => {
  const { server, baseUrl } = await startWorkbenchServer();

  try {
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const response = await fetch(
      `${baseUrl}/api/v1/production-readiness/internal-test`,
      {
        headers: {
          Cookie: adminCookie,
        },
      },
    );
    const readiness = (await response.json()) as {
      status: "ready" | "not_ready";
      checks: Array<{
        key: string;
        status: "ok" | "warning" | "failed";
        blocking: boolean;
      }>;
      summary: {
        total: number;
        failed: number;
        warning: number;
        blocking_failed: number;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(readiness.status, "ready");
    assert.ok(readiness.summary.total >= 5);
    assert.equal(readiness.summary.blocking_failed, 0);
    assert.ok(readiness.checks.some((check) => check.key === "api.healthz"));
    assert.ok(readiness.checks.some((check) => check.key === "api.readyz"));
    assert.ok(readiness.checks.some((check) => check.key === "storage.upload_root"));
    assert.ok(
      readiness.checks.some(
        (check) => check.key === "module_execution.concurrency",
      ),
    );
    assert.ok(
      ["screening", "editing", "proofreading"].every((module) =>
        readiness.checks.some((check) => check.key === `module.${module}.lane`),
      ),
    );
  } finally {
    await stopServer(server);
  }
});

test("workbench http harness dataset routes let admins create and publish proofreading gold sets", async () => {
  const { server, baseUrl } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const familyResponse = await fetch(
      `${baseUrl}/api/v1/harness-datasets/gold-set-families`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "HTTP Proofreading Gold Set",
          scope: {
            module: "proofreading",
            manuscriptTypes: ["clinical_study"],
            measureFocus: "issue_detection",
          },
        }),
      },
    );
    const family = (await familyResponse.json()) as {
      id: string;
      scope: {
        module: string;
      };
    };

    const rubricDraftResponse = await fetch(
      `${baseUrl}/api/v1/harness-datasets/rubrics`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "HTTP Proofreading Rubric",
          scope: {
            module: "proofreading",
            manuscriptTypes: ["clinical_study"],
          },
          scoringDimensions: [
            {
              key: "critical_recall",
              label: "Critical recall",
            },
          ],
          createdBy: "forged-admin",
        }),
      },
    );
    const rubricDraft = (await rubricDraftResponse.json()) as { id: string };
    const rubricResponse = await fetch(
      `${baseUrl}/api/v1/harness-datasets/rubrics/${rubricDraft.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publishedBy: "forged-admin",
        }),
      },
    );
    const rubric = (await rubricResponse.json()) as {
      id: string;
      status: string;
    };

    const versionResponse = await fetch(
      `${baseUrl}/api/v1/harness-datasets/gold-set-versions`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          familyId: family.id,
          rubricDefinitionId: rubric.id,
          createdBy: "forged-admin",
          items: [
            {
              sourceKind: "reviewed_case_snapshot",
              sourceId: "snapshot-http-gold-1",
              manuscriptId: "manuscript-http-gold-1",
              manuscriptType: "clinical_study",
              deidentificationPassed: true,
              humanReviewed: true,
              expectedStructuredOutput: {
                expectedIssues: [
                  {
                    id: "expected-http-gold-1",
                    severity: "critical",
                    issueType: "sample_size_consistency",
                    layerId: "context_consistency",
                    quote: "n=120",
                    blockIndex: 3,
                  },
                ],
                criticalRecallThreshold: 1,
                falsePositiveReviewThreshold: 0.2,
                requiredLayers: ["context_consistency"],
              },
            },
          ],
          publicationNotes: "Created through HTTP admin route.",
        }),
      },
    );
    const version = (await versionResponse.json()) as {
      id: string;
      status: string;
      item_count: number;
    };
    const publishedResponse = await fetch(
      `${baseUrl}/api/v1/harness-datasets/gold-set-versions/${version.id}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publishedBy: "forged-admin",
        }),
      },
    );
    const published = (await publishedResponse.json()) as {
      status: string;
      published_by?: string;
    };

    assert.equal(familyResponse.status, 201);
    assert.equal(family.scope.module, "proofreading");
    assert.equal(rubricDraftResponse.status, 201);
    assert.equal(rubricResponse.status, 200);
    assert.equal(rubric.status, "published");
    assert.equal(versionResponse.status, 201);
    assert.equal(version.status, "draft");
    assert.equal(version.item_count, 1);
    assert.equal(publishedResponse.status, 200);
    assert.equal(published.status, "published");
    assert.equal(published.published_by, "dev-admin");
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
        id: string;
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

    const manuscriptResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}`,
      {
        headers: { Cookie: cookie },
      },
    );
    const manuscript = (await manuscriptResponse.json()) as {
      current_editing_asset_id?: string;
      editing_completion_gate_summary?: {
        observation_status: string;
        passed: boolean;
      };
      module_execution_overview?: {
        editing?: {
          observation_status: string;
          settlement?: {
            derived_status: string;
          };
        };
      };
    };
    const jobResponse = await fetch(`${baseUrl}/api/v1/jobs/${body.job.id}`, {
      headers: { Cookie: cookie },
    });
    const job = (await jobResponse.json()) as {
      payload?: {
        editingCompletionGateSummary?: {
          observation_status: string;
          passed: boolean;
        };
      };
    };

    assert.equal(manuscriptResponse.status, 200);
    assert.equal(jobResponse.status, 200);
    assert.equal(manuscript.current_editing_asset_id, body.asset.id);
    assert.equal(
      manuscript.editing_completion_gate_summary?.observation_status,
      "failed_open",
    );
    assert.equal(
      typeof manuscript.editing_completion_gate_summary?.passed,
      "boolean",
    );
    assert.ok(
      ["reported", "failed_open"].includes(
        manuscript.module_execution_overview?.editing?.observation_status ?? "",
      ),
    );
    assert.equal(
      job.payload?.editingCompletionGateSummary?.observation_status,
      "failed_open",
    );
    assert.equal(
      typeof job.payload?.editingCompletionGateSummary?.passed,
      "boolean",
    );
    const matrixResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/harness-matrix`,
      {
        headers: { Cookie: cookie },
      },
    );
    const matrix = (await matrixResponse.json()) as {
      modules: Array<{
        module: string;
        matrix_items: Array<{
          key: string;
          source_kind: string;
          state: string;
          evidence?: {
            observation_status?: string;
            passed?: boolean;
          };
        }>;
      }>;
    };
    const editingMatrix = matrix.modules.find(
      (module) => module.module === "editing",
    );
    assert.equal(matrixResponse.status, 200);
    assert.ok(
      editingMatrix?.matrix_items.some(
        (item) =>
          item.key === "editing_completion_gate.summary" &&
          item.source_kind === "editing_completion_gate" &&
          item.state === "failed" &&
          item.evidence?.observation_status === "failed_open" &&
          typeof item.evidence?.passed === "boolean",
      ),
    );
  } finally {
    await stopServer(server);
  }
});

test("workbench http proofreading routes create a draft and then finalize against the pinned draft context", async () => {
  const recordedAiCalls: Array<{ userPayload: Record<string, unknown> }> = [];
  const { server, baseUrl, seededIds, runtime } = await startWorkbenchServer({
    recordMainlineAiCall(input) {
      if (input.module === "proofreading") {
        recordedAiCalls.push({
          userPayload: input.userPayload,
        });
      }
    },
  });

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
      job: {
        id: string;
        payload?: {
          proofreadingPlan?: {
            issues?: Array<{
              title?: string;
              anchor?: {
                quote?: string;
              };
            }>;
          };
          proofreadingSourceBlocks?: Array<{
            text?: string;
          }>;
          proofreadingDeepPassRuns?: Array<{
            job_id: string;
            pass_no: number;
            pass_kind: string;
            status: string;
            model_id?: string;
            output?: {
              summary?: string;
              issues?: unknown[];
            };
            error_message?: string;
          }>;
          proofreadingLayerMatrix?: Array<{
            layer_id: string;
            status: string;
            required_for_release?: boolean;
            evidence?: {
              pass_kind?: string;
              issue_count?: number;
            };
          }>;
          goldSetAssertionResult?: {
            expectedIssueCount: number;
            matchedExpectedIssueCount: number;
            missedExpectedIssueCount: number;
            falsePositiveIssueCount: number;
            recall: number;
            criticalRecall: number;
          };
          rules?: Array<{ id: string }>;
          resolvedRules?: Array<{ rule: { id: string } }>;
          instructionPayload?: {
            hardRuleSummary?: string;
            promptSnippets?: string[];
          };
        };
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
    assert.ok(
      draft.job.payload?.rules?.some(
        (rule) => rule.id === "rule-proofreading-punctuation-1",
      ),
    );
    assert.ok(
      draft.job.payload?.resolvedRules?.some(
        (entry) => entry.rule.id === "rule-proofreading-punctuation-1",
      ),
    );
    assert.ok(draft.snapshot_id);
    assert.ok(draft.agent_execution_log_id);
    const initialProofreadingCall = recordedAiCalls.find(
      (call) => !("passFocus" in call.userPayload),
    );
    const governedCoverage = initialProofreadingCall?.userPayload
      .governedCoverage as
      | {
          knowledgeHits?: Array<{ knowledgeItemId?: string; canonicalText?: string }>;
        }
      | undefined;
    const governance = initialProofreadingCall?.userPayload.governance as
      | {
          resolvedRules?: Array<{ ruleId?: string }>;
          knowledgeHits?: Array<{ knowledgeItemId?: string }>;
        }
      | undefined;
    assert.ok(
      governedCoverage?.knowledgeHits?.some(
        (hit) =>
          hit.knowledgeItemId === seededIds.proofreadingKnowledgeId &&
          hit.canonicalText === "Confirm punctuation consistency.",
      ),
    );
    assert.ok(
      governance?.resolvedRules?.some(
        (rule) => rule.ruleId === "rule-proofreading-punctuation-1",
      ),
    );
    assert.ok(
      governance?.knowledgeHits?.some(
        (hit) => hit.knowledgeItemId === seededIds.proofreadingKnowledgeId,
      ),
    );
    assert.equal(
      draft.job.payload?.proofreadingPlan?.issues?.[0]?.anchor?.quote,
      draft.job.payload?.proofreadingSourceBlocks?.[0]?.text,
    );
    assert.notEqual(
      draft.job.payload?.proofreadingPlan?.issues?.[0]?.anchor?.quote,
      "Proofreading target",
    );
    assert.deepEqual(
      draft.job.payload?.proofreadingDeepPassRuns?.map((pass) => [
        pass.pass_no,
        pass.pass_kind,
        pass.status,
      ]),
      [
        [1, "medical_facts_and_terminology", "completed"],
        [2, "structure_logic_and_consistency", "completed"],
        [3, "data_statistics_units_and_tables", "completed"],
        [4, "language_style_punctuation_and_format", "completed"],
        [5, "residual_synthesis", "completed"],
      ],
    );
    assert.deepEqual(
      draft.job.payload?.proofreadingLayerMatrix
        ?.filter((layer) => layer.required_for_release)
        .map((layer) => [layer.layer_id, layer.status, layer.evidence?.pass_kind]),
      [
        ["document_structure", "completed", undefined],
        [
          "context_consistency",
          "completed",
          "structure_logic_and_consistency",
        ],
        [
          "statistics_expression",
          "completed",
          "data_statistics_units_and_tables",
        ],
        ["table_proofreading", "completed", "data_statistics_units_and_tables"],
        ["residual_discovery", "completed", "residual_synthesis"],
        ["final_regression_readiness", "completed", undefined],
      ],
    );
    assert.ok(
      draft.job.payload?.proofreadingDeepPassRuns?.every(
        (pass) => pass.output && Array.isArray(pass.output.issues),
      ),
    );
    assert.deepEqual(
      draft.job.payload?.proofreadingDeepPassRuns?.map(
        (pass) => pass.output?.summary,
      ),
      [
        "AI proofreading pass 1: medical_facts_and_terminology.",
        "AI proofreading pass 2: structure_logic_and_consistency.",
        "AI proofreading pass 3: data_statistics_units_and_tables.",
        "AI proofreading pass 4: language_style_punctuation_and_format.",
        "AI proofreading pass 5: residual_synthesis.",
      ],
    );
    assert.ok(
      draft.job.payload?.proofreadingPlan?.issues?.some(
        (issue) => issue.title === "Pass 5 issue",
      ),
    );
    draft.job.payload = {
      ...draft.job.payload,
      goldSetAssertionResult: {
        expectedIssueCount: 2,
        matchedExpectedIssueCount: 1,
        missedExpectedIssueCount: 1,
        falsePositiveIssueCount: 1,
        recall: 0.5,
        criticalRecall: 1,
      },
    };
    const draftJobForGoldSet = await runtime.jobRepository.findById(draft.job.id);
    assert.ok(draftJobForGoldSet);
    await runtime.jobRepository.save({
      ...draftJobForGoldSet,
      payload: {
        ...draftJobForGoldSet.payload,
        goldSetAssertionResult: draft.job.payload.goldSetAssertionResult,
      },
    });

    const draftRunsResponse = await fetch(
      `${baseUrl}/api/v1/verification-ops/evaluation-suites/${seededIds.proofreadingSuiteId}/runs`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    assert.equal(draftRunsResponse.status, 200);
    assert.deepEqual(await draftRunsResponse.json(), []);

    const matrixResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/harness-matrix`,
      {
        headers: { Cookie: cookie },
      },
    );
    const matrix = (await matrixResponse.json()) as {
      modules: Array<{
        module: string;
        matrix_items: Array<{
          key: string;
          source_kind: string;
          source_id?: string;
          state: string;
          evidence?: {
            pass_run_id?: string;
            snapshot_id?: string;
            knowledge_item_ids?: string[];
            prompt_template_id?: string;
            recall?: number;
            critical_recall?: number;
            missed_expected_issue_count?: number;
            false_positive_issue_count?: number;
          };
        }>;
      }>;
    };
    const proofreadingMatrix = matrix.modules.find(
      (module) => module.module === "proofreading",
    );
    const passCoverageItems =
      proofreadingMatrix?.matrix_items.filter(
        (item) => item.source_kind === "proofreading_deep_pass",
      ) ?? [];

    assert.equal(matrixResponse.status, 200);
    const goldSetAssertionItem = proofreadingMatrix?.matrix_items.find(
      (item) => item.key === "gold_set.assertions",
    );
    assert.equal(goldSetAssertionItem?.source_kind, "gold_set_assertion");
    assert.equal(goldSetAssertionItem?.state, "missed");
    assert.equal(goldSetAssertionItem?.evidence?.recall, 0.5);
    assert.equal(goldSetAssertionItem?.evidence?.critical_recall, 1);
    assert.equal(goldSetAssertionItem?.evidence?.missed_expected_issue_count, 1);
    assert.equal(goldSetAssertionItem?.evidence?.false_positive_issue_count, 1);
    assert.equal(passCoverageItems.length, 5);
    assert.ok(
      passCoverageItems.every(
        (item) =>
          item.source_id &&
          item.source_id !== `${draft.job.payload?.proofreadingDeepPassRuns?.[0]?.job_id}:1` &&
          item.evidence?.pass_run_id === item.source_id &&
          item.evidence?.snapshot_id === draft.snapshot_id &&
          item.evidence?.prompt_template_id === "prompt-proofreading-1" &&
          item.evidence?.knowledge_item_ids?.includes(seededIds.proofreadingKnowledgeId),
      ),
    );
    assert.deepEqual(
      passCoverageItems.map((item) => [item.key, item.state]),
      [
        ["proofreading_pass.1.medical_facts_and_terminology", "hit"],
        ["proofreading_pass.2.structure_logic_and_consistency", "hit"],
        ["proofreading_pass.3.data_statistics_units_and_tables", "hit"],
        ["proofreading_pass.4.language_style_punctuation_and_format", "hit"],
        ["proofreading_pass.5.residual_synthesis", "hit"],
      ],
    );
    const retryTarget = passCoverageItems[0];
    assert.ok(retryTarget?.source_id);
    const passDetailResponse = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/pass-runs/${retryTarget.source_id}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const passDetail = (await passDetailResponse.json()) as {
      id: string;
      output?: {
        segmentation?: {
          segments?: Array<{
            blockIndexes?: number[];
            inputPreview?: unknown[];
          }>;
        };
      };
    };
    assert.equal(passDetailResponse.status, 200);
    assert.equal(passDetail.id, retryTarget.source_id);
    assert.ok(
      passDetail.output?.segmentation === undefined ||
        Array.isArray(passDetail.output.segmentation.segments),
    );
    const storedPassRun =
      await runtime.proofreadingPassRunRepository.findById(retryTarget.source_id);
    assert.ok(storedPassRun);
    await runtime.proofreadingPassRunRepository.save({
      ...storedPassRun,
      status: "failed",
      error_message: "Injected failure for retry coverage.",
      updated_at: new Date("2026-03-31T08:01:00.000Z").toISOString(),
    });
    const retryResponse = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/pass-runs/${retryTarget.source_id}/retry`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
      },
    );
    const retriedPassRun = (await retryResponse.json()) as {
      id: string;
      status: string;
      retry_count: number;
      output?: {
        summary?: string;
      };
      error_message?: string;
    };
    assert.equal(retryResponse.status, 200);
    assert.equal(retriedPassRun.id, retryTarget.source_id);
    assert.equal(retriedPassRun.status, "completed");
    assert.equal(retriedPassRun.retry_count, storedPassRun.retry_count + 1);
    assert.equal(retriedPassRun.error_message, undefined);
    assert.equal(
      retriedPassRun.output?.summary,
      "AI proofreading pass 1: medical_facts_and_terminology.",
    );

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

test("workbench http proofreading draft automatically evaluates published gold-set assertions", async () => {
  const { server, baseUrl, seededIds, runtime } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const family = await runtime.harnessDatasetApi.createGoldSetFamily({
      actorRole: "admin",
      input: {
        name: "Proofreading HTTP gold set",
        scope: {
          module: "proofreading",
          manuscriptTypes: ["clinical_study"],
          measureFocus: "issue_detection",
        },
      },
    });
    const rubric = await runtime.harnessDatasetApi.publishRubricDefinition({
      actorRole: "admin",
      rubricDefinitionId: (
        await runtime.harnessDatasetApi.createRubricDefinition({
          actorRole: "admin",
          input: {
            name: "Proofreading HTTP rubric",
            scope: {
              module: "proofreading",
              manuscriptTypes: ["clinical_study"],
            },
            scoringDimensions: [
              {
                key: "recall",
                label: "Recall",
              },
            ],
            createdBy: "admin-1",
          },
        })
      ).body.id,
      input: {
        publishedBy: "admin-1",
      },
    });
    const version = await runtime.harnessDatasetApi.createGoldSetVersion({
      actorRole: "admin",
      input: {
        familyId: family.body.id,
        rubricDefinitionId: rubric.body.id,
        createdBy: "admin-1",
        items: [
          {
            sourceKind: "reviewed_case_snapshot",
            sourceId: "proofreading-http-snapshot-1",
            manuscriptId: seededIds.manuscriptId,
            manuscriptType: "clinical_study",
            deidentificationPassed: true,
            humanReviewed: true,
            expectedStructuredOutput: {
              expectedIssues: [
                {
                  id: "expected-pass-5-residual",
                  severity: "medium",
                  issueType: "residual_synthesis",
                  quote: "Fallback source paragraph for deep proofreading",
                },
                {
                  id: "expected-missed-statistics",
                  severity: "critical",
                  issueType: "statistics_expression",
                  quote: "not present in actual proofreading issues",
                },
              ],
              criticalRecallThreshold: 1,
              falsePositiveReviewThreshold: 0.9,
              requiredLayers: ["residual_discovery", "statistics_expression"],
            },
          },
        ],
        publicationNotes: "HTTP automatic gold-set assertion fixture.",
      },
    });
    await runtime.harnessDatasetApi.publishGoldSetVersion({
      actorRole: "admin",
      goldSetVersionId: version.body.id,
      input: {
        publishedBy: "admin-1",
      },
    });

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
          storageKey: "runs/http/proofreading/gold-set-auto-draft.md",
          fileName: "proofreading-gold-set-auto-draft.md",
        }),
      },
    );
    const draft = (await draftResponse.json()) as {
      asset: {
        id: string;
      };
      job: {
        payload?: {
          goldSetAssertionResult?: {
            expectedIssueCount: number;
            matchedExpectedIssueCount: number;
            missedExpectedIssueCount: number;
            falsePositiveIssueCount: number;
            recall: number;
            criticalRecall: number;
            missedExpectedIssueIds: string[];
            harnessQualityReport?: {
              mode?: string;
              scope?: string;
              caseCount?: number;
              assertionCount?: number;
              recall?: number;
              falsePositiveCount?: number;
              falseNegativeCount?: number;
              manualReviewSamplingRequired?: boolean;
              limitations?: string[];
            };
          };
          releaseQualityGateReport?: {
            mode?: string;
            passed?: boolean;
            reasons?: string[];
            enforcement?: {
              finalizeBlocking?: boolean;
              wouldBlockFinalize?: boolean;
            };
          };
        };
      };
    };

    assert.equal(draftResponse.status, 201);
    assert.deepEqual(draft.job.payload?.goldSetAssertionResult, {
      expectedIssueCount: 2,
      matchedExpectedIssueCount: 1,
      missedExpectedIssueCount: 1,
      falsePositiveIssueCount: 4,
      recall: 0.5,
      criticalRecall: 0,
      missedExpectedIssueIds: ["expected-missed-statistics"],
      falsePositiveIssueIds: [
        "pass-1-issue",
        "pass-2-issue",
        "pass-3-issue",
        "pass-4-issue",
      ],
      thresholds: {
        criticalRecallThreshold: 1,
        criticalRecallPassed: false,
        falsePositiveReviewThreshold: 0.9,
        falsePositiveReviewPassed: true,
        requiredLayerCoveragePassed: false,
      },
      requiredLayers: ["residual_discovery", "statistics_expression"],
      harnessQualityReport: {
        mode: "report_only",
        scope: "gold_set_assertions",
        expectedIssueCount: 2,
        actualIssueCount: 5,
        caseCount: 1,
        assertionCount: 2,
        recall: 0.5,
        falsePositiveCount: 4,
        falseNegativeCount: 1,
        ruleHitCoverage: 0,
        knowledgeHitCoverage: 0,
        residualCoverage: 0.5,
        requiredLayerCoverage: {
          requiredLayerCount: 2,
          coveredLayerCount: 0,
          missingLayerIds: ["residual_discovery", "statistics_expression"],
        },
        manualReviewSamplingRequired: true,
        limitations: [
          "Harness gold-set metrics are bounded by the published cases and do not represent universal manuscript accuracy.",
          "Report-only gates record quality risks without changing release behavior unless enforcement is separately enabled.",
        ],
        residualRisks: [
          "1 expected issue(s) were missed by the current proofreading output.",
          "4 unmatched issue(s) require false-positive review.",
          "2 required layer(s) were not covered by matched expected issues.",
        ],
      },
    });
    assert.deepEqual(draft.job.payload?.releaseQualityGateReport, {
      mode: "evaluated",
      passed: false,
      reasons: [
        "gold set critical recall threshold failed",
        "gold set required layer coverage failed",
      ],
      enforcement: {
        finalizeBlocking: true,
        wouldBlockFinalize: true,
      },
    });

    const matrixResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${seededIds.manuscriptId}/harness-matrix`,
      {
        headers: { Cookie: cookie },
      },
    );
    const matrix = (await matrixResponse.json()) as {
      modules: Array<{
        module: string;
        matrix_items: Array<{
          key: string;
          source_kind: string;
          state: string;
          evidence?: {
            recall?: number;
            critical_recall?: number;
            missed_expected_issue_count?: number;
          };
        }>;
      }>;
    };
    const proofreadingMatrix = matrix.modules.find(
      (module) => module.module === "proofreading",
    );
    const goldSetAssertionItem = proofreadingMatrix?.matrix_items.find(
      (item) => item.key === "gold_set.assertions",
    );

    assert.equal(matrixResponse.status, 200);
    assert.equal(goldSetAssertionItem?.source_kind, "gold_set_assertion");
    assert.equal(goldSetAssertionItem?.state, "missed");
    assert.equal(goldSetAssertionItem?.evidence?.recall, 0.5);
    assert.equal(goldSetAssertionItem?.evidence?.critical_recall, 0);
    assert.equal(goldSetAssertionItem?.evidence?.missed_expected_issue_count, 1);

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
          storageKey: "runs/http/proofreading/gold-set-auto-final.docx",
          fileName: "proofreading-gold-set-auto-final.docx",
        }),
      },
    );
    const finalizeBody = (await finalizeResponse.json()) as {
      error?: string;
      message?: string;
    };

    assert.equal(finalizeResponse.status, 400);
    assert.equal(finalizeBody.error, "invalid_request");
    assert.match(
      finalizeBody.message ?? "",
      /gold set critical recall threshold failed/i,
    );
  } finally {
    await stopServer(server);
  }
});

test("workbench http proofreading finalize blocks drafts that fail the release quality gate", async () => {
  const { server, baseUrl, seededIds, runtime } = await startWorkbenchServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
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
        storageKey: "runs/http/proofreading/gate-draft.md",
        fileName: "proofreading-gate-draft.md",
      }),
    });
    const draft = (await draftResponse.json()) as {
      asset: { id: string };
      job: { id: string; payload?: Record<string, unknown> };
    };
    assert.equal(draftResponse.status, 201);

    const draftJob = await runtime.jobRepository.findById(draft.job.id);
    assert.ok(draftJob);
    await runtime.jobRepository.save({
      ...draftJob,
      payload: {
      ...draft.job.payload,
      proofreadingPlan: {
        role: "医学稿件终校审校员",
        summary: "Injected failing quality gate.",
        corrections: [],
        issues: [],
        manualReviewItems: [],
      },
      proofreadingDeepPassRuns: [
        {
          pass_no: 5,
          pass_kind: "residual_synthesis",
          status: "failed",
          output: {
            summary: "Injected failed residual pass.",
            issues: [],
            governedEvidenceCounts: {
              failedChecks: 0,
              manualReviewItems: 0,
              qualityFindings: 0,
            },
            segmentation: {
              mode: "segmented_candidate_discovery",
              segmentCount: 1,
              totalBlockCount: 1,
              coveredBlockCount: 0,
              coverageRatio: 0,
              completedSegmentCount: 0,
              failedSegmentCount: 1,
              segments: [
                {
                  segmentNo: 1,
                  blockStartIndex: 0,
                  blockEndIndex: 0,
                  blockIndexes: [0],
                  blockCount: 1,
                  inputPreview: [],
                  issueCount: 0,
                  status: "failed",
                  attemptCount: 2,
                  elapsedMs: 10,
                  errorMessage: "Injected segment failure.",
                },
              ],
            },
          },
        },
      ],
      proofreadingLayerMatrix: [
        {
          layer_id: "context_consistency",
          status: "missing",
          required_for_release: true,
        },
      ],
      },
    });

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
        storageKey: "runs/http/proofreading/gate-final.docx",
        fileName: "proofreading-gate-final.docx",
      }),
    });
    const body = (await finalizeResponse.json()) as {
      error?: string;
      message?: string;
    };

    assert.equal(finalizeResponse.status, 400);
    assert.equal(body.error, "invalid_request");
    assert.match(body.message ?? "", /quality gate failed/i);
    assert.match(body.message ?? "", /no proofreading issues/i);
    assert.match(body.message ?? "", /context_consistency/i);
    assert.match(body.message ?? "", /segment/i);
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
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
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
  const docxTransforms: Array<{
    outputStorageKey: string;
    aiReplacements?: Array<{
      targetText: string;
      replacementText: string;
    }>;
  }> = [];
  const { server, baseUrl, seededIds } = await startWorkbenchServer({
    recordDocxTransform(input) {
      docxTransforms.push({
        outputStorageKey: input.outputStorageKey,
        aiReplacements: input.aiReplacements,
      });
    },
  });

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const adminCookie = await loginAsDemoUser(baseUrl, "dev.admin");
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
          confirmationDecisions: [
            {
              itemId: "pass-1-issue",
              targetText: "Fallback source paragraph for deep proofreading",
              replacementText: "Fallback source paragraph for deep proofreading [accepted]",
              action: "accepted_with_manual_edit",
              editedReplacementText:
                "Fallback source paragraph for deep proofreading [human final]",
              note: "accepted and edited by human reviewer",
            },
            {
              itemId: "pass-2-issue",
              targetText: "Fallback source paragraph for deep proofreading",
              replacementText: "Fallback source paragraph for deep proofreading [rejected]",
              action: "rejected",
              note: "rejected as false positive",
            },
            {
              itemId: "pass-3-issue",
              targetText: "Fallback source paragraph for deep proofreading",
              replacementText: "Fallback source paragraph for deep proofreading [knowledge]",
              action: "route_to_knowledge_candidate",
              editedReplacementText:
                "Fallback source paragraph for deep proofreading [knowledge final]",
              note: "promote to knowledge candidate",
            },
          ],
        }),
      },
    );
    const published = (await publishResponse.json()) as {
      job: {
        id: string;
        module: string;
        job_type: string;
        requested_by: string;
        payload?: {
          sourceAssetId?: string;
          confirmationSummary?: {
            acceptedIntoManuscriptCount?: number;
            rejectedCount?: number;
            routedKnowledgeCandidateCount?: number;
          };
          writebackLedger?: Array<{
            itemId?: string;
            applied?: boolean;
            disposition?: string;
          }>;
          confirmationReconciliation?: {
            sourceDraftAssetId?: string;
            sourceFinalAssetId?: string;
            humanFinalAssetId?: string;
            decisions?: Array<{
              itemId?: string;
              decisionAction?: string;
              appliedToHumanFinal?: boolean;
              finalAction?: string;
            }>;
          };
        };
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
    assert.deepEqual(published.job.payload?.confirmationSummary, {
      totalItems: 3,
      acceptedIntoManuscriptCount: 2,
      rejectedCount: 1,
      routedRuleCandidateCount: 0,
      routedKnowledgeCandidateCount: 1,
      manualOnlyCount: 0,
    });
    assert.deepEqual(
      published.job.payload?.writebackLedger?.map((item) => [
        item.itemId,
        item.applied,
        item.disposition,
      ]),
      [
        ["pass-1-issue", true, "auto_writeback"],
        ["pass-2-issue", false, "rejected"],
        ["pass-3-issue", true, "auto_writeback"],
      ],
    );
    assert.equal(
      published.job.payload?.confirmationReconciliation?.sourceDraftAssetId,
      draft.asset.id,
    );
    assert.equal(
      published.job.payload?.confirmationReconciliation?.sourceFinalAssetId,
      finalized.asset.id,
    );
    assert.equal(
      published.job.payload?.confirmationReconciliation?.humanFinalAssetId,
      published.asset.id,
    );
    assert.deepEqual(
      published.job.payload?.confirmationReconciliation?.decisions?.map((item) => [
        item.itemId,
        item.decisionAction,
        item.appliedToHumanFinal,
        item.finalAction,
      ]),
      [
        ["pass-1-issue", "accepted_with_manual_edit", true, "auto_writeback"],
        ["pass-2-issue", "rejected", false, "rejected"],
        ["pass-3-issue", "route_to_knowledge_candidate", true, "auto_writeback"],
      ],
    );
    const humanFinalTransform = docxTransforms.find(
      (item) =>
        item.outputStorageKey === "runs/http-human-final/proofreading/human-final.docx",
    );
    assert.deepEqual(humanFinalTransform?.aiReplacements, [
      {
        targetText: "Fallback source paragraph for deep proofreading",
        replacementText:
          "Fallback source paragraph for deep proofreading [human final]",
        reason: "medical_facts_and_terminology",
      },
      {
        targetText: "Fallback source paragraph for deep proofreading",
        replacementText:
          "Fallback source paragraph for deep proofreading [knowledge final]",
        reason: "data_statistics_units_and_tables",
      },
    ]);
    assert.equal(published.asset.asset_type, "human_final_docx");
    assert.equal(published.asset.created_by, "dev-proofreader");
    assert.equal(published.asset.source_module, "manual");
    assert.equal(published.asset.parent_asset_id, finalized.asset.id);
    assert.equal(manuscriptResponse.status, 200);
    assert.equal(manuscript.current_proofreading_asset_id, published.asset.id);
    assert.equal(exportResponse.status, 200);
    assert.equal(exported.asset.id, published.asset.id);
    assert.equal(exported.asset.asset_type, "human_final_docx");

    const reviewItemsResponse = await fetch(`${baseUrl}/api/v1/review-items?reviewStatus=routed`, {
      headers: {
        Cookie: adminCookie,
      },
    });
    const reviewItems = (await reviewItemsResponse.json()) as Array<{
      source_kind?: string;
      feedback_category?: string;
      title?: string;
      source_status?: string;
      review_status?: string;
      learning_candidate_id?: string;
    }>;
    assert.equal(reviewItemsResponse.status, 200);
    assert.ok(
      reviewItems.some(
        (item) =>
          item.source_kind === "governed_hit" &&
          item.feedback_category === "missing_knowledge" &&
          item.title === "Proofreading confirmation pass-3-issue" &&
          item.source_status === "routed_knowledge_candidate" &&
          item.review_status === "routed" &&
          typeof item.learning_candidate_id === "string",
      ),
      JSON.stringify(reviewItems),
    );
  } finally {
    await stopServer(server);
  }
});

test("workbench http proofreading confirmation-draft route persists review decisions on the confirmation job", async () => {
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
        storageKey: "runs/http-confirmation-draft/proofreading/draft.md",
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
        storageKey: "runs/http-confirmation-draft/proofreading/final.docx",
        fileName: "proofreading-final.docx",
      }),
    });
    const finalized = (await finalizeResponse.json()) as {
      asset: {
        id: string;
      };
      job: {
        id: string;
      };
    };
    assert.equal(finalizeResponse.status, 201);

    const saveDraftResponse = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/confirmation-draft`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: seededIds.manuscriptId,
          confirmationAssetId: finalized.asset.id,
          requestedBy: "forged-proofreader",
          actorRole: "admin",
          confirmationDecisions: [
            {
              itemId: "issue-1",
              targetText: "Proofreading target",
              replacementText: "Proofreading target [proofread]",
              action: "accepted_with_manual_edit",
              editedReplacementText: "Proofreading target [human confirmed]",
              note: "human confirmed table wording",
            },
          ],
        }),
      },
    );
    const saved = (await saveDraftResponse.json()) as {
      job: {
        id: string;
        requested_by: string;
      };
    };

    const savedJobResponse = await fetch(`${baseUrl}/api/v1/jobs/${saved.job.id}`, {
      headers: {
        Cookie: cookie,
      },
    });
    const savedJob = (await savedJobResponse.json()) as {
      id: string;
      payload?: {
        confirmationDraft?: {
          assetId?: string;
          savedDecisionCount?: number;
          confirmationSummary?: {
            acceptedIntoManuscriptCount?: number;
          };
          confirmationDecisions?: Array<{
            itemId?: string;
            action?: string;
            finalReplacementText?: string;
            note?: string;
          }>;
        };
      };
    };

    assert.equal(saveDraftResponse.status, 200);
    assert.equal(saved.job.id, finalized.job.id);
    assert.equal(saved.job.requested_by, "dev-proofreader");
    assert.equal(savedJobResponse.status, 200);
    assert.equal(savedJob.id, finalized.job.id);
    assert.equal(savedJob.payload?.confirmationDraft?.assetId, finalized.asset.id);
    assert.equal(savedJob.payload?.confirmationDraft?.savedDecisionCount, 1);
    assert.equal(
      savedJob.payload?.confirmationDraft?.confirmationSummary
        ?.acceptedIntoManuscriptCount,
      1,
    );
    assert.equal(savedJob.payload?.confirmationDraft?.confirmationDecisions?.length, 1);
    assert.equal(
      savedJob.payload?.confirmationDraft?.confirmationDecisions?.[0]?.itemId,
      "issue-1",
    );
    assert.equal(
      savedJob.payload?.confirmationDraft?.confirmationDecisions?.[0]?.action,
      "accepted_with_manual_edit",
    );
    assert.equal(
      savedJob.payload?.confirmationDraft?.confirmationDecisions?.[0]
        ?.finalReplacementText,
      "Proofreading target [human confirmed]",
    );
    assert.equal(
      savedJob.payload?.confirmationDraft?.confirmationDecisions?.[0]?.note,
      "human confirmed table wording",
    );
  } finally {
    await stopServer(server);
  }
});

