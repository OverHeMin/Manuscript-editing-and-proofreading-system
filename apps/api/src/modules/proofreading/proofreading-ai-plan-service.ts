import type { EditorialTextBlock } from "../editorial-execution/types.ts";
import type { AiGovernanceContext } from "../shared/ai-governance-context.ts";
import { isAiGovernanceContextEmpty } from "../shared/ai-governance-context.ts";
import type { MainlineAiRuntimeExecutor } from "../shared/mainline-ai-runtime-executor.ts";
import type {
  ProofreadingAiPlan,
  ProofreadingIssue,
  ProofreadingIssueAnchor,
  ProofreadingIssueSeverity,
  ProofreadingIssueSource,
  ProofreadingLegacyCorrection,
  ProofreadingSuggestionAction,
} from "./proofreading-issue-contract.ts";

const FULL_DOCUMENT_CONTEXT_CHAR_LIMIT = 24_000;

export class ProofreadingFullDocumentContextLimitExceededError extends Error {
  constructor(manuscriptId: string, observedLength: number, limit: number) {
    super(
      `Manuscript ${manuscriptId} exceeds the full-document proofreading context limit (${observedLength}/${limit}).`,
    );
    this.name = "ProofreadingFullDocumentContextLimitExceededError";
  }
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
    issue_type?: string;
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
    const normalizedBlocks = normalizeSourceBlocks(input.sourceBlocks ?? []);
    const fullDocument = normalizedBlocks
      .map((block) => block.text)
      .filter((text) => text.length > 0)
      .join("\n\n");

    if (fullDocument.length > FULL_DOCUMENT_CONTEXT_CHAR_LIMIT) {
      throw new ProofreadingFullDocumentContextLimitExceededError(
        input.manuscriptId,
        fullDocument.length,
        FULL_DOCUMENT_CONTEXT_CHAR_LIMIT,
      );
    }

    if (!this.mainlineAiRuntimeExecutor || fullDocument.length === 0) {
      return fallbackPlan;
    }

    const payload =
      await this.mainlineAiRuntimeExecutor.executeJson<Record<string, unknown>>({
        module: "proofreading",
        systemPrompt: buildProofreadingSystemPrompt(),
        userPayload: buildProofreadingUserPayload({
          ...input,
          sourceBlocks: normalizedBlocks,
        }),
      });

    return normalizeProofreadingAiPlan(payload, fallbackPlan, normalizedBlocks);
  }
}

function buildProofreadingSystemPrompt(): string {
  return [
    "你是“医学稿件终校审校员”。",
    "你的职责是基于整篇稿件上下文发现终校问题，而不是直接改写稿件。",
    "必须保持保守：证据不足时宁可少报，不要臆造问题。",
    "只返回 JSON，不要返回 Markdown，不要返回修改后的全文。",
    "把已由规则、知识库、质量检查覆盖的内容视为已治理层覆盖，重点补充 residual AI 问题。",
    "如果提供 governance，则其中的 hardRuleSummary、forbiddenOperations、manualReviewItems、knowledgeHits 都是硬约束，不得给出与其冲突的建议。",
    "issue.source 固定使用 residual_ai，除非输入已经明确给出其他来源。",
    "anchor.blockIndex 必须对应输入 fullDocumentBlocks 里的 blockIndex。",
    "只有在能给出安全建议时才填写 suggestion；否则给 explain_only 或 verify_fact。",
    "JSON schema:",
    JSON.stringify({
      role: "医学稿件终校审校员",
      summary: "string",
      issues: [
        {
          itemId: "string",
          title: "string",
          description: "string",
          severity: "critical|high|medium|low",
          source: "residual_ai",
          issueType: "string",
          blocksFinal: false,
          anchor: {
            blockIndex: 0,
            quote: "string",
            sectionLabel: "string",
            blockKind: "string",
          },
          suggestion: {
            action: "replace_text|rewrite_manually|verify_fact|explain_only",
            replacementText: "string",
            note: "string",
          },
        },
      ],
      manualReviewItems: ["string"],
    }),
  ].join(" ");
}

