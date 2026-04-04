export type HarnessAdapterKind =
  | "promptfoo"
  | "langfuse_oss"
  | "simple_evals_local"
  | "judge_reliability_local";

export type HarnessExecutionMode = "local_cli" | "self_hosted_http";

export type HarnessExecutionStatus = "succeeded" | "degraded" | "failed";

export interface HarnessAdapterViewModel {
  id: string;
  kind: HarnessAdapterKind;
  display_name: string;
  execution_mode: HarnessExecutionMode;
  fail_open: boolean;
  redaction_profile_id: string;
  feature_flag_keys: string[];
  result_envelope_version: string;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HarnessExecutionViewModel {
  id: string;
  adapter_id: string;
  trigger_kind: "operator_requested" | "api_requested";
  input_reference: string;
  dataset_id?: string;
  artifact_uri?: string;
  status: HarnessExecutionStatus;
  degradation_reason?: string;
  result_summary?: Record<string, unknown>;
  created_at: string;
}

export type HarnessTraceAvailability =
  | "available"
  | "unavailable"
  | "not_applicable"
  | "unknown";

export interface HarnessAdapterHealthViewModel {
  adapter: HarnessAdapterViewModel;
  latest_execution: HarnessExecutionViewModel | null;
  latest_status: HarnessExecutionStatus | "never_run";
  trace_availability: HarnessTraceAvailability;
  latest_degradation_reason?: string;
}

export interface HarnessJudgeCalibrationOutcomeViewModel {
  adapter_id: string;
  execution_id: string;
  status: HarnessExecutionStatus;
  exact_match_rate?: number;
  agreement_count?: number;
  disagreement_count?: number;
  created_at: string;
}
