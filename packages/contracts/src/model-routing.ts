import type { ModuleType, ModuleTemplateId } from "./templates.js";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "azure_openai"
  | "local"
  | "other";

export type ModelRegistryId = string;

export interface ModelCostProfile {
  currency?: string;
  // Keep cost model flexible: providers differ by pricing dimensions.
  unit?: "per_1k_tokens" | "per_1m_tokens" | "per_request" | "unknown";
  input?: number;
  output?: number;
}

export interface ModelRateLimit {
  rpm?: number;
  tpm?: number;
}

// Per docs/superpowers/specs/05-ai-model-routing-and-evaluation.md
export interface ModelRegistryEntry {
  id: ModelRegistryId;

  provider: ModelProvider;
  model_name: string;
  model_version?: string;

  allowed_modules: ModuleType[];
  is_prod_allowed: boolean;

  cost_profile?: ModelCostProfile;
  rate_limit?: ModelRateLimit;

  fallback_model_id?: ModelRegistryId;
}

export type ModelSelectionLayer =
  | "system_default"
  | "module_default"
  | "template_override"
  | "task_override";

export interface ModelRouteRequest {
  module: ModuleType;
  module_template_id?: ModuleTemplateId;

  // Task-level override only works if the model is in the allow list.
  task_override_model_id?: ModelRegistryId;
  task_override_allow_list?: ModelRegistryId[];
}

export interface ResolvedModel {
  layer: ModelSelectionLayer;
  model: ModelRegistryEntry;
  fallback?: ModelRegistryEntry;
}

export interface ModelRouter {
  resolve(req: ModelRouteRequest): ResolvedModel;
}

