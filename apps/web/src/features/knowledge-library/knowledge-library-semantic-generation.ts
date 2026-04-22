import type { KnowledgeLibraryLedgerComposer } from "./knowledge-library-ledger-composer.ts";
import type { KnowledgeLibraryWorkbenchController } from "./knowledge-library-controller.ts";
import type {
  KnowledgeLibraryAiIntakeSuggestionViewModel,
  KnowledgeLibrarySemanticAssistSuggestionViewModel,
  KnowledgeSemanticLayerViewModel,
} from "./types.ts";

const DEFAULT_SEMANTIC_ASSIST_INSTRUCTION =
  "请基于当前知识草稿补全语义摘要、检索词与适用场景；必要时补充摘要、别名、风险标签和学科标签，但不要改写标题。";

const DEFAULT_SEMANTIC_ASSIST_TARGET_SCOPES = [
  "semantic_layer",
  "metadata_patch",
] as const;

const DEFAULT_SEMANTIC_INTAKE_OPERATOR_HINTS =
  "请重点返回语义摘要、检索词、适用场景，以及必要的摘要、别名和风险标签建议，不要改写标题。";

export type KnowledgeLibrarySemanticSuggestionResult =
  | {
      kind: "assist";
      suggestion: KnowledgeLibrarySemanticAssistSuggestionViewModel;
    }
  | {
      kind: "intake";
      suggestion: KnowledgeLibraryAiIntakeSuggestionViewModel;
    };

export async function generateKnowledgeLibrarySemanticSuggestion(input: {
  controller: Pick<
    KnowledgeLibraryWorkbenchController,
    "assistSemanticLayer" | "createAiIntakeSuggestion"
  >;
  composer: KnowledgeLibraryLedgerComposer;
  sourceText: string;
}): Promise<KnowledgeLibrarySemanticSuggestionResult> {
  if (input.composer.persistedRevisionId) {
    return {
      kind: "assist",
      suggestion: await input.controller.assistSemanticLayer({
        revisionId: input.composer.persistedRevisionId,
        instructionText: DEFAULT_SEMANTIC_ASSIST_INSTRUCTION,
        targetScopes: [...DEFAULT_SEMANTIC_ASSIST_TARGET_SCOPES],
      }),
    };
  }

  return {
    kind: "intake",
    suggestion: await input.controller.createAiIntakeSuggestion({
      sourceText: input.sourceText,
      operatorHints: DEFAULT_SEMANTIC_INTAKE_OPERATOR_HINTS,
    }),
  };
}

export function applyKnowledgeLibrarySemanticSuggestion(
  composer: KnowledgeLibraryLedgerComposer,
  result: KnowledgeLibrarySemanticSuggestionResult,
): KnowledgeLibraryLedgerComposer {
  return result.kind === "assist"
    ? applySemanticAssistSuggestion(composer, result.suggestion)
    : applySemanticIntakeSuggestion(composer, result.suggestion);
}

export function buildKnowledgeLibrarySemanticAnalysisNotes(input: {
  composer: KnowledgeLibraryLedgerComposer;
  autoPersistedDraft?: boolean;
}): string[] {
  const notes: string[] = [];
  const summaryFields = ["标题", "标准答案"];
  if (toOptionalString(input.composer.draft.summary)) {
    summaryFields.push("补充说明");
  }
  if (normalizeStringArray(input.composer.draft.aliases)) {
    summaryFields.push("别名");
  }
  if (normalizeStringArray(input.composer.draft.riskTags)) {
    summaryFields.push("风险标签");
  }

  notes.push(`本次分析已带入：${summaryFields.join("、")}。`);

  const textCount = input.composer.contentBlocksDraft.filter(
    (block) => block.block_type === "text_block",
  ).length;
  const tableCount = input.composer.contentBlocksDraft.filter(
    (block) => block.block_type === "table_block",
  ).length;
  const imageBlocks = input.composer.contentBlocksDraft.filter(
    (block) => block.block_type === "image_block",
  );
  const materialParts = [
    textCount > 0 ? formatCount(textCount, "个文本块") : null,
    tableCount > 0 ? formatCount(tableCount, "个表格块") : null,
    imageBlocks.length > 0 ? formatCount(imageBlocks.length, "张图片") : null,
  ].filter((part): part is string => part != null);

  if (materialParts.length > 0) {
    notes.push(`本次分析同步参考了：${materialParts.join("、")}。`);
  }

  const imageNames = imageBlocks
    .map((block) =>
      typeof block.content_payload.file_name === "string"
        ? block.content_payload.file_name.trim()
        : "",
    )
    .filter((value) => value.length > 0)
    .slice(0, 3);
  if (imageNames.length > 0) {
    notes.push(`图片附件：${imageNames.join("、")}。`);
  }

  if (input.autoPersistedDraft) {
    notes.push("系统已先保存当前草稿，以便把材料块和附件一起带入 AI 分析。");
  }

  return notes;
}

