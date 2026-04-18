import type {
  ResidualConfidenceBand,
  ResidualHarnessValidationStatus,
  ResidualIssueRiskLevel,
  ResidualIssueRoute,
  ResidualIssueSourceStage,
  ResidualIssueStatus,
} from "@medical/contracts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { LearningCandidateRecord } from "../learning/learning-record.ts";
import type {
  ManuscriptRecord,
  ManuscriptType,
} from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export interface ResidualIssueRecord {
  id: string;
  module: TemplateModule;
  manuscript_id: ManuscriptRecord["id"];
  manuscript_type: ManuscriptType;
  job_id?: JobRecord["id"];
  execution_snapshot_id: string;
  agent_execution_log_id?: string;
  output_asset_id?: DocumentAssetRecord["id"];
  execution_profile_id?: string;
  runtime_binding_id?: string;
  prompt_template_id?: string;
  retrieval_snapshot_id?: string;
  issue_type: string;
  source_stage: ResidualIssueSourceStage;
  excerpt?: string;
  location?: Record<string, unknown>;
  suggestion?: string;
  rationale?: string;
  related_rule_ids?: string[];
  related_knowledge_item_ids?: string[];
  related_quality_issue_ids?: string[];
  novelty_key: string;
  recurrence_count: number;
  model_confidence?: number;
  signal_breakdown?: Record<string, unknown>;
  system_confidence_band: ResidualConfidenceBand;
  risk_level: ResidualIssueRiskLevel;
  recommended_route: ResidualIssueRoute;
  status: ResidualIssueStatus;
  harness_validation_status: ResidualHarnessValidationStatus;
  harness_run_id?: string;
  harness_evidence_pack_id?: string;
  learning_candidate_id?: LearningCandidateRecord["id"];
  created_at: string;
  updated_at: string;
}
