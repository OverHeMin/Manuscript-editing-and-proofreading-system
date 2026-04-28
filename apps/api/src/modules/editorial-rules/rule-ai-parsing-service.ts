import type { RuleAiParsingRequest, RuleAiParsingResponse } from "@medical/contracts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import { RuleAiIntakeUnavailableError } from "./rule-ai-intake-service.ts";

export interface RuleAiParsingGenerator {
  parseRule(input: RuleAiParsingRequest): Promise<RuleAiParsingResponse>;
}

export class RuleAiParsingService {
  private readonly generator?: RuleAiParsingGenerator;

  constructor(options: { generator?: RuleAiParsingGenerator }) {
    this.generator = options.generator;
  }

  async parseRule(input: RuleAiParsingRequest): Promise<RuleAiParsingResponse> {
    if (!input.rule_fields.rule_body.trim()) {
      throw new RuleAiIntakeUnavailableError(
        "Rule AI parsing rule body is required.",
      );
    }

    if (!this.generator) {
      throw new RuleAiIntakeUnavailableError("Rule AI parsing is unavailable.");
    }

    const parsed = await this.generator.parseRule(input);
    return {
      ai_understanding_summary: parsed.ai_understanding_summary.trim(),
      consistency: parsed.consistency,
      findings: parsed.findings ?? [],
      similar_rule_matches: parsed.similar_rule_matches ?? [],
      requires_human_confirmation: parsed.requires_human_confirmation,
      warnings: parsed.warnings ?? [],
    };
  }
}

export class OpenAiRuleAiParsingGenerator implements RuleAiParsingGenerator {
  private readonly aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;
  private readonly aiProviderRuntimeService: Pick<
    AiProviderRuntimeService,
    "resolveSelectionRuntime"
  >;
  private readonly fetchImpl: typeof fetch;

  constructor(options: {
    aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;
    aiProviderRuntimeService: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
    fetch?: typeof fetch;
  }) {
    this.aiGatewayService = options.aiGatewayService;
    this.aiProviderRuntimeService = options.aiProviderRuntimeService;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async parseRule(input: RuleAiParsingRequest): Promise<RuleAiParsingResponse> {
    const module =
      input.rule_fields.module_scope && input.rule_fields.module_scope !== "any"
        ? input.rule_fields.module_scope
        : "proofreading";
    const selection = await this.aiGatewayService.resolveModelSelection({ module });
    const runtime =
      await this.aiProviderRuntimeService.resolveSelectionRuntime(selection);

    const response = await this.fetchImpl(runtime.primary.request_url, {
      method: "POST",
      headers: runtime.primary.headers,
      body: JSON.stringify({
        model: runtime.primary.model_name,
        messages: [
          {
            role: "system",
            content:
              "You are a governed rule parsing reviewer. Compare the entered rule fields with your understanding. Return JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "rule_ai_manual_entry_parse",
              contract: {
                ai_understanding_summary: "string",
                consistency:
                  "consistent|partially_inconsistent|missing_evidence|possibly_duplicate|uncertain",
                findings: [
                  {
                    field: "string",
                    severity: "info|warning|blocking",
                    message: "string",
                  },
                ],
                requires_human_confirmation: "boolean",
                warnings: ["string"],
              },
              input,
            }),
          },
        ],
        temperature: 0.2,
        response_format: {
          type: "json_object",
        },
      }),
    });

    if (!response.ok) {
      throw new RuleAiIntakeUnavailableError(
        `Rule AI parsing request failed with status ${response.status}.`,
      );
    }

    const body = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
        };
      }>;
    };
    const content = extractOpenAiCompatibleContent(body);

    try {
      return JSON.parse(content) as RuleAiParsingResponse;
    } catch (error) {
      throw new RuleAiIntakeUnavailableError(
        error instanceof Error
          ? `Rule AI parsing returned invalid JSON: ${error.message}`
          : "Rule AI parsing returned invalid JSON.",
      );
    }
  }
}

function extractOpenAiCompatibleContent(body: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}): string {
  const content = body.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" && part.text ? part.text : ""))
      .join("");
  }

  throw new RuleAiIntakeUnavailableError("Rule AI parsing returned an empty response.");
}
