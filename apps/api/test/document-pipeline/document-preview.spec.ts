import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import {
  DocumentNormalizationService,
  DocumentNormalizationWorkflowService,
} from "../../src/modules/document-pipeline/document-normalization-service.ts";
import { createDocumentPipelineApi } from "../../src/modules/document-pipeline/document-pipeline-api.ts";
import { DocumentPreviewService } from "../../src/modules/document-pipeline/document-preview-service.ts";
import { OnlyOfficeSessionService } from "../../src/modules/document-pipeline/onlyoffice-session-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";

function createPreviewHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const issuedIds = [
    "manuscript-1",
    "asset-original-1",
    "job-upload-1",
    "asset-normalized-1",
  ];
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected a test id to be available.");
    return value;
  };

  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    now: () => new Date("2026-03-27T02:00:00.000Z"),
    createId: nextId,
  });
  const assetService = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    now: () => new Date("2026-03-27T02:05:00.000Z"),
    createId: nextId,
  });
  const workflowService = new DocumentNormalizationWorkflowService({
    normalizationService: new DocumentNormalizationService(),
    assetService,
    toolingStatus: {
      libreOfficeAvailable: false,
    },
  });
  const previewService = new DocumentPreviewService({
    assetRepository,
    sessionService: new OnlyOfficeSessionService({
      createId: () => "11111111-1111-4111-8111-111111111111",
      documentServerPublicUrl: "http://127.0.0.1:58080",
      surfaceSessionSecret: "preview-session-secret",
    }),
  });
  const documentPipelineApi = createDocumentPipelineApi({
    workflowService,
    previewService,
  });

  return {
    manuscriptService,
    workflowService,
    documentPipelineApi,
  };
}

test("preview session is built from the current normalized asset and stays read-only", async () => {
  const { manuscriptService, workflowService, documentPipelineApi } =
    createPreviewHarness();
  const uploadResult = await manuscriptService.upload({
    title: "Docx Intake",
    manuscriptType: "review",
    createdBy: "editor-1",
    fileName: "docx-intake.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/docx-intake.docx",
  });
  const normalizationResult = await workflowService.normalize({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "docx-intake.docx",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "editor-1",
    sourceJobId: uploadResult.job.id,
  });

  const response = await documentPipelineApi.createPreviewSession({
    manuscriptId: uploadResult.manuscript.id,
    assetId: normalizationResult.normalized_asset?.id ?? "missing",
    actorRole: "editor",
    comments: [
      {
        id: "comment-1",
        body: "Check figure caption style.",
      },
    ],
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.viewer, "onlyoffice");
  assert.equal(response.body.mode, "view");
  const body = response.body as typeof response.body & {
    session_id?: string;
    correlation_id?: string;
    surface_mode?: string;
    document?: {
      document_key?: string;
      file_name?: string;
      file_extension?: string;
      mime_type?: string;
      download_path?: string;
      permissions?: {
        edit?: boolean;
        comment?: boolean;
        review?: boolean;
        download?: boolean;
        print?: boolean;
      };
    };
    authorization?: {
      kind?: string;
      requires_surface_session?: boolean;
    };
    event_bridge?: {
      provider?: string;
      transport?: string;
      capabilities?: {
        ready_event?: boolean;
        locate_to_anchor?: boolean;
        selection_from_document?: boolean;
        visible_issue_marks?: boolean;
        bi_directional_sync?: boolean;
      };
    };
  };
  assert.match(body.session_id ?? "", /^[0-9a-f-]{36}$/u);
  assert.equal(body.correlation_id, body.session_id);
  assert.equal(body.surface_mode, "read_only_review");
  assert.deepEqual(body.document, {
    document_key: normalizationResult.normalized_asset?.id,
    file_name: normalizationResult.normalized_asset?.file_name,
    file_extension: "docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    download_path: `/api/v1/document-assets/${normalizationResult.normalized_asset?.id}/download`,
    permissions: {
      edit: false,
      comment: false,
      review: false,
      download: true,
      print: true,
    },
  });
  assert.deepEqual(body.authorization, {
    kind: "surface_session",
    requires_surface_session: true,
    token_scheme: "surface_session_jwt",
    access_token: body.authorization?.access_token,
  });
  assert.match(body.authorization?.access_token ?? "", /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
  assert.deepEqual(body.event_bridge, {
    provider: "onlyoffice",
    transport: "window_post_message",
    capabilities: {
      ready_event: true,
      locate_to_anchor: true,
      selection_from_document: true,
      visible_issue_marks: true,
      bi_directional_sync: true,
    },
  });
  assert.deepEqual(body.embed, {
    provider: "onlyoffice",
    provider_origin: "http://127.0.0.1:58080",
    api_js_url: "http://127.0.0.1:58080/web-apps/apps/api/documents/api.js",
    document_type: "word",
    ui_type: "desktop",
    editor_config: {
      mode: "view",
      lang: "zh-CN",
      customization: {
        autosave: false,
        chat: false,
        comments: false,
        compactHeader: true,
        compactToolbar: true,
        feedback: false,
        forcesave: false,
        help: false,
        submitForm: false,
      },
    },
  });
  assert.equal(response.body.comment_source, "onlyoffice");
  assert.equal(response.body.save_back_enabled, false);
  assert.equal(response.body.status, "ready");
  assert.equal(
    response.body.source_asset_id,
    normalizationResult.normalized_asset?.id,
  );
  assert.equal(response.body.comments[0]?.body, "Check figure caption style.");
});

test("preview session for pending normalization stays read-only and signals waiting state", async () => {
  const { manuscriptService, documentPipelineApi } = createPreviewHarness();
  const uploadResult = await manuscriptService.upload({
    title: "Doc Intake",
    manuscriptType: "review",
    createdBy: "editor-1",
    fileName: "doc-intake.doc",
    mimeType: "application/msword",
    storageKey: "uploads/doc-intake.doc",
  });

  const response = await documentPipelineApi.createPreviewSession({
    manuscriptId: uploadResult.manuscript.id,
    assetId: uploadResult.asset.id,
    actorRole: "editor",
    previewStatus: "pending_normalization",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.viewer, "onlyoffice");
  assert.equal(response.body.status, "pending_normalization");
  const body = response.body as typeof response.body & {
    surface_mode?: string;
    authorization?: {
      kind?: string;
      requires_surface_session?: boolean;
      token_scheme?: string;
      access_token?: string;
    };
    embed?: {
      api_js_url?: string;
      editor_config?: {
        mode?: string;
      };
    };
    event_bridge?: {
      capabilities?: {
        locate_to_anchor?: boolean;
      };
    };
  };
  assert.equal(body.surface_mode, "read_only_review");
  assert.deepEqual(body.authorization, {
    kind: "surface_session",
    requires_surface_session: true,
    token_scheme: "surface_session_jwt",
    access_token: body.authorization?.access_token,
  });
  assert.match(body.authorization?.access_token ?? "", /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
  assert.equal(body.embed?.api_js_url, "http://127.0.0.1:58080/web-apps/apps/api/documents/api.js");
  assert.equal(body.embed?.editor_config?.mode, "view");
  assert.equal(body.event_bridge?.capabilities?.locate_to_anchor, true);
  assert.equal(response.body.save_back_enabled, false);
  assert.equal(response.body.source_asset_type, "original");
});
