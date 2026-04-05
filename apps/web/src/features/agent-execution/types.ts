import type { TemplateModule } from "../templates/types.ts";
import type { ModelRoutingPolicyScopeKind } from "../model-routing-governance/types.ts";

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

export interface AgentExecutionLogViewModel {
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
  orchestration_status?: AgentExecutionOrchestrationStatus;
  orchestration_attempt_count?: number;
  orchestration_max_attempts?: number;
  orchestration_last_error?: string;
  orchestration_last_attempt_started_at?: string;
  orchestration_last_attempt_finished_at?: string;
  orchestration_next_retry_at?: string;
  started_at: string;
  finished_at?: string;
}

export interface CreateAgentExecutionLogInput {
  manuscriptId: string;
  module: TemplateModule;
  triggeredBy: string;
  runtimeId: string;
  sandboxProfileId: string;
  agentProfileId: string;
  runtimeBindingId: string;
  toolPermissionPolicyId: string;
  knowledgeItemIds: string[];
  verificationCheckProfileIds?: string[];
  evaluationSuiteIds?: string[];
  releaseCheckProfileId?: string;
}

export interface CompleteAgentExecutionLogInput {
  logId: string;
  executionSnapshotId: string;
  verificationEvidenceIds?: string[];
}
