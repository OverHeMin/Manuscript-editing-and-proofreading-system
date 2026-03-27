import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createLearningApi } from "../../src/modules/learning/learning-api.ts";
import {
  LearningAnnotatedAssetMismatchError,
  LearningAnnotatedAssetNotFoundError,
  LearningDeidentificationRequiredError,
  LearningHumanFinalAssetRequiredError,
  LearningSnapshotDeidentificationRequiredError,
  LearningService,
} from "../../src/modules/learning/learning-service.ts";
import {
  InMemoryLearningCandidateRepository,
  InMemoryReviewedCaseSnapshotRepository,
} from "../../src/modules/learning/in-memory-learning-repository.ts";
import type { ReviewedCaseSnapshotRecord } from "../../src/modules/learning/learning-record.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";

class FailingReviewedCaseSnapshotRepository extends InMemoryReviewedCaseSnapshotRepository {
  constructor(
    private readonly shouldFail: (record: ReviewedCaseSnapshotRecord) => boolean,
  ) {
    super();
  }

  override async save(record: ReviewedCaseSnapshotRecord): Promise<void> {
    if (this.shouldFail(record)) {
      throw new Error("Injected reviewed case snapshot persistence failure.");
    }

    await super.save(record);
  }
}

function createLearningHarness(options?: {
  snapshotRepository?: InMemoryReviewedCaseSnapshotRepository;
  candidateRepository?: InMemoryLearningCandidateRepository;
}) {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const snapshotRepository =
    options?.snapshotRepository ?? new InMemoryReviewedCaseSnapshotRepository();
  const candidateRepository =
    options?.candidateRepository ?? new InMemoryLearningCandidateRepository();
  const issuedIds = [
    "asset-1",
    "asset-2",
    "asset-3",
    "snapshot-1",
    "candidate-1",
  ];
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected a learning test id to be available.");
    return value;
  };

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    createId: nextId,
    now: () => new Date("2026-03-27T10:00:00.000Z"),
  });
  const learningService = new LearningService({
    manuscriptRepository,
    assetRepository,
    snapshotRepository,
    candidateRepository,
    documentAssetService,
    createId: nextId,
    now: () => new Date("2026-03-27T10:00:00.000Z"),
  });

  return {
    manuscriptRepository,
    assetRepository,
    documentAssetService,
    learningApi: createLearningApi({
      learningService,
    }),
  };
}

async function seedLearningContext() {
  const harness = createLearningHarness();

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Learning Fixture",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-27T09:55:00.000Z",
    updated_at: "2026-03-27T09:55:00.000Z",
  });

  const originalAsset = await harness.documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "original",
    storageKey: "uploads/manuscript-1/original.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-1",
    fileName: "original.docx",
    sourceModule: "upload",
  });

  return {
    ...harness,
    originalAsset,
  };
}

test("reviewed case snapshots require a human-final asset", async () => {
  const { learningApi, originalAsset } = await seedLearningContext();

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: originalAsset.id,
        deidentificationPassed: true,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    LearningHumanFinalAssetRequiredError,
  );
});

test("reviewed case snapshots require a de-identification pass", async () => {
  const { learningApi, documentAssetService, originalAsset } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset.id,
        deidentificationPassed: false,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    LearningSnapshotDeidentificationRequiredError,
  );
});

test("learning candidates require a de-identification pass", async () => {
  const { learningApi, documentAssetService, originalAsset } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  const snapshot = await learningApi.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "clinical_study",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });

  await assert.rejects(
    () =>
      learningApi.createLearningCandidate({
        snapshotId: snapshot.body.id,
        type: "rule_candidate",
        title: "Terminology fix",
        proposalText: "Standardize trial terminology.",
        requestedBy: "editor-1",
        deidentificationPassed: false,
      }),
    LearningDeidentificationRequiredError,
  );
});

