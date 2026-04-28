import type { ManuscriptQualityIssue } from "@medical/contracts";
import type {
  EditorialTextBlock,
  ManualReviewItem,
  ProofreadingCheckResult,
} from "../editorial-execution/types.ts";
import type { AiGovernanceContext } from "../shared/ai-governance-context.ts";
import { isAiGovernanceContextEmpty } from "../shared/ai-governance-context.ts";
import type { MainlineAiRuntimeExecutor } from "../shared/mainline-ai-runtime-executor.ts";
import type {
  ProofreadingDeepPassKind,
} from "./proofreading-pass-run-record.ts";
import type {
  ProofreadingAiPlan,
  ProofreadingIssue,
  ProofreadingIssueAnchor,
  ProofreadingIssueAnchorKind,
  ProofreadingIssueDocumentLocator,
  ProofreadingIssueSeverity,
  ProofreadingIssueSource,
  ProofreadingLegacyCorrection,
  ProofreadingSuggestionAction,
} from "./proofreading-issue-contract.ts";

const FULL_DOCUMENT_CONTEXT_CHAR_LIMIT = 24_000;
const LONG_DOCUMENT_TOTAL_PREVIEW_CHAR_BUDGET = 10_000;
const LONG_DOCUMENT_BLOCK_PREVIEW_CHAR_LIMIT = 96;
const LONG_DOCUMENT_MIN_BLOCK_PREVIEW_CHAR_LIMIT = 18;
const LONG_DOCUMENT_KEY_TERM_LIMIT = 18;
const LONG_DOCUMENT_SECTION_PREVIEW_CHAR_LIMIT = 120;

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
  governedFailedChecks?: Array<
    Pick<
      ProofreadingCheckResult,
      "ruleId" | "severity" | "actual" | "expected" | "blockIndex"
    >
  >;
  governedManualReviewItems?: Array<
    Pick<ManualReviewItem, "ruleId" | "reason" | "evidence_pack">
  >;
  qualityIssues?: Array<
    Pick<
      ManuscriptQualityIssue,
      | "severity"
      | "explanation"
      | "issue_type"
      | "action"
      | "text_excerpt"
      | "suggested_replacement"
    >
  >;
  knowledgeHits?: Array<{
    knowledgeItemId: string;
    title?: string;
    summary?: string;
    canonicalText?: string;
    matchReasons?: string[];
  }>;
  promptGuardrails?: {
    roleLabel?: string;
    systemInstructions?: string;
    taskFrame?: string;
    manualReviewPolicy?: string;
    forbiddenOperations?: string[];
    outputContract?: string;
  };
  governanceContext?: AiGovernanceContext;
  passFocus?: {
    passNo: number;
    passKind: ProofreadingDeepPassKind;
    instruction: string;
  };
  sliceContext?: Record<string, unknown>;
  factLedgerSummary?: Record<string, unknown>;
  activatedRules?: Array<Record<string, unknown>>;
  budgetedKnowledge?: Array<Record<string, unknown>>;
  deepDiagnostics?: Record<string, unknown>;
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
    const planningContext = buildPlanningContext(normalizedBlocks);

    if (
      !this.mainlineAiRuntimeExecutor ||
      planningContext.sourceCharacterCount === 0
    ) {
      return fallbackPlan;
    }

    const payload =
      await this.mainlineAiRuntimeExecutor.executeJson<Record<string, unknown>>({
        module: "proofreading",
        systemPrompt: buildProofreadingSystemPrompt(input),
        userPayload: buildProofreadingUserPayload({
          ...input,
          planningContext,
        }),
      });

    return normalizeProofreadingAiPlan(
      payload,
      fallbackPlan,
      normalizedBlocks,
      input,
    );
  }
}

