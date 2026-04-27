import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import type { AiProviderRuntimeExecutableTarget } from "../ai-provider-runtime/ai-provider-runtime-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export interface ExecuteMainlineAiInput {
  module: "screening" | "editing" | "proofreading";
  systemPrompt: string;
  userPayload: Record<string, unknown>;
}

export interface MainlineAiRuntimeExecutor {
  executeJson<T>(input: ExecuteMainlineAiInput): Promise<T>;
  executeMarkdown(input: ExecuteMainlineAiInput): Promise<string>;
}

export interface OpenAiMainlineAiRuntimeExecutorOptions {
  aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;
  aiProviderRuntimeService: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const TRANSIENT_NETWORK_RETRY_COUNT = 2;

export class MainlineAiRuntimeExecutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MainlineAiRuntimeExecutorError";
  }
}

export class OpenAiMainlineAiRuntimeExecutor
  implements MainlineAiRuntimeExecutor
{
  private readonly aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;

  private readonly aiProviderRuntimeService: Pick<
    AiProviderRuntimeService,
    "resolveSelectionRuntime"
  >;

  private readonly fetchImpl: typeof fetch;

  private readonly requestTimeoutMs: number;

  constructor(options: OpenAiMainlineAiRuntimeExecutorOptions) {
    this.aiGatewayService = options.aiGatewayService;
    this.aiProviderRuntimeService = options.aiProviderRuntimeService;
    this.fetchImpl = options.fetch ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
    const request = {
      ...input,
      responseFormat: {
        type: "json_object",
      },
    } as const;
    const firstAttempt = tryParseJsonResponse<T>(await this.executeRequest(request));
    if (firstAttempt.ok) {
      return firstAttempt.value;
    }

    const secondAttempt = tryParseJsonResponse<T>(await this.executeRequest(request));
    if (secondAttempt.ok) {
      return secondAttempt.value;
    }

    throw new MainlineAiRuntimeExecutorError(
      `${formatModuleLabel(input.module)} AI returned invalid JSON after retry${formatErrorSuffix(secondAttempt.error)}.`,
    );
  }

  async executeMarkdown(input: ExecuteMainlineAiInput): Promise<string> {
    return this.executeRequest(input);
  }

  private async executeRequest(
    input: ExecuteMainlineAiInput & {
      responseFormat?: {
        type: "json_object";
      };
    },
  ): Promise<string> {
    const selection = await this.aiGatewayService.resolveModelSelection({
      module: input.module as TemplateModule,
    });
    const runtime = await this.aiProviderRuntimeService.resolveSelectionRuntime(
      selection,
    );
    const requestBody = JSON.stringify({
      model: runtime.primary.model_name,
      messages: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(input.userPayload),
        },
      ],
      temperature: 0.2,
      ...(input.responseFormat
        ? {
            response_format: input.responseFormat,
          }
        : {}),
    });

    try {
      return await this.executeTargetRequestWithRetry({
        module: input.module,
        target: runtime.primary,
        requestBody,
      });
    } catch (error) {
      if (!shouldRetryWithFallback(error) || runtime.fallback_chain.length === 0) {
        throw formatExecutorRequestError(input.module, error);
      }
    }

    try {
      return await this.executeTargetRequestWithRetry({
        module: input.module,
        target: runtime.fallback_chain[0]!,
        requestBody,
      });
    } catch (error) {
      throw formatExecutorRequestError(input.module, error);
    }
  }

  private async executeTargetRequest(input: {
    module: ExecuteMainlineAiInput["module"];
    target: AiProviderRuntimeExecutableTarget;
    requestBody: string;
  }): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await this.fetchImpl(input.target.request_url, {
        method: "POST",
        headers: input.target.headers,
        body: input.requestBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new MainlineAiRuntimeHttpStatusError(
          response.status,
          await readResponseErrorSnippet(response),
        );
      }

      const body = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
      };

      return extractOpenAiCompatibleContent(body, input.module);
    } catch (error) {
      if (isAbortError(error)) {
        throw new MainlineAiRuntimeTimeoutError(this.requestTimeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async executeTargetRequestWithRetry(input: {
    module: ExecuteMainlineAiInput["module"];
    target: AiProviderRuntimeExecutableTarget;
    requestBody: string;
  }): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= TRANSIENT_NETWORK_RETRY_COUNT; attempt += 1) {
      try {
        return await this.executeTargetRequest(input);
      } catch (error) {
        lastError = error;
        if (!isRetryableTargetError(error) || attempt >= TRANSIENT_NETWORK_RETRY_COUNT) {
          throw error;
        }
        await sleep(500 * (attempt + 1));
      }
    }

    throw lastError;
  }
}

class MainlineAiRuntimeTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms.`);
    this.name = "MainlineAiRuntimeTimeoutError";
  }
}

class MainlineAiRuntimeHttpStatusError extends Error {
  constructor(readonly status: number, readonly bodySnippet?: string) {
    super(`HTTP ${status}${bodySnippet ? `: ${bodySnippet}` : ""}`);
    this.name = "MainlineAiRuntimeHttpStatusError";
  }
}

function extractOpenAiCompatibleContent(
  body: {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  },
  module: ExecuteMainlineAiInput["module"],
): string {
  const content = body.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content;
  }

  if (Array.isArray(content)) {
    const textContent = content
      .map((entry) => entry.text?.trim() ?? "")
      .filter((entry) => entry.length > 0)
      .join("\n");
    if (textContent.length > 0) {
      return textContent;
    }
  }

  throw new MainlineAiRuntimeExecutorError(
    `${formatModuleLabel(module)} AI response did not include message content.`,
  );
}

function formatModuleLabel(module: ExecuteMainlineAiInput["module"]): string {
  switch (module) {
    case "screening":
      return "Screening";
    case "editing":
      return "Editing";
    case "proofreading":
      return "Proofreading";
  }
}

function formatErrorSuffix(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "";
  }

  return `: ${error.message}`;
}

function shouldRetryWithFallback(error: unknown): boolean {
  if (error instanceof MainlineAiRuntimeTimeoutError) {
    return true;
  }

  return (
    error instanceof MainlineAiRuntimeHttpStatusError &&
    (error.status === 403 || error.status === 429 || error.status >= 500)
  );
}

function isRetryableTargetError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    typeof error.message === "string" &&
    error.message.toLowerCase().includes("fetch failed")
  );
}

function formatExecutorRequestError(
  module: ExecuteMainlineAiInput["module"],
  error: unknown,
): MainlineAiRuntimeExecutorError {
  if (error instanceof MainlineAiRuntimeTimeoutError) {
    return new MainlineAiRuntimeExecutorError(
      `${formatModuleLabel(module)} AI request timed out after ${error.timeoutMs}ms.`,
    );
  }

  if (error instanceof MainlineAiRuntimeHttpStatusError) {
    return new MainlineAiRuntimeExecutorError(
      `${formatModuleLabel(module)} AI request failed with status ${error.status}${shouldIncludeProviderErrorBody() && error.bodySnippet ? `: ${error.bodySnippet}` : ""}.`,
    );
  }

  if (error instanceof MainlineAiRuntimeExecutorError) {
    return error;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new MainlineAiRuntimeExecutorError(
      `${formatModuleLabel(module)} AI request failed: ${error.message}`,
    );
  }

  return new MainlineAiRuntimeExecutorError(
    `${formatModuleLabel(module)} AI request failed.`,
  );
}

async function readResponseErrorSnippet(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.trim().slice(0, 500) || undefined;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldIncludeProviderErrorBody(): boolean {
  return process.env.AI_PROVIDER_ERROR_BODY_DEBUG === "1";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function tryParseJsonResponse<T>(
  content: string,
):
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: unknown;
    } {
  try {
    return {
      ok: true,
      value: JSON.parse(content) as T,
    };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
}
