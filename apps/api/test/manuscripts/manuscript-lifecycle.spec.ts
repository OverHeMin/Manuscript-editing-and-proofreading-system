import test from "node:test";
import assert from "node:assert/strict";
import { createManuscriptApi } from "../../src/modules/manuscripts/manuscript-api.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";

function createLifecycleHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const issuedIds = [
    "manuscript-1",
    "asset-1",
    "job-1",
    "asset-2",
    "asset-3",
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
    now: () => new Date("2026-03-26T10:00:00.000Z"),
    createId: nextId,
  });
  const assetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    now: () => new Date("2026-03-26T10:05:00.000Z"),
    createId: nextId,
  });
  const api = createManuscriptApi({
    manuscriptService,
    assetService,
  });

  return {
    api,
    assetService,
  };
}

test("upload creates manuscript, original asset, and queued upload job records", async () => {
  const { api } = createLifecycleHarness();

  const uploadResponse = await api.upload({
    title: "Cardiology Outcomes 2026",
    manuscriptType: "clinical_study",
    createdBy: "user-1",
    fileName: "cardiology-outcomes.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/cardiology-outcomes.docx",
  });

  assert.equal(uploadResponse.status, 201);
  assert.deepEqual(uploadResponse.body, {
    manuscript: {
      id: "manuscript-1",
      title: "Cardiology Outcomes 2026",
      manuscript_type: "clinical_study",
      status: "uploaded",
      created_by: "user-1",
      current_screening_asset_id: undefined,
      current_editing_asset_id: undefined,
      current_proofreading_asset_id: undefined,
      current_template_family_id: undefined,
      created_at: "2026-03-26T10:00:00.000Z",
      updated_at: "2026-03-26T10:00:00.000Z",
    },
    asset: {
      id: "asset-1",
      manuscript_id: "manuscript-1",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/cardiology-outcomes.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parent_asset_id: undefined,
      source_module: "upload",
      source_job_id: "job-1",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "cardiology-outcomes.docx",
      created_at: "2026-03-26T10:00:00.000Z",
      updated_at: "2026-03-26T10:00:00.000Z",
    },
    job: {
      id: "job-1",
      manuscript_id: "manuscript-1",
      module: "upload",
      job_type: "manuscript_upload",
      status: "queued",
      requested_by: "user-1",
      payload: {
        assetId: "asset-1",
        fileName: "cardiology-outcomes.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      attempt_count: 0,
      started_at: undefined,
      finished_at: undefined,
      error_message: undefined,
      created_at: "2026-03-26T10:00:00.000Z",
      updated_at: "2026-03-26T10:00:00.000Z",
    },
  });

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: "manuscript-1",
  });
  const assetsResponse = await api.listAssets({
    manuscriptId: "manuscript-1",
  });
  const jobResponse = await api.getJob({
    jobId: "job-1",
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(manuscriptResponse.body.id, "manuscript-1");

  assert.equal(assetsResponse.status, 200);
  assert.equal(assetsResponse.body.length, 1);
  assert.equal(assetsResponse.body[0]?.id, "asset-1");

  assert.equal(jobResponse.status, 200);
  assert.equal(jobResponse.body.id, "job-1");
  assert.equal(jobResponse.body.status, "queued");
});

test("writing new derived assets updates the manuscript current asset pointers without overwriting history", async () => {
  const { api, assetService } = createLifecycleHarness();

  const uploadResponse = await api.upload({
    title: "Neurology Review 2026",
    manuscriptType: "review",
    createdBy: "user-2",
    fileName: "neurology-review.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/neurology-review.docx",
  });

  const firstScreeningAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "screening_report",
    storageKey: "screening/neurology-review-v1.md",
    mimeType: "text/markdown",
    createdBy: "user-2",
    fileName: "neurology-review-v1.md",
    sourceModule: "screening",
    sourceJobId: uploadResponse.body.job.id,
  });
  const secondScreeningAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "screening_report",
    storageKey: "screening/neurology-review-v2.md",
    mimeType: "text/markdown",
    createdBy: "user-2",
    fileName: "neurology-review-v2.md",
    parentAssetId: firstScreeningAsset.id,
    sourceModule: "screening",
    sourceJobId: uploadResponse.body.job.id,
  });

  assert.equal(firstScreeningAsset.id, "asset-2");
  assert.equal(firstScreeningAsset.version_no, 1);
  assert.equal(firstScreeningAsset.is_current, true);

  assert.equal(secondScreeningAsset.id, "asset-3");
  assert.equal(secondScreeningAsset.version_no, 2);
  assert.equal(secondScreeningAsset.parent_asset_id, "asset-2");
  assert.equal(secondScreeningAsset.is_current, true);

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });
  const assetsResponse = await api.listAssets({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(
    manuscriptResponse.body.current_screening_asset_id,
    "asset-3",
  );

  assert.equal(assetsResponse.status, 200);
  const screeningAssets = assetsResponse.body.filter(
    (asset) => asset.asset_type === "screening_report",
  );

  assert.deepEqual(
    screeningAssets.map((asset) => ({
      id: asset.id,
      version_no: asset.version_no,
      is_current: asset.is_current,
    })),
    [
      {
        id: "asset-2",
        version_no: 1,
        is_current: false,
      },
      {
        id: "asset-3",
        version_no: 2,
        is_current: true,
      },
    ],
  );
});
