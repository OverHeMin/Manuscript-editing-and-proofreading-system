import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import {
  DocumentNormalizationService,
  DocumentNormalizationWorkflowService,
} from "../../src/modules/document-pipeline/document-normalization-service.ts";
import { createDocumentPipelineApi } from "../../src/modules/document-pipeline/document-pipeline-api.ts";
import { DocumentExportService } from "../../src/modules/document-pipeline/document-export-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";

function createDocumentExportHarness() {
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
  const documentPipelineApi = createDocumentPipelineApi({
    workflowService,
    exportService: new DocumentExportService({
      assetRepository,
    }),
  });

  return {
    manuscriptService,
    workflowService,
    documentPipelineApi,
  };
}

test("export returns the latest authoritative asset instead of the preview session", async () => {
  const { manuscriptService, workflowService, documentPipelineApi } =
    createDocumentExportHarness();
  const uploadResult = await manuscriptService.upload({
    title: "Docx Export",
    manuscriptType: "review",
    createdBy: "editor-1",
    fileName: "docx-export.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/docx-export.docx",
  });
  const normalizationResult = await workflowService.normalize({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "docx-export.docx",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "editor-1",
    sourceJobId: uploadResult.job.id,
  });

  const response = await documentPipelineApi.exportCurrentAsset({
    manuscriptId: uploadResult.manuscript.id,
    preferredAssetType: "normalized_docx",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.asset.asset_type, "normalized_docx");
  assert.equal(response.body.asset.id, normalizationResult.normalized_asset?.id);
  assert.ok(response.body.download.file_name?.endsWith(".docx"));
  assert.equal(
    response.body.download.storage_key,
    normalizationResult.normalized_asset?.storage_key,
  );
});
