import type { AuthRole } from "../auth/roles.ts";
import type { ManuscriptType } from "../manuscripts/types.ts";
import type { TemplateModule } from "../templates/types.ts";

export type AgentProfileRoleKey = "superpowers" | "gstack" | "subagent";
export type AgentProfileStatus = "draft" | "published" | "archived";

export interface AgentProfileViewModel {
  id: string;
  name: string;
  role_key: AgentProfileRoleKey;
  status: AgentProfileStatus;
  module_scope: TemplateModule[] | "any";
  manuscript_types: ManuscriptType[] | "any";
  description?: string;
  admin_only: true;
}

export interface CreateAgentProfileInput {
  actorRole: AuthRole;
  name: string;
  roleKey: AgentProfileRoleKey;
  moduleScope: TemplateModule[] | "any";
  manuscriptTypes: ManuscriptType[] | "any";
  description?: string;
}

export interface PublishAgentProfileInput {
  actorRole: AuthRole;
}

export interface ArchiveAgentProfileInput {
  actorRole: AuthRole;
}
