import type {
  ConfirmedAiTablePackage,
  RuleAiEvidenceItem,
  RuleAiParsingRequest,
  RuleAiParsingResponse,
} from "@medical/contracts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import { RuleAiIntakeUnavailableError } from "./rule-ai-intake-service.ts";

export interface RuleAiParsingGenerator {
  parseRule(input: RuleAiParsingRequest): Promise<RuleAiParsingResponse>;
}

export interface RuleAiParsingTableEvidenceService {
  assertConfirmedRevision(revisionId: string): Promise<{
    ai_table_package?: ConfirmedAiTablePackage;
  }>;
}

export class RuleAiParsingService {
  private readonly generator?: RuleAiParsingGenerator;
  private readonly tableEvidenceService?: RuleAiParsingTableEvidenceService;

  constructor(options: {
    generator?: RuleAiParsingGenerator;
    tableEvidenceService?: RuleAiParsingTableEvidenceService;
  }) {
    this.generator = options.generator;
    this.tableEvidenceService = options.tableEvidenceService;
  }

  async parseRule(input: RuleAiParsingRequest): Promise<RuleAiParsingResponse> {
    if (!input.rule_fields.rule_body.trim()) {
      throw new RuleAiIntakeUnavailableError(
        "Rule AI parsing rule body is required.",
      );
    }

    const resolvedInput = await this.resolveTableEvidence(input);
    const tableEvidenceWarnings = buildTableEvidenceWarnings(resolvedInput);
    if (isPublishParseMode(input) && tableEvidenceWarnings.length > 0) {
      throw new RuleAiIntakeUnavailableError(
        "table_evidence_not_authoritative",
      );
    }

    if (!this.generator) {
      throw new RuleAiIntakeUnavailableError("Rule AI parsing is unavailable.");
    }

    const parsed = await this.generator.parseRule(resolvedInput);
    return {
      ai_understanding_summary: parsed.ai_understanding_summary.trim(),
      consistency: parsed.consistency,
      findings: parsed.findings ?? [],
      similar_rule_matches: parsed.similar_rule_matches ?? [],
      requires_human_confirmation: parsed.requires_human_confirmation,
      warnings: uniqueWarnings([
        ...(parsed.warnings ?? []),
        ...tableEvidenceWarnings,
      ]),
    };
  }

  private async resolveTableEvidence(
    input: RuleAiParsingRequest,
  ): Promise<RuleAiParsingRequest> {
    if (!this.tableEvidenceService) {
      return input;
    }

    const evidence = input.rule_fields.evidence;
    if (!evidence?.length) {
      return input;
    }

    const resolvedEvidence = await Promise.all(
      evidence.map((item) => this.resolveTableEvidenceItem(item)),
    );

    return {
      ...input,
      rule_fields: {
        ...input.rule_fields,
        evidence: resolvedEvidence,
      },
    };
  }

  private async resolveTableEvidenceItem(
    evidence: RuleAiEvidenceItem,
  ): Promise<RuleAiEvidenceItem> {
    if (evidence.kind !== "confirmed_table_package") {
      return evidence;
    }

    const revisionId =
      normalizeOptionalId(evidence.source_id) ??
      normalizeOptionalId(evidence.confirmed_table_package?.revision_id);
    if (!revisionId) {
      return markTableEvidenceUnavailable(evidence);
    }

    try {
      const revision =
        await this.tableEvidenceService?.assertConfirmedRevision(revisionId);
      const tablePackage = revision?.ai_table_package;
      if (tablePackage?.authority !== "authoritative") {
        return markTableEvidenceUnavailable(evidence);
      }

      return {
        ...evidence,
        source_id: revisionId,
        authority: "authoritative",
        confirmed_table_package: tablePackage,
      };
    } catch {
      return markTableEvidenceUnavailable(evidence);
    }
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

    const promptParts = buildRuleAiPromptParts(input);
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
              ...(promptParts.length > 0 ? { prompt_parts: promptParts } : {}),
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

function buildRuleAiPromptParts(input: RuleAiParsingRequest): string[] {
  const promptParts: string[] = [];
  for (const evidence of input.rule_fields.evidence ?? []) {
    if (
      evidence.kind !== "confirmed_table_package" ||
      !evidence.confirmed_table_package
    ) {
      continue;
    }

    const packageJson = JSON.stringify(evidence.confirmed_table_package);
    promptParts.push(
      [
        "Confirmed table package:",
        packageJson,
        "Rules:",
        "- Treat confirmed_table_package as authoritative only when authority is authoritative.",
        "- Do not collapse U+002D, U+2013, U+2014, U+2212.",
        "- Do not collapse U+0020, U+3000, U+00A0, tabs, line breaks, or paragraph boundaries.",
        "- Use runs.style.superscript and runs.style.subscript for unit interpretation.",
      ].join("\n"),
    );
  }
  return promptParts;
}

function buildTableEvidenceWarnings(input: RuleAiParsingRequest): string[] {
  return (input.rule_fields.evidence ?? []).some(isNonAuthoritativeTableEvidence)
    ? ["table_evidence_not_authoritative"]
    : [];
}

function isNonAuthoritativeTableEvidence(evidence: RuleAiEvidenceItem): boolean {
  return (
    evidence.kind === "confirmed_table_package" &&
    (evidence.authority !== "authoritative" ||
      evidence.confirmed_table_package?.authority !== "authoritative")
  );
}

function isPublishParseMode(input: RuleAiParsingRequest): boolean {
  if (input.parse_mode) {
    return input.parse_mode === "publish" || input.parse_mode === "final";
  }

  const mode = (input as RuleAiParsingRequest & {
    parseMode?: string;
    reviewMode?: string;
    mode?: string;
  }).parseMode ?? (input as { reviewMode?: string }).reviewMode ??
    (input as { mode?: string }).mode;
  return mode === "publish" || mode === "final";
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

function normalizeOptionalId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function markTableEvidenceUnavailable(
  evidence: RuleAiEvidenceItem,
): RuleAiEvidenceItem {
  const {
    confirmed_table_package: _untrustedClientPackage,
    ...withoutClientPackage
  } = evidence;
  return {
    ...withoutClientPackage,
    authority: "unavailable",
  };
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
