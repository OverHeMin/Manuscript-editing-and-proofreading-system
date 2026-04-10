import type { ResolvedModelSelection } from "../ai-gateway/ai-gateway-service.ts";
import { AiProviderCredentialCrypto } from "../ai-provider-connections/ai-provider-credential-crypto.ts";
import type { AiProviderConnectionRepository } from "../ai-provider-connections/ai-provider-connection-repository.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import {
  type AiProviderRuntimeConfigurationErrorCode,
  type AiProviderRuntimeFailureInput,
  type AiProviderRuntimeFallbackPlan,
  type AiProviderRuntimeFallbackReason,
  type AiProviderRuntimeSelectionRecord,
} from "./ai-provider-runtime-record.ts";
import { OpenAiChatCompatibleRuntimeAdapter } from "./openai-chat-compatible-runtime-adapter.ts";

export interface AiProviderRuntimeServiceOptions {
  repository: AiProviderConnectionRepository;
  credentialCrypto: AiProviderCredentialCrypto;
  openAiChatCompatibleAdapter?: OpenAiChatCompatibleRuntimeAdapter;
}

export class AiProviderRuntimeConfigurationError extends Error {
  readonly code: AiProviderRuntimeConfigurationErrorCode;

  readonly modelId?: string;

  readonly connectionId?: string;

  constructor(
    code: AiProviderRuntimeConfigurationErrorCode,
    message: string,
    input: {
      modelId?: string;
      connectionId?: string;
    } = {},
  ) {
    super(message);
    this.name = "AiProviderRuntimeConfigurationError";
    this.code = code;
    this.modelId = input.modelId;
    this.connectionId = input.connectionId;
  }
}

export class AiProviderRuntimeService {
  private readonly repository: AiProviderConnectionRepository;

  private readonly credentialCrypto: AiProviderCredentialCrypto;

  private readonly openAiChatCompatibleAdapter: OpenAiChatCompatibleRuntimeAdapter;

  constructor(options: AiProviderRuntimeServiceOptions) {
    this.repository = options.repository;
    this.credentialCrypto = options.credentialCrypto;
    this.openAiChatCompatibleAdapter =
      options.openAiChatCompatibleAdapter ??
      new OpenAiChatCompatibleRuntimeAdapter();
  }

  async resolveSelectionRuntime(
    selection: Pick<ResolvedModelSelection, "model" | "fallback_chain">,
  ): Promise<AiProviderRuntimeSelectionRecord> {
    return {
      primary: await this.resolveModelTarget(selection.model),
      fallback_chain: await Promise.all(
        selection.fallback_chain.map((model) => this.resolveModelTarget(model)),
      ),
    };
  }

  planFallbackFromFailure(input: {
    selection: Pick<ResolvedModelSelection, "model" | "fallback_chain">;
    failure: AiProviderRuntimeFailureInput;
  }): AiProviderRuntimeFallbackPlan {
    const fallbackModelId = input.selection.fallback_chain[0]?.id;
    const classification = classifyFailure(input.failure);
    const allowFallback =
      classification.allowFallback && fallbackModelId !== undefined;

    return {
      allow_fallback: allowFallback,
      primary_model_id: input.selection.model.id,
      ...(fallbackModelId ? { fallback_model_id: fallbackModelId } : {}),
      reason: classification.reason,
      log_entry: {
        primary_model_id: input.selection.model.id,
        ...(fallbackModelId ? { fallback_model_id: fallbackModelId } : {}),
        reason: classification.reason,
      },
    };
  }

  private async resolveModelTarget(model: ModelRegistryRecord) {
    if (!model.connection_id) {
      throw new AiProviderRuntimeConfigurationError(
        "legacy_unbound",
        "Resolved model is still using legacy provider fields without connection_id.",
        {
          modelId: model.id,
        },
      );
    }

    const connection = await this.repository.findById(model.connection_id);
    if (!connection) {
      throw new AiProviderRuntimeConfigurationError(
        "connection_missing",
        `Resolved model references missing ai provider connection ${model.connection_id}.`,
        {
          modelId: model.id,
          connectionId: model.connection_id,
        },
      );
    }

    if (!connection.enabled) {
      throw new AiProviderRuntimeConfigurationError(
        "connection_disabled",
        `AI provider connection "${connection.name}" is disabled.`,
        {
          modelId: model.id,
          connectionId: connection.id,
        },
      );
    }

    const credential = await this.repository.findCredentialByConnectionId(connection.id);
    if (!credential) {
      throw new AiProviderRuntimeConfigurationError(
        "credential_missing",
        `AI provider connection "${connection.name}" does not have credentials configured.`,
        {
          modelId: model.id,
          connectionId: connection.id,
        },
      );
    }

    let apiKey: string;
    try {
      apiKey = this.credentialCrypto.decrypt(credential.credential_ciphertext).apiKey;
    } catch (error) {
      throw new AiProviderRuntimeConfigurationError(
        "credential_invalid",
        error instanceof Error
          ? error.message
          : "Invalid ai provider credential payload.",
        {
          modelId: model.id,
          connectionId: connection.id,
        },
      );
    }

    if (connection.compatibility_mode !== "openai_chat_compatible") {
      throw new AiProviderRuntimeConfigurationError(
        "unsupported_adapter",
        `Compatibility mode "${connection.compatibility_mode}" does not have a runtime adapter.`,
        {
          modelId: model.id,
          connectionId: connection.id,
        },
      );
    }

    return this.openAiChatCompatibleAdapter.buildExecutableTarget({
      model,
      connection,
      apiKey,
    });
  }
}

export function createAiProviderRuntimeService(
  options: AiProviderRuntimeServiceOptions,
): AiProviderRuntimeService {
  return new AiProviderRuntimeService(options);
}

function classifyFailure(
  failure: AiProviderRuntimeFailureInput,
): {
  reason: AiProviderRuntimeFallbackReason;
  allowFallback: boolean;
} {
  switch (failure.kind) {
    case "timeout":
      return {
        reason: "timeout",
        allowFallback: true,
      };
    case "http":
      if (failure.status === 429) {
        return {
          reason: "rate_limit",
          allowFallback: true,
        };
      }

      if (failure.status >= 500) {
        return {
          reason: "upstream_5xx",
          allowFallback: true,
        };
      }

      return {
        reason: "non_retryable",
        allowFallback: false,
      };
    case "configuration":
      return {
        reason: failure.error.code,
        allowFallback: false,
      };
  }
}
