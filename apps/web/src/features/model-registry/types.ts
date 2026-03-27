import type { AuthRole } from "../auth/roles.ts";
import type { TemplateModule } from "../templates/types.ts";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "azure_openai"
  | "local"
  | "other";

export interface ModelCostProfileViewModel {
  currency?: string;
  unit?: "per_1k_tokens" | "per_1m_tokens" | "per_request" | "unknown";
  input?: number;
  output?: number;
}

export interface ModelRateLimitViewModel {
  rpm?: number;
  tpm?: number;
}

export interface ModelRegistryEntryViewModel {
  id: string;
  provider: ModelProvider;
  model_name: string;
  model_version: string;
  allowed_modules: TemplateModule[];
  is_prod_allowed: boolean;
  cost_profile?: ModelCostProfileViewModel;
  rate_limit?: ModelRateLimitViewModel;
  fallback_model_id?: string;
}

export interface ModelRoutingPolicyViewModel {
  system_default_model_id?: string;
  module_defaults: Partial<Record<TemplateModule, string>>;
  template_overrides: Record<string, string>;
}

export interface CreateModelRegistryEntryInput {
  actorRole: AuthRole;
  provider: ModelProvider;
  modelName: string;
  modelVersion?: string;
  allowedModules: TemplateModule[];
  isProdAllowed: boolean;
  costProfile?: ModelCostProfileViewModel;
  rateLimit?: ModelRateLimitViewModel;
  fallbackModelId?: string;
}

export interface UpdateModelRegistryEntryInput {
  actorRole: AuthRole;
  allowedModules?: TemplateModule[];
  isProdAllowed?: boolean;
  costProfile?: ModelCostProfileViewModel;
  rateLimit?: ModelRateLimitViewModel;
  fallbackModelId?: string | null;
}

export interface UpdateModelRoutingPolicyInput {
  actorRole: AuthRole;
  systemDefaultModelId?: string | null;
  moduleDefaults?: Partial<Record<TemplateModule, string | null>>;
  templateOverrides?: Record<string, string | null>;
}
