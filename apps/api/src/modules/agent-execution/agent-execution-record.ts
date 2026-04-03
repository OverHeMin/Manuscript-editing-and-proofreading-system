import type { TemplateModule } from "../templates/template-record.ts";
import type { ModelRoutingPolicyScopeKind } from "../model-routing-governance/model-routing-governance-record.ts";

export type AgentExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

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
  started_at: string;
  finished_at?: string;
}
