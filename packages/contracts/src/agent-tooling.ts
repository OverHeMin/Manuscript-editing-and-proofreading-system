import type { ManuscriptModule } from "./assets.js";
import type { ManuscriptType } from "./manuscript.js";

export type AgentRuntimeAdapter = "internal_prompt" | "deepagents";
export type AgentRuntimeStatus = "draft" | "active" | "archived";

export interface AgentRuntime {
  id: string;
  name: string;
  adapter: AgentRuntimeAdapter;
  status: AgentRuntimeStatus;
  sandbox_profile_id?: string;
  allowed_modules: string[];
  admin_only: true;
  created_at?: string;
  updated_at?: string;
}

export type ToolGatewayAccessMode = "read" | "write";
export type ToolGatewayScope =
  | "manuscripts"
  | "assets"
  | "knowledge"
  | "templates"
  | "audit"
  | "agent_runtime"
  | "prompt_skill";

export interface ToolGatewayTool {
  id: string;
  name: string;
  description?: string;
  access_mode: ToolGatewayAccessMode;
  scope: ToolGatewayScope;
  admin_only: true;
  created_at?: string;
  updated_at?: string;
}

export type PromptTemplateStatus = "draft" | "published" | "archived";

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  template: string;
  module: ManuscriptModule;
  manuscript_types: ManuscriptType[];
  status: PromptTemplateStatus;
  rollback_version?: string;
  created_at?: string;
  updated_at?: string;
}

export type SkillPackageScope = "admin_only";
export type SkillPackageStatus = "draft" | "published" | "archived";

export interface SkillPackage {
  id: string;
  name: string;
  version: string;
  description?: string;
  applies_to_modules: ManuscriptModule[];
  scope: SkillPackageScope;
  status: SkillPackageStatus;
  admin_only: true;
  created_at?: string;
  updated_at?: string;
}
