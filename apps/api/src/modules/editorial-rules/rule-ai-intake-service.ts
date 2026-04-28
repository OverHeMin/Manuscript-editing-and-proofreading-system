import type {
  RuleAiDraft,
  RuleAiIntakeDraftRequest,
  RuleAiIntakeDraftResponse,
} from "@medical/contracts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import type { EditorialRuleAction, EditorialRuleRecord, EditorialRuleTrigger } from "./editorial-rule-record.ts";
import { RuleSimilarityService } from "./rule-similarity-service.ts";
import type { RuleSimilarityLedgerItem } from "./rule-similarity-service.ts";
import { RuleTemplateMatchingService } from "./rule-template-matching-service.ts";

export interface RuleAiIntakeGenerator {
  createDraft(
    input: RuleAiIntakeDraftRequest,
  ): Promise<RuleAiIntakeDraftResponse>;
}

export interface RuleAiIntakeServiceOptions {
  generator?: RuleAiIntakeGenerator;
  templateMatchingService?: RuleTemplateMatchingService;
  similarityService?: RuleSimilarityService;
  existingRules?: () => Promise<RuleSimilarityLedgerItem[]>;
}

export class RuleAiIntakeUnavailableError extends Error {
  constructor(message = "Rule AI intake is unavailable.") {
    super(message);
    this.name = "RuleAiIntakeUnavailableError";
  }
}

export class RuleAiIntakeService {
  private readonly generator?: RuleAiIntakeGenerator;
  private readonly templateMatchingService: RuleTemplateMatchingService;
  private readonly similarityService: RuleSimilarityService;
  private readonly existingRules?: () => Promise<RuleSimilarityLedgerItem[]>;

  constructor(options: RuleAiIntakeServiceOptions) {
    this.generator = options.generator;
    this.templateMatchingService =
      options.templateMatchingService ?? new RuleTemplateMatchingService();
    this.similarityService = options.similarityService ?? new RuleSimilarityService();
    this.existingRules = options.existingRules;
  }

  async createDraft(
    input: RuleAiIntakeDraftRequest,
  ): Promise<RuleAiIntakeDraftResponse> {
    if (input.source_kind !== "manual_description") {
      throw new RuleAiIntakeUnavailableError(
        "Only manual_description intake is supported in this MVP.",
      );
    }

    if (!input.description.trim()) {
      throw new RuleAiIntakeUnavailableError(
        "Rule AI intake description is required.",
      );
    }

    if (!this.generator) {
      throw new RuleAiIntakeUnavailableError();
    }

    const generated = await this.generator.createDraft(input);
    const draft = normalizeDraft(generated.draft, input);
    const templateMatch =
      generated.template_match.status === "matched" ||
      generated.template_match.status === "multiple_candidates"
        ? generated.template_match
        : this.templateMatchingService.match({ draft });
    const existingRules = this.existingRules ? await this.existingRules() : [];
    const deterministicMatches = this.similarityService.findSimilar({
      draft,
      existingRules,
    });

    return {
      draft,
      template_match: templateMatch,
      similar_rule_matches: [
        ...deterministicMatches,
        ...(generated.similar_rule_matches ?? []),
      ],
      warnings: generated.warnings ?? [],
    };
  }
}

export function createRuleAiSimilarityLedgerResolver(
  repository: Pick<
    EditorialRuleRepository,
    "listRuleSets" | "listRulesByRuleSetId"
  >,
): () => Promise<RuleSimilarityLedgerItem[]> {
  return async () => {
    const ruleSets = await repository.listRuleSets();
    const ruleGroups = await Promise.all(
      ruleSets.map((ruleSet) => repository.listRulesByRuleSetId(ruleSet.id)),
    );

    return ruleGroups.flat().map(mapEditorialRuleToSimilarityLedgerItem);
  };
}

export class OpenAiRuleAiIntakeGenerator implements RuleAiIntakeGenerator {
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

  async createDraft(
    input: RuleAiIntakeDraftRequest,
  ): Promise<RuleAiIntakeDraftResponse> {
    const module =
      input.context?.module_scope && input.context.module_scope !== "any"
        ? input.context.module_scope
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
              "You are a governed medical manuscript rule-authoring assistant. Return JSON only. Generate a reviewable draft; never claim it is published.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "rule_ai_manual_description_intake",
              contract: {
                draft: "RuleAiDraft",
                template_match: "RuleAiTemplateMatch",
                similar_rule_matches: "RuleAiSimilarityMatch[]",
                warnings: "string[]",
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
        `Rule AI intake request failed with status ${response.status}.`,
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
      return JSON.parse(content) as RuleAiIntakeDraftResponse;
    } catch (error) {
      throw new RuleAiIntakeUnavailableError(
        error instanceof Error
          ? `Rule AI intake returned invalid JSON: ${error.message}`
          : "Rule AI intake returned invalid JSON.",
      );
    }
  }
}

function mapEditorialRuleToSimilarityLedgerItem(
  rule: EditorialRuleRecord,
): RuleSimilarityLedgerItem {
  return {
    id: rule.id,
    title: resolveEditorialRuleTitle(rule),
    targetObject: rule.rule_object,
    trigger: resolveRuleKind(rule.trigger),
    action: resolveRuleKind(rule.action),
  };
}

function resolveEditorialRuleTitle(rule: EditorialRuleRecord): string {
  const title = rule.authoring_payload["title"];
  if (typeof title === "string" && title.trim().length > 0) {
    return title.trim();
  }

  const summary = rule.projection_payload?.summary ?? rule.explanation_payload?.rationale;
  if (typeof summary === "string" && summary.trim().length > 0) {
    return summary.trim();
  }

  return rule.rule_object;
}

function resolveRuleKind(
  value: EditorialRuleTrigger | EditorialRuleAction,
): string {
  return typeof value.kind === "string" ? value.kind : "";
}

function normalizeDraft(
  draft: RuleAiDraft,
  input: RuleAiIntakeDraftRequest,
): RuleAiDraft {
  return {
    ...draft,
    source_kind: "manual_description",
    scope: {
      ...input.context,
      ...draft.scope,
    },
    evidence:
      draft.evidence.length > 0
        ? draft.evidence
        : [
            {
              kind: "user_description",
              text: input.description,
            },
          ],
    confidence: {
      overall: clampConfidence(draft.confidence.overall),
      ...(draft.confidence.fields ? { fields: draft.confidence.fields } : {}),
    },
    uncertainties: [...new Set(draft.uncertainties ?? [])],
  };
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
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

  throw new RuleAiIntakeUnavailableError("Rule AI intake returned an empty response.");
}
