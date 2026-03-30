import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { InMemoryFeedbackGovernanceRepository } from "../../src/modules/feedback-governance/in-memory-feedback-governance-repository.ts";
import { FeedbackGovernanceService } from "../../src/modules/feedback-governance/feedback-governance-service.ts";
import {
  InMemoryLearningCandidateRepository,
  InMemoryReviewedCaseSnapshotRepository,
} from "../../src/modules/learning/in-memory-learning-repository.ts";
import { createLearningApi } from "../../src/modules/learning/learning-api.ts";
import { LearningService } from "../../src/modules/learning/learning-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { createVerificationOpsApi } from "../../src/modules/verification-ops/verification-ops-api.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import {
  EvaluationLearningCandidateTypeError,
  VerificationOpsService,
} from "../../src/modules/verification-ops/verification-ops-service.ts";

function createEvaluationLearningHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const snapshotRepository = new InMemoryReviewedCaseSnapshotRepository();
  const candidateRepository = new InMemoryLearningCandidateRepository();
  const feedbackGovernanceRepository = new InMemoryFeedbackGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const learningIds = ["candidate-1", "candidate-2", "candidate-3"];
  const feedbackIds = ["link-1", "link-2", "link-3"];

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    createId: () => "unused-asset-id",
    now: () => new Date("2026-03-28T17:30:00.000Z"),
  });

  const feedbackGovernanceService = new FeedbackGovernanceService({
    repository: feedbackGovernanceRepository,
    executionTrackingRepository,
    assetRepository,
    reviewedCaseSnapshotRepository: snapshotRepository,
    createId: () => {
      const value = feedbackIds.shift();
      assert.ok(value, "Expected an experiment provenance link id.");
      return value;
    },
    now: () => new Date("2026-03-28T17:31:00.000Z"),
  });

  const learningService = new LearningService({
    manuscriptRepository,
    assetRepository,
    snapshotRepository,
    candidateRepository,
    documentAssetService,
    feedbackGovernanceService,
    createId: () => {
      const value = learningIds.shift();
      assert.ok(value, "Expected a learning candidate id.");
      return value;
    },
    now: () => new Date("2026-03-28T17:32:00.000Z"),
  });

  const verificationOpsApi = createVerificationOpsApi({
    verificationOpsService: new VerificationOpsService({
      repository: verificationOpsRepository,
      reviewedCaseSnapshotRepository: snapshotRepository,
      toolGatewayRepository,
      learningService,
      createId: () => "unused-verification-id",
      now: () => new Date("2026-03-28T17:33:00.000Z"),
    }),
  });

  return {
    manuscriptRepository,
    assetRepository,
    snapshotRepository,
    candidateRepository,
    feedbackGovernanceService,
    verificationOpsRepository,
    verificationOpsApi,
    learningApi: createLearningApi({
      learningService,
    }),
  };
}

async function seedEvaluationLearningContext() {
  const harness = createEvaluationLearningHarness();

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Evaluation Learning Fixture",
    manuscript_type: "clinical_study",
    status: "completed",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-28T17:20:00.000Z",
    updated_at: "2026-03-28T17:20:00.000Z",
  });

  await harness.assetRepository.save({
    id: "candidate-result-asset-1",
    manuscript_id: "manuscript-1",
    asset_type: "edited_docx",
    status: "active",
    storage_key: "runs/manuscript-1/editing/candidate-result.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_module: "editing",
    created_by: "admin-1",
    version_no: 1,
    is_current: true,
    file_name: "candidate-result.docx",
    created_at: "2026-03-28T17:21:00.000Z",
    updated_at: "2026-03-28T17:21:00.000Z",
  });

  await harness.snapshotRepository.save({
    id: "reviewed-snapshot-1",
    manuscript_id: "manuscript-1",
    module: "editing",
    manuscript_type: "clinical_study",
    human_final_asset_id: "human-final-1",
    deidentification_passed: true,
    snapshot_asset_id: "snapshot-asset-1",
    created_by: "editor-1",
    created_at: "2026-03-28T17:22:00.000Z",
  });

  await harness.verificationOpsRepository.saveEvaluationSampleSet({
    id: "sample-set-1",
    name: "Evaluation Sample Set",
    module: "editing",
    manuscript_types: ["clinical_study"],
    sample_count: 1,
    source_policy: {
      source_kind: "reviewed_case_snapshot",
      requires_deidentification_pass: true,
      requires_human_final_asset: true,
    },
    status: "published",
    admin_only: true,
  });
  await harness.verificationOpsRepository.saveEvaluationSampleSetItem({
    id: "sample-set-item-1",
    sample_set_id: "sample-set-1",
    manuscript_id: "manuscript-1",
    snapshot_asset_id: "snapshot-asset-1",
    reviewed_case_snapshot_id: "reviewed-snapshot-1",
    module: "editing",
    manuscript_type: "clinical_study",
    risk_tags: ["structure"],
  });
  await harness.verificationOpsRepository.saveEvaluationRun({
    id: "evaluation-run-1",
    suite_id: "suite-1",
    sample_set_id: "sample-set-1",
    baseline_binding: {
      lane: "baseline",
      model_id: "model-prod-1",
      runtime_id: "runtime-prod-1",
      prompt_template_id: "prompt-prod-1",
      skill_package_ids: ["skill-prod-1"],
      module_template_id: "template-prod-1",
    },
    candidate_binding: {
      lane: "candidate",
      model_id: "model-candidate-1",
      runtime_id: "runtime-prod-1",
      prompt_template_id: "prompt-prod-1",
      skill_package_ids: ["skill-prod-1"],
      module_template_id: "template-prod-1",
    },
    run_item_count: 1,
    status: "queued",
    evidence_ids: [],
    started_at: "2026-03-28T17:23:00.000Z",
  });
  await harness.verificationOpsRepository.saveEvaluationEvidencePack({
    id: "evidence-pack-1",
    experiment_run_id: "evaluation-run-1",
    summary_status: "recommended",
    score_summary: "Average weighted score 91.0 across 1 item(s).",
    regression_summary: "No regression failures were recorded.",
    failure_summary: "No failure annotations were recorded.",
    cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
    latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
    created_at: "2026-03-28T17:24:00.000Z",
  });

  return harness;
}

