export type AiProviderRuntimeAdapterId = "openai_chat_compatible";

export type AiProviderRuntimeConfigurationErrorCode =
  | "legacy_unbound"
  | "connection_missing"
  | "connection_disabled"
  | "credential_missing"
  | "credential_invalid"
  | "unsupported_adapter";

export type AiProviderRuntimeFallbackReason =
  | "timeout"
  | "rate_limit"
  | "upstream_5xx"
  | "non_retryable"
  | AiProviderRuntimeConfigurationErrorCode;

export interface AiProviderRuntimeExecutableTarget {
  adapter: AiProviderRuntimeAdapterId;
  model_id: string;
  model_name: string;
  model_version: string;
  connection_id: string;
  connection_name: string;
  provider_kind: string;
  compatibility_mode: string;
  base_url: string;
  request_url: string;
  headers: Record<string, string>;
}

export interface AiProviderRuntimeSelectionRecord {
  primary: AiProviderRuntimeExecutableTarget;
  fallback_chain: AiProviderRuntimeExecutableTarget[];
}

export interface AiProviderRuntimeFallbackLogEntry {
  primary_model_id: string;
  fallback_model_id?: string;
  reason: AiProviderRuntimeFallbackReason;
}

export interface AiProviderRuntimeFallbackPlan {
  allow_fallback: boolean;
  primary_model_id: string;
  fallback_model_id?: string;
  reason: AiProviderRuntimeFallbackReason;
  log_entry: AiProviderRuntimeFallbackLogEntry;
}

export type AiProviderRuntimeFailureInput =
  | {
      kind: "timeout";
    }
  | {
      kind: "http";
      status: number;
    }
  | {
      kind: "configuration";
      error: {
        code: AiProviderRuntimeConfigurationErrorCode;
      };
    };
