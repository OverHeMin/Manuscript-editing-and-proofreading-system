import type { TemplateModule } from "../templates/template-record.ts";
import type { ModelRoutingPolicyScopeKind } from "../model-routing-governance/model-routing-governance-record.ts";
import type { RuntimeBindingReadinessReport } from "../runtime-bindings/runtime-binding-readiness.ts";

export type AgentExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";
export type AgentExecutionOrchestrationStatus =
  | "not_required"
  | "pending"
  | "running"
  | "retryable"
  | "completed"
  | "failed";
export type AgentExecutionCompletionDerivedStatus =
  | "business_in_progress"
  | "business_failed"
  | "business_completed_follow_up_pending"
  | "business_completed_follow_up_running"
  | "business_completed_follow_up_retryable"
  | "business_completed_follow_up_failed"
  | "business_completed_settled";

export interface AgentExecutionLogRecord {
  id: string;
  manuscript_id: string;
  module: TemplateModule;
  triggered_by: string;
  runtime_id: string;
  sandbox_profile_id: string;
  agent_profile_id: string;
  runtime_binding_id: string;
  tool_permission_policy_id: string;
  execution_snapshot_id?: string;
  routing_policy_version_id?: string;
  routing_policy_scope_kind?: ModelRoutingPolicyScopeKind;
  routing_policy_scope_value?: string;
  resolved_model_id?: string;
  fallback_model_id?: string;
  fallback_trigger?: string;
  knowledge_item_ids: string[];
  verification_check_profile_ids: string[];
  evaluation_suite_ids: string[];
  release_check_profile_id?: string;
  verification_evidence_ids: string[];
  status: AgentExecutionStatus;
  orchestration_status: AgentExecutionOrchestrationStatus;
  orchestration_attempt_count: number;
  orchestration_max_attempts: number;
  orchestration_last_error?: string;
  orchestration_last_attempt_started_at?: string;
  orchestration_last_attempt_finished_at?: string;
  orchestration_attempt_claim_token?: string;
  orchestration_next_retry_at?: string;
  started_at: string;
  finished_at?: string;
}

export interface AgentExecutionRuntimeBindingReadinessObservationRecord {
  observation_status: "reported" | "failed_open";
  report?: RuntimeBindingReadinessReport;
  error?: string;
}

export interface AgentExecutionCompletionSummaryRecord {
  derived_status: AgentExecutionCompletionDerivedStatus;
  business_completed: boolean;
  follow_up_required: boolean;
  fully_settled: boolean;
  attention_required: boolean;
}

export interface AgentExecutionLogViewRecord extends AgentExecutionLogRecord {
  completion_summary: AgentExecutionCompletionSummaryRecord;
  runtime_binding_readiness: AgentExecutionRuntimeBindingReadinessObservationRecord;
}
