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
    sessionService: new OnlyOfficeSessionService(),
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
  assert.equal(response.body.save_back_enabled, false);
  assert.equal(response.body.source_asset_type, "original");
});
