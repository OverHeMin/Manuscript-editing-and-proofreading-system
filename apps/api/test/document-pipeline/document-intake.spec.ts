import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import {
  DocumentNormalizationService,
  DocumentNormalizationWorkflowService,
} from "../../src/modules/document-pipeline/document-normalization-service.ts";
import { createDocumentPipelineApi } from "../../src/modules/document-pipeline/document-pipeline-api.ts";
import { DocumentIntakeService } from "../../src/modules/document-pipeline/document-intake-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";

function createDocumentPipelineHarness(libreOfficeAvailable: boolean) {
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
      libreOfficeAvailable,
    },
  });
  const intakeService = new DocumentIntakeService({
    workflowService,
  });
  const documentPipelineApi = createDocumentPipelineApi({
    workflowService,
    intakeService,
  });

  return {
    manuscriptService,
    documentPipelineApi,
  };
}

test("uploaded doc intake returns queued normalization and a pending preview plan", async () => {
  const { manuscriptService, documentPipelineApi } =
    createDocumentPipelineHarness(false);
  const uploadResult = await manuscriptService.upload({
    title: "Doc Intake",
    manuscriptType: "review",
    createdBy: "user-doc",
    fileName: "doc-intake.doc",
    mimeType: "application/msword",
    storageKey: "uploads/doc-intake.doc",
  });

  const response = await documentPipelineApi.intakeUploadedManuscript({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "doc-intake.doc",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "user-doc",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(response.status, 202);
  assert.equal(response.body.normalization.plan.target_type, "docx");
  assert.equal(response.body.preview.viewer, "onlyoffice");
  assert.equal(response.body.preview.status, "pending_normalization");
});

test("uploaded docx intake returns a ready preview backed by a normalized asset", async () => {
  const { manuscriptService, documentPipelineApi } =
    createDocumentPipelineHarness(false);
  const uploadResult = await manuscriptService.upload({
    title: "Docx Intake",
    manuscriptType: "review",
    createdBy: "user-docx",
    fileName: "docx-intake.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/docx-intake.docx",
  });

  const response = await documentPipelineApi.intakeUploadedManuscript({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "docx-intake.docx",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "user-docx",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.preview.viewer, "onlyoffice");
  assert.equal(response.body.preview.status, "ready");
  assert.equal(
    response.body.normalization.normalized_asset?.asset_type,
    "normalized_docx",
  );
});