test("learning candidate approval is restricted to the dedicated learning review permission", async () => {
  const { learningApi, documentAssetService, originalAsset } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  const snapshot = await learningApi.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "clinical_study",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });
  const candidate = await learningApi.createLearningCandidate({
    snapshotId: snapshot.body.id,
    type: "rule_candidate",
    title: "Terminology fix",
    proposalText: "Standardize trial terminology.",
    requestedBy: "editor-1",
    deidentificationPassed: true,
  });

  await assert.rejects(
    () =>
      learningApi.approveLearningCandidate({
        candidateId: candidate.body.id,
        actorRole: "editor",
      }),
    AuthorizationError,
  );
  await assert.rejects(
    () =>
      learningApi.approveLearningCandidate({
        candidateId: candidate.body.id,
        actorRole: "admin",
      }),
    AuthorizationError,
  );

  const reviewerApproved = await learningApi.approveLearningCandidate({
    candidateId: candidate.body.id,
    actorRole: "knowledge_reviewer",
  });

  assert.equal(reviewerApproved.status, 200);
  assert.equal(reviewerApproved.body.status, "approved");
});

test("reviewed case snapshot creation rolls back the snapshot asset on persistence failure", async () => {
  const snapshotRepository = new FailingReviewedCaseSnapshotRepository(() => true);
  const { learningApi, documentAssetService, assetRepository, originalAsset } =
    await seedLearningContextWithOverrides({
      snapshotRepository,
    });

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset.id,
        deidentificationPassed: true,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    /snapshot persistence failure/i,
  );

  const snapshotAssets = await assetRepository.listByManuscriptIdAndType(
    "manuscript-1",
    "learning_snapshot_attachment",
  );

  assert.deepEqual(snapshotAssets, []);
});

test("reviewed case snapshots persist the manuscript type from the stored manuscript record", async () => {
  const { learningApi, documentAssetService, originalAsset } =
    await seedLearningContext();

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });

  const snapshot = await learningApi.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    manuscriptType: "other",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });

  assert.equal(snapshot.body.manuscript_type, "clinical_study");
});

test("reviewed case snapshots reject annotated assets that do not belong to the same manuscript", async () => {
  const { learningApi, manuscriptRepository, documentAssetService, originalAsset } =
    await seedLearningContext();

  await manuscriptRepository.save({
    id: "manuscript-2",
    title: "Foreign Fixture",
    manuscript_type: "review",
    status: "completed",
    created_by: "user-2",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-2",
    created_at: "2026-03-27T09:56:00.000Z",
    updated_at: "2026-03-27T09:56:00.000Z",
  });

  const humanFinalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "human_final_docx",
    storageKey: "learning/manuscript-1/human-final.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "human-final.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "manual",
  });
  const foreignOriginalAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-2",
    assetType: "original",
    storageKey: "uploads/manuscript-2/original.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-2",
    fileName: "foreign.docx",
    sourceModule: "upload",
  });

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset.id,
        annotatedAssetId: foreignOriginalAsset.id,
        deidentificationPassed: true,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    LearningAnnotatedAssetMismatchError,
  );

  await assert.rejects(
    () =>
      learningApi.createReviewedCaseSnapshot({
        manuscriptId: "manuscript-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: humanFinalAsset.id,
        annotatedAssetId: "missing-annotated-asset",
        deidentificationPassed: true,
        requestedBy: "editor-1",
        storageKey: "learning/manuscript-1/snapshot.bin",
      }),
    LearningAnnotatedAssetNotFoundError,
  );
});

async function seedLearningContextWithOverrides(options?: {
  snapshotRepository?: InMemoryReviewedCaseSnapshotRepository;
  candidateRepository?: InMemoryLearningCandidateRepository;
}) {
  const harness = createLearningHarness(options);

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Learning Fixture",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-27T09:55:00.000Z",
    updated_at: "2026-03-27T09:55:00.000Z",
  });

  const originalAsset = await harness.documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "original",
    storageKey: "uploads/manuscript-1/original.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-1",
    fileName: "original.docx",
    sourceModule: "upload",
  });

  return {
    ...harness,
    originalAsset,
  };
}
