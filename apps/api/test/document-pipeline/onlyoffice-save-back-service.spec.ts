import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { DocumentPreviewService } from "../../src/modules/document-pipeline/document-preview-service.ts";
import { OnlyOfficeSaveBackService } from "../../src/modules/document-pipeline/onlyoffice-save-back-service.ts";
import { OnlyOfficeSessionService } from "../../src/modules/document-pipeline/onlyoffice-session-service.ts";

test("OnlyOffice save-back stores proofreading edits as an internal human review working asset", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-saveback-proofreading-"));
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    createId: () => "upload-proofreading-saveback",
    now: () => new Date("2026-04-28T08:00:00.000Z"),
  });
  const assetService = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    createId: () => `asset-${Math.random().toString(16).slice(2)}`,
    now: () => new Date("2026-04-28T08:01:00.000Z"),
  });
  const sessionService = new OnlyOfficeSessionService({
    createId: () => "proofreading-session-1",
    surfaceSessionSecret: "proofreading-saveback-secret",
  });
  const previewService = new DocumentPreviewService({
    assetRepository,
    sessionService,
  });
  const saveBackService = new OnlyOfficeSaveBackService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    assetService,
    uploadRootDir,
    surfaceSessionSecret: "proofreading-saveback-secret",
    createId: () => "job-proofreading-saveback-1",
    now: () => new Date("2026-04-28T08:02:00.000Z"),
  });
  const callbackSourceServer = createServer((_, response) => {
    response.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    response.end("Human saved proofreading DOCX");
  });
  callbackSourceServer.listen(0, "127.0.0.1");
  await once(callbackSourceServer, "listening");
  const callbackSourceAddress = callbackSourceServer.address();
  assert.ok(callbackSourceAddress && typeof callbackSourceAddress !== "string");

  try {
    const upload = await manuscriptService.upload({
      title: "Proofreading Save Back",
      manuscriptType: "review",
      createdBy: "proofreader-1",
      fileName: "proofreading-saveback.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: "uploads/proofreading-saveback.docx",
    });
    const finalProofAsset = await assetService.createAsset({
      manuscriptId: upload.manuscript.id,
      assetType: "final_proof_annotated_docx",
      storageKey: "runs/proofreading/final-proof.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      createdBy: "proofreader-1",
      fileName: "final-proof.docx",
      parentAssetId: upload.asset.id,
      sourceModule: "proofreading",
      sourceJobId: upload.job.id,
    });
    const preview = await previewService.createPreviewSession({
      manuscriptId: upload.manuscript.id,
      assetId: finalProofAsset.id,
      actorRole: "proofreader",
      saveBack: {
        enabled: true,
        module: "proofreading",
        baselineAssetId: finalProofAsset.id,
      },
    });

    const response = await saveBackService.handleCallback({
      sessionId: preview.session_id,
      surfaceAccessToken: preview.authorization.access_token ?? "",
      saveBackModule: "proofreading",
      baselineAssetId: finalProofAsset.id,
      body: {
        status: 6,
        key: `${finalProofAsset.id}-${preview.session_id}`,
        url: `http://127.0.0.1:${callbackSourceAddress.port}/saved-proofreading.docx`,
      },
    });

    assert.deepEqual(response, { error: 0 });
    const assets = await assetRepository.listByManuscriptId(upload.manuscript.id);
    const workingAssets = assets.filter(
      (asset) =>
        asset.asset_type === "human_review_working_docx" &&
        asset.parent_asset_id === finalProofAsset.id,
    );
    assert.equal(workingAssets.length, 1);
    assert.equal(workingAssets[0]?.source_module, "manual");
    assert.equal(workingAssets[0]?.is_current, false);
    const manuscript = await manuscriptRepository.findById(upload.manuscript.id);
    assert.equal(manuscript?.current_proofreading_asset_id, finalProofAsset.id);
    assert.notEqual(manuscript?.current_proofreading_asset_id, workingAssets[0]?.id);

    const job = await jobRepository.findById(workingAssets[0]?.source_job_id ?? "");
    assert.equal(job?.job_type, "onlyoffice_human_review_working_save_back");
    assert.equal(job?.payload?.baselineAssetId, finalProofAsset.id);
    assert.equal(job?.payload?.saveBackModule, "proofreading");
    assert.equal(job?.payload?.saveBackPurpose, "human_review_working_state");
    assert.equal(job?.payload?.outputAssetType, "human_review_working_docx");
  } finally {
    callbackSourceServer.close();
    await once(callbackSourceServer, "close");
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});
