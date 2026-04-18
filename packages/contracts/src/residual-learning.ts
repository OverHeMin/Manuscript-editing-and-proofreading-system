import type {
  DocumentAssetId,
  ManuscriptId,
  ManuscriptType,
} from "./manuscript.js";
import type { LearningCandidateId } from "./learning.js";
import type { ModuleType } from "./templates.js";

export type ResidualIssueId = string;
export type ResidualIssueSourceStage =
  | "quality_engine"
  | "rule_residual"
  | "model_residual";
export type ResidualConfidenceBand =
  | "L0_observation"
  | "L1_review_pending"
  | "L2_candidate_ready"
  | "L3_strongly_reusable";
export type ResidualIssueRiskLevel = "low" | "medium" | "high" | "critical";
export type ResidualIssueRoute =
  | "rule_candidate"
  | "knowledge_candidate"
  | "prompt_template_candidate"
  | "manual_only"
  | "evidence_only";
export type ResidualIssueStatus =
  | "observed"
  | "validation_pending"
  | "candidate_ready"
  | "validation_failed"
  | "manual_only"
  | "evidence_only"
  | "candidate_created"
  | "archived";
export type ResidualHarnessValidationStatus =
  | "not_required"
  | "queued"
  | "passed"
  | "failed";

export interface ResidualIssue {
  id: ResidualIssueId;
  module: ModuleType;
  manuscript_id: ManuscriptId;
  manuscript_type?: ManuscriptType;
  job_id?: string;
  execution_snapshot_id: string;
  agent_execution_log_id?: string;
  output_asset_id?: DocumentAssetId;
  execution_profile_id?: string;
  runtime_binding_id?: string;
  prompt_template_id?: string;
  retrieval_snapshot_id?: string;
  issue_type: string;
  source_stage?: ResidualIssueSourceStage;
  excerpt?: string;
  location?: Record<string, unknown>;
  suggestion?: string;
  rationale?: string;
  related_rule_ids?: string[];
  related_knowledge_item_ids?: string[];
  related_quality_issue_ids?: string[];
  novelty_key: string;
  recurrence_count?: number;
  model_confidence?: number;
  signal_breakdown?: Record<string, unknown>;
  system_confidence_band: ResidualConfidenceBand;
  risk_level?: ResidualIssueRiskLevel;
  recommended_route: ResidualIssueRoute;
  status?: ResidualIssueStatus;
  harness_validation_status: ResidualHarnessValidationStatus;
  harness_run_id?: string;
  harness_evidence_pack_id?: string;
  learning_candidate_id?: LearningCandidateId;
  created_at?: string;
  updated_at?: string;
}
