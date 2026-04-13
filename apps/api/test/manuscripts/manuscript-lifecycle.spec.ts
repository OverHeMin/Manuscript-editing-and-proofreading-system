import test from "node:test";
import assert from "node:assert/strict";
import { createManuscriptApi } from "../../src/modules/manuscripts/manuscript-api.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { createWriteTransactionManager } from "../../src/modules/shared/write-transaction-manager.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import type { AgentExecutionLogRecord } from "../../src/modules/agent-execution/agent-execution-record.ts";
import type { DocumentAssetRecord } from "../../src/modules/assets/document-asset-record.ts";
import type { ManuscriptRecord } from "../../src/modules/manuscripts/manuscript-record.ts";

class FailOnNthAssetSaveRepository extends InMemoryDocumentAssetRepository {
  private saveAttempts = 0;

  constructor(private readonly failOnAttempt: number) {
    super();
  }

  async save(asset: DocumentAssetRecord): Promise<void> {
    this.saveAttempts += 1;

    if (this.saveAttempts === this.failOnAttempt) {
      throw new Error("Injected asset save failure.");
    }

    await super.save(asset);
  }
}

class FailOnNthManuscriptSaveRepository extends InMemoryManuscriptRepository {
  private saveAttempts = 0;

  constructor(private readonly failOnAttempt: number) {
    super();
  }

  async seed(manuscript: ManuscriptRecord): Promise<void> {
    await super.save(manuscript);
  }

  async save(manuscript: ManuscriptRecord): Promise<void> {
    this.saveAttempts += 1;

    if (this.saveAttempts === this.failOnAttempt) {
      throw new Error("Injected manuscript save failure.");
    }

    await super.save(manuscript);
  }
}

function createLifecycleHarness(
  issuedIds = [
    "manuscript-1",
    "asset-1",
    "job-1",
    "asset-2",
    "asset-3",
    "asset-4",
    "asset-5",
  ],
) {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();

  const nextId = () => {
    const value = issuedIds.shift();

    assert.ok(value, "Expected a test id to be available.");
    return value;
  };

  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    templateFamilyRepository,
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
    manuscriptService,
    assetService,
    manuscriptRepository,
    assetRepository,
    jobRepository,
    templateFamilyRepository,
  };
}

function createSettlementLifecycleHarness(options?: {
  issuedIds?: string[];
  agentExecutionLogs?: AgentExecutionLogRecord[];
}) {
  const issuedIds = options?.issuedIds ?? [
    "manuscript-1",
    "asset-1",
    "job-1",
    "asset-2",
    "asset-3",
  ];
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const executionTrackingService = new ExecutionTrackingService({
    repository: executionTrackingRepository,
  });
  const executionLogs = new Map(
    (options?.agentExecutionLogs ?? []).map((record) => [record.id, record]),
  );

  const nextId = () => {
    const value = issuedIds.shift();

    assert.ok(value, "Expected a test id to be available.");
    return value;
  };

  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    templateFamilyRepository,
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
    executionTrackingService,
    agentExecutionService: {
      async getLog(logId) {
        const record = executionLogs.get(logId);
        if (!record) {
          throw new Error(`Execution log ${logId} was not found.`);
        }

        return {
          ...record,
          knowledge_item_ids: [...record.knowledge_item_ids],
          verification_check_profile_ids: [
            ...record.verification_check_profile_ids,
          ],
          evaluation_suite_ids: [...record.evaluation_suite_ids],
          verification_evidence_ids: [...record.verification_evidence_ids],
        };
      },
    },
    now: () => new Date("2026-03-26T10:10:00.000Z"),
  });

  return {
    api,
    manuscriptRepository,
    assetRepository,
    jobRepository,
    executionTrackingRepository,
    executionTrackingService,
    executionLogs,
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
  assert.equal(
    manuscriptResponse.body.mainline_readiness_summary?.observation_status,
    "reported",
  );
  assert.equal(
    manuscriptResponse.body.mainline_readiness_summary?.derived_status,
    "ready_for_next_step",
  );
  assert.equal(
    manuscriptResponse.body.mainline_readiness_summary?.next_module,
    "screening",
  );

  assert.equal(assetsResponse.status, 200);
  assert.equal(assetsResponse.body.length, 1);
  assert.equal(assetsResponse.body[0]?.id, "asset-1");

  assert.equal(jobResponse.status, 200);
  assert.equal(jobResponse.body.id, "job-1");
  assert.equal(jobResponse.body.status, "queued");
});

test("batch upload creates a stable root job with queued items and visible progress counts", async () => {
  const { api } = createLifecycleHarness([
    "job-batch-1",
    "manuscript-batch-1",
    "asset-batch-1",
    "job-upload-batch-1",
    "manuscript-batch-2",
    "asset-batch-2",
    "job-upload-batch-2",
  ]);

  const uploadResponse = await api.uploadBatch({
    createdBy: "user-batch",
    items: [
      {
        title: "Batch Review A",
        manuscriptType: "review",
        fileName: "batch-review-a.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/batch-review-a.docx",
      },
      {
        title: "Batch Review B",
        manuscriptType: "clinical_study",
        fileName: "batch-review-b.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/batch-review-b.docx",
      },
    ],
  });

  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadResponse.body.batch_job.id, "job-batch-1");
  assert.equal(uploadResponse.body.batch_job.job_type, "manuscript_upload_batch");
  assert.equal(uploadResponse.body.batch_job.status, "queued");
  assert.equal(uploadResponse.body.items.length, 2);
  assert.equal(uploadResponse.body.items[0]?.job.id, "job-upload-batch-1");
  assert.equal(uploadResponse.body.items[1]?.job.id, "job-upload-batch-2");

  const jobResponse = await api.getJob({
    jobId: uploadResponse.body.batch_job.id,
  });

  assert.equal(jobResponse.status, 200);
  assert.equal(jobResponse.body.batch_progress?.lifecycle_status, "queued");
  assert.equal(jobResponse.body.batch_progress?.settlement_status, "in_progress");
  assert.equal(jobResponse.body.batch_progress?.total_count, 2);
  assert.equal(jobResponse.body.batch_progress?.queued_count, 2);
  assert.equal(jobResponse.body.batch_progress?.running_count, 0);
  assert.equal(jobResponse.body.batch_progress?.succeeded_count, 0);
  assert.equal(jobResponse.body.batch_progress?.failed_count, 0);
  assert.equal(jobResponse.body.batch_progress?.cancelled_count, 0);
  assert.equal(jobResponse.body.batch_progress?.remaining_count, 2);
  assert.equal(
    jobResponse.body.batch_progress?.restart_posture.status,
    "fresh",
  );
  assert.equal(
    jobResponse.body.batch_progress?.items.map((item) => item.status).join(","),
    "queued,queued",
  );
});

