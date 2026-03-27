import type { AuthRole } from "../auth/roles.ts";

export type AgentRuntimeAdapter = "internal_prompt" | "deepagents";
export type AgentRuntimeStatus = "draft" | "active" | "archived";

export interface AgentRuntimeViewModel {
  id: string;
  name: string;
  adapter: AgentRuntimeAdapter;
  status: AgentRuntimeStatus;
  sandbox_profile_id?: string;
  allowed_modules: string[];
  admin_only: true;
}

export interface CreateAgentRuntimeInput {
  actorRole: AuthRole;
  name: string;
  adapter: AgentRuntimeAdapter;
  sandboxProfileId?: string;
  allowedModules: string[];
}

export interface ArchiveAgentRuntimeInput {
  actorRole: AuthRole;
}
