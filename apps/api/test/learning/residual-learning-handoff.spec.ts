import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { FeedbackGovernanceService } from "../../src/modules/feedback-governance/feedback-governance-service.ts";
import { InMemoryFeedbackGovernanceRepository } from "../../src/modules/feedback-governance/in-memory-feedback-governance-repository.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import {
  InMemoryLearningCandidateRepository,
  InMemoryReviewedCaseSnapshotRepository,
} from "../../src/modules/learning/in-memory-learning-repository.ts";
import { LearningService } from "../../src/modules/learning/learning-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";

function createResidualLearningHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const snapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
  const candidateRepository = new InMemoryLearningCandidateRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const feedbackGovernanceRepository = new InMemoryFeedbackGovernanceRepository();
  const ids = [
    "asset-1",
    "asset-2",
    "reviewed-snapshot-1",
    "snapshot-asset-1",
    "candidate-1",
    "source-asset-1",
    "link-1",
    "candidate-2",
    "link-2",
    "candidate-3",
    "link-3",
    "candidate-4",
    "link-4",
  ];
  const nextId = () => {
    const value = ids.shift();
    assert.ok(value, "Expected a residual learning test id to be available.");
    return value;
  };

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    createId: nextId,
    now: () => new Date("2026-04-18T09:00:00.000Z"),
  });
  const feedbackGovernanceService = new FeedbackGovernanceService({
    repository: feedbackGovernanceRepository,
    executionTrackingRepository,
    assetRepository,
    reviewedCaseSnapshotRepository: snapshotRepository,
    createId: nextId,
    now: () => new Date("2026-04-18T09:05:00.000Z"),
  });
  const learningService = new LearningService({
    manuscriptRepository,
    assetRepository,
    snapshotRepository,
    candidateRepository,
    documentAssetService,
    feedbackGovernanceService,
    createId: nextId,
    now: () => new Date("2026-04-18T09:00:00.000Z"),
  });

  return {
    manuscriptRepository,
    assetRepository,
    candidateRepository,
    documentAssetService,
    executionTrackingRepository,
    learningService,
  };
}

async function seedResidualLearningContext() {
  const harness = createResidualLearningHarness();

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Residual learning fixture",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-04-18T08:55:00.000Z",
    updated_at: "2026-04-18T08:55:00.000Z",
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

async function seedExecutionSnapshot(
  executionTrackingRepository: InMemoryExecutionTrackingRepository,
) {
  await executionTrackingRepository.saveSnapshot({
    id: "execution-snapshot-1",
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
    created_asset_ids: ["asset-2"],
    created_at: "2026-04-18T08:59:00.000Z",
  });
}

test("residual issue handoff creates knowledge candidates with truthful provenance", async () => {
  const {
    learningService,
    candidateRepository,
    documentAssetService,
    executionTrackingRepository,
    originalAsset,
  } = await seedResidualLearningContext();

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

  const reviewedSnapshot = await learningService.createReviewedCaseSnapshot({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    manuscriptType: "clinical_study",
    humanFinalAssetId: humanFinalAsset.id,
    deidentificationPassed: true,
    requestedBy: "editor-1",
    storageKey: "learning/manuscript-1/snapshot.bin",
  });

  const candidate = await learningService.createLearningCandidate({
    snapshotId: reviewedSnapshot.id,
    type: "knowledge_candidate",
    title: "Residual terminology guidance",
    proposalText: "Capture the missed terminology guidance as reusable knowledge.",
    requestedBy: "editor-1",
    deidentificationPassed: true,
  });

  await seedExecutionSnapshot(executionTrackingRepository);

  const sourceAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "final_proof_annotated_docx",
    storageKey: "runs/manuscript-1/proofreading/annotated.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "annotated.docx",
    parentAssetId: humanFinalAsset.id,
    sourceModule: "proofreading",
    sourceJobId: "job-1",
  });

  const sourceLink = await learningService.attachGovernedSource({
    candidateId: candidate.id,
    sourceKind: "residual_issue",
    residualIssueId: "residual-1",
    snapshotId: "execution-snapshot-1",
    sourceAssetId: sourceAsset.id,
  });
  const storedCandidate = await candidateRepository.findById(candidate.id);

  assert.equal(candidate.type, "knowledge_candidate");
  assert.equal(storedCandidate?.governed_provenance_kind, "residual_issue");
  assert.equal(sourceLink.source_kind, "residual_issue");
  assert.equal(storedCandidate?.status, "pending_review");
});

