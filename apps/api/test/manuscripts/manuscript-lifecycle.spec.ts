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
