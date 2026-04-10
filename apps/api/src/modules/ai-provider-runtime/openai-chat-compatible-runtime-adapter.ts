import type { AiProviderConnectionRecord } from "../ai-provider-connections/ai-provider-connection-record.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import type { AiProviderRuntimeExecutableTarget } from "./ai-provider-runtime-record.ts";

export class OpenAiChatCompatibleRuntimeAdapter {
  readonly compatibilityMode = "openai_chat_compatible";

  buildExecutableTarget(input: {
    model: ModelRegistryRecord;
    connection: AiProviderConnectionRecord;
    apiKey: string;
  }): AiProviderRuntimeExecutableTarget {
    const baseUrl = normalizeOpenAiCompatibleBaseUrl(input.connection.base_url);

    return {
      adapter: "openai_chat_compatible",
      model_id: input.model.id,
      model_name: input.model.model_name,
      model_version: input.model.model_version,
      connection_id: input.connection.id,
      connection_name: input.connection.name,
      provider_kind: input.connection.provider_kind,
      compatibility_mode: input.connection.compatibility_mode,
      base_url: baseUrl,
      request_url: buildOpenAiChatCompatibleUrl(baseUrl),
      headers: buildOpenAiChatCompatibleHeaders(input.apiKey),
    };
  }

  buildProbeRequest(input: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
    signal?: AbortSignal;
  }): {
    url: string;
    init: RequestInit;
  } {
    const url = buildOpenAiChatCompatibleUrl(input.baseUrl);

    return {
      url,
      init: {
        method: "POST",
        headers: buildOpenAiChatCompatibleHeaders(input.apiKey),
        body: JSON.stringify({
          model: input.modelName,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          temperature: 0,
          stream: false,
        }),
        ...(input.signal ? { signal: input.signal } : {}),
      },
    };
  }
}

export function normalizeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  return new URL(baseUrl).toString().replace(/\/+$/u, "");
}

export function buildOpenAiChatCompatibleUrl(baseUrl: string): string {
  const normalizedBaseUrl = normalizeOpenAiCompatibleBaseUrl(baseUrl);
  const urlBase = normalizedBaseUrl.endsWith("/")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/`;

  return new URL("chat/completions", urlBase).toString();
}

function buildOpenAiChatCompatibleHeaders(
  apiKey: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}
