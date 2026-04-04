import type { TemplateModule } from "../templates/template-record.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";

export type VerificationCheckType =
  | "browser_qa"
  | "benchmark"
  | "deploy_verification"
  | "retrieval_quality";
export type RegistryAssetStatus = "draft" | "published" | "archived";
export type EvaluationSuiteStatus = "draft" | "active" | "archived";
export type EvaluationSuiteType = "regression" | "release_gate";
export type VerificationEvidenceKind = "url" | "artifact";
export type EvaluationRunStatus = "queued" | "running" | "passed" | "failed";
export type EvaluationSampleSetSourceKind = "reviewed_case_snapshot";
export type GovernedExecutionEvaluationSourceKind =
  "governed_module_execution";
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

export interface EvaluationHardGatePolicyRecord {
  must_use_deidentified_samples: boolean;
  requires_parsable_output: boolean;
}

export interface EvaluationScoreWeightsRecord {
  structure: number;
  terminology: number;
  knowledge_coverage: number;
  risk_detection: number;
  human_edit_burden: number;
  cost_and_latency: number;
}

export interface EvaluationSampleSetSourcePolicyRecord {
  source_kind: EvaluationSampleSetSourceKind;
  requires_deidentification_pass: true;
  requires_human_final_asset: true;
}

export interface EvaluationSampleSetRecord {
  id: string;
  name: string;
  module: TemplateModule;
  manuscript_types: ManuscriptType[];
  risk_tags?: string[];
  sample_count: number;
  source_policy: EvaluationSampleSetSourcePolicyRecord;
  status: RegistryAssetStatus;
  admin_only: true;
}

export interface EvaluationSampleSetItemRecord {
  id: string;
  sample_set_id: string;
  manuscript_id: string;
  snapshot_asset_id: string;
  reviewed_case_snapshot_id: string;
  module: TemplateModule;
  manuscript_type: ManuscriptType;
  risk_tags?: string[];
}

export interface VerificationCheckProfileRecord {
  id: string;
  name: string;
  check_type: VerificationCheckType;
  status: RegistryAssetStatus;
  tool_ids?: string[];
  admin_only: true;
}

export interface ReleaseCheckProfileRecord {
  id: string;
  name: string;
  check_type: VerificationCheckType;
  status: RegistryAssetStatus;
  verification_check_profile_ids: string[];
  admin_only: true;
}

export interface EvaluationSuiteRecord {
  id: string;
  name: string;
  suite_type: EvaluationSuiteType;
  status: EvaluationSuiteStatus;
  verification_check_profile_ids: string[];
  module_scope: TemplateModule[] | "any";
  requires_production_baseline: boolean;
  supports_ab_comparison: boolean;
  hard_gate_policy: EvaluationHardGatePolicyRecord;
  score_weights: EvaluationScoreWeightsRecord;
  admin_only: true;
}

export interface FrozenExperimentBindingRecord {
  lane: FrozenExperimentLane;
  model_id: string;
  runtime_id: string;
  prompt_template_id: string;
  skill_package_ids: string[];
  module_template_id: string;
}

export interface VerificationEvidenceRecord {
  id: string;
  kind: VerificationEvidenceKind;
  label: string;
  uri?: string;
  artifact_asset_id?: string;
  check_profile_id?: string;
  retrieval_snapshot_id?: string;
  retrieval_quality_run_id?: string;
  created_at: string;
}

export interface GovernedExecutionEvaluationSourceRecord {
  source_kind: GovernedExecutionEvaluationSourceKind;
  manuscript_id: string;
  source_module: TemplateModule;
  agent_execution_log_id: string;
  execution_snapshot_id: string;
  output_asset_id: string;
}

export interface EvaluationRunRecord {
  id: string;
  suite_id: string;
  sample_set_id?: string;
  baseline_binding?: FrozenExperimentBindingRecord;
  candidate_binding?: FrozenExperimentBindingRecord;
  governed_source?: GovernedExecutionEvaluationSourceRecord;
  release_check_profile_id?: string;
  run_item_count: number;
  status: EvaluationRunStatus;
  evidence_ids: string[];
  started_at: string;
  finished_at?: string;
}

export interface EvaluationRunItemRecord {
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

export interface EvaluationEvidencePackRecord {
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

export interface EvaluationPromotionRecommendationRecord {
  id: string;
  experiment_run_id: string;
  evidence_pack_id: string;
  status: EvaluationDecisionStatus;
  decision_reason?: string;
  learning_candidate_ids?: string[];
  created_at: string;
}
