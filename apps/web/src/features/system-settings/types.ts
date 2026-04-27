import type { AuthRole } from "../auth/index.ts";

export type SystemSettingsUserStatus = "active" | "disabled" | "locked";
export type AiProviderKind = "openai" | "openai_compatible" | "qwen" | "deepseek";
export type AiProviderConnectionTestStatus = "unknown" | "passed" | "failed";
export type SystemSettingsModuleKey = "screening" | "editing" | "proofreading";

export interface SystemSettingsUserViewModel {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
  status: SystemSettingsUserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingsAiProviderCredentialSummary {
  mask: string;
  version: number;
}

export interface SystemSettingsAiProviderConnectionViewModel {
  id: string;
  name: string;
  provider_kind: AiProviderKind;
  compatibility_mode: string;
  base_url: string;
  enabled: boolean;
  connection_metadata?: Record<string, unknown>;
  last_test_status?: AiProviderConnectionTestStatus;
  last_test_at?: string;
  last_error_summary?: string;
  credential_summary?: SystemSettingsAiProviderCredentialSummary;
}

export interface SystemSettingsRegisteredModelViewModel {
  id: string;
  modelName: string;
  displayName: string;
  connectionId: string;
  connectionName: string;
  allowedModules: SystemSettingsModuleKey[];
  productionAllowed: boolean;
  fallbackModelId?: string | null;
  fallbackModelName?: string | null;
}

export interface SystemSettingsModuleDefaultViewModel {
  moduleKey: SystemSettingsModuleKey;
  moduleLabel: string;
  primaryModelId?: string | null;
  primaryModelName?: string | null;
  fallbackModelId?: string | null;
  fallbackModelName?: string | null;
  temperature?: number | null;
}

export interface SystemSettingsResolvedModuleDefaultViewModel {
  moduleKey: SystemSettingsModuleKey;
  moduleLabel: string;
  selectedModelId: string | null;
  selectedModelLabel: string | null;
  fallbackModelId: string | null;
  fallbackModelLabel: string | null;
  temperature: number | null;
}

export interface SystemSettingsSummary {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  adminUsers: number;
}

export type InternalTestProductionReadinessStatus = "ready" | "not_ready";

export type InternalTestProductionReadinessCheckStatus = "ok" | "warning" | "failed";

export interface InternalTestProductionReadinessCheckViewModel {
  key: string;
  label?: string;
  status: InternalTestProductionReadinessCheckStatus;
  blocking: boolean;
  message?: string;
  evidence?: unknown;
}

export interface InternalTestProductionReadinessSummaryViewModel {
  total: number;
  failed: number;
  warning: number;
  blocking_failed: number;
}

export interface InternalTestProductionReadinessViewModel {
  status: InternalTestProductionReadinessStatus;
  checks: InternalTestProductionReadinessCheckViewModel[];
  summary: InternalTestProductionReadinessSummaryViewModel;
}

export interface SystemSettingsWorkbenchOverview {
  users: SystemSettingsUserViewModel[];
  summary: SystemSettingsSummary;
  selectedUserId: string | null;
  selectedUser: SystemSettingsUserViewModel | null;
  providerConnections: SystemSettingsAiProviderConnectionViewModel[];
  selectedConnectionId: string | null;
  selectedConnection: SystemSettingsAiProviderConnectionViewModel | null;
  registeredModels: SystemSettingsRegisteredModelViewModel[];
  moduleDefaults: SystemSettingsModuleDefaultViewModel[];
  internalTestProductionReadiness: InternalTestProductionReadinessViewModel | null;
}

export interface CreateSystemSettingsUserInput {
  username: string;
  displayName: string;
  role: AuthRole;
  password: string;
}

export interface UpdateSystemSettingsUserProfileInput {
  displayName: string;
  role: AuthRole;
}

export interface CreateAiProviderConnectionInput {
  name: string;
  providerKind: AiProviderKind;
  baseUrl?: string;
  testModelName: string;
  apiKey: string;
  enabled: boolean;
}

export interface AutoConfigureAiProviderInput {
  apiKey: string;
  providerKind: AiProviderKind;
  baseUrl?: string;
  connectionName?: string;
}

export interface AutoConfigureAiProviderResult {
  connection: SystemSettingsAiProviderConnectionViewModel;
  registeredModels: Array<{
    id: string;
    model_name: string;
    fallback_model_id?: string | null;
    connection_id?: string | null;
  }>;
  test: {
    status: "unknown" | "passed" | "failed";
    errorSummary?: string;
  };
  discovery: {
    status: "unknown" | "passed" | "failed";
    models: Array<{ id: string }>;
    errorSummary?: string;
  };
}

export interface UpdateAiProviderConnectionInput {
  name: string;
  baseUrl?: string;
  testModelName: string;
  enabled: boolean;
}

export interface CreateSystemSettingsRegisteredModelInput {
  providerKind: AiProviderKind;
  modelName: string;
  connectionId: string;
  allowedModules: SystemSettingsModuleKey[];
  productionAllowed: boolean;
  fallbackModelId?: string | null;
}

export interface SaveSystemSettingsModuleDefaultInput {
  moduleKey: SystemSettingsModuleKey;
  primaryModelId: string;
  fallbackModelId?: string | null;
  temperature?: number | null;
}
