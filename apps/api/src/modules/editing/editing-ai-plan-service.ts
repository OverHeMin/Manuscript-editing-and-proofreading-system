import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type { AiGovernanceContext } from "../shared/ai-governance-context.ts";
import { isAiGovernanceContextEmpty } from "../shared/ai-governance-context.ts";
import type { MainlineAiRuntimeExecutor } from "../shared/mainline-ai-runtime-executor.ts";

export interface EditingAiReplacement {
  targetText: string;
  replacementText: string;
  reason: string;
}

export interface EditingAiPlan {
  summary: string;
  replacements: EditingAiReplacement[];
  manualReviewItems: string[];
}

type EditingGuardrailReason =
  | "meaning_risk"
  | "anchor_not_precise"
  | "numeric_entity_present"
  | "medical_entity_present"
  | "object_type_not_safe"
  | "insufficient_style_evidence";

export interface EditingAiPlanServiceOptions {
  mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;
}

export interface CreateEditingAiPlanInput {
  manuscriptId: string;
  sourceFileName?: string;
  sourceBlocks?: EditorialTextBlock[];
  qualityIssues?: Array<{
    severity?: string;
    explanation?: string;
  }>;
  governanceContext?: AiGovernanceContext;
}

export class EditingAiPlanService {
  private readonly mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;

  constructor(options: EditingAiPlanServiceOptions) {
    this.mainlineAiRuntimeExecutor = options.mainlineAiRuntimeExecutor;
  }

  async createPlan(input: CreateEditingAiPlanInput): Promise<EditingAiPlan> {
    const fallbackPlan = buildFallbackEditingPlan(input);
    if (!this.mainlineAiRuntimeExecutor) {
      return fallbackPlan;
    }

    const payload =
      await this.mainlineAiRuntimeExecutor.executeJson<Record<string, unknown>>({
        module: "editing",
        systemPrompt: buildEditingSystemPrompt(),
        userPayload: buildEditingUserPayload(input),
      });

    return normalizeEditingAiPlan(payload, fallbackPlan);
  }
}

function buildEditingSystemPrompt(): string {
  return [
    "You are a conservative medical manuscript editing planner.",
    "Return JSON only.",
    "Propose exact text replacements only when the source text is present in the manuscript excerpts.",
    "Prefer zero replacements over speculative rewriting.",
    "If a governance payload is provided, treat its hard rules, forbidden operations, manual-review items, and required knowledge as binding constraints.",
    "Do not propose edits that violate governance.forbiddenOperations or bypass governance.manualReviewItems.",
    "Use this exact schema:",
    JSON.stringify({
      summary: "string",
      replacements: [
        {
          targetText: "string",
          replacementText: "string",
          reason: "string",
        },
      ],
      manualReviewItems: ["string"],
    }),
  ].join(" ");
}

function buildEditingUserPayload(input: CreateEditingAiPlanInput) {
  const governance =
    input.governanceContext && !isAiGovernanceContextEmpty(input.governanceContext)
      ? input.governanceContext
      : undefined;

  return {
    task: "editing_plan",
    manuscriptId: input.manuscriptId,
    sourceFileName: input.sourceFileName,
    sourceBlocks: (input.sourceBlocks ?? [])
      .map((block) => ({
        section: block.section,
        blockKind: block.block_kind,
        text: block.text.trim(),
      }))
      .filter((block) => block.text.length > 0)
      .slice(0, 12),
    qualityIssues: (input.qualityIssues ?? []).map((issue) => ({
      severity: issue.severity ?? "info",
      explanation: issue.explanation ?? "",
    })),
    ...(governance
      ? {
          governance,
        }
      : {}),
    contract: {
      summary: "string",
      replacements: [
        {
          targetText: "string",
          replacementText: "string",
          reason: "string",
        },
      ],
      manualReviewItems: ["string"],
    },
  };
}

function buildFallbackEditingPlan(input: CreateEditingAiPlanInput): EditingAiPlan {
  return {
    summary: `No AI editing replacements were proposed for ${input.manuscriptId}.`,
    replacements: [],
    manualReviewItems: [],
  };
}