test("batch upload rejects requests that exceed the guarded upload limit", async () => {
  const { manuscriptService } = createLifecycleHarness();

  await assert.rejects(
    () =>
      manuscriptService.uploadBatch({
        createdBy: "user-batch-limit",
        items: Array.from({ length: 11 }, (_, index) => ({
          title: `Batch manuscript ${index + 1}`,
          fileName: `batch-${index + 1}.docx`,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          storageKey: `uploads/batch-${index + 1}.docx`,
        })),
      }),
    /cannot exceed 10/i,
  );
});

test("upload detects manuscript type when the operator does not provide one", async () => {
  const { api } = createLifecycleHarness([
    "manuscript-detected-1",
    "asset-detected-1",
    "job-detected-1",
  ]);

  const uploadResponse = await api.upload({
    title: "Meta-analysis of perioperative outcomes",
    manuscriptType: undefined,
    createdBy: "user-detected",
    fileName: "meta-analysis.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/meta-analysis.docx",
  });

  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadResponse.body.manuscript.manuscript_type, "meta_analysis");
  assert.deepEqual(uploadResponse.body.manuscript.manuscript_type_detection_summary, {
    detected_type: "meta_analysis",
    final_type: "meta_analysis",
    source: "heuristic",
    confidence: 0.94,
    matched_signals: ["meta-analysis", "meta analysis"],
  });
});

test("batch lifecycle reports running work, failed-item retry, cancellation, and restart recovery posture", async () => {
  const {
    api,
    manuscriptService,
    manuscriptRepository,
    assetRepository,
    jobRepository,
  } = createLifecycleHarness([
    "job-batch-2",
    "manuscript-batch-3",
    "asset-batch-3",
    "job-upload-batch-3",
    "manuscript-batch-4",
    "asset-batch-4",
    "job-upload-batch-4",
    "manuscript-batch-5",
    "asset-batch-5",
    "job-upload-batch-5",
  ]);

  const uploadResponse = await manuscriptService.uploadBatch({
    createdBy: "user-batch",
    items: [
      {
        title: "Batch Review C",
        manuscriptType: "review",
        fileName: "batch-review-c.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/batch-review-c.docx",
      },
      {
        title: "Batch Review D",
        manuscriptType: "review",
        fileName: "batch-review-d.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/batch-review-d.docx",
      },
      {
        title: "Batch Review E",
        manuscriptType: "review",
        fileName: "batch-review-e.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/batch-review-e.docx",
      },
    ],
  });

  await manuscriptService.markBatchItemRunning({
    batchJobId: uploadResponse.batch_job.id,
    itemId: "item-1",
  });
  await manuscriptService.markBatchItemSucceeded({
    batchJobId: uploadResponse.batch_job.id,
    itemId: "item-1",
  });
  await manuscriptService.markBatchItemRunning({
    batchJobId: uploadResponse.batch_job.id,
    itemId: "item-2",
  });

  const runningResponse = await api.getJob({
    jobId: uploadResponse.batch_job.id,
  });

  assert.equal(runningResponse.body.batch_progress?.lifecycle_status, "running");
  assert.equal(runningResponse.body.batch_progress?.settlement_status, "in_progress");
  assert.equal(runningResponse.body.batch_progress?.succeeded_count, 1);
  assert.equal(runningResponse.body.batch_progress?.running_count, 1);
  assert.equal(runningResponse.body.batch_progress?.queued_count, 1);
  assert.equal(runningResponse.body.batch_progress?.remaining_count, 2);

  await manuscriptService.markBatchItemFailed({
    batchJobId: uploadResponse.batch_job.id,
    itemId: "item-2",
    errorMessage: "Inline normalization failed.",
  });

  const failedResponse = await api.getJob({
    jobId: uploadResponse.batch_job.id,
  });

  assert.equal(failedResponse.body.batch_progress?.failed_count, 1);
  assert.equal(
    failedResponse.body.batch_progress?.items.find((item) => item.item_id === "item-2")
      ?.status,
    "failed",
  );

  await manuscriptService.retryBatchItem({
    batchJobId: uploadResponse.batch_job.id,
    itemId: "item-2",
  });
  await manuscriptService.markBatchItemRunning({
    batchJobId: uploadResponse.batch_job.id,
    itemId: "item-2",
  });

  const restartedManuscriptRepository = new InMemoryManuscriptRepository();
  restartedManuscriptRepository.restoreState(manuscriptRepository.snapshotState());
  const restartedAssetRepository = new InMemoryDocumentAssetRepository();
  restartedAssetRepository.restoreState(assetRepository.snapshotState());
  const restartedJobRepository = new InMemoryJobRepository();
  restartedJobRepository.restoreState(jobRepository.snapshotState());
  const restartedTemplateFamilyRepository = new InMemoryTemplateFamilyRepository();

  const restartedService = new ManuscriptLifecycleService({
    manuscriptRepository: restartedManuscriptRepository,
    assetRepository: restartedAssetRepository,
    jobRepository: restartedJobRepository,
    templateFamilyRepository: restartedTemplateFamilyRepository,
    now: () => new Date("2026-03-26T10:15:00.000Z"),
    createId: () => "unused-id",
  });
  const restartedApi = createManuscriptApi({
    manuscriptService: restartedService,
    assetService: new DocumentAssetService({
      assetRepository: restartedAssetRepository,
      manuscriptRepository: restartedManuscriptRepository,
      now: () => new Date("2026-03-26T10:15:00.000Z"),
      createId: () => "unused-asset-id",
    }),
  });

  await restartedService.resumeBatchAfterRestart({
    batchJobId: uploadResponse.batch_job.id,
  });
  await restartedService.cancelBatch({
    batchJobId: uploadResponse.batch_job.id,
    reason: "Operator cancelled the remaining queue after restart.",
  });

  const cancelledResponse = await restartedApi.getJob({
    jobId: uploadResponse.batch_job.id,
  });

  assert.equal(
    cancelledResponse.body.batch_progress?.lifecycle_status,
    "cancelled",
  );
  assert.equal(
    cancelledResponse.body.batch_progress?.settlement_status,
    "partial_success",
  );
  assert.equal(cancelledResponse.body.batch_progress?.succeeded_count, 1);
  assert.equal(cancelledResponse.body.batch_progress?.failed_count, 0);
  assert.equal(cancelledResponse.body.batch_progress?.running_count, 0);
  assert.equal(cancelledResponse.body.batch_progress?.queued_count, 0);
  assert.equal(cancelledResponse.body.batch_progress?.cancelled_count, 2);
  assert.equal(cancelledResponse.body.batch_progress?.remaining_count, 0);
  assert.equal(
    cancelledResponse.body.batch_progress?.restart_posture.status,
    "resumed_after_restart",
  );
  assert.match(
    cancelledResponse.body.batch_progress?.restart_posture.reason ?? "",
    /restart/i,
  );
  assert.equal(
    cancelledResponse.body.batch_progress?.items.find((item) => item.item_id === "item-2")
      ?.attempt_count,
    2,
  );
  assert.equal(
    cancelledResponse.body.batch_progress?.items.find((item) => item.item_id === "item-2")
      ?.status,
    "cancelled",
  );
  assert.equal(
    cancelledResponse.body.batch_progress?.items.find((item) => item.item_id === "item-3")
      ?.status,
    "cancelled",
  );
});

