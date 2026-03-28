import type { AuthRole } from "../auth/roles.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type { TemplateModule } from "../templates/types.ts";
import type {
  LearningCandidateType,
  LearningCandidateViewModel,
} from "../learning-review/types.ts";

export type VerificationCheckType =
  | "browser_qa"
  | "benchmark"
  | "deploy_verification";
export type VerificationRegistryStatus = "draft" | "published" | "archived";
export type EvaluationSuiteStatus = "draft" | "active" | "archived";
export type EvaluationSuiteType = "regression" | "release_gate";
export type VerificationEvidenceKind = "url" | "artifact";
export type EvaluationRunStatus = "queued" | "running" | "passed" | "failed";
export type EvaluationSampleSetSourceKind = "reviewed_case_snapshot";
export type FrozenExperimentLane = "baseline" | "candidate";
export type EvaluationDecisionStatus =
  | "recommended"
  | "needs_review"
  | "rejected";
export type EvaluationRunItemFailureKind =
  | "governance_failed"
  | "runtime_failed"
  | "scoring_failed"
  | "regression_failed";

export interface EvaluationHardGatePolicyViewModel {
  must_use_deidentified_samples: boolean;
  requires_parsable_output: boolean;
}

export interface EvaluationScoreWeightsViewModel {
  structure: number;
  terminology: number;
  knowledge_coverage: number;
  risk_detection: number;
  human_edit_burden: number;
  cost_and_latency: number;
}

export interface EvaluationSampleSetSourcePolicyViewModel {
  source_kind: EvaluationSampleSetSourceKind;
  requires_deidentification_pass: true;
  requires_human_final_asset: true;
}

export interface FrozenExperimentBindingViewModel {
  lane: FrozenExperimentLane;
  model_id: string;
  runtime_id: string;
  prompt_template_id: string;
  skill_package_ids: string[];
  module_template_id: string;
}

export interface VerificationCheckProfileViewModel {
  id: string;
  name: string;
  check_type: VerificationCheckType;
  status: VerificationRegistryStatus;
  tool_ids?: string[];
  admin_only: true;
}

export interface ReleaseCheckProfileViewModel {
  id: string;
  name: string;
  check_type: VerificationCheckType;
  status: VerificationRegistryStatus;
  verification_check_profile_ids: string[];
  admin_only: true;
}

export interface EvaluationSuiteViewModel {
  id: string;
  name: string;
  suite_type: EvaluationSuiteType;
  status: EvaluationSuiteStatus;
  verification_check_profile_ids: string[];
  module_scope: TemplateModule[] | "any";
  requires_production_baseline?: boolean;
  supports_ab_comparison?: boolean;
  hard_gate_policy?: EvaluationHardGatePolicyViewModel;
  score_weights?: EvaluationScoreWeightsViewModel;
  admin_only: true;
}

export interface VerificationEvidenceViewModel {
  id: string;
  kind: VerificationEvidenceKind;
  label: string;
  uri?: string;
  artifact_asset_id?: string;
  check_profile_id?: string;
  created_at: string;
}

export interface EvaluationSampleSetViewModel {
  id: string;
  name: string;
  module: TemplateModule;
  manuscript_types: ManuscriptType[];
  risk_tags?: string[];
  sample_count: number;
  source_policy: EvaluationSampleSetSourcePolicyViewModel;
  status: VerificationRegistryStatus;
  admin_only: true;
}

export interface EvaluationSampleSetItemViewModel {
  id: string;
  sample_set_id: string;
  manuscript_id: string;
  snapshot_asset_id: string;
  reviewed_case_snapshot_id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  risk_tags?: string[];
}

export interface EvaluationRunViewModel {
  id: string;
  suite_id: string;
  sample_set_id?: string;
  baseline_binding?: FrozenExperimentBindingViewModel;
  candidate_binding?: FrozenExperimentBindingViewModel;
  release_check_profile_id?: string;
  run_item_count?: number;
  status: EvaluationRunStatus;
  evidence_ids: string[];
  started_at: string;
  finished_at?: string;
}

export interface EvaluationRunItemViewModel {
  id: string;
  evaluation_run_id: string;
  sample_set_item_id: string;
  lane: FrozenExperimentLane;
  result_asset_id?: string;
  hard_gate_passed?: boolean;
  weighted_score?: number;
  failure_kind?: EvaluationRunItemFailureKind;
  failure_reason?: string;
  diff_summary?: string;
  requires_human_review?: boolean;
}

