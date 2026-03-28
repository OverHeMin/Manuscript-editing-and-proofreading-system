import type { AuthRole } from "../auth/roles.ts";
import type { TemplateModule } from "../templates/types.ts";

export type AgentRuntimeAdapter = "internal_prompt" | "deepagents";
export type AgentRuntimeStatus = "draft" | "active" | "archived";

export interface AgentRuntimeViewModel {
  id: string;
  name: string;
  adapter: AgentRuntimeAdapter;
  status: AgentRuntimeStatus;
  sandbox_profile_id?: string;
  allowed_modules: TemplateModule[];
  runtime_slot?: string;
  version?: number;
  admin_only: true;
}

export interface CreateAgentRuntimeInput {
  actorRole: AuthRole;
  name: string;
  adapter: AgentRuntimeAdapter;
  sandboxProfileId?: string;
  allowedModules: TemplateModule[];
  runtimeSlot?: string;
}

export interface ArchiveAgentRuntimeInput {
  actorRole: AuthRole;
}

export interface PublishAgentRuntimeInput {
  actorRole: AuthRole;
}