test("experiment evidence can create governed learning candidates with experiment provenance", async () => {
  const { verificationOpsApi, candidateRepository, feedbackGovernanceService } =
    await seedEvaluationLearningContext();

  await assert.rejects(
    () =>
      verificationOpsApi.createLearningCandidateFromEvaluation({
        actorRole: "editor",
        input: {
          runId: "evaluation-run-1",
          evidencePackId: "evidence-pack-1",
          reviewedCaseSnapshotId: "reviewed-snapshot-1",
          candidateType: "prompt_optimization_candidate",
          title: "Proofreading baseline prompt optimization",
          proposalText: "Adopt the candidate prompt because regression gates passed.",
          createdBy: "admin-1",
          sourceAssetId: "candidate-result-asset-1",
        },
      }),
    AuthorizationError,
  );

  const created = await verificationOpsApi.createLearningCandidateFromEvaluation({
    actorRole: "admin",
    input: {
      runId: "evaluation-run-1",
      evidencePackId: "evidence-pack-1",
      reviewedCaseSnapshotId: "reviewed-snapshot-1",
      candidateType: "prompt_optimization_candidate",
      title: "Proofreading baseline prompt optimization",
      proposalText: "Adopt the candidate prompt because regression gates passed.",
      createdBy: "admin-1",
      sourceAssetId: "candidate-result-asset-1",
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.type, "prompt_optimization_candidate");
  assert.equal(created.body.status, "pending_review");

  const storedCandidate = await candidateRepository.findById(created.body.id);
  assert.equal(storedCandidate?.status, "pending_review");

  const links =
    await feedbackGovernanceService.listLearningCandidateSourceLinksByCandidateId(
      created.body.id,
    );
  assert.equal(links.length, 1);
  assert.equal(links[0]?.source_kind, "evaluation_experiment");
  assert.equal(links[0]?.snapshot_kind, "reviewed_case_snapshot");
  assert.equal(links[0]?.snapshot_id, "reviewed-snapshot-1");
  assert.equal(links[0]?.evaluation_run_id, "evaluation-run-1");
  assert.equal(links[0]?.evidence_pack_id, "evidence-pack-1");
  assert.equal(links[0]?.feedback_record_id, undefined);
});

test("experiment handoff only supports governed optimization candidate types", async () => {
  const { verificationOpsApi } = await seedEvaluationLearningContext();

  await assert.rejects(
    () =>
      verificationOpsApi.createLearningCandidateFromEvaluation({
        actorRole: "admin",
        input: {
          runId: "evaluation-run-1",
          evidencePackId: "evidence-pack-1",
          reviewedCaseSnapshotId: "reviewed-snapshot-1",
          candidateType: "rule_candidate",
          title: "Unsupported rule candidate",
          proposalText: "This should stay outside the experiment handoff path.",
          createdBy: "admin-1",
          sourceAssetId: "candidate-result-asset-1",
        },
      }),
    EvaluationLearningCandidateTypeError,
  );
});
