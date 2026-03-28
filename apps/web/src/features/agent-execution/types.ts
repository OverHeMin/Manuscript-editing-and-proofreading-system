import type { TemplateModule } from "../templates/types.ts";

export type AgentExecutionStatus =
  | "queued"
  | "running"
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
  knowledge_item_ids: string[];
  verification_evidence_ids: string[];
  status: AgentExecutionStatus;
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
}

export interface CompleteAgentExecutionLogInput {
  logId: string;
  executionSnapshotId: string;
  verificationEvidenceIds?: string[];
}