function buildProofreadingUserPayload(input: {
  manuscriptId: string;
  sourceFileName?: string;
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>;
  qualityIssues?: Array<{
    severity?: string;
    explanation?: string;
    issue_type?: string;
  }>;
  governanceContext?: AiGovernanceContext;
}) {
  const governance =
    input.governanceContext && !isAiGovernanceContextEmpty(input.governanceContext)
      ? input.governanceContext
      : undefined;

  return {
    task: "proofreading_issue_plan",
    manuscriptId: input.manuscriptId,
    sourceFileName: input.sourceFileName,
    fullDocumentBlocks: input.sourceBlocks,
    fullDocumentText: input.sourceBlocks.map((block) => block.text).join("\n\n"),
    governedCoverage: {
      qualityIssues: (input.qualityIssues ?? []).map((issue) => ({
        severity: issue.severity ?? "info",
        issueType: issue.issue_type ?? "",
        explanation: issue.explanation ?? "",
      })),
    },
    ...(governance
      ? {
          governance,
        }
      : {}),
    contract: {
      role: "医学稿件终校审校员",
      summary: "string",
      issues: [
        {
          itemId: "string",
          title: "string",
          description: "string",
          severity: "critical|high|medium|low",
          source: "residual_ai",
          issueType: "string",
          blocksFinal: false,
          anchor: {
            blockIndex: 0,
            quote: "string",
            sectionLabel: "string",
            blockKind: "string",
          },
          suggestion: {
            action: "replace_text|rewrite_manually|verify_fact|explain_only",
            replacementText: "string",
            note: "string",
          },
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
    role: "医学稿件终校审校员",
    summary: `No additional residual proofreading issues were proposed for ${input.manuscriptId}.`,
    issues: [],
    corrections: [],
    manualReviewItems: [],
  };
}

function normalizeProofreadingAiPlan(
  payload: Record<string, unknown>,
  fallback: ProofreadingAiPlan,
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>,
): ProofreadingAiPlan {
  const issues = Array.isArray(payload.issues)
    ? payload.issues
        .map((value, index) => normalizeIssue(value, index, sourceBlocks))
        .filter((value): value is ProofreadingIssue => value !== undefined)
    : [];
  const manualReviewItems = toStringArray(payload.manualReviewItems);

  return {
    role: toNonEmptyString(payload.role) ?? fallback.role,
    summary: toNonEmptyString(payload.summary) ?? fallback.summary,
    issues,
    corrections: issuesToLegacyCorrections(issues),
    manualReviewItems:
      manualReviewItems.length > 0 ? manualReviewItems : fallback.manualReviewItems,
  };
}

function normalizeIssue(
  value: unknown,
  index: number,
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>,
): ProofreadingIssue | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const anchor = normalizeAnchor(value.anchor, sourceBlocks);
  if (!anchor) {
    return undefined;
  }

  return {
    itemId: toNonEmptyString(value.itemId) ?? `issue-${index + 1}`,
    title: toNonEmptyString(value.title) ?? `Issue ${index + 1}`,
    description: toNonEmptyString(value.description) ?? anchor.quote,
    severity: toSeverity(value.severity) ?? "medium",
    source: toSource(value.source) ?? "residual_ai",
    issueType: toNonEmptyString(value.issueType) ?? "style",
    blocksFinal: Boolean(value.blocksFinal),
    anchor,
    suggestion: normalizeSuggestion(value.suggestion),
  };
}

function normalizeAnchor(
  value: unknown,
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>,
): ProofreadingIssueAnchor | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const blockIndex =
    typeof value.blockIndex === "number" && Number.isInteger(value.blockIndex)
      ? value.blockIndex
      : undefined;
  if (blockIndex === undefined) {
    return undefined;
  }

  const matchedBlock = sourceBlocks.find((block) => block.blockIndex === blockIndex);
  const quote = toNonEmptyString(value.quote) ?? matchedBlock?.text;
  if (!quote) {
    return undefined;
  }

  return {
    blockIndex,
    quote,
    sectionLabel:
      toNonEmptyString(value.sectionLabel) ?? matchedBlock?.sectionLabel,
    blockKind: toNonEmptyString(value.blockKind) ?? matchedBlock?.blockKind,
  };
}

function normalizeSuggestion(
  value: unknown,
):
  | {
      action: ProofreadingSuggestionAction;
      replacementText?: string;
      note?: string;
    }
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const action = toSuggestionAction(value.action);
  if (!action) {
    return undefined;
  }

  return {
    action,
    ...(toNonEmptyString(value.replacementText)
      ? {
          replacementText: toNonEmptyString(value.replacementText),
        }
      : {}),
    ...(toNonEmptyString(value.note)
      ? {
          note: toNonEmptyString(value.note),
        }
      : {}),
  };
}

function normalizeSourceBlocks(
  sourceBlocks: EditorialTextBlock[],
): Array<{
  blockIndex: number;
  text: string;
  sectionLabel?: string;
  blockKind?: string;
}> {
  return sourceBlocks.flatMap((block, blockIndex) => {
    const text = block.text.trim();
    if (text.length === 0) {
      return [];
    }

    return [
      {
        blockIndex,
        text,
        sectionLabel: toNonEmptyString(block.section),
        blockKind: toNonEmptyString(block.block_kind),
      },
    ];
  });
}

function issuesToLegacyCorrections(
  issues: readonly ProofreadingIssue[],
): ProofreadingLegacyCorrection[] {
  return issues.flatMap((issue) => {
    const replacementText = toNonEmptyString(issue.suggestion?.replacementText);
    if (!replacementText) {
      return [];
    }

    return [
      {
        targetText: issue.anchor.quote,
        replacementText,
        category: issue.issueType,
      },
    ];
  });
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

function toSeverity(value: unknown): ProofreadingIssueSeverity | undefined {
  return value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
    ? value
    : undefined;
}

function toSource(value: unknown): ProofreadingIssueSource | undefined {
  return value === "governed_rule" ||
    value === "knowledge_base" ||
    value === "quality_check" ||
    value === "residual_ai" ||
    value === "legacy_correction"
    ? value
    : undefined;
}

function toSuggestionAction(
  value: unknown,
): ProofreadingSuggestionAction | undefined {
  return value === "replace_text" ||
    value === "rewrite_manually" ||
    value === "verify_fact" ||
    value === "explain_only"
    ? value
    : undefined;
}