test("validated residual issues bridge into governed learning candidates with route-aware candidate types", async () => {
  const {
    learningService,
    candidateRepository,
    documentAssetService,
    executionTrackingRepository,
    originalAsset,
  } = await seedResidualLearningContext();
  const residualIssueRepository = new InMemoryResidualIssueRepository();
  const residualLearningService = new ResidualLearningService({
    residualIssueRepository,
    learningService,
    createId: () => "residual-generated-1",
    now: () => new Date("2026-04-18T09:10:00.000Z"),
  });

  await seedExecutionSnapshot(executionTrackingRepository);

  const sourceAsset = await documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "final_proof_annotated_docx",
    storageKey: "runs/manuscript-1/proofreading/residual-annotated.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "editor-1",
    fileName: "residual-annotated.docx",
    parentAssetId: originalAsset.id,
    sourceModule: "proofreading",
    sourceJobId: "job-1",
  });

  await residualIssueRepository.save({
    id: "residual-rule-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    execution_snapshot_id: "execution-snapshot-1",
    output_asset_id: sourceAsset.id,
    issue_type: "unit_expression_gap",
    source_stage: "model_residual",
    excerpt: "5 mg per dL",
    novelty_key: "unit_expression_gap:5 mg per dL",
    recurrence_count: 2,
    system_confidence_band: "L2_candidate_ready",
    risk_level: "low",
    recommended_route: "rule_candidate",
    status: "candidate_ready",
    harness_validation_status: "passed",
    created_at: "2026-04-18T09:00:00.000Z",
    updated_at: "2026-04-18T09:00:00.000Z",
  });
  await residualIssueRepository.save({
    id: "residual-knowledge-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    execution_snapshot_id: "execution-snapshot-1",
    output_asset_id: sourceAsset.id,
    issue_type: "terminology_gap",
    source_stage: "model_residual",
    excerpt: "HbA1c naming drift",
    novelty_key: "terminology_gap:HbA1c naming drift",
    recurrence_count: 1,
    system_confidence_band: "L2_candidate_ready",
    risk_level: "low",
    recommended_route: "knowledge_candidate",
    status: "candidate_ready",
    harness_validation_status: "passed",
    created_at: "2026-04-18T09:00:00.000Z",
    updated_at: "2026-04-18T09:00:00.000Z",
  });
  await residualIssueRepository.save({
    id: "residual-prompt-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    execution_snapshot_id: "execution-snapshot-1",
    output_asset_id: sourceAsset.id,
    issue_type: "uncovered_local_language_issue",
    source_stage: "model_residual",
    excerpt: "Localized phrasing gap",
    novelty_key: "uncovered_local_language_issue:Localized phrasing gap",
    recurrence_count: 1,
    system_confidence_band: "L2_candidate_ready",
    risk_level: "low",
    recommended_route: "prompt_template_candidate",
    status: "candidate_ready",
    harness_validation_status: "passed",
    created_at: "2026-04-18T09:00:00.000Z",
    updated_at: "2026-04-18T09:00:00.000Z",
  });
  await residualIssueRepository.save({
    id: "residual-manual-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    execution_snapshot_id: "execution-snapshot-1",
    output_asset_id: sourceAsset.id,
    issue_type: "medical_meaning_risk",
    source_stage: "model_residual",
    excerpt: "Medical meaning risk",
    novelty_key: "medical_meaning_risk:Medical meaning risk",
    recurrence_count: 1,
    system_confidence_band: "L1_review_pending",
    risk_level: "high",
    recommended_route: "manual_only",
    status: "manual_only",
    harness_validation_status: "not_required",
    created_at: "2026-04-18T09:00:00.000Z",
    updated_at: "2026-04-18T09:00:00.000Z",
  });

  const createdRule = await residualLearningService.createLearningCandidateFromIssue({
    issueId: "residual-rule-1",
    requestedBy: "editor-1",
    title: "Residual unit rule",
  });
  const createdKnowledge =
    await residualLearningService.createLearningCandidateFromIssue({
      issueId: "residual-knowledge-1",
      requestedBy: "editor-1",
      title: "Residual terminology knowledge",
    });
  const createdPrompt =
    await residualLearningService.createLearningCandidateFromIssue({
      issueId: "residual-prompt-1",
      requestedBy: "editor-1",
      title: "Residual prompt optimization",
    });

  assert.equal(createdRule.type, "rule_candidate");
  assert.equal(createdRule.governed_provenance_kind, "residual_issue");
  assert.equal(createdKnowledge.type, "knowledge_candidate");
  assert.equal(createdPrompt.type, "prompt_optimization_candidate");

  const updatedRuleIssue = await residualIssueRepository.findById("residual-rule-1");
  assert.equal(updatedRuleIssue?.learning_candidate_id, createdRule.id);
  assert.equal(updatedRuleIssue?.status, "candidate_created");

  await assert.rejects(
    () =>
      residualLearningService.createLearningCandidateFromIssue({
        issueId: "residual-manual-1",
        requestedBy: "editor-1",
      }),
  );

  const storedCandidates = await candidateRepository.list();
  assert.equal(storedCandidates.length, 3);
});
