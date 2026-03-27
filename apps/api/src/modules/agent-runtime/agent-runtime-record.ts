export type AgentRuntimeAdapter = "internal_prompt" | "deepagents";
export type AgentRuntimeStatus = "draft" | "active" | "archived";

export interface AgentRuntimeRecord {
  id: string;
  name: string;
  adapter: AgentRuntimeAdapter;
  status: AgentRuntimeStatus;
  sandbox_profile_id?: string;
  allowed_modules: string[];
  admin_only: true;
}
