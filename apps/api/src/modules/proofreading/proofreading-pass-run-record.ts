import type { ProofreadingIssue } from "./proofreading-issue-contract.ts";

export type ProofreadingDeepPassKind =
  | "medical_facts_and_terminology"
  | "structure_logic_and_consistency"
  | "data_statistics_units_and_tables"
  | "language_style_punctuation_and_format"
  | "residual_synthesis";

export type ProofreadingPassRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface ProofreadingPassRunOutputRecord {
  summary: string;
  issues: ProofreadingIssue[];
  governedEvidenceCounts: {
    failedChecks: number;
    manualReviewItems: number;
    qualityFindings: number;
  };
}

export interface ProofreadingPassRunRecord {
  id: string;
  manuscript_id: string;
  job_id: string;
  snapshot_id?: string;
  pass_no: number;
  pass_kind: ProofreadingDeepPassKind;
  status: ProofreadingPassRunStatus;
  model_id: string;
  model_version?: string;
  input_context_digest?: string;
  rule_ids: string[];
  knowledge_item_ids: string[];
  quality_package_ids: string[];
  prompt_template_id?: string;
  skill_package_ids: string[];
  output?: ProofreadingPassRunOutputRecord;
  error_message?: string;
  retry_count: number;
  started_at: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
}
