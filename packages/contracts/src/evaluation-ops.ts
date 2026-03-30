import type { ManuscriptModule } from "./assets.js";
import type {
  AgentRuntimeId,
  PromptTemplate,
  SkillPackage,
} from "./agent-tooling.js";
import type { LearningCandidateId } from "./learning.js";
import type { DocumentAssetId, ManuscriptType, UserId } from "./manuscript.js";
import type { ModelRegistryId } from "./model-routing.js";
import type { ModuleTemplateId } from "./templates.js";

export type EvaluationSampleSetId = string;
export type EvaluationSampleSetItemId = string;
export type EvaluationRunItemId = string;
export type EvaluationEvidencePackId = string;
export type EvaluationPromotionRecommendationId = string;

export type EvaluationSampleSetStatus = "draft" | "published" | "archived";
export type FrozenExperimentLane = "baseline" | "candidate";
export type EvaluationRunItemFailureKind =
  | "governance_failed"
  | "runtime_failed"
  | "scoring_failed"
  | "regression_failed";
export type EvaluationDecisionStatus =
  | "recommended"
  | "needs_review"
  | "rejected";

export interface EvaluationSampleSet {
  id: EvaluationSampleSetId;
  name: string;
  module: ManuscriptModule;
  manuscript_types: ManuscriptType[] | "any";
  risk_tags?: string[];
  sample_count: number;
  status: EvaluationSampleSetStatus;
  created_by?: UserId;
  created_at?: string;
}

export interface EvaluationSampleSetItem {
  id: EvaluationSampleSetItemId;
  sample_set_id: EvaluationSampleSetId;
  reviewed_case_snapshot_id: string;
  module: ManuscriptModule;
  manuscript_type: ManuscriptType;
  risk_tags?: string[];
}

export interface FrozenExperimentBinding {
  lane: FrozenExperimentLane;
  model_id: ModelRegistryId;
  runtime_id: AgentRuntimeId;
  prompt_template_id: PromptTemplate["id"];
  skill_package_ids: SkillPackage["id"][];
  module_template_id: ModuleTemplateId;
}

export interface EvaluationRunItem {
  id: EvaluationRunItemId;
  evaluation_run_id: string;
  sample_set_item_id: EvaluationSampleSetItemId;
  lane: FrozenExperimentLane;
  result_asset_id?: DocumentAssetId;
  hard_gate_passed?: boolean;
  weighted_score?: number;
  failure_kind?: EvaluationRunItemFailureKind;
  failure_reason?: string;
  diff_summary?: string;
  requires_human_review?: boolean;
}

export interface EvaluationEvidencePack {
  id: EvaluationEvidencePackId;
  experiment_run_id: string;
  summary_status: EvaluationDecisionStatus;
  score_summary?: string;
  regression_summary?: string;
  failure_summary?: string;
  cost_summary?: string;
  latency_summary?: string;
  created_at?: string;
}

export interface EvaluationPromotionRecommendation {
  id: EvaluationPromotionRecommendationId;
  experiment_run_id: string;
  evidence_pack_id: EvaluationEvidencePackId;
  status: EvaluationDecisionStatus;
  decision_reason?: string;
  learning_candidate_ids?: LearningCandidateId[];
  created_by?: UserId;
  created_at?: string;
}
