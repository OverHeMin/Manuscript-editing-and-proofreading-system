import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryReviewedCaseSnapshotRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import {
  FeedbackGovernanceReviewedSnapshotNotFoundError,
  FeedbackSourceAssetNotFoundError,
  HumanFeedbackRecordNotFoundError,
  HumanFeedbackSnapshotMismatchError,
  FeedbackGovernanceService,
  ModuleExecutionSnapshotNotFoundError,
} from "../../src/modules/feedback-governance/feedback-governance-service.ts";
import { InMemoryFeedbackGovernanceRepository } from "../../src/modules/feedback-governance/in-memory-feedback-governance-repository.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";

function createFeedbackGovernanceHarness() {
  const repository = new InMemoryFeedbackGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const reviewedCaseSnapshotRepository =
    new InMemoryReviewedCaseSnapshotRepository();
  const service = new FeedbackGovernanceService({
    repository,
    executionTrackingRepository,
    assetRepository,
    reviewedCaseSnapshotRepository,
    createId: (() => {
      const ids = ["feedback-1", "link-1", "feedback-2", "link-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a feedback governance id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-28T11:00:00.000Z"),
  });

  return {
    repository,
    executionTrackingRepository,
    assetRepository,
    reviewedCaseSnapshotRepository,
    service,
  };
}

async function seedSnapshot(
  executionTrackingRepository: InMemoryExecutionTrackingRepository,
) {
  await executionTrackingRepository.saveSnapshot({
    id: "snapshot-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_id: "job-1",
    execution_profile_id: "profile-1",
    module_template_id: "template-1",
    module_template_version_no: 1,
    prompt_template_id: "prompt-1",
    prompt_template_version: "1.0.0",
    skill_package_ids: ["skill-1"],
    skill_package_versions: ["1.0.0"],
    model_id: "model-1",
    knowledge_item_ids: ["knowledge-1"],
    created_asset_ids: ["asset-1"],
    created_at: "2026-03-28T10:55:00.000Z",
  });
}

async function seedAsset(assetRepository: InMemoryDocumentAssetRepository) {
  await assetRepository.save({
    id: "asset-1",
    manuscript_id: "manuscript-1",
    asset_type: "final_proof_annotated_docx",
    status: "active",
    storage_key: "runs/manuscript-1/proofreading/final.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_module: "proofreading",
    created_by: "proofreader-1",
    version_no: 1,
    is_current: true,
    created_at: "2026-03-28T10:58:00.000Z",
    updated_at: "2026-03-28T10:58:00.000Z",
  });
}

test("learning source links require a snapshot, human feedback, and a source asset", async () => {
  const { service, executionTrackingRepository, assetRepository } =
    createFeedbackGovernanceHarness();

  await assert.rejects(
    () =>
      service.linkLearningCandidateSource({
        learningCandidateId: "candidate-1",
        snapshotId: "missing",
        feedbackRecordId: "feedback-1",
        sourceAssetId: "asset-1",
      }),
    ModuleExecutionSnapshotNotFoundError,
  );

  await seedSnapshot(executionTrackingRepository);

  await assert.rejects(
    () =>
      service.linkLearningCandidateSource({
        learningCandidateId: "candidate-1",
        snapshotId: "snapshot-1",
        feedbackRecordId: "missing-feedback",
        sourceAssetId: "asset-1",
      }),
    HumanFeedbackRecordNotFoundError,
  );

  const feedback = await service.recordHumanFeedback({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    snapshotId: "snapshot-1",
    feedbackType: "manual_confirmation",
    createdBy: "proofreader-1",
  });

  await assert.rejects(
    () =>
      service.linkLearningCandidateSource({
        learningCandidateId: "candidate-1",
        snapshotId: "snapshot-1",
        feedbackRecordId: feedback.id,
        sourceAssetId: "missing-asset",
      }),
    FeedbackSourceAssetNotFoundError,
  );

  await seedAsset(assetRepository);

  const link = await service.linkLearningCandidateSource({
    learningCandidateId: "candidate-1",
    snapshotId: "snapshot-1",
    feedbackRecordId: feedback.id,
    sourceAssetId: "asset-1",
  });

  assert.equal(link.snapshot_id, "snapshot-1");
  assert.equal(link.feedback_record_id, feedback.id);
});

test("human feedback remains manuscript-scoped and cannot be linked across snapshots", async () => {
  const { executionTrackingRepository, assetRepository, service } =
    createFeedbackGovernanceHarness();

  await seedSnapshot(executionTrackingRepository);
  await executionTrackingRepository.saveSnapshot({
    id: "snapshot-2",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_id: "job-2",
    execution_profile_id: "profile-2",
    module_template_id: "template-1",
    module_template_version_no: 1,
    prompt_template_id: "prompt-1",
    prompt_template_version: "1.0.0",
    skill_package_ids: ["skill-1"],
    skill_package_versions: ["1.0.0"],
    model_id: "model-1",
    knowledge_item_ids: ["knowledge-1"],
    created_asset_ids: ["asset-2"],
    created_at: "2026-03-28T10:59:00.000Z",
  });
  await seedAsset(assetRepository);

  const feedback = await service.recordHumanFeedback({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    snapshotId: "snapshot-1",
    feedbackType: "manual_correction",
    feedbackText: "Need to normalize punctuation one more time.",
    createdBy: "proofreader-2",
  });

  assert.equal(feedback.snapshot_id, "snapshot-1");
  assert.equal(feedback.manuscript_id, "manuscript-1");
  assert.equal(feedback.module, "proofreading");

  await assert.rejects(
    () =>
      service.linkLearningCandidateSource({
        learningCandidateId: "candidate-2",
        snapshotId: "snapshot-2",
        feedbackRecordId: feedback.id,
        sourceAssetId: "asset-1",
      }),
    HumanFeedbackSnapshotMismatchError,
  );
});

test("experiment provenance links keep source lineage without requiring human feedback", async () => {
  const { service, assetRepository, reviewedCaseSnapshotRepository } =
    createFeedbackGovernanceHarness();

  await assert.rejects(
    () =>
      service.linkLearningCandidateSource({
        sourceKind: "evaluation_experiment",
        learningCandidateId: "candidate-3",
        reviewedCaseSnapshotId: "missing-reviewed-snapshot",
        evaluationRunId: "evaluation-run-1",
        evidencePackId: "evidence-pack-1",
        sourceAssetId: "asset-1",
      }),
    FeedbackGovernanceReviewedSnapshotNotFoundError,
  );

  await reviewedCaseSnapshotRepository.save({
    id: "reviewed-snapshot-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    manuscript_type: "case_report",
    human_final_asset_id: "human-final-1",
    deidentification_passed: true,
    snapshot_asset_id: "snapshot-asset-1",
    created_by: "proofreader-1",
    created_at: "2026-03-28T10:57:00.000Z",
  });
  await seedAsset(assetRepository);

  const link = await service.linkLearningCandidateSource({
    sourceKind: "evaluation_experiment",
    learningCandidateId: "candidate-3",
    reviewedCaseSnapshotId: "reviewed-snapshot-1",
    evaluationRunId: "evaluation-run-1",
    evidencePackId: "evidence-pack-1",
    sourceAssetId: "asset-1",
  });

  assert.equal(link.source_kind, "evaluation_experiment");
  assert.equal(link.snapshot_kind, "reviewed_case_snapshot");
  assert.equal(link.snapshot_id, "reviewed-snapshot-1");
  assert.equal(link.feedback_record_id, undefined);
  assert.equal(link.evaluation_run_id, "evaluation-run-1");
  assert.equal(link.evidence_pack_id, "evidence-pack-1");
});

test("residual issue provenance links keep truthful governed source labels", async () => {
  const { service, executionTrackingRepository, assetRepository } =
    createFeedbackGovernanceHarness();

  await seedSnapshot(executionTrackingRepository);
  await seedAsset(assetRepository);

  const link = await service.linkLearningCandidateSource({
    sourceKind: "residual_issue",
    learningCandidateId: "candidate-4",
    residualIssueId: "residual-1",
    snapshotId: "snapshot-1",
    sourceAssetId: "asset-1",
  });

  assert.equal(link.source_kind, "residual_issue");
  assert.equal(link.snapshot_kind, "execution_snapshot");
  assert.equal(link.snapshot_id, "snapshot-1");
  assert.equal(link.source_asset_id, "asset-1");
});
