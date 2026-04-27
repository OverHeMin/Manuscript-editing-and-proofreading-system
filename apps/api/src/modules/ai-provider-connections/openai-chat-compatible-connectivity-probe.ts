import type { AiProviderConnectionTestStatus } from "./ai-provider-connection-record.ts";
import { OpenAiChatCompatibleRuntimeAdapter } from "../ai-provider-runtime/openai-chat-compatible-runtime-adapter.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ERROR_SUMMARY_LENGTH = 200;

type FetchLike = typeof fetch;

export interface AiProviderConnectivityProbeResult {
  status: AiProviderConnectionTestStatus;
  testedAt: Date;
  errorSummary?: string;
}

export interface AiProviderDiscoveredModel {
  id: string;
  owned_by?: string;
}

export interface AiProviderModelDiscoveryResult {
  status: AiProviderConnectionTestStatus;
  testedAt: Date;
  models: AiProviderDiscoveredModel[];
  errorSummary?: string;
}

export interface AiProviderConnectivityProbe {
  testConnection(input: {
    providerKind: string;
    baseUrl: string;
    apiKey: string;
    modelName: string;
    connectionMetadata?: Record<string, unknown>;
  }): Promise<AiProviderConnectivityProbeResult>;
  discoverModels(input: {
    providerKind: string;
    baseUrl: string;
    apiKey: string;
    connectionMetadata?: Record<string, unknown>;
  }): Promise<AiProviderModelDiscoveryResult>;
}

export interface OpenAiChatCompatibleConnectivityProbeOptions {
  fetchImpl?: FetchLike;
  now?: () => Date;
  timeoutMs?: number;
  adapter?: OpenAiChatCompatibleRuntimeAdapter;
}

export class OpenAiChatCompatibleConnectivityProbe
  implements AiProviderConnectivityProbe
{
  private readonly fetchImpl: FetchLike;

  private readonly now: () => Date;

  private readonly timeoutMs: number;

  private readonly adapter: OpenAiChatCompatibleRuntimeAdapter;

  constructor(options: OpenAiChatCompatibleConnectivityProbeOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.adapter = options.adapter ?? new OpenAiChatCompatibleRuntimeAdapter();
  }

  async testConnection(input: {
    providerKind: string;
    baseUrl: string;
    apiKey: string;
    modelName: string;
    connectionMetadata?: Record<string, unknown>;
  }): Promise<AiProviderConnectivityProbeResult> {
    const testedAt = this.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const request = this.adapter.buildProbeRequest({
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        modelName: input.modelName,
        signal: controller.signal,
      });
      const response = await this.fetchImpl(request.url, request.init);
      const rawBody = await response.text();

      if (!response.ok) {
        return {
          status: "failed",
          testedAt,
          errorSummary: summarizeResponseFailure(response.status, rawBody),
        };
      }

      const parsed = parseJsonBody(rawBody);
      if (!isSuccessfulChatCompletionPayload(parsed)) {
        return {
          status: "failed",
          testedAt,
          errorSummary: "Provider returned an invalid chat completions response.",
        };
      }

      return {
        status: "passed",
        testedAt,
      };
    } catch (error) {
      return {
        status: "failed",
        testedAt,
        errorSummary: summarizeError(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async discoverModels(input: {
    providerKind: string;
    baseUrl: string;
    apiKey: string;
    connectionMetadata?: Record<string, unknown>;
  }): Promise<AiProviderModelDiscoveryResult> {
    const testedAt = this.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${input.baseUrl.replace(/\/+$/u, "")}/models`, {
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
        },
        method: "GET",
        signal: controller.signal,
      });
      const rawBody = await response.text();

      if (!response.ok) {
        return {
          status: "failed",
          testedAt,
          models: [],
          errorSummary: summarizeResponseFailure(response.status, rawBody),
        };
      }

      const parsed = parseJsonBody(rawBody);
      const models = parseModelListPayload(parsed);
      if (models.length === 0) {
        return {
          status: "failed",
          testedAt,
          models: [],
          errorSummary: "Provider returned no discoverable models.",
        };
      }

      return {
        status: "passed",
        testedAt,
        models,
      };
    } catch (error) {
      return {
        status: "failed",
        testedAt,
        models: [],
        errorSummary: summarizeError(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseJsonBody(rawBody: string): unknown {
  if (!rawBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function isSuccessfulChatCompletionPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  return Array.isArray(candidate.choices) && candidate.choices.length > 0;
}

function parseModelListPayload(payload: unknown): AiProviderDiscoveredModel[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as { data?: Array<{ id?: unknown; owned_by?: unknown }> };
  if (!Array.isArray(candidate.data)) {
    return [];
  }

  return candidate.data
    .map((item) => ({
      id: typeof item.id === "string" ? item.id.trim() : "",
      owned_by: typeof item.owned_by === "string" ? item.owned_by : undefined,
    }))
    .filter((item) => item.id.length > 0);
}

function summarizeResponseFailure(status: number, rawBody: string): string {
  const normalizedBody = rawBody.trim().replace(/\s+/gu, " ");
  const suffix = normalizedBody ? `: ${normalizedBody}` : "";
  return truncateErrorSummary(`Provider returned HTTP ${status}${suffix}`);
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return truncateErrorSummary(error.message);
  }

  return "Unknown connectivity probe failure.";
}

function truncateErrorSummary(summary: string): string {
  return summary.length <= MAX_ERROR_SUMMARY_LENGTH
    ? summary
    : `${summary.slice(0, MAX_ERROR_SUMMARY_LENGTH - 3)}...`;
}
