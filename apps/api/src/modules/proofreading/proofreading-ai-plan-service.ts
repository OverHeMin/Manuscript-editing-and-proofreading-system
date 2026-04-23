import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type { AiGovernanceContext } from "../shared/ai-governance-context.ts";
import { isAiGovernanceContextEmpty } from "../shared/ai-governance-context.ts";
import type { MainlineAiRuntimeExecutor } from "../shared/mainline-ai-runtime-executor.ts";

export type ProofreadingCorrectionCategory =
  | "terminology"
  | "punctuation"
  | "grammar"
  | "style";

export interface ProofreadingAiCorrection {
  targetText: string;
  replacementText: string;
  category: ProofreadingCorrectionCategory;
}

export interface ProofreadingAiPlan {
  summary: string;
  corrections: ProofreadingAiCorrection[];
  manualReviewItems: string[];
}

export interface ProofreadingAiPlanServiceOptions {
  mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;
}

export interface CreateProofreadingAiPlanInput {
  manuscriptId: string;
  sourceFileName?: string;
  sourceBlocks?: EditorialTextBlock[];
  qualityIssues?: Array<{
    severity?: string;
    explanation?: string;
  }>;
  governanceContext?: AiGovernanceContext;
}

export class ProofreadingAiPlanService {
  private readonly mainlineAiRuntimeExecutor?: MainlineAiRuntimeExecutor;

  constructor(options: ProofreadingAiPlanServiceOptions) {
    this.mainlineAiRuntimeExecutor = options.mainlineAiRuntimeExecutor;
  }

  async createPlan(
    input: CreateProofreadingAiPlanInput,
  ): Promise<ProofreadingAiPlan> {
    const fallbackPlan = buildFallbackProofreadingPlan(input);
    if (!this.mainlineAiRuntimeExecutor) {
      return fallbackPlan;
    }

    const payload =
      await this.mainlineAiRuntimeExecutor.executeJson<Record<string, unknown>>({
        module: "proofreading",
        systemPrompt: buildProofreadingSystemPrompt(),
        userPayload: buildProofreadingUserPayload(input),
      });

    return normalizeProofreadingAiPlan(payload, fallbackPlan);
  }
}

function buildProofreadingSystemPrompt(): string {
  return [
    "You are a conservative medical manuscript proofreading planner.",
    "Return JSON only.",
    "Propose exact text corrections only when the target text exists in the manuscript excerpts.",
    "Prefer zero corrections over speculative rewriting.",
    "If a governance payload is provided, treat its hard rules, forbidden operations, manual-review items, and knowledge hits as binding proofreading constraints.",
    "Do not produce a correction that would bypass governance.manualReviewItems or violate governance.forbiddenOperations.",
    "Use this exact schema:",
    JSON.stringify({
      summary: "string",
      corrections: [
        {
          targetText: "string",
          replacementText: "string",
          category: "terminology|punctuation|grammar|style",
        },
      ],
      manualReviewItems: ["string"],
    }),
  ].join(" ");
}

function buildProofreadingUserPayload(input: CreateProofreadingAiPlanInput) {
  const governance =
    input.governanceContext && !isAiGovernanceContextEmpty(input.governanceContext)
      ? input.governanceContext
      : undefined;

  return {
    task: "proofreading_plan",
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
      corrections: [
        {
          targetText: "string",
          replacementText: "string",
          category: "terminology|punctuation|grammar|style",
        },
      ],
      manualReviewItems: ["string"],
    },
  };
}

function buildFallbackProofreadingPlan(
  input: CreateProofreadingAiPlanInput,
): ProofreadingAiPlan {
  return {
    summary: `No AI proofreading corrections were proposed for ${input.manuscriptId}.`,
    corrections: [],
    manualReviewItems: [],
  };
}

function normalizeProofreadingAiPlan(
  payload: Record<string, unknown>,
  fallback: ProofreadingAiPlan,
): ProofreadingAiPlan {
  const corrections = Array.isArray(payload.corrections)
    ? payload.corrections
        .map(normalizeCorrection)
        .filter(
          (entry): entry is ProofreadingAiCorrection =>
            entry !== undefined &&
            entry.targetText !== entry.replacementText,
        )
    : [];

  return {
    summary: toNonEmptyString(payload.summary) ?? fallback.summary,
    corrections: corrections.length > 0 ? corrections : fallback.corrections,
    manualReviewItems: toStringArray(payload.manualReviewItems),
  };
}

function normalizeCorrection(
  value: unknown,
): ProofreadingAiCorrection | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const targetText = toNonEmptyString(value.targetText);
  const replacementText = toNonEmptyString(value.replacementText);
  const category = toCategory(value.category);
  if (!targetText || !replacementText || !category) {
    return undefined;
  }

  return {
    targetText,
    replacementText,
    category,
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
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function toCategory(value: unknown): ProofreadingCorrectionCategory | undefined {
  return value === "terminology" ||
    value === "punctuation" ||
    value === "grammar" ||
    value === "style"
    ? value
    : undefined;
}
