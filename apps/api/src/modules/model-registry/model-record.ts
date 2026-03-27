import type { TemplateModule } from "../templates/template-record.ts";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "azure_openai"
  | "local"
  | "other";

export interface ModelCostProfile {
  currency?: string;
  unit?: "per_1k_tokens" | "per_1m_tokens" | "per_request" | "unknown";
  input?: number;
  output?: number;
}

export interface ModelRateLimit {
  rpm?: number;
  tpm?: number;
}

export interface ModelRegistryRecord {
  id: string;
  provider: ModelProvider;
  model_name: string;
  model_version: string;
  allowed_modules: TemplateModule[];
  is_prod_allowed: boolean;
  cost_profile?: ModelCostProfile;
  rate_limit?: ModelRateLimit;
  fallback_model_id?: string;
}

export interface ModelRoutingPolicyRecord {
  system_default_model_id?: string;
  module_defaults: Partial<Record<TemplateModule, string>>;
  template_overrides: Record<string, string>;
}
