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
    "asset-screening-1",
    "asset-editing-1",
    "asset-proof-draft-1",
    "asset-proof-final-1",
    "asset-human-final-1",
    "asset-proof-report-1",
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
      manuscriptRepository,
    }),
  });

  return {
    manuscriptService,
    assetService,
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

test("export without a preferred type follows the manuscript current asset pointers", async () => {
  const { manuscriptService, assetService, documentPipelineApi } =
    createDocumentExportHarness();
  const uploadResult = await manuscriptService.upload({
    title: "Proofreading Export",
    manuscriptType: "review",
    createdBy: "editor-1",
    fileName: "proofreading-export.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/proofreading-export.docx",
  });

  const screeningAsset = await assetService.createAsset({
    manuscriptId: uploadResult.manuscript.id,
    assetType: "screening_report",
    storageKey: "runs/proofreading-export/screening/output",
    mimeType: "text/markdown",
    createdBy: "screener-1",
    fileName: "screening-output.md",
    parentAssetId: uploadResult.asset.id,
    sourceModule: "screening",
    sourceJobId: "job-screening-1",
  });
  const editingAsset = await assetService.createAsset({
    manuscriptId: uploadResult.manuscript.id,
    assetType: "edited_docx",
    storageKey: "runs/proofreading-export/editing/output",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "editing-output.docx",
    parentAssetId: screeningAsset.id,
    sourceModule: "editing",
    sourceJobId: "job-editing-1",
  });
  await assetService.createAsset({
    manuscriptId: uploadResult.manuscript.id,
    assetType: "proofreading_draft_report",
    storageKey: "runs/proofreading-export/proofreading/draft",
    mimeType: "text/markdown",
    createdBy: "proofreader-1",
    fileName: "proofreading-draft.md",
    parentAssetId: editingAsset.id,
    sourceModule: "proofreading",
    sourceJobId: "job-proof-draft-1",
  });
  const finalProofAsset = await assetService.createAsset({
    manuscriptId: uploadResult.manuscript.id,
    assetType: "final_proof_annotated_docx",
    storageKey: "runs/proofreading-export/proofreading/final",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "proofreader-1",
    fileName: "proofreading-final.docx",
    parentAssetId: editingAsset.id,
    sourceModule: "proofreading",
    sourceJobId: "job-proof-final-1",
  });

  const response = await documentPipelineApi.exportCurrentAsset({
    manuscriptId: uploadResult.manuscript.id,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.asset.id, finalProofAsset.id);
  assert.equal(response.body.asset.asset_type, "final_proof_annotated_docx");
  assert.equal(response.body.download.file_name, "proofreading-final.docx");
  assert.equal(
    response.body.download.storage_key,
    "runs/proofreading-export/proofreading/final",
  );
});

test("export exposes the current release output matrix and prefers the furthest operator-facing result", async () => {
  const { manuscriptService, assetService, documentPipelineApi } =
    createDocumentExportHarness();
  const uploadResult = await manuscriptService.upload({
    title: "Release Output Matrix",
    manuscriptType: "review",
    createdBy: "editor-1",
    fileName: "release-output-matrix.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/release-output-matrix.docx",
  });

  const screeningAsset = await assetService.createAsset({
    manuscriptId: uploadResult.manuscript.id,
    assetType: "screening_report",
    storageKey: "runs/release-output-matrix/screening/output",
    mimeType: "text/markdown",
    createdBy: "screener-1",
    fileName: "screening-output.md",
    parentAssetId: uploadResult.asset.id,
    sourceModule: "screening",
    sourceJobId: "job-screening-1",
  });

  let response = await documentPipelineApi.exportCurrentAsset({
    manuscriptId: uploadResult.manuscript.id,
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.selection);
  assert.equal(response.body.asset.id, screeningAsset.id);
  assert.equal(response.body.asset.asset_type, "screening_report");
  assert.equal(response.body.selection.slot, "screening_report");
  assert.equal(response.body.matrix.screening_report?.id, screeningAsset.id);
  assert.equal(response.body.matrix.edited_docx, undefined);
  assert.equal(response.body.matrix.proofreading_draft_report, undefined);
  assert.equal(response.body.matrix.final_proof_output, undefined);

  const editingAsset = await assetService.createAsset({
    manuscriptId: uploadResult.manuscript.id,
    assetType: "edited_docx",
    storageKey: "runs/release-output-matrix/editing/output",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "editing-output.docx",
    parentAssetId: screeningAsset.id,
    sourceModule: "editing",
    sourceJobId: "job-editing-1",
  });

  response = await documentPipelineApi.exportCurrentAsset({
    manuscriptId: uploadResult.manuscript.id,
  });

  assert.ok(response.body.selection);
  assert.equal(response.body.asset.id, editingAsset.id);
  assert.equal(response.body.asset.asset_type, "edited_docx");
  assert.equal(response.body.selection.slot, "edited_docx");
  assert.equal(response.body.matrix.screening_report?.id, screeningAsset.id);
  assert.equal(response.body.matrix.edited_docx?.id, editingAsset.id);

  const proofreadingDraftAsset = await assetService.createAsset({
    manuscriptId: uploadResult.manuscript.id,
    assetType: "proofreading_draft_report",
    storageKey: "runs/release-output-matrix/proofreading/draft",
    mimeType: "text/markdown",
    createdBy: "proofreader-1",
    fileName: "proofreading-draft.md",
    parentAssetId: editingAsset.id,
    sourceModule: "proofreading",
    sourceJobId: "job-proof-draft-1",
  });

  response = await documentPipelineApi.exportCurrentAsset({
    manuscriptId: uploadResult.manuscript.id,
  });

  assert.ok(response.body.selection);
  assert.equal(response.body.asset.id, proofreadingDraftAsset.id);
  assert.equal(response.body.asset.asset_type, "proofreading_draft_report");
  assert.equal(response.body.selection.slot, "proofreading_draft_report");
  assert.equal(
    response.body.matrix.proofreading_draft_report?.id,
    proofreadingDraftAsset.id,
  );
  assert.equal(response.body.matrix.final_proof_output, undefined);

  const humanFinalAsset = await assetService.createAsset({
    manuscriptId: uploadResult.manuscript.id,
    assetType: "human_final_docx",
    storageKey: "runs/release-output-matrix/proofreading/human-final",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "proofreader-1",
    fileName: "human-final.docx",
    parentAssetId: editingAsset.id,
    sourceModule: "manual",
    sourceJobId: "job-human-final-1",
  });

  response = await documentPipelineApi.exportCurrentAsset({
    manuscriptId: uploadResult.manuscript.id,
  });

  assert.ok(response.body.selection);
  assert.equal(response.body.asset.id, humanFinalAsset.id);
  assert.equal(response.body.asset.asset_type, "human_final_docx");
  assert.equal(response.body.selection.slot, "final_proof_output");
  assert.equal(response.body.matrix.screening_report?.id, screeningAsset.id);
  assert.equal(response.body.matrix.edited_docx?.id, editingAsset.id);
  assert.equal(
    response.body.matrix.proofreading_draft_report?.id,
    proofreadingDraftAsset.id,
  );
  assert.equal(response.body.matrix.final_proof_output?.id, humanFinalAsset.id);
});