test("batch lifecycle marks the root batch job as failed when every item fails", async () => {
  const { api, manuscriptService } = createLifecycleHarness([
    "job-batch-all-failed-1",
    "manuscript-batch-all-failed-1",
    "asset-batch-all-failed-1",
    "job-upload-batch-all-failed-1",
    "manuscript-batch-all-failed-2",
    "asset-batch-all-failed-2",
    "job-upload-batch-all-failed-2",
  ]);

  const uploadResponse = await manuscriptService.uploadBatch({
    createdBy: "user-batch",
    items: [
      {
        title: "Batch Failure A",
        manuscriptType: "review",
        fileName: "batch-failure-a.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/batch-failure-a.docx",
      },
      {
        title: "Batch Failure B",
        manuscriptType: "review",
        fileName: "batch-failure-b.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/batch-failure-b.docx",
      },
    ],
  });

  await manuscriptService.markBatchItemFailed({
    batchJobId: uploadResponse.batch_job.id,
    itemId: "item-1",
    errorMessage: "Normalization failed.",
  });
  await manuscriptService.markBatchItemFailed({
    batchJobId: uploadResponse.batch_job.id,
    itemId: "item-2",
    errorMessage: "Template resolution failed.",
  });

  const failedResponse = await api.getJob({
    jobId: uploadResponse.batch_job.id,
  });

  assert.equal(failedResponse.status, 200);
  assert.equal(failedResponse.body.status, "failed");
  assert.equal(failedResponse.body.batch_progress?.lifecycle_status, "completed");
  assert.equal(failedResponse.body.batch_progress?.settlement_status, "failed");
  assert.equal(failedResponse.body.batch_progress?.failed_count, 2);
  assert.equal(failedResponse.body.batch_progress?.succeeded_count, 0);
  assert.equal(failedResponse.body.batch_progress?.remaining_count, 0);
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

test("upload assigns the active template family that matches the manuscript type when one is available", async () => {
  const { api, templateFamilyRepository } = createLifecycleHarness();
  await templateFamilyRepository.save({
    id: "family-review-1",
    manuscript_type: "review",
    name: "Review Mainline",
    status: "active",
  });
  await templateFamilyRepository.save({
    id: "family-review-archived",
    manuscript_type: "review",
    name: "Review Legacy",
    status: "archived",
  });

  const uploadResponse = await api.upload({
    title: "Review Family Assignment",
    manuscriptType: "review",
    createdBy: "user-review",
    fileName: "review-family.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/review-family.docx",
  });

  assert.equal(uploadResponse.status, 201);
  assert.equal(
    uploadResponse.body.manuscript.current_template_family_id,
    "family-review-1",
  );
});

test("upload leaves the template family unset when multiple active families match the manuscript type", async () => {
  const { api, templateFamilyRepository } = createLifecycleHarness();
  await templateFamilyRepository.save({
    id: "family-review-1",
    manuscript_type: "review",
    name: "Review Mainline A",
    status: "active",
  });
  await templateFamilyRepository.save({
    id: "family-review-2",
    manuscript_type: "review",
    name: "Review Mainline B",
    status: "active",
  });

  const uploadResponse = await api.upload({
    title: "Ambiguous Review Family Assignment",
    manuscriptType: "review",
    createdBy: "user-review",
    fileName: "ambiguous-review-family.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/ambiguous-review-family.docx",
  });

  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadResponse.body.manuscript.current_template_family_id, undefined);
});

test("proofreading draft assets do not advance the formal proofreading pointer until a final proofreading asset exists", async () => {
  const { api, assetService } = createLifecycleHarness();

  const uploadResponse = await api.upload({
    title: "Oncology Proofreading 2026",
    manuscriptType: "review",
    createdBy: "user-3",
    fileName: "oncology-proofreading.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/oncology-proofreading.docx",
  });

  const draftProofreadingAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "proofreading_draft_report",
    storageKey: "proofreading/oncology-draft-review.md",
    mimeType: "text/markdown",
    createdBy: "user-3",
    fileName: "oncology-draft-review.md",
    sourceModule: "proofreading",
    sourceJobId: uploadResponse.body.job.id,
  });

  let manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(draftProofreadingAsset.id, "asset-2");
  assert.equal(
    manuscriptResponse.body.current_proofreading_asset_id,
    undefined,
  );

  const finalProofreadingAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "final_proof_issue_report",
    storageKey: "proofreading/oncology-final-issues.md",
    mimeType: "text/markdown",
    createdBy: "user-3",
    fileName: "oncology-final-issues.md",
    parentAssetId: draftProofreadingAsset.id,
    sourceModule: "proofreading",
    sourceJobId: uploadResponse.body.job.id,
  });

  manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(finalProofreadingAsset.id, "asset-3");
  assert.equal(manuscriptResponse.status, 200);
  assert.equal(
    manuscriptResponse.body.current_proofreading_asset_id,
    "asset-3",
  );
});

