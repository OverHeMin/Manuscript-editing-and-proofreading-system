import type { ManuscriptType } from "./manuscript.js";
import type { ModuleType } from "./templates.js";

export type AgentRuntimeAdapter = "internal_prompt" | "deepagents";
export type AgentRuntimeStatus = "draft" | "active" | "archived";
export type ToolGatewayAccessMode = "read" | "write";
export type ToolGatewayScope =
  | "manuscripts"
  | "assets"
  | "knowledge"
  | "templates"
  | "audit"
  | "learning"
  | "model_routing";
export type SkillPackageScope = "admin_only" | "experiment_only";
export type RegistryAssetStatus = "draft" | "published" | "archived";

export interface AgentRuntime {
  id: string;
  name: string;
  adapter: AgentRuntimeAdapter;
  status: AgentRuntimeStatus;
  sandbox_profile_id?: string;
  allowed_modules: ModuleType[];
  admin_only: true;
}

export interface ToolGatewayTool {
  id: string;
  name: string;
  scope: ToolGatewayScope;
  access_mode: ToolGatewayAccessMode;
  description?: string;
  admin_only: true;
}

export interface PromptTemplateAsset {
  id: string;
  name: string;
  version: string;
  status: RegistryAssetStatus;
  module: ModuleType;
  manuscript_types: ManuscriptType[] | "any";
  rollback_target_version?: string;
}

export interface SkillPackage {
  id: string;
  name: string;
  version: string;
  scope: SkillPackageScope;
  status: RegistryAssetStatus;
  applies_to_modules: ModuleType[];
  manuscript_types?: ManuscriptType[] | "any";
  dependency_tools?: string[];
}
