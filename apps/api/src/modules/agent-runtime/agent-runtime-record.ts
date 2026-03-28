import type { TemplateModule } from "../templates/template-record.ts";

export type AgentRuntimeAdapter = "internal_prompt" | "deepagents";
export type AgentRuntimeStatus = "draft" | "active" | "archived";

export interface AgentRuntimeRecord {
  id: string;
  name: string;
  adapter: AgentRuntimeAdapter;
  status: AgentRuntimeStatus;
  sandbox_profile_id?: string;
  allowed_modules: TemplateModule[];
  runtime_slot?: string;
  admin_only: true;
}
