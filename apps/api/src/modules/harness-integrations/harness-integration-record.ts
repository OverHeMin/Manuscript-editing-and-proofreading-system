export type HarnessAdapterKind =
  | "promptfoo"
  | "langfuse_oss"
  | "simple_evals_local"
  | "judge_reliability_local";

export type HarnessExecutionMode = "local_cli" | "self_hosted_http";

export type HarnessRedactionMode =
  | "structured_only"
  | "metadata_only"
  | "bounded_excerpt";

export type HarnessExecutionTriggerKind =
  | "operator_requested"
  | "api_requested";

export type HarnessExecutionStatus = "succeeded" | "degraded" | "failed";

export interface HarnessRedactionProfileRecord {
  id: string;
  name: string;
  redaction_mode: HarnessRedactionMode;
  structured_fields: string[];
  allow_raw_payload_export: boolean;
  created_at: string;
  updated_at: string;
}

export interface HarnessAdapterRecord {
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

export interface HarnessFeatureFlagChangeRecord {
  id: string;
  adapter_id: string;
  flag_key: string;
  enabled: boolean;
  changed_by: string;
  change_reason?: string;
  created_at: string;
}

export interface HarnessExecutionAuditRecord {
  id: string;
  adapter_id: string;
  trigger_kind: HarnessExecutionTriggerKind;
  input_reference: string;
  dataset_id?: string;
  artifact_uri?: string;
  status: HarnessExecutionStatus;
  degradation_reason?: string;
  result_summary?: Record<string, unknown>;
  created_at: string;
}
