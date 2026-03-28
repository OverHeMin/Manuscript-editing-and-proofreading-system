import {
  createEvaluationRun,
  createEvaluationSampleSet,
  createLearningCandidateFromEvaluation,
  finalizeEvaluationRun,
  type CreateEvaluationRunInput,
  type CreateEvaluationSampleSetInput,
  type CreateLearningCandidateFromEvaluationInput,
  type EvaluationDecisionStatus,
  type EvaluationEvidencePackViewModel,
  type EvaluationPromotionRecommendationViewModel,
  type EvaluationRunItemFailureKind,
  type EvaluationRunItemViewModel,
  type EvaluationSampleSetViewModel,
  type FrozenExperimentBindingViewModel,
} from "./verification-ops/index.ts";

const evaluationDecisionStatusCheck: EvaluationDecisionStatus = "needs_review";
const evaluationRunItemFailureKindCheck: EvaluationRunItemFailureKind =
  "regression_failed";

const frozenBindingCheck: FrozenExperimentBindingViewModel = {
  lane: "candidate",
  model_id: "model-candidate-1",
  runtime_id: "runtime-1",
  prompt_template_id: "prompt-1",
  skill_package_ids: ["skill-1"],
  module_template_id: "template-1",
};

const evaluationSampleSetCheck: EvaluationSampleSetViewModel = {
  id: "sample-set-1",
  name: "Editing Historical Samples",
  module: "editing",
  manuscript_types: ["clinical_study"],
  risk_tags: ["terminology", "structure"],
  sample_count: 12,
  source_policy: {
    source_kind: "reviewed_case_snapshot",
    requires_deidentification_pass: true,
    requires_human_final_asset: true,
  },
  status: "published",
  admin_only: true,
};

const evaluationRunItemCheck: EvaluationRunItemViewModel = {
  id: "run-item-1",
  evaluation_run_id: "evaluation-run-1",
  sample_set_item_id: "sample-item-1",
  lane: "candidate",
  result_asset_id: "asset-1",
  hard_gate_passed: true,
  weighted_score: 92,
  failure_kind: evaluationRunItemFailureKindCheck,
  failure_reason: "Regression found in terminology normalization.",
  diff_summary: "Candidate introduced one terminology mismatch.",
  requires_human_review: true,
};

const evidencePackCheck: EvaluationEvidencePackViewModel = {
  id: "evidence-pack-1",
  experiment_run_id: "evaluation-run-1",
  summary_status: evaluationDecisionStatusCheck,
  score_summary: "Average weighted score 92.0 across 12 items.",
  regression_summary: "One regression failure requires review.",
  failure_summary: "1 of 12 candidate outputs failed regression gate.",
  cost_summary: "Candidate lane cost delta +8%.",
  latency_summary: "Candidate lane p95 latency +120ms.",
  created_at: "2026-03-28T18:00:00.000Z",
};

const recommendationCheck: EvaluationPromotionRecommendationViewModel = {
  id: "recommendation-1",
  experiment_run_id: "evaluation-run-1",
  evidence_pack_id: evidencePackCheck.id,
  status: "needs_review",
  decision_reason: "Human review is required before any promotion decision.",
  learning_candidate_ids: ["candidate-1"],
  created_at: "2026-03-28T18:01:00.000Z",
};

const createSampleSetInputCheck: CreateEvaluationSampleSetInput = {
  actorRole: "admin",
  name: "Editing Historical Samples",
  module: "editing",
  sampleItemInputs: [
    {
      reviewedCaseSnapshotId: "reviewed-snapshot-1",
      riskTags: ["terminology", "structure"],
    },
  ],
};

const createEvaluationRunInputCheck: CreateEvaluationRunInput = {
  actorRole: "admin",
  suiteId: "suite-1",
  sampleSetId: "sample-set-1",
  baselineBinding: {
    lane: "baseline",
    modelId: "model-prod-1",
    runtimeId: "runtime-1",
    promptTemplateId: "prompt-prod-1",
    skillPackageIds: ["skill-1"],
    moduleTemplateId: "template-1",
  },
  candidateBinding: {
    lane: frozenBindingCheck.lane,
    modelId: "model-candidate-1",
    runtimeId: "runtime-1",
    promptTemplateId: "prompt-candidate-1",
    skillPackageIds: ["skill-1"],
    moduleTemplateId: "template-1",
  },
  releaseCheckProfileId: "release-profile-1",
};

const createLearningCandidateFromEvaluationInputCheck:
  CreateLearningCandidateFromEvaluationInput = {
    actorRole: "admin",
    runId: "evaluation-run-1",
    evidencePackId: "evidence-pack-1",
    reviewedCaseSnapshotId: "reviewed-snapshot-1",
    candidateType: "prompt_optimization_candidate",
    title: "Adopt the candidate prompt",
    proposalText: "Promote the candidate prompt after review.",
    createdBy: "admin-1",
    sourceAssetId: "asset-1",
  };

const client = {
  async request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }) {
    void input;
    return {
      status: 200,
      body: undefined as TResponse,
    };
  },
};

void createEvaluationSampleSet(client, createSampleSetInputCheck);
void createEvaluationRun(client, createEvaluationRunInputCheck);
void finalizeEvaluationRun(client, {
  actorRole: "admin",
  runId: "evaluation-run-1",
});
void createLearningCandidateFromEvaluation(
  client,
  createLearningCandidateFromEvaluationInputCheck,
);

export {
  createEvaluationRunInputCheck,
  createLearningCandidateFromEvaluationInputCheck,
  createSampleSetInputCheck,
  evaluationDecisionStatusCheck,
  evaluationRunItemCheck,
  evaluationRunItemFailureKindCheck,
  evaluationSampleSetCheck,
  evidencePackCheck,
  frozenBindingCheck,
  recommendationCheck,
};