test("manuscript reads expose a settled result asset matrix and current export selection", async () => {
  const { api, assetService } = createLifecycleHarness([
    "manuscript-1",
    "asset-1",
    "job-1",
    "asset-2",
    "asset-3",
    "asset-4",
    "asset-5",
  ]);

  const uploadResponse = await api.upload({
    title: "Result Matrix Manuscript",
    manuscriptType: "review",
    createdBy: "user-4",
    fileName: "result-matrix.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/result-matrix.docx",
  });

  const screeningAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "screening_report",
    storageKey: "screening/result-matrix.md",
    mimeType: "text/markdown",
    createdBy: "user-4",
    fileName: "result-matrix-screening.md",
    sourceModule: "screening",
    sourceJobId: uploadResponse.body.job.id,
  });
  const editingAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "edited_docx",
    storageKey: "editing/result-matrix.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-4",
    fileName: "result-matrix-editing.docx",
    parentAssetId: screeningAsset.id,
    sourceModule: "editing",
    sourceJobId: uploadResponse.body.job.id,
  });
  const proofreadingDraftAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "proofreading_draft_report",
    storageKey: "proofreading/result-matrix-draft.md",
    mimeType: "text/markdown",
    createdBy: "user-4",
    fileName: "result-matrix-draft.md",
    parentAssetId: editingAsset.id,
    sourceModule: "proofreading",
    sourceJobId: uploadResponse.body.job.id,
  });
  const humanFinalAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "human_final_docx",
    storageKey: "proofreading/result-matrix-human-final.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-4",
    fileName: "result-matrix-human-final.docx",
    parentAssetId: editingAsset.id,
    sourceModule: "manual",
    sourceJobId: uploadResponse.body.job.id,
  });

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(
    manuscriptResponse.body.result_asset_matrix.screening_report?.id,
    screeningAsset.id,
  );
  assert.equal(
    manuscriptResponse.body.result_asset_matrix.edited_docx?.id,
    editingAsset.id,
  );
  assert.equal(
    manuscriptResponse.body.result_asset_matrix.proofreading_draft_report?.id,
    proofreadingDraftAsset.id,
  );
  assert.equal(
    manuscriptResponse.body.result_asset_matrix.final_proof_output?.id,
    humanFinalAsset.id,
  );
  assert.ok(manuscriptResponse.body.current_export_selection);
  assert.equal(
    manuscriptResponse.body.current_export_selection.slot,
    "final_proof_output",
  );
  assert.equal(
    manuscriptResponse.body.current_export_selection.asset.id,
    humanFinalAsset.id,
  );
});

test("human-final publish remains the formal proofreading output even if a lower-precedence proof asset is written later", async () => {
  const { api, assetService } = createLifecycleHarness([
    "manuscript-1",
    "asset-1",
    "job-1",
    "asset-2",
    "asset-3",
    "asset-4",
    "asset-5",
    "asset-6",
  ]);

  const uploadResponse = await api.upload({
    title: "Human Final Priority",
    manuscriptType: "review",
    createdBy: "user-5",
    fileName: "human-final-priority.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/human-final-priority.docx",
  });

  const editingAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "edited_docx",
    storageKey: "editing/human-final-priority.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-5",
    fileName: "human-final-priority-editing.docx",
    parentAssetId: uploadResponse.body.asset.id,
    sourceModule: "editing",
    sourceJobId: uploadResponse.body.job.id,
  });
  await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "final_proof_annotated_docx",
    storageKey: "proofreading/human-final-priority-annotated.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-5",
    fileName: "human-final-priority-annotated.docx",
    parentAssetId: editingAsset.id,
    sourceModule: "proofreading",
    sourceJobId: uploadResponse.body.job.id,
  });
  const humanFinalAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "human_final_docx",
    storageKey: "proofreading/human-final-priority-human-final.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-5",
    fileName: "human-final-priority-human-final.docx",
    parentAssetId: editingAsset.id,
    sourceModule: "manual",
    sourceJobId: uploadResponse.body.job.id,
  });
  await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "final_proof_issue_report",
    storageKey: "proofreading/human-final-priority-report.md",
    mimeType: "text/markdown",
    createdBy: "user-5",
    fileName: "human-final-priority-report.md",
    parentAssetId: editingAsset.id,
    sourceModule: "proofreading",
    sourceJobId: uploadResponse.body.job.id,
  });

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(
    manuscriptResponse.body.current_proofreading_asset_id,
    humanFinalAsset.id,
  );
  assert.equal(
    manuscriptResponse.body.result_asset_matrix.final_proof_output?.id,
    humanFinalAsset.id,
  );
});

