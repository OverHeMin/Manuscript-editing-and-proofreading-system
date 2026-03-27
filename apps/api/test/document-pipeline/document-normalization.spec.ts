import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import {
  DocumentNormalizationService,
  DocumentNormalizationWorkflowService,
} from "../../src/modules/document-pipeline/document-normalization-service.ts";
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
  const normalizationService = new DocumentNormalizationService();
  const workflowService = new DocumentNormalizationWorkflowService({
    normalizationService,
    assetService,
    toolingStatus: {
      libreOfficeAvailable,
    },
  });

  return {
    manuscriptService,
    workflowService,
    assetRepository,
  };
}

test("docx normalization materializes a normalized_docx asset and exposes a ready preview only after asset creation", async () => {
  const { manuscriptService, workflowService, assetRepository } =
    createDocumentPipelineHarness(false);
  const uploadResult = await manuscriptService.upload({
    title: "Docx Intake",
    manuscriptType: "review",
    createdBy: "user-docx",
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
    createdBy: "user-docx",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(normalizationResult.preview.status, "ready");
  assert.equal(normalizationResult.normalized_asset?.asset_type, "normalized_docx");
  assert.equal(
    normalizationResult.normalized_asset?.parent_asset_id,
    uploadResult.asset.id,
  );

  const allAssets = await assetRepository.listByManuscriptId(uploadResult.manuscript.id);
  const normalizedAsset = allAssets.find(
    (asset) => asset.asset_type === "normalized_docx",
  );

  assert.ok(normalizedAsset);
  assert.equal(normalizedAsset?.id, normalizationResult.normalized_asset?.id);
});

test("docx file names win over legacy msword MIME values during normalization", async () => {
  const { manuscriptService, workflowService } =
    createDocumentPipelineHarness(false);
  const uploadResult = await manuscriptService.upload({
    title: "Legacy MIME",
    manuscriptType: "review",
    createdBy: "user-legacy",
    fileName: "legacy-mime.docx",
    mimeType: "application/msword",
    storageKey: "uploads/legacy-mime.docx",
  });

  const normalizationResult = await workflowService.normalize({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "legacy-mime.docx",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "user-legacy",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(normalizationResult.plan.source_type, "docx");
  assert.equal(normalizationResult.plan.conversion.status, "not_required");
  assert.equal(normalizationResult.preview.status, "ready");
  assert.equal(normalizationResult.normalized_asset?.asset_type, "normalized_docx");
});

test("doc normalization without libreoffice keeps preview pending and does not create a normalized_docx asset", async () => {
  const { manuscriptService, workflowService, assetRepository } =
    createDocumentPipelineHarness(false);
  const uploadResult = await manuscriptService.upload({
    title: "Doc Intake",
    manuscriptType: "review",
    createdBy: "user-doc",
    fileName: "doc-intake.doc",
    mimeType: "application/msword",
    storageKey: "uploads/doc-intake.doc",
  });

  const normalizationResult = await workflowService.normalize({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "doc-intake.doc",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "user-doc",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(normalizationResult.preview.status, "pending_normalization");
  assert.equal(normalizationResult.normalized_asset, undefined);

  const allAssets = await assetRepository.listByManuscriptId(uploadResult.manuscript.id);
  const normalizedAssets = allAssets.filter(
    (asset) => asset.asset_type === "normalized_docx",
  );

  assert.deepEqual(normalizedAssets, []);
});

test("normalization plans generate unique storage keys per source asset even when file names match", async () => {
  const normalizationService = new DocumentNormalizationService();

  const firstPlan = normalizationService.planNormalization(
    {
      manuscriptId: "manuscript-keys",
      sourceAssetId: "asset-original-1",
      fileName: "submission.doc",
      mimeType: "application/msword",
      storageKey: "uploads/submission.doc",
    },
    {
      libreOfficeAvailable: true,
    },
  );
  const secondPlan = normalizationService.planNormalization(
    {
      manuscriptId: "manuscript-keys",
      sourceAssetId: "asset-original-2",
      fileName: "submission.doc",
      mimeType: "application/msword",
      storageKey: "uploads/submission.doc",
    },
    {
      libreOfficeAvailable: true,
    },
  );

  assert.notEqual(
    firstPlan.derived_asset.storage_key,
    secondPlan.derived_asset.storage_key,
  );
});
