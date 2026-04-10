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

export interface AiProviderConnectivityProbe {
  testConnection(input: {
    providerKind: string;
    baseUrl: string;
    apiKey: string;
    modelName: string;
    connectionMetadata?: Record<string, unknown>;
  }): Promise<AiProviderConnectivityProbeResult>;
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
