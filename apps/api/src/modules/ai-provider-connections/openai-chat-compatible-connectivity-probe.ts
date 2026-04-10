import type { AiProviderConnectionTestStatus } from "./ai-provider-connection-record.ts";

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
}

export class OpenAiChatCompatibleConnectivityProbe
  implements AiProviderConnectivityProbe
{
  private readonly fetchImpl: FetchLike;

  private readonly now: () => Date;

  private readonly timeoutMs: number;

  constructor(options: OpenAiChatCompatibleConnectivityProbeOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
      const response = await this.fetchImpl(buildChatCompletionsUrl(input.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.modelName,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          temperature: 0,
          stream: false,
        }),
        signal: controller.signal,
      });
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

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("chat/completions", normalizedBaseUrl).toString();
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
