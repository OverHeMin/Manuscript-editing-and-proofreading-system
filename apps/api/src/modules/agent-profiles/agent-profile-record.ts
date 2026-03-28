import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type AgentRoleKey = "superpowers" | "gstack" | "subagent";
export type AgentProfileStatus = "draft" | "published" | "archived";

export interface AgentProfileRecord {
  id: string;
  name: string;
  role_key: AgentRoleKey;
  status: AgentProfileStatus;
  module_scope: TemplateModule[] | "any";
  manuscript_types: ManuscriptType[] | "any";
  description?: string;
  admin_only: true;
}
