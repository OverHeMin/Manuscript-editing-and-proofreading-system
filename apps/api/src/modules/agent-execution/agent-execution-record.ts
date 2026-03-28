import type { TemplateModule } from "../templates/template-record.ts";

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
  knowledge_item_ids: string[];
  verification_evidence_ids: string[];
  status: AgentExecutionStatus;
  started_at: string;
  finished_at?: string;
}
