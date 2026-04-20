import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
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
}

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

  constructor(options: OpenAiMainlineAiRuntimeExecutorOptions) {
    this.aiGatewayService = options.aiGatewayService;
    this.aiProviderRuntimeService = options.aiProviderRuntimeService;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async executeJson<T>(input: ExecuteMainlineAiInput): Promise<T> {
    const content = await this.executeRequest({
      ...input,
      responseFormat: {
        type: "json_object",
      },
    });

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new MainlineAiRuntimeExecutorError(
        `${formatModuleLabel(input.module)} AI returned invalid JSON${formatErrorSuffix(error)}.`,
      );
    }
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
    const response = await this.fetchImpl(runtime.primary.request_url, {
      method: "POST",
      headers: runtime.primary.headers,
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      throw new MainlineAiRuntimeExecutorError(
        `${formatModuleLabel(input.module)} AI request failed with status ${response.status}.`,
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
