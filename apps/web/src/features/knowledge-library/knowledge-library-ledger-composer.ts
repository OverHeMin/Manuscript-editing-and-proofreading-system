import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeContentBlockViewModel,
  KnowledgeLibraryAiIntakeSuggestionViewModel,
  KnowledgeSemanticLayerViewModel,
} from "./types.ts";

export interface KnowledgeLibraryLedgerComposer {
  mode: "new_local" | "existing_revision";
  persistedAssetId: string | null;
  persistedRevisionId: string | null;
  aiIntakeSourceText: string;
  draft: CreateKnowledgeLibraryDraftInput;
  contentBlocksDraft: KnowledgeContentBlockViewModel[];
  semanticLayerDraft?: KnowledgeSemanticLayerViewModel;
  warnings: string[];
}

export function createEmptyLedgerComposer(): KnowledgeLibraryLedgerComposer {
  return {
    mode: "new_local",
    persistedAssetId: null,
    persistedRevisionId: null,
    aiIntakeSourceText: "",
    draft: {
      title: "",
      canonicalText: "",
      knowledgeKind: "reference",
      moduleScope: "any",
      manuscriptTypes: "any",
      evidenceLevel: "unknown",
      sourceType: "other",
    },
    contentBlocksDraft: [],
    semanticLayerDraft: undefined,
    warnings: [],
  };
}

export function createLedgerComposerFromDraftPrefill(
  draft: CreateKnowledgeLibraryDraftInput,
): KnowledgeLibraryLedgerComposer {
  const composer = createEmptyLedgerComposer();
  return {
    ...composer,
    draft: {
      ...composer.draft,
      ...structuredClone(draft),
    },
  };
}

export function applyAiIntakeSuggestion(
  composer: KnowledgeLibraryLedgerComposer,
  suggestion: KnowledgeLibraryAiIntakeSuggestionViewModel,
): KnowledgeLibraryLedgerComposer {
  return {
    ...composer,
    aiIntakeSourceText: composer.aiIntakeSourceText,
    draft: {
      ...composer.draft,
      ...suggestion.suggestedDraft,
    },
    contentBlocksDraft: [...suggestion.suggestedContentBlocks],
    semanticLayerDraft: suggestion.suggestedSemanticLayer
      ? {
          ...suggestion.suggestedSemanticLayer,
          revision_id:
            composer.persistedRevisionId ??
            suggestion.suggestedSemanticLayer.revision_id ??
            "local-draft",
          status: "pending_confirmation",
        }
      : composer.semanticLayerDraft,
    warnings: [...suggestion.warnings],
  };
}

export function buildCreateDraftInput(
  composer: KnowledgeLibraryLedgerComposer,
): CreateKnowledgeLibraryDraftInput {
  return {
    ...composer.draft,
  };
}

export function formatLedgerTagText(values: readonly string[] | undefined): string {
  return (values ?? []).join("、");
}

export function parseLedgerTagText(value: string): string[] | undefined {
  const normalized = value
    .split(/[、,，;\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}