test("upload is atomic and rolls back manuscript writes when downstream asset persistence fails", async () => {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new FailOnNthAssetSaveRepository(1);
  const jobRepository = new InMemoryJobRepository();
  const service = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    now: () => new Date("2026-03-26T11:00:00.000Z"),
    createId: (() => {
      const ids = ["manuscript-1", "asset-1", "job-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a test id to be available.");
        return value;
      };
    })(),
  });

  await assert.rejects(
    () =>
      service.upload({
        title: "Atomicity Check",
        manuscriptType: "review",
        createdBy: "user-atomic",
        fileName: "atomicity-check.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "uploads/atomicity-check.docx",
      }),
    /Injected asset save failure/,
  );

  assert.equal(await manuscriptRepository.findById("manuscript-1"), undefined);
  assert.equal(await assetRepository.findById("asset-1"), undefined);
  assert.equal(await jobRepository.findById("job-1"), undefined);
});

test("creating a derived asset rolls back supersede state when manuscript pointer update fails", async () => {
  const manuscriptRepository = new FailOnNthManuscriptSaveRepository(1);
  const assetRepository = new InMemoryDocumentAssetRepository();
  const service = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    now: () => new Date("2026-03-26T11:05:00.000Z"),
    createId: () => "asset-2",
  });

  await manuscriptRepository.seed({
    id: "manuscript-1",
    title: "Rollback Needed",
    manuscript_type: "review",
    status: "uploaded",
    created_by: "user-rollback",
    current_screening_asset_id: "asset-1",
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: undefined,
    created_at: "2026-03-26T11:00:00.000Z",
    updated_at: "2026-03-26T11:00:00.000Z",
  });
  await assetRepository.save({
    id: "asset-1",
    manuscript_id: "manuscript-1",
    asset_type: "screening_report",
    status: "active",
    storage_key: "screening/rollback-v1.md",
    mime_type: "text/markdown",
    parent_asset_id: undefined,
    source_module: "screening",
    source_job_id: "job-1",
    created_by: "user-rollback",
    version_no: 1,
    is_current: true,
    file_name: "rollback-v1.md",
    created_at: "2026-03-26T11:00:00.000Z",
    updated_at: "2026-03-26T11:00:00.000Z",
  });

  await assert.rejects(
    () =>
      service.createAsset({
        manuscriptId: "manuscript-1",
        assetType: "screening_report",
        storageKey: "screening/rollback-v2.md",
        mimeType: "text/markdown",
        createdBy: "user-rollback",
        fileName: "rollback-v2.md",
        parentAssetId: "asset-1",
        sourceModule: "screening",
        sourceJobId: "job-2",
      }),
    /Injected manuscript save failure/,
  );

  const existingAsset = await assetRepository.findById("asset-1");
  const newAsset = await assetRepository.findById("asset-2");

  assert.ok(existingAsset);
  assert.equal(existingAsset.status, "active");
  assert.equal(existingAsset.is_current, true);
  assert.equal(newAsset, undefined);
});

test("derived assets reject parent assets from another manuscript", async () => {
  const { api, assetService } = createLifecycleHarness([
    "manuscript-1",
    "asset-1",
    "job-1",
    "manuscript-2",
    "asset-2",
    "job-2",
    "asset-3",
    "asset-4",
  ]);

  const firstUpload = await api.upload({
    title: "Source Manuscript",
    manuscriptType: "review",
    createdBy: "user-parent",
    fileName: "source.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/source.docx",
  });
  const secondUpload = await api.upload({
    title: "Target Manuscript",
    manuscriptType: "clinical_study",
    createdBy: "user-parent",
    fileName: "target.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/target.docx",
  });

  const sourceAsset = await assetService.createAsset({
    manuscriptId: firstUpload.body.manuscript.id,
    assetType: "screening_report",
    storageKey: "screening/source-v1.md",
    mimeType: "text/markdown",
    createdBy: "user-parent",
    fileName: "source-v1.md",
    sourceModule: "screening",
    sourceJobId: firstUpload.body.job.id,
  });

  await assert.rejects(
    () =>
      assetService.createAsset({
        manuscriptId: secondUpload.body.manuscript.id,
        assetType: "screening_report",
        storageKey: "screening/target-v1.md",
        mimeType: "text/markdown",
        createdBy: "user-parent",
        fileName: "target-v1.md",
        parentAssetId: sourceAsset.id,
        sourceModule: "screening",
        sourceJobId: secondUpload.body.job.id,
      }),
    /parent asset/i,
  );
});

