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
    draft: {
      title: "",
      canonicalText: "",
      knowledgeKind: "rule",
      moduleScope: "any",
      manuscriptTypes: "any",
    },
    contentBlocksDraft: [],
    semanticLayerDraft: undefined,
    warnings: [],
  };
}

export function applyAiIntakeSuggestion(
  composer: KnowledgeLibraryLedgerComposer,
  suggestion: KnowledgeLibraryAiIntakeSuggestionViewModel,
): KnowledgeLibraryLedgerComposer {
  return {
    ...composer,
    draft: {
      ...composer.draft,
      ...suggestion.suggestedDraft,
    },
    contentBlocksDraft: [...suggestion.suggestedContentBlocks],
    semanticLayerDraft: suggestion.suggestedSemanticLayer,
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
