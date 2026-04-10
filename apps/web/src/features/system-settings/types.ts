import type { AuthRole } from "../auth/index.ts";

export type SystemSettingsUserStatus = "active" | "disabled" | "locked";
export type AiProviderKind = "openai" | "openai_compatible" | "qwen" | "deepseek";
export type AiProviderConnectionTestStatus = "unknown" | "passed" | "failed";

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

export interface SystemSettingsSummary {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  adminUsers: number;
}

export interface SystemSettingsWorkbenchOverview {
  users: SystemSettingsUserViewModel[];
  summary: SystemSettingsSummary;
  selectedUserId: string | null;
  selectedUser: SystemSettingsUserViewModel | null;
  providerConnections: SystemSettingsAiProviderConnectionViewModel[];
  selectedConnectionId: string | null;
  selectedConnection: SystemSettingsAiProviderConnectionViewModel | null;
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

export interface UpdateAiProviderConnectionInput {
  name: string;
  baseUrl?: string;
  testModelName: string;
  enabled: boolean;
}