function normalizeEditingAiPlan(
  payload: Record<string, unknown>,
  fallback: EditingAiPlan,
): EditingAiPlan {
  const guardrailManualReviewItems: string[] = [];
  const replacements: EditingAiReplacement[] = [];

  if (Array.isArray(payload.replacements)) {
    for (const entry of payload.replacements) {
      if (!isRecord(entry)) {
        continue;
      }

      const malformedReason = detectMalformedEditingGuardrailReason(entry);
      if (malformedReason) {
        guardrailManualReviewItems.push(
          buildEditingGuardrailManualReviewItem(
            malformedReason,
            toNonEmptyString(entry.targetText) ??
              toNonEmptyString(entry.replacementText) ??
              "unlabeled_replacement",
          ),
        );
        continue;
      }

      const normalized = normalizeReplacement(entry);
      if (!normalized || normalized.targetText === normalized.replacementText) {
        continue;
      }

      const guardrailReason = detectEditingGuardrailReason(normalized);
      if (guardrailReason) {
        guardrailManualReviewItems.push(
          buildEditingGuardrailManualReviewItem(
            guardrailReason,
            normalized.targetText,
          ),
        );
        continue;
      }

      replacements.push(normalized);
    }
  }

  return {
    summary: toNonEmptyString(payload.summary) ?? fallback.summary,
    replacements: replacements.length > 0 ? replacements : fallback.replacements,
    manualReviewItems: dedupeStringArray(
      toStringArray(payload.manualReviewItems).concat(guardrailManualReviewItems),
    ),
  };
}

function normalizeReplacement(value: unknown): EditingAiReplacement | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const targetText = toNonEmptyString(value.targetText);
  const replacementText = toNonEmptyString(value.replacementText);
  const reason = toNonEmptyString(value.reason);
  if (!targetText || !replacementText || !reason) {
    return undefined;
  }

  return {
    targetText,
    replacementText,
    reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function detectMalformedEditingGuardrailReason(
  value: Record<string, unknown>,
): EditingGuardrailReason | undefined {
  if (!toNonEmptyString(value.targetText)) {
    return "anchor_not_precise";
  }

  if (!toNonEmptyString(value.replacementText) || !toNonEmptyString(value.reason)) {
    return "insufficient_style_evidence";
  }

  return undefined;
}

function detectEditingGuardrailReason(
  replacement: EditingAiReplacement,
): EditingGuardrailReason | undefined {
  const combinedText = `${replacement.targetText}\n${replacement.replacementText}`;
  if (OBJECT_TYPE_PATTERN.test(combinedText)) {
    return "object_type_not_safe";
  }

  if (NUMERIC_ENTITY_PATTERN.test(combinedText)) {
    return "numeric_entity_present";
  }

  if (MEDICAL_ENTITY_PATTERN.test(combinedText)) {
    return "medical_entity_present";
  }

  if (!isLikelyFormatOnlyReplacement(replacement.targetText, replacement.replacementText)) {
    return "meaning_risk";
  }

  return undefined;
}

function isLikelyFormatOnlyReplacement(targetText: string, replacementText: string): boolean {
  return normalizeFormatSkeleton(targetText) === normalizeFormatSkeleton(replacementText);
}

function normalizeFormatSkeleton(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(FORMAT_ONLY_IGNORED_PATTERN, "");
}

function truncateGuardrailExcerpt(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

function buildEditingGuardrailManualReviewItem(
  reason: EditingGuardrailReason,
  excerpt: string,
): string {
  return `editing_guardrail:${reason}:${truncateGuardrailExcerpt(excerpt)}`;
}

function dedupeStringArray(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

const FORMAT_ONLY_IGNORED_PATTERN =
  /[\s.,;:!?()[\]{}"'`“”‘’<>/\-|\\，。；：！？（）【】《》、]/gu;
const NUMERIC_ENTITY_PATTERN =
  /\d|%|‰|mg|g\/L|mmol|μmol|ml|kg|cm|mm|p\s*[<=>]|ci|confidence interval|n\s*=|mean|sd|±/iu;
const MEDICAL_ENTITY_PATTERN =
  /patient|patients|diagnosis|diagnostic|therapy|treatment|clinical|hemoglobin|alanine aminotransferase|serum|plasma|dose|dosage|患者|诊断|治疗|临床|血红蛋白|转氨酶|剂量|结论/iu;
const OBJECT_TYPE_PATTERN = /χ²|χ|β|α|±|≤|≥|∑|√|≈|≠/u;