test("derived asset version allocation advances past the highest stored version", async () => {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const service = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    now: () => new Date("2026-03-26T11:10:00.000Z"),
    createId: () => "asset-4",
  });

  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Version Recovery",
    manuscript_type: "review",
    status: "uploaded",
    created_by: "user-version",
    current_screening_asset_id: "asset-3",
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: undefined,
    created_at: "2026-03-26T11:00:00.000Z",
    updated_at: "2026-03-26T11:00:00.000Z",
  });
  await assetRepository.save({
    id: "asset-1",
    manuscript_id: "manuscript-1",
    asset_type: "screening_report",
    status: "superseded",
    storage_key: "screening/version-v1.md",
    mime_type: "text/markdown",
    parent_asset_id: undefined,
    source_module: "screening",
    source_job_id: "job-1",
    created_by: "user-version",
    version_no: 1,
    is_current: false,
    file_name: "version-v1.md",
    created_at: "2026-03-26T11:00:00.000Z",
    updated_at: "2026-03-26T11:00:00.000Z",
  });
  await assetRepository.save({
    id: "asset-3",
    manuscript_id: "manuscript-1",
    asset_type: "screening_report",
    status: "active",
    storage_key: "screening/version-v3.md",
    mime_type: "text/markdown",
    parent_asset_id: "asset-1",
    source_module: "screening",
    source_job_id: "job-2",
    created_by: "user-version",
    version_no: 3,
    is_current: true,
    file_name: "version-v3.md",
    created_at: "2026-03-26T11:05:00.000Z",
    updated_at: "2026-03-26T11:05:00.000Z",
  });

  const newAsset = await service.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "screening_report",
    storageKey: "screening/version-v4.md",
    mimeType: "text/markdown",
    createdBy: "user-version",
    fileName: "version-v4.md",
    parentAssetId: "asset-3",
    sourceModule: "screening",
    sourceJobId: "job-3",
  });

  assert.equal(newAsset.version_no, 4);
});

test("the latest final proofreading asset becomes the formal proofreading pointer", async () => {
  const { api, assetService } = createLifecycleHarness([
    "manuscript-1",
    "asset-1",
    "job-1",
    "asset-2",
    "asset-3",
    "asset-4",
  ]);

  const uploadResponse = await api.upload({
    title: "Dual Final Proof Outputs",
    manuscriptType: "review",
    createdBy: "user-proof",
    fileName: "dual-final-proof.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/dual-final-proof.docx",
  });

  const draftAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "proofreading_draft_report",
    storageKey: "proofreading/dual-draft.md",
    mimeType: "text/markdown",
    createdBy: "user-proof",
    fileName: "dual-draft.md",
    sourceModule: "proofreading",
    sourceJobId: uploadResponse.body.job.id,
  });
  const issueReportAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "final_proof_issue_report",
    storageKey: "proofreading/dual-final-issues.md",
    mimeType: "text/markdown",
    createdBy: "user-proof",
    fileName: "dual-final-issues.md",
    parentAssetId: draftAsset.id,
    sourceModule: "proofreading",
    sourceJobId: uploadResponse.body.job.id,
  });
  const annotatedDocxAsset = await assetService.createAsset({
    manuscriptId: uploadResponse.body.manuscript.id,
    assetType: "final_proof_annotated_docx",
    storageKey: "proofreading/dual-final-annotated.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-proof",
    fileName: "dual-final-annotated.docx",
    parentAssetId: issueReportAsset.id,
    sourceModule: "proofreading",
    sourceJobId: uploadResponse.body.job.id,
  });

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(
    manuscriptResponse.body.current_proofreading_asset_id,
    annotatedDocxAsset.id,
  );
});

test("re-entering the same in-memory write transaction completes without deadlocking", async () => {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const transactionManager = createWriteTransactionManager({
    manuscriptRepository,
    assetRepository,
    jobRepository,
  });

  const nestedTransaction = transactionManager.withTransaction(async () =>
    transactionManager.withTransaction(async () => "nested-ok"),
  );
  const timeout = new Promise<string>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Nested write transaction timed out."));
    }, 100);
  });

  const result = await Promise.race([nestedTransaction, timeout]);

  assert.equal(result, "nested-ok");
});

test("manuscript api reports not-started mainline settlement for untouched execution modules", async () => {
  const { api } = createLifecycleHarness();

  const uploadResponse = await api.upload({
    title: "Settlement Baseline",
    manuscriptType: "clinical_study",
    createdBy: "user-settlement",
    fileName: "settlement-baseline.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/settlement-baseline.docx",
  });

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.deepEqual(
    (manuscriptResponse.body as ManuscriptRecord & {
      module_execution_overview?: unknown;
    }).module_execution_overview,
    {
      screening: {
        module: "screening",
        observation_status: "not_started",
      },
      editing: {
        module: "editing",
        observation_status: "not_started",
      },
      proofreading: {
        module: "proofreading",
        observation_status: "not_started",
      },
    },
  );
});

test("job reads mark upload jobs as untracked when no execution snapshot exists", async () => {
  const { api } = createLifecycleHarness();

  const uploadResponse = await api.upload({
    title: "Untracked Upload Job",
    manuscriptType: "review",
    createdBy: "user-job",
    fileName: "untracked-upload.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/untracked-upload.docx",
  });

  const jobResponse = await api.getJob({
    jobId: uploadResponse.body.job.id,
  });

  assert.equal(jobResponse.status, 200);
  assert.deepEqual(
    (jobResponse.body as typeof jobResponse.body & {
      execution_tracking?: unknown;
    }).execution_tracking,
    {
      observation_status: "not_tracked",
    },
  );
});