export interface EvaluationEvidencePackViewModel {
  id: string;
  experiment_run_id: string;
  summary_status: EvaluationDecisionStatus;
  score_summary?: string;
  regression_summary?: string;
  failure_summary?: string;
  cost_summary?: string;
  latency_summary?: string;
  created_at: string;
}

export interface EvaluationPromotionRecommendationViewModel {
  id: string;
  experiment_run_id: string;
  evidence_pack_id: string;
  status: EvaluationDecisionStatus;
  decision_reason?: string;
  learning_candidate_ids?: string[];
  created_at: string;
}

export interface FinalizeEvaluationRunResultViewModel {
  run: EvaluationRunViewModel;
  evidence_pack: EvaluationEvidencePackViewModel;
  recommendation: EvaluationPromotionRecommendationViewModel;
}

export interface CreateVerificationCheckProfileInput {
  actorRole: AuthRole;
  name: string;
  checkType: VerificationCheckType;
  toolIds?: string[];
}

export interface PublishVerificationCheckProfileInput {
  actorRole: AuthRole;
}

export interface CreateReleaseCheckProfileInput {
  actorRole: AuthRole;
  name: string;
  checkType: VerificationCheckType;
  verificationCheckProfileIds: string[];
}

export interface PublishReleaseCheckProfileInput {
  actorRole: AuthRole;
}

export interface CreateEvaluationSuiteInput {
  actorRole: AuthRole;
  name: string;
  suiteType: EvaluationSuiteType;
  verificationCheckProfileIds: string[];
  moduleScope: TemplateModule[] | "any";
  requiresProductionBaseline?: boolean;
  supportsAbComparison?: boolean;
  hardGatePolicy?: {
    mustUseDeidentifiedSamples: boolean;
    requiresParsableOutput: boolean;
  };
  scoreWeights?: {
    structure: number;
    terminology: number;
    knowledgeCoverage: number;
    riskDetection: number;
    humanEditBurden: number;
    costAndLatency: number;
  };
}

export interface ActivateEvaluationSuiteInput {
  actorRole: AuthRole;
}

export interface RecordVerificationEvidenceInput {
  actorRole: AuthRole;
  kind: VerificationEvidenceKind;
  label: string;
  uri?: string;
  artifactAssetId?: string;
  checkProfileId?: string;
}

export interface CreateEvaluationSampleSetInput {
  actorRole: AuthRole;
  name: string;
  module: TemplateModule;
  sampleItemInputs: Array<{
    reviewedCaseSnapshotId: string;
    riskTags?: string[];
  }>;
}

export interface PublishEvaluationSampleSetInput {
  actorRole: AuthRole;
}

export interface FrozenExperimentBindingInput {
  lane: FrozenExperimentLane;
  modelId: string;
  runtimeId: string;
  promptTemplateId: string;
  skillPackageIds: string[];
  moduleTemplateId: string;
}

export interface CreateEvaluationRunInput {
  actorRole: AuthRole;
  suiteId: string;
  sampleSetId?: string;
  baselineBinding?: FrozenExperimentBindingInput;
  candidateBinding?: FrozenExperimentBindingInput;
  releaseCheckProfileId?: string;
}

export interface CompleteEvaluationRunInput {
  actorRole: AuthRole;
  runId: string;
  status: Extract<EvaluationRunStatus, "passed" | "failed">;
  evidenceIds: string[];
}

export interface RecordEvaluationRunItemResultInput {
  actorRole: AuthRole;
  runItemId: string;
  resultAssetId?: string;
  hardGatePassed?: boolean;
  weightedScore?: number;
  failureKind?: EvaluationRunItemFailureKind;
  failureReason?: string;
  diffSummary?: string;
  requiresHumanReview?: boolean;
}

export interface FinalizeEvaluationRunInput {
  actorRole: AuthRole;
  runId: string;
}

export interface CreateLearningCandidateFromEvaluationInput {
  actorRole: AuthRole;
  runId: string;
  evidencePackId: string;
  reviewedCaseSnapshotId: string;
  candidateType: LearningCandidateType;
  title?: string;
  proposalText?: string;
  createdBy: string;
  sourceAssetId: string;
}

export type EvaluationLearningCandidateViewModel = LearningCandidateViewModel;
