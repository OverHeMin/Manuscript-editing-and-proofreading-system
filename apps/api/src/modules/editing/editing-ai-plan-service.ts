import type { EditorialTextBlock } from "../editorial-execution/types.ts";
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
  const firstLongBlock = (input.sourceBlocks ?? []).find(
    (block) => block.text.trim().length >= 8,
  );
  if (!firstLongBlock) {
    return {
      summary: `No AI editing replacements were proposed for ${input.manuscriptId}.`,
      replacements: [],
      manualReviewItems: [],
    };
  }

  const targetText = firstLongBlock.text.trim();
  return {
    summary: `Prepared a conservative editing plan for ${input.manuscriptId}.`,
    replacements: [
      {
        targetText,
        replacementText: `${targetText}（编辑建议版）`,
        reason: "Provide a deterministic fallback replacement when AI runtime is unavailable.",
      },
    ],
    manualReviewItems: [],
  };
}

function normalizeEditingAiPlan(
  payload: Record<string, unknown>,
  fallback: EditingAiPlan,
): EditingAiPlan {
  const replacements = Array.isArray(payload.replacements)
    ? payload.replacements
        .map(normalizeReplacement)
        .filter(
          (entry): entry is EditingAiReplacement =>
            entry !== undefined &&
            entry.targetText !== entry.replacementText,
        )
    : [];

  return {
    summary: toNonEmptyString(payload.summary) ?? fallback.summary,
    replacements: replacements.length > 0 ? replacements : fallback.replacements,
    manualReviewItems: toStringArray(payload.manualReviewItems),
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