test("manuscript settlement fails open for tracked modules when execution tracking is unavailable", async () => {
  const { api, jobRepository } = createLifecycleHarness();

  const uploadResponse = await api.upload({
    title: "Tracked Module Without Snapshot Service",
    manuscriptType: "review",
    createdBy: "user-fail-open",
    fileName: "tracked-module.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/tracked-module.docx",
  });

  await jobRepository.save({
    id: "job-screening-1",
    manuscript_id: uploadResponse.body.manuscript.id,
    module: "screening",
    job_type: "screening_run",
    status: "completed",
    requested_by: "user-fail-open",
    payload: {
      snapshotId: "snapshot-screening-1",
    },
    attempt_count: 1,
    started_at: "2026-03-26T10:20:00.000Z",
    finished_at: "2026-03-26T10:21:00.000Z",
    created_at: "2026-03-26T10:20:00.000Z",
    updated_at: "2026-03-26T10:21:00.000Z",
  });

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(
    manuscriptResponse.body.module_execution_overview.screening.observation_status,
    "failed_open",
  );
  assert.match(
    manuscriptResponse.body.module_execution_overview.screening.error ?? "",
    /Execution tracking service is unavailable/i,
  );
  assert.equal(
    manuscriptResponse.body.mainline_readiness_summary?.observation_status,
    "failed_open",
  );
  assert.match(
    manuscriptResponse.body.mainline_readiness_summary?.error ?? "",
    /Execution tracking service is unavailable/i,
  );
  assert.equal(
    manuscriptResponse.body.module_execution_overview.editing.observation_status,
    "not_started",
  );
  assert.equal(
    manuscriptResponse.body.module_execution_overview.proofreading
      .observation_status,
    "not_started",
  );
});

test("manuscript and job reads expose linked settlement when snapshot evidence is available", async () => {
  const linkedLog: AgentExecutionLogRecord = {
    id: "execution-log-1",
    manuscript_id: "manuscript-1",
    module: "screening",
    triggered_by: "user-tracked",
    runtime_id: "runtime-1",
    sandbox_profile_id: "sandbox-1",
    agent_profile_id: "agent-profile-1",
    runtime_binding_id: "binding-1",
    tool_permission_policy_id: "policy-1",
    execution_snapshot_id: "snapshot-screening-1",
    knowledge_item_ids: [],
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    verification_evidence_ids: [],
    status: "completed",
    orchestration_status: "pending",
    orchestration_attempt_count: 0,
    orchestration_max_attempts: 3,
    started_at: "2026-03-26T10:20:00.000Z",
    finished_at: "2026-03-26T10:21:00.000Z",
  };
  const {
    api,
    jobRepository,
    executionTrackingRepository,
  } = createSettlementLifecycleHarness({
    agentExecutionLogs: [linkedLog],
  });

  const uploadResponse = await api.upload({
    title: "Tracked Mainline Settlement",
    manuscriptType: "clinical_study",
    createdBy: "user-tracked",
    fileName: "tracked-mainline.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/tracked-mainline.docx",
  });

  await jobRepository.save({
    id: "job-screening-1",
    manuscript_id: uploadResponse.body.manuscript.id,
    module: "screening",
    job_type: "screening_run",
    status: "completed",
    requested_by: "user-tracked",
    payload: {
      snapshotId: "snapshot-screening-1",
      agentExecutionLogId: linkedLog.id,
    },
    attempt_count: 1,
    started_at: "2026-03-26T10:20:00.000Z",
    finished_at: "2026-03-26T10:21:00.000Z",
    created_at: "2026-03-26T10:20:00.000Z",
    updated_at: "2026-03-26T10:21:00.000Z",
  });
  await executionTrackingRepository.saveSnapshot({
    id: "snapshot-screening-1",
    manuscript_id: uploadResponse.body.manuscript.id,
    module: "screening",
    job_id: "job-screening-1",
    execution_profile_id: "profile-1",
    module_template_id: "template-1",
    module_template_version_no: 1,
    prompt_template_id: "prompt-1",
    prompt_template_version: "1.0.0",
    skill_package_ids: [],
    skill_package_versions: [],
    model_id: "model-1",
    knowledge_item_ids: [],
    created_asset_ids: ["asset-screening-1"],
    agent_execution_log_id: linkedLog.id,
    created_at: "2026-03-26T10:21:00.000Z",
  });

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });
  const jobResponse = await api.getJob({
    jobId: "job-screening-1",
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(
    manuscriptResponse.body.module_execution_overview.screening.observation_status,
    "reported",
  );
  assert.equal(
    manuscriptResponse.body.module_execution_overview.screening.latest_job?.id,
    "job-screening-1",
  );
  assert.equal(
    manuscriptResponse.body.module_execution_overview.screening.latest_snapshot?.id,
    "snapshot-screening-1",
  );
  assert.equal(
    manuscriptResponse.body.module_execution_overview.screening.settlement
      ?.derived_status,
    "business_completed_follow_up_pending",
  );
  assert.equal(
    manuscriptResponse.body.mainline_readiness_summary?.observation_status,
    "reported",
  );
  assert.equal(
    manuscriptResponse.body.mainline_readiness_summary?.derived_status,
    "waiting_for_follow_up",
  );
  assert.equal(
    manuscriptResponse.body.mainline_readiness_summary?.active_module,
    "screening",
  );

  assert.equal(jobResponse.status, 200);
  assert.equal(jobResponse.body.execution_tracking.observation_status, "reported");
  assert.equal(
    jobResponse.body.execution_tracking.snapshot?.id,
    "snapshot-screening-1",
  );
  assert.equal(
    jobResponse.body.execution_tracking.settlement?.derived_status,
    "business_completed_follow_up_pending",
  );
});