function buildProofreadingSystemPrompt(
  input?: Pick<CreateProofreadingAiPlanInput, "sliceContext">,
): string {
  const scopeInstruction = input?.sliceContext
    ? "这是一次分片深度校对调用，只审查 deepProofreading.sliceContext 指定的证据范围，并结合 factLedgerSummary 判断。"
    : "这是一次整篇稿件单次校对，不允许按段分块改写后再拼接结论。";
  return [
    "你是“医学稿件终校审校员”。",
    scopeInstruction,
    "你的职责是基于整篇稿件上下文发现终校问题，而不是直接改写稿件。",
    "当 contextMode=full_text 时，先完整阅读 fullDocumentText，再回到 fullDocumentBlocks 给出可定位的问题。",
    "当 contextMode=document_map 时，要先完整理解 documentMap 提供的整篇结构、跨章节信号和关键术语，再结合 fullDocumentBlocks 的定位预览统一判断。",
    "必须保持保守：证据不足时宁可少报，不要臆造问题。",
    "优先关注医学事实、术语、数值与单位、统计与表格正文一致性、前后逻辑链条、语法与标点格式。",
    "只返回 JSON，不要返回 Markdown，不要返回修改后的全文。",
    "把已由规则、知识库、质量检查覆盖的内容视为已治理层覆盖，重点补充 residual AI 问题。",
    "不要重复报告 governedCoverage 里已经出现的同一段引文、同一规则失败、同一人工复核项或同一质量问题。",
    "严格遵循 qualityControlChecklist 里的重点核查方向与禁止行为。",
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
            documentLocator: {
              anchorKind:
                "block|paragraph|heading|table|table_cell|image|caption|reference_entry",
              anchorKey: "string",
              confidence: "provided|derived|fallback",
              blockIndex: 0,
              sectionLabel: "string",
              ordinalWithinSection: 0,
              tableId: "string",
              tableTarget: "string",
              rowKey: "string",
              columnKey: "string",
              footnoteAnchor: "string",
            },
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
  planningContext: ProofreadingPlanningContext;
  governedFailedChecks?: CreateProofreadingAiPlanInput["governedFailedChecks"];
  governedManualReviewItems?: CreateProofreadingAiPlanInput["governedManualReviewItems"];
  qualityIssues?: CreateProofreadingAiPlanInput["qualityIssues"];
  knowledgeHits?: CreateProofreadingAiPlanInput["knowledgeHits"];
  promptGuardrails?: CreateProofreadingAiPlanInput["promptGuardrails"];
  governanceContext?: AiGovernanceContext;
  passFocus?: CreateProofreadingAiPlanInput["passFocus"];
  sliceContext?: CreateProofreadingAiPlanInput["sliceContext"];
  factLedgerSummary?: CreateProofreadingAiPlanInput["factLedgerSummary"];
  activatedRules?: CreateProofreadingAiPlanInput["activatedRules"];
  budgetedKnowledge?: CreateProofreadingAiPlanInput["budgetedKnowledge"];
  deepDiagnostics?: CreateProofreadingAiPlanInput["deepDiagnostics"];
}) {
  const governance =
    input.governanceContext && !isAiGovernanceContextEmpty(input.governanceContext)
      ? input.governanceContext
      : undefined;

  return {
    task: "proofreading_issue_plan",
    manuscriptId: input.manuscriptId,
    sourceFileName: input.sourceFileName,
    ...(input.passFocus
      ? {
          passFocus: {
            passNo: input.passFocus.passNo,
            passKind: input.passFocus.passKind,
            instruction: input.passFocus.instruction,
          },
        }
      : {}),
    contextMode: input.planningContext.contextMode,
    fullDocumentBlocks: input.planningContext.fullDocumentBlocks,
    ...(input.planningContext.fullDocumentText
      ? {
          fullDocumentText: input.planningContext.fullDocumentText,
        }
      : {}),
    ...(input.planningContext.documentMap
      ? {
          documentMap: input.planningContext.documentMap,
        }
      : {}),
    ...(input.sliceContext ||
    input.factLedgerSummary ||
    input.activatedRules ||
    input.budgetedKnowledge ||
    input.deepDiagnostics
      ? {
          deepProofreading: {
            ...(input.sliceContext ? { sliceContext: input.sliceContext } : {}),
            ...(input.factLedgerSummary
              ? { factLedgerSummary: input.factLedgerSummary }
              : {}),
            ...(input.activatedRules ? { activatedRules: input.activatedRules } : {}),
            ...(input.budgetedKnowledge
              ? { budgetedKnowledge: input.budgetedKnowledge }
              : {}),
            ...(input.deepDiagnostics
              ? { diagnostics: input.deepDiagnostics }
              : {}),
          },
        }
      : {}),
    governedCoverage: {
      failedChecks: buildGovernedFailedCheckPayload(input.governedFailedChecks),
      manualReviewItems: buildGovernedManualReviewPayload(
        input.governedManualReviewItems,
      ),
      qualityIssues: buildGovernedQualityIssuePayload(input.qualityIssues),
      knowledgeHits: buildGovernedKnowledgeHitPayload(input.knowledgeHits),
      promptGuardrails: buildPromptGuardrailPayload(input.promptGuardrails),
    },
    proofreadingContextLayers: buildProofreadingContextLayers(input),
    qualityControlChecklist: buildProofreadingQualityControlChecklist(),
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
            documentLocator: {
              anchorKind:
                "block|paragraph|heading|table|table_cell|image|caption|reference_entry",
              anchorKey: "string",
              confidence: "provided|derived|fallback",
              blockIndex: 0,
              sectionLabel: "string",
              ordinalWithinSection: 0,
              tableId: "string",
              tableTarget: "string",
              rowKey: "string",
              columnKey: "string",
              footnoteAnchor: "string",
            },
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

function buildProofreadingQualityControlChecklist() {
  return {
    reviewMode: "whole_document_single_pass",
    governedCoveragePolicy: "governed_coverage_is_already_handled",
    forbiddenBehaviors: [
      "rewrite_full_manuscript",
      "segment_then_merge",
      "duplicate_governed_findings",
      "invent_missing_evidence",
    ],
    regressionFocuses: [
      {
        id: "cross_section_contradiction",
        requiredChecks: [
          "study_design_consistency",
          "population_definition_consistency",
          "sample_size_consistency",
          "follow_up_window_consistency",
        ],
      },
      {
        id: "conclusion_overclaim",
        requiredChecks: [
          "results_vs_conclusion_alignment",
          "study_design_vs_claim_strength",
        ],
      },
      {
        id: "terminology_consistency",
        requiredChecks: [
          "first_use_expansion",
          "abbreviation_casing",
          "unit_style_consistency",
        ],
      },
    ],
  };
}

function buildProofreadingContextLayers(input: {
  planningContext: ProofreadingPlanningContext;
  governedFailedChecks?: CreateProofreadingAiPlanInput["governedFailedChecks"];
  governedManualReviewItems?: CreateProofreadingAiPlanInput["governedManualReviewItems"];
  knowledgeHits?: CreateProofreadingAiPlanInput["knowledgeHits"];
  governanceContext?: AiGovernanceContext;
  passFocus?: CreateProofreadingAiPlanInput["passFocus"];
}) {
  const blocks = input.planningContext.fullDocumentBlocks;
  const ruleIds = dedupeStringArray([
    ...(input.governedFailedChecks ?? []).map((item) => item.ruleId),
    ...(input.governedManualReviewItems ?? []).map((item) => item.ruleId),
    ...(input.governanceContext?.resolvedRules ?? []).map((item) => item.ruleId),
  ]);
  const knowledgeItemIds = dedupeStringArray([
    ...(input.knowledgeHits ?? []).map((item) => item.knowledgeItemId),
    ...(input.governanceContext?.knowledgeHits ?? []).map(
      (item) => item.knowledgeItemId,
    ),
  ]);

  return {
    localBlockContext: {
      blockCount: blocks.length,
      blocks: blocks.map((block) => ({
        blockIndex: block.blockIndex,
        text: block.text,
        ...(block.sectionLabel ? { sectionLabel: block.sectionLabel } : {}),
        ...(block.blockKind ? { blockKind: block.blockKind } : {}),
        charCount: block.charCount,
      })),
    },
    neighborContext: {
      windows: blocks.map((block, index) => ({
        blockIndex: block.blockIndex,
        ...(blocks[index - 1]
          ? {
              previousBlockIndex: blocks[index - 1]?.blockIndex,
              previousTextPreview: blocks[index - 1]?.text,
            }
          : {}),
        ...(blocks[index + 1]
          ? {
              nextBlockIndex: blocks[index + 1]?.blockIndex,
              nextTextPreview: blocks[index + 1]?.text,
            }
          : {}),
      })),
    },
    sectionContext: {
      sections: buildContextLayerSections(blocks),
    },
    globalConsistencyContext: {
      contextMode: input.planningContext.contextMode,
      sourceCharacterCount: input.planningContext.sourceCharacterCount,
      fullDocumentAvailable: Boolean(input.planningContext.fullDocumentText),
      crossSectionSignals:
        input.planningContext.documentMap?.crossSectionSignals ?? [],
    },
    ruleCitationContext: {
      ruleIds,
      failedCheckCount: input.governedFailedChecks?.length ?? 0,
      manualReviewRuleIds: dedupeStringArray(
        (input.governedManualReviewItems ?? []).map((item) => item.ruleId),
      ),
    },
    knowledgeCitationContext: {
      knowledgeItemIds,
      hitCount: knowledgeItemIds.length,
    },
    residualAnalysisContext: {
      passNo: input.passFocus?.passNo,
      passKind: input.passFocus?.passKind,
      instruction: input.passFocus?.instruction,
      runsAfterGovernedCoverage: true,
      governedCoveragePolicy: "governed_coverage_is_already_handled",
      residualInstruction:
        "Find remaining high-confidence issues after deterministic rules and knowledge-backed checks.",
    },
  };
}

function buildContextLayerSections(
  blocks: ProofreadingPlanningBlockPreview[],
): Array<{
  sectionLabel: string;
  blockStartIndex: number;
  blockEndIndex: number;
  blockCount: number;
}> {
  const sections: Array<{
    sectionLabel: string;
    blockStartIndex: number;
    blockEndIndex: number;
    blockCount: number;
  }> = [];

  for (const block of blocks) {
    const sectionLabel = block.sectionLabel ?? "unlabeled";
    const existing = sections.at(-1);
    if (existing && existing.sectionLabel === sectionLabel) {
      existing.blockEndIndex = block.blockIndex;
      existing.blockCount += 1;
      continue;
    }
    sections.push({
      sectionLabel,
      blockStartIndex: block.blockIndex,
      blockEndIndex: block.blockIndex,
      blockCount: 1,
    });
  }

  return sections;
}

interface ProofreadingPlanningBlockPreview {
  blockIndex: number;
  text: string;
  sectionLabel?: string;
  blockKind?: string;
  charCount: number;
}

interface ProofreadingPlanningContext {
  contextMode: "full_text" | "document_map";
  sourceCharacterCount: number;
  fullDocumentBlocks: ProofreadingPlanningBlockPreview[];
  fullDocumentText?: string;
  documentMap?: {
    totalBlockCount: number;
    totalCharacterCount: number;
    sectionOutline: Array<{
      sectionLabel: string;
      blockStartIndex: number;
      blockEndIndex: number;
      blockCount: number;
      charCount: number;
      representativePreview: string;
    }>;
    keyTerms: string[];
    crossSectionSignals: string[];
    blockCatalog: Array<{
      blockIndex: number;
      sectionLabel?: string;
      blockKind?: string;
      charCount: number;
    }>;
  };
}

function buildPlanningContext(
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>,
): ProofreadingPlanningContext {
  const fullDocumentText = sourceBlocks
    .map((block) => block.text)
    .filter((text) => text.length > 0)
    .join("\n\n");
  const sourceCharacterCount = fullDocumentText.length;

  if (sourceCharacterCount <= FULL_DOCUMENT_CONTEXT_CHAR_LIMIT) {
    return {
      contextMode: "full_text",
      sourceCharacterCount,
      fullDocumentBlocks: sourceBlocks.map((block) => ({
        ...block,
        charCount: block.text.length,
      })),
      ...(fullDocumentText.length > 0
        ? {
            fullDocumentText,
          }
        : {}),
    };
  }

  const blockPreviews = buildLongDocumentBlockPreviews(sourceBlocks);
  const sectionOutline = buildLongDocumentSectionOutline(sourceBlocks);
  const keyTerms = extractLongDocumentKeyTerms(sourceBlocks);
  const crossSectionSignals = buildCrossSectionSignals(sectionOutline, keyTerms);

  return {
    contextMode: "document_map",
    sourceCharacterCount,
    fullDocumentBlocks: blockPreviews,
    documentMap: {
      totalBlockCount: sourceBlocks.length,
      totalCharacterCount: sourceCharacterCount,
      sectionOutline,
      keyTerms,
      crossSectionSignals,
      blockCatalog: sourceBlocks.map((block) => ({
        blockIndex: block.blockIndex,
        ...(block.sectionLabel
          ? {
              sectionLabel: block.sectionLabel,
            }
          : {}),
        ...(block.blockKind
          ? {
              blockKind: block.blockKind,
            }
          : {}),
        charCount: block.text.length,
      })),
    },
  };
}

function buildLongDocumentBlockPreviews(
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>,
): ProofreadingPlanningBlockPreview[] {
  let remainingBudget = LONG_DOCUMENT_TOTAL_PREVIEW_CHAR_BUDGET;

  return sourceBlocks.map((block, index) => {
    const remainingBlocks = sourceBlocks.length - index;
    const averageBudget =
      remainingBlocks > 0 ? Math.floor(remainingBudget / remainingBlocks) : 0;
    const previewBudget =
      remainingBudget <= 0
        ? 0
        : Math.min(
            LONG_DOCUMENT_BLOCK_PREVIEW_CHAR_LIMIT,
            remainingBudget,
            Math.max(averageBudget, LONG_DOCUMENT_MIN_BLOCK_PREVIEW_CHAR_LIMIT),
          );
    const previewText =
      previewBudget > 0
        ? createPreviewText(block.text, previewBudget)
        : createPreviewText(block.text, LONG_DOCUMENT_MIN_BLOCK_PREVIEW_CHAR_LIMIT);

    remainingBudget = Math.max(0, remainingBudget - previewText.length);

    return {
      blockIndex: block.blockIndex,
      text: previewText,
      ...(block.sectionLabel
        ? {
            sectionLabel: block.sectionLabel,
          }
        : {}),
      ...(block.blockKind
        ? {
            blockKind: block.blockKind,
          }
        : {}),
      charCount: block.text.length,
    };
  });
}

function buildLongDocumentSectionOutline(
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>,
) {
  const outline: Array<{
    sectionLabel: string;
    blockStartIndex: number;
    blockEndIndex: number;
    blockCount: number;
    charCount: number;
    representativePreview: string;
  }> = [];

  for (const block of sourceBlocks) {
    const sectionLabel = block.sectionLabel ?? "unlabeled";
    const existing = outline.at(-1);
    if (existing && existing.sectionLabel === sectionLabel) {
      existing.blockEndIndex = block.blockIndex;
      existing.blockCount += 1;
      existing.charCount += block.text.length;
      continue;
    }

    outline.push({
      sectionLabel,
      blockStartIndex: block.blockIndex,
      blockEndIndex: block.blockIndex,
      blockCount: 1,
      charCount: block.text.length,
      representativePreview: createPreviewText(
        block.text,
        LONG_DOCUMENT_SECTION_PREVIEW_CHAR_LIMIT,
      ),
    });
  }

  return outline;
}

function extractLongDocumentKeyTerms(
  sourceBlocks: Array<{
    text: string;
  }>,
): string[] {
  const termFrequency = new Map<string, number>();
  const stopwords = new Set([
    "about",
    "after",
    "before",
    "between",
    "contains",
    "detailed",
    "events",
    "every",
    "follow",
    "group",
    "groups",
    "manuscript",
    "measured",
    "outcomes",
    "paragraph",
    "patient",
    "patients",
    "protocol",
    "result",
    "results",
    "study",
    "text",
    "that",
    "this",
    "were",
    "with",
    "windows",
  ]);

  for (const block of sourceBlocks) {
    const uppercaseTerms = block.text.match(/\b[A-Z][A-Z0-9-]{1,10}\b/gu) ?? [];
    for (const term of uppercaseTerms) {
      termFrequency.set(term, (termFrequency.get(term) ?? 0) + 3);
    }

    const wordTerms =
      block.text.toLowerCase().match(/\b[a-z][a-z-]{3,20}\b/gu) ?? [];
    for (const term of wordTerms) {
      if (stopwords.has(term)) {
        continue;
      }
      termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
    }
  }

  return [...termFrequency.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, LONG_DOCUMENT_KEY_TERM_LIMIT)
    .map(([term]) => term);
}

function buildCrossSectionSignals(
  sectionOutline: Array<{
    sectionLabel: string;
  }>,
  keyTerms: readonly string[],
): string[] {
  const sectionLabels = sectionOutline.map((entry) => entry.sectionLabel.toLowerCase());
  const signals = new Set<string>();

  if (sectionOutline.length > 1) {
    signals.add(
      `全文跨 ${sectionOutline
        .map((entry) => entry.sectionLabel)
        .join(" -> ")} 展开，需统一核对前后逻辑链条。`,
    );
  }
  if (
    sectionLabels.includes("abstract") &&
    sectionLabels.includes("methods") &&
    sectionLabels.includes("results")
  ) {
    signals.add("重点核对 Abstract、Methods、Results 之间的研究设计、入组人群、样本量与随访时间是否一致。");
  }
  if (sectionLabels.includes("methods") && sectionLabels.includes("results")) {
    signals.add("重点核对 Methods 与 Results 之间的方案、样本量、指标口径是否一致。");
    signals.add("重点核对 Methods 与 Results 之间的入组人群定义、样本量与随访时间窗是否一致。");
  }
  if (sectionLabels.includes("results") && sectionLabels.includes("conclusion")) {
    signals.add("重点核对 Results 与 Conclusion 之间的结论强度、数值表述和因果措辞是否一致。");
    signals.add("重点核对 Results 与 Conclusion 之间是否存在结论升级、超出证据支撑或未报告结局被直接下结论。");
  }
  if (sectionLabels.includes("abstract") && sectionLabels.includes("conclusion")) {
    signals.add("重点核对 Abstract 与 Conclusion 是否存在结论升级或摘要遗漏。");
  }
  if (keyTerms.length > 0) {
    signals.add(
      `全文高频术语包括 ${keyTerms.slice(0, 6).join("、")}，需关注首次定义、缩写大小写、单位格式与后续引用一致性。`,
    );
  }

  return [...signals];
}

function createPreviewText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  if (limit <= 1) {
    return text.slice(0, limit);
  }
  if (limit <= 12) {
    return `${text.slice(0, limit - 1)}…`;
  }

  const headLength = Math.max(8, Math.floor(limit * 0.7) - 1);
  const tailLength = Math.max(4, limit - headLength - 1);
  return `${text.slice(0, headLength)}…${text.slice(-tailLength)}`;
}

function buildGovernedFailedCheckPayload(
  items: CreateProofreadingAiPlanInput["governedFailedChecks"],
) {
  return (items ?? []).map((item) => ({
    ruleId: item.ruleId,
    severity: item.severity,
    ...(typeof item.blockIndex === "number"
      ? {
          blockIndex: item.blockIndex,
        }
      : {}),
    actual: item.actual,
    expected: item.expected,
  }));
}

function buildGovernedManualReviewPayload(
  items: CreateProofreadingAiPlanInput["governedManualReviewItems"],
) {
  return (items ?? []).map((item) => ({
    ruleId: item.ruleId,
    reason: item.reason,
    ...(toNonEmptyString(item.evidence_pack?.excerpt)
      ? {
          excerpt: toNonEmptyString(item.evidence_pack?.excerpt),
        }
      : {}),
  }));
}

function buildGovernedQualityIssuePayload(
  issues: CreateProofreadingAiPlanInput["qualityIssues"],
) {
  return (issues ?? []).map((issue) => ({
    severity: issue.severity ?? "info",
    issueType: issue.issue_type ?? "",
    explanation: issue.explanation ?? "",
    ...(toNonEmptyString(issue.action)
      ? {
          action: toNonEmptyString(issue.action),
        }
      : {}),
    ...(toNonEmptyString(issue.text_excerpt)
      ? {
          excerpt: toNonEmptyString(issue.text_excerpt),
        }
      : {}),
    ...(toNonEmptyString(issue.suggested_replacement)
      ? {
          suggestedReplacement: toNonEmptyString(issue.suggested_replacement),
        }
      : {}),
  }));
}

function buildGovernedKnowledgeHitPayload(
  hits: CreateProofreadingAiPlanInput["knowledgeHits"],
) {
  return (hits ?? []).map((hit) => ({
    knowledgeItemId: hit.knowledgeItemId,
    ...(toNonEmptyString(hit.title)
      ? {
          title: toNonEmptyString(hit.title),
        }
      : {}),
    ...(toNonEmptyString(hit.summary)
      ? {
          summary: toNonEmptyString(hit.summary),
        }
      : {}),
    ...(toNonEmptyString(hit.canonicalText)
      ? {
          canonicalText: toNonEmptyString(hit.canonicalText),
        }
      : {}),
    ...(toStringArray(hit.matchReasons).length > 0
      ? {
          matchReasons: toStringArray(hit.matchReasons),
        }
      : {}),
  }));
}

function buildPromptGuardrailPayload(
  promptGuardrails: CreateProofreadingAiPlanInput["promptGuardrails"],
) {
  if (!promptGuardrails) {
    return undefined;
  }

  const forbiddenOperations = toStringArray(promptGuardrails.forbiddenOperations);

  return {
    ...(toNonEmptyString(promptGuardrails.roleLabel)
      ? {
          roleLabel: toNonEmptyString(promptGuardrails.roleLabel),
        }
      : {}),
    ...(toNonEmptyString(promptGuardrails.systemInstructions)
      ? {
          systemInstructions: toNonEmptyString(
            promptGuardrails.systemInstructions,
          ),
        }
      : {}),
    ...(toNonEmptyString(promptGuardrails.taskFrame)
      ? {
          taskFrame: toNonEmptyString(promptGuardrails.taskFrame),
        }
      : {}),
    ...(toNonEmptyString(promptGuardrails.manualReviewPolicy)
      ? {
          manualReviewPolicy: toNonEmptyString(
            promptGuardrails.manualReviewPolicy,
          ),
        }
      : {}),
    ...(forbiddenOperations.length > 0
      ? {
          forbiddenOperations,
        }
      : {}),
    ...(toNonEmptyString(promptGuardrails.outputContract)
      ? {
          outputContract: toNonEmptyString(promptGuardrails.outputContract),
        }
      : {}),
  };
}

function filterAndDedupeResidualIssues(
  issues: readonly ProofreadingIssue[],
  input: CreateProofreadingAiPlanInput,
): ProofreadingIssue[] {
  const coveredTextKeys = collectGovernedCoverageTextKeys(input);
  const coveredAnchoredKeys = collectGovernedCoverageAnchoredKeys(input);
  const seenIssueKeys = new Set<string>();
  const filteredIssues: ProofreadingIssue[] = [];

  for (const issue of issues) {
    const anchoredKey = buildAnchoredTextKey(
      issue.anchor.quote,
      issue.anchor.blockIndex,
    );
    const textKey = normalizeComparisonText(issue.anchor.quote);
    if (
      (anchoredKey && coveredAnchoredKeys.has(anchoredKey)) ||
      (textKey && coveredTextKeys.has(textKey))
    ) {
      continue;
    }

    const dedupeKey = `${issue.issueType}:${anchoredKey ?? textKey ?? issue.itemId}`;
    if (seenIssueKeys.has(dedupeKey)) {
      continue;
    }

    seenIssueKeys.add(dedupeKey);
    filteredIssues.push(issue);
  }

  return filteredIssues;
}

function collectGovernedCoverageTextKeys(
  input: CreateProofreadingAiPlanInput,
): Set<string> {
  const keys = new Set<string>();

  for (const item of input.governedFailedChecks ?? []) {
    const key = normalizeComparisonText(item.actual);
    if (key) {
      keys.add(key);
    }
  }
  for (const item of input.governedManualReviewItems ?? []) {
    const key = normalizeComparisonText(item.evidence_pack?.excerpt);
    if (key) {
      keys.add(key);
    }
  }
  for (const issue of input.qualityIssues ?? []) {
    const key = normalizeComparisonText(issue.text_excerpt);
    if (key) {
      keys.add(key);
    }
  }

  return keys;
}

function collectGovernedCoverageAnchoredKeys(
  input: CreateProofreadingAiPlanInput,
): Set<string> {
  const keys = new Set<string>();

  for (const item of input.governedFailedChecks ?? []) {
    const key = buildAnchoredTextKey(item.actual, item.blockIndex);
    if (key) {
      keys.add(key);
    }
  }

  return keys;
}

function buildAnchoredTextKey(
  value: unknown,
  blockIndex: number | undefined,
): string | undefined {
  if (typeof blockIndex !== "number") {
    return undefined;
  }

  const normalizedText = normalizeComparisonText(value);
  return normalizedText ? `${blockIndex}:${normalizedText}` : undefined;
}

function normalizeComparisonText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/gu, " ");
  return normalized.length > 0 ? normalized : undefined;
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
  input: CreateProofreadingAiPlanInput,
): ProofreadingAiPlan {
  const normalizedIssues = Array.isArray(payload.issues)
    ? payload.issues
        .map((value, index) => normalizeIssue(value, index, sourceBlocks))
        .filter((value): value is ProofreadingIssue => value !== undefined)
    : [];
  const issues = filterAndDedupeResidualIssues(normalizedIssues, input);
  const manualReviewItems = dedupeStringArray(toStringArray(payload.manualReviewItems));

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
    documentLocator: normalizeDocumentLocator({
      value: value.documentLocator,
      blockIndex,
      sectionLabel:
        toNonEmptyString(value.sectionLabel) ?? matchedBlock?.sectionLabel,
      blockKind: toNonEmptyString(value.blockKind) ?? matchedBlock?.blockKind,
      sourceBlocks,
    }),
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

function normalizeDocumentLocator(input: {
  value: unknown;
  blockIndex: number;
  sectionLabel?: string;
  blockKind?: string;
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>;
}): ProofreadingIssueDocumentLocator | undefined {
  const derivedLocator = buildDerivedDocumentLocator({
    blockIndex: input.blockIndex,
    sectionLabel: input.sectionLabel,
    blockKind: input.blockKind,
    sourceBlocks: input.sourceBlocks,
  });
  const providedLocator = isRecord(input.value)
    ? buildProvidedDocumentLocator(input.value)
    : undefined;
  if (!providedLocator) {
    return derivedLocator;
  }

  if (
    providedLocator.anchorKind === "block" &&
    derivedLocator.anchorKind !== "block"
  ) {
    return derivedLocator;
  }

  return providedLocator;
}

function buildProvidedDocumentLocator(
  value: Record<string, unknown>,
): ProofreadingIssueDocumentLocator | undefined {
  const anchorKind = toAnchorKind(value.anchorKind);
  const anchorKey = toNonEmptyString(value.anchorKey);
  if (!anchorKind || !anchorKey) {
    return undefined;
  }

  return {
    anchorKind,
    anchorKey,
    confidence:
      value.confidence === "provided" ||
      value.confidence === "derived" ||
      value.confidence === "fallback"
        ? value.confidence
        : "provided",
    ...(typeof value.blockIndex === "number" && Number.isInteger(value.blockIndex)
      ? {
          blockIndex: value.blockIndex,
        }
      : {}),
    ...(toNonEmptyString(value.sectionLabel)
      ? {
          sectionLabel: toNonEmptyString(value.sectionLabel),
        }
      : {}),
    ...(typeof value.ordinalWithinSection === "number" &&
    Number.isInteger(value.ordinalWithinSection)
      ? {
          ordinalWithinSection: value.ordinalWithinSection,
        }
      : {}),
    ...(toNonEmptyString(value.tableId)
      ? {
          tableId: toNonEmptyString(value.tableId),
        }
      : {}),
    ...(toNonEmptyString(value.tableTarget)
      ? {
          tableTarget: toNonEmptyString(value.tableTarget),
        }
      : {}),
    ...(toNonEmptyString(value.rowKey)
      ? {
          rowKey: toNonEmptyString(value.rowKey),
        }
      : {}),
    ...(toNonEmptyString(value.columnKey)
      ? {
          columnKey: toNonEmptyString(value.columnKey),
        }
      : {}),
    ...(toNonEmptyString(value.footnoteAnchor)
      ? {
          footnoteAnchor: toNonEmptyString(value.footnoteAnchor),
        }
      : {}),
  };
}

function buildDerivedDocumentLocator(input: {
  blockIndex: number;
  sectionLabel?: string;
  blockKind?: string;
  sourceBlocks: Array<{
    blockIndex: number;
    text: string;
    sectionLabel?: string;
    blockKind?: string;
  }>;
}): ProofreadingIssueDocumentLocator {
  const anchorKind = inferAnchorKind(input.blockKind);
  if (anchorKind === "block") {
    return {
      anchorKind,
      anchorKey: `block:${input.blockIndex}`,
      confidence: "fallback",
      blockIndex: input.blockIndex,
      ...(input.sectionLabel
        ? {
            sectionLabel: input.sectionLabel,
          }
        : {}),
    };
  }

  const ordinalWithinSection = input.sourceBlocks
    .filter((block) => block.blockIndex < input.blockIndex)
    .filter(
      (block) =>
        (block.sectionLabel ?? "") === (input.sectionLabel ?? "") &&
        inferAnchorKind(block.blockKind) === anchorKind,
    ).length;

  return {
    anchorKind,
    anchorKey: `${anchorKind}:${input.sectionLabel ?? "document"}:${ordinalWithinSection}`,
    confidence: "derived",
    blockIndex: input.blockIndex,
    ...(input.sectionLabel
      ? {
          sectionLabel: input.sectionLabel,
        }
      : {}),
    ordinalWithinSection,
  };
}

function inferAnchorKind(blockKind: string | undefined): ProofreadingIssueAnchorKind {
  switch (blockKind) {
    case "paragraph":
      return "paragraph";
    case "heading":
      return "heading";
    case "table":
      return "table";
    case "image":
      return "image";
    case "caption":
      return "caption";
    case "reference_entry":
      return "reference_entry";
    default:
      return "block";
  }
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

function dedupeStringArray(values: readonly string[]): string[] {
  return [...new Set(values)];
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
  return value === "deterministic_check" ||
    value === "governed_rule" ||
    value === "knowledge_base" ||
    value === "quality_package" ||
    value === "ai_pass" ||
    value === "quality_check" ||
    value === "residual_ai" ||
    value === "legacy_correction"
    ? value
    : undefined;
}

function toAnchorKind(value: unknown): ProofreadingIssueAnchorKind | undefined {
  return value === "block" ||
    value === "paragraph" ||
    value === "heading" ||
    value === "table" ||
    value === "table_cell" ||
    value === "image" ||
    value === "caption" ||
    value === "reference_entry"
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
