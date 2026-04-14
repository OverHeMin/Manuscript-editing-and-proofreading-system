export type AiProviderConnectionTestStatus = "unknown" | "passed" | "failed";
export type AiProviderConnectionReadinessStatus =
  | "ready"
  | "disabled"
  | "missing_credentials"
  | "unsupported_compatibility";

export interface AiProviderCredentialSummary {
  mask: string;
  version: number;
}

export interface AiProviderConnectionReadiness {
  status: AiProviderConnectionReadinessStatus;
  summary: string;
  credential_configured: boolean;
  adapter_supported: boolean;
}

export interface AiProviderConnectionRecord {
  id: string;
  name: string;
  provider_kind: string;
  compatibility_mode: string;
  base_url: string;
  enabled: boolean;
  connection_metadata?: Record<string, unknown>;
  last_test_status?: AiProviderConnectionTestStatus;
  last_test_at?: Date;
  last_error_summary?: string;
  credential_summary?: AiProviderCredentialSummary;
  readiness?: AiProviderConnectionReadiness;
}

export interface AiProviderCredentialRecord {
  id: string;
  connection_id: string;
  credential_ciphertext: string;
  credential_mask: string;
  credential_version?: number;
  last_rotated_at: Date;
}