test("manuscript reads expose a bounded mainline attempt ledger ordered by newest activity", async () => {
  const screeningLog: AgentExecutionLogRecord = {
    id: "execution-log-screening-1",
    manuscript_id: "manuscript-1",
    module: "screening",
    triggered_by: "user-ledger",
    runtime_id: "runtime-1",
    sandbox_profile_id: "sandbox-1",
    agent_profile_id: "agent-profile-1",
    runtime_binding_id: "binding-1",
    tool_permission_policy_id: "policy-1",
    execution_snapshot_id: "snapshot-screening-1",
    knowledge_item_ids: [],
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    verification_evidence_ids: [],
    status: "completed",
    orchestration_status: "completed",
    orchestration_attempt_count: 1,
    orchestration_max_attempts: 3,
    started_at: "2026-03-26T10:20:00.000Z",
    finished_at: "2026-03-26T10:21:00.000Z",
  };
  const editingLog: AgentExecutionLogRecord = {
    id: "execution-log-editing-1",
    manuscript_id: "manuscript-1",
    module: "editing",
    triggered_by: "user-ledger",
    runtime_id: "runtime-1",
    sandbox_profile_id: "sandbox-1",
    agent_profile_id: "agent-profile-1",
    runtime_binding_id: "binding-1",
    tool_permission_policy_id: "policy-1",
    execution_snapshot_id: "snapshot-editing-1",
    knowledge_item_ids: [],
    verification_check_profile_ids: [],
    evaluation_suite_ids: [],
    verification_evidence_ids: [],
    status: "completed",
    orchestration_status: "retryable",
    orchestration_attempt_count: 2,
    orchestration_max_attempts: 3,
    started_at: "2026-03-26T10:30:00.000Z",
    finished_at: "2026-03-26T10:31:00.000Z",
  };
  const { api, jobRepository, executionTrackingRepository } =
    createSettlementLifecycleHarness({
      agentExecutionLogs: [screeningLog, editingLog],
    });

  const uploadResponse = await api.upload({
    title: "Tracked Mainline Ledger",
    manuscriptType: "review",
    createdBy: "user-ledger",
    fileName: "tracked-mainline-ledger.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/tracked-mainline-ledger.docx",
  });

  await jobRepository.save({
    id: "job-screening-1",
    manuscript_id: uploadResponse.body.manuscript.id,
    module: "screening",
    job_type: "screening_run",
    status: "completed",
    requested_by: "user-ledger",
    payload: {
      snapshotId: "snapshot-screening-1",
      agentExecutionLogId: screeningLog.id,
    },
    attempt_count: 1,
    started_at: "2026-03-26T10:20:00.000Z",
    finished_at: "2026-03-26T10:21:00.000Z",
    created_at: "2026-03-26T10:20:00.000Z",
    updated_at: "2026-03-26T10:21:00.000Z",
  });
  await executionTrackingRepository.saveSnapshot({
    id: "snapshot-screening-1",
    manuscript_id: uploadResponse.body.manuscript.id,
    module: "screening",
    job_id: "job-screening-1",
    execution_profile_id: "profile-1",
    module_template_id: "template-1",
    module_template_version_no: 1,
    prompt_template_id: "prompt-1",
    prompt_template_version: "1.0.0",
    skill_package_ids: [],
    skill_package_versions: [],
    model_id: "model-1",
    knowledge_item_ids: [],
    created_asset_ids: ["asset-screening-1"],
    agent_execution_log_id: screeningLog.id,
    created_at: "2026-03-26T10:21:00.000Z",
  });

  await jobRepository.save({
    id: "job-editing-1",
    manuscript_id: uploadResponse.body.manuscript.id,
    module: "editing",
    job_type: "editing_run",
    status: "completed",
    requested_by: "user-ledger",
    payload: {
      snapshotId: "snapshot-editing-1",
      agentExecutionLogId: editingLog.id,
    },
    attempt_count: 2,
    started_at: "2026-03-26T10:30:00.000Z",
    finished_at: "2026-03-26T10:31:00.000Z",
    created_at: "2026-03-26T10:30:00.000Z",
    updated_at: "2026-03-26T10:31:00.000Z",
  });
  await executionTrackingRepository.saveSnapshot({
    id: "snapshot-editing-1",
    manuscript_id: uploadResponse.body.manuscript.id,
    module: "editing",
    job_id: "job-editing-1",
    execution_profile_id: "profile-1",
    module_template_id: "template-2",
    module_template_version_no: 1,
    prompt_template_id: "prompt-2",
    prompt_template_version: "1.0.0",
    skill_package_ids: [],
    skill_package_versions: [],
    model_id: "model-2",
    knowledge_item_ids: [],
    created_asset_ids: ["asset-editing-1"],
    agent_execution_log_id: editingLog.id,
    created_at: "2026-03-26T10:31:00.000Z",
  });

  const manuscriptResponse = await api.getManuscript({
    manuscriptId: uploadResponse.body.manuscript.id,
  });

  assert.equal(manuscriptResponse.status, 200);
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.observation_status,
    "reported",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.total_attempts,
    2,
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.visible_attempts,
    2,
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.items[0]?.job_id,
    "job-editing-1",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.items[0]?.module,
    "editing",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.items[0]?.orchestration_status,
    "retryable",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.items[0]
      ?.orchestration_attempt_count,
    2,
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.items[0]?.is_latest_for_module,
    true,
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.items[1]?.job_id,
    "job-screening-1",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attempt_ledger?.items[1]?.settlement_status,
    "business_completed_settled",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.observation_status,
    "reported",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.attention_status,
    "action_required",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.handoff_status,
    "blocked_by_attention",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.focus_module,
    "editing",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.from_module,
    "editing",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.to_module,
    "proofreading",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.latest_job_id,
    "job-editing-1",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.latest_snapshot_id,
    "snapshot-editing-1",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.attention_items.length,
    1,
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.attention_items[0]?.kind,
    "follow_up_retryable",
  );
  assert.equal(
    manuscriptResponse.body.mainline_attention_handoff_pack?.attention_items[0]
      ?.severity,
    "action_required",
  );
});