function applySemanticAssistSuggestion(
  composer: KnowledgeLibraryLedgerComposer,
  suggestion: KnowledgeLibrarySemanticAssistSuggestionViewModel,
): KnowledgeLibraryLedgerComposer {
  const fieldPatch = suggestion.suggestedFieldPatch ?? {};

  return {
    ...composer,
    draft: {
      ...composer.draft,
      ...(toOptionalString(fieldPatch.summary)
        ? { summary: toOptionalString(fieldPatch.summary) }
        : {}),
      aliases: normalizeStringArray(fieldPatch.aliases) ?? composer.draft.aliases ?? [],
      sections: normalizeStringArray(fieldPatch.sections) ?? composer.draft.sections ?? [],
      riskTags: normalizeStringArray(fieldPatch.riskTags) ?? composer.draft.riskTags ?? [],
      disciplineTags:
        normalizeStringArray(fieldPatch.disciplineTags) ??
        composer.draft.disciplineTags ??
        [],
    },
    semanticLayerDraft: mergeSemanticLayerDraft(composer, {
      page_summary: toOptionalString(suggestion.suggestedSemanticLayer.pageSummary),
      retrieval_terms: normalizeStringArray(
        suggestion.suggestedSemanticLayer.retrievalTerms,
      ),
      retrieval_snippets: normalizeStringArray(
        suggestion.suggestedSemanticLayer.retrievalSnippets,
      ),
      table_semantics: toOptionalRecord(
        suggestion.suggestedSemanticLayer.tableSemantics,
      ),
      image_understanding: toOptionalRecord(
        suggestion.suggestedSemanticLayer.imageUnderstanding,
      ),
    }),
    warnings: Array.from(new Set([...composer.warnings, ...suggestion.warnings])),
  };
}

function applySemanticIntakeSuggestion(
  composer: KnowledgeLibraryLedgerComposer,
  suggestion: KnowledgeLibraryAiIntakeSuggestionViewModel,
): KnowledgeLibraryLedgerComposer {
  const nextSemanticDraft = suggestion.suggestedSemanticLayer
    ? {
        ...suggestion.suggestedSemanticLayer,
        revision_id:
          composer.persistedRevisionId ??
          suggestion.suggestedSemanticLayer.revision_id ??
          "local-draft",
        status: "pending_confirmation" as const,
      }
    : {
        revision_id: composer.persistedRevisionId ?? "local-draft",
        status: "pending_confirmation" as const,
        page_summary: composer.draft.summary ?? "",
        retrieval_terms: composer.draft.aliases ?? [],
        retrieval_snippets: [],
      };

  return {
    ...composer,
    draft: {
      ...composer.draft,
      summary:
        composer.draft.summary && composer.draft.summary.trim().length > 0
          ? composer.draft.summary
          : suggestion.suggestedDraft.summary,
      aliases:
        normalizeStringArray(suggestion.suggestedDraft.aliases) ??
        composer.draft.aliases ??
        [],
      riskTags:
        normalizeStringArray(suggestion.suggestedDraft.riskTags) ??
        composer.draft.riskTags ??
        [],
    },
    semanticLayerDraft: nextSemanticDraft,
    warnings: Array.from(new Set([...composer.warnings, ...suggestion.warnings])),
  };
}

function mergeSemanticLayerDraft(
  composer: KnowledgeLibraryLedgerComposer,
  patch: Partial<KnowledgeSemanticLayerViewModel>,
): KnowledgeSemanticLayerViewModel {
  const current = composer.semanticLayerDraft;

  return {
    revision_id: composer.persistedRevisionId ?? current?.revision_id ?? "local-draft",
    status: "pending_confirmation",
    page_summary: patch.page_summary ?? current?.page_summary,
    retrieval_terms: patch.retrieval_terms ?? current?.retrieval_terms,
    retrieval_snippets: patch.retrieval_snippets ?? current?.retrieval_snippets,
    table_semantics: patch.table_semantics ?? current?.table_semantics,
    image_understanding: patch.image_understanding ?? current?.image_understanding,
  };
}

function normalizeStringArray(
  values: readonly string[] | undefined,
): string[] | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function toOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : undefined;
}

function toOptionalRecord(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return value && Object.keys(value).length > 0 ? value : undefined;
}

function formatCount(value: number, suffix: string): string {
  return `${value}${suffix}`;
}
