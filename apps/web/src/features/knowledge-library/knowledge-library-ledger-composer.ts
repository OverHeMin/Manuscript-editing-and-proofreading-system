import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeContentBlockViewModel,
  KnowledgeLibraryAiIntakeSuggestionViewModel,
  KnowledgeRevisionViewModel,
  KnowledgeSemanticLayerViewModel,
} from "./types.ts";
import type {
  KnowledgeCandidatePrefill,
  KnowledgeCandidateSourceSummary,
} from "./knowledge-candidate-prefill.ts";

export interface KnowledgeLibraryLedgerComposer {
  mode: "new_local" | "existing_revision";
  persistedAssetId: string | null;
  persistedRevisionId: string | null;
  aiIntakeSourceText: string;
  draft: CreateKnowledgeLibraryDraftInput;
  sourceLearningCandidateId?: string;
  sourceSummary?: KnowledgeCandidateSourceSummary;
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

export function createLedgerComposerFromKnowledgeCandidatePrefill(
  prefill: KnowledgeCandidatePrefill,
): KnowledgeLibraryLedgerComposer {
  return {
    ...createLedgerComposerFromDraftPrefill(prefill.draft),
    sourceLearningCandidateId: prefill.sourceLearningCandidateId,
    sourceSummary: prefill.sourceSummary,
    contentBlocksDraft: [...prefill.contentBlocks],
    semanticLayerDraft: prefill.semanticLayer,
  };
}

export function createLedgerComposerFromKnowledgeRevision(
  selectedRevision: KnowledgeRevisionViewModel,
  selectedAssetId: string | null,
): KnowledgeLibraryLedgerComposer {
  return {
    mode: "existing_revision",
    persistedAssetId: selectedAssetId,
    persistedRevisionId: selectedRevision.id,
    aiIntakeSourceText: selectedRevision.canonical_text,
    sourceLearningCandidateId: selectedRevision.source_learning_candidate_id,
    draft: {
      title: selectedRevision.title,
      canonicalText: selectedRevision.canonical_text,
      summary: selectedRevision.summary,
      knowledgeKind: selectedRevision.knowledge_kind,
      moduleScope: selectedRevision.routing.module_scope,
      manuscriptTypes: selectedRevision.routing.manuscript_types,
      sections: selectedRevision.routing.sections,
      riskTags: selectedRevision.routing.risk_tags,
      disciplineTags: selectedRevision.routing.discipline_tags,
      evidenceLevel: selectedRevision.evidence_level,
      sourceType: selectedRevision.source_type,
      sourceLink: selectedRevision.source_link,
      aliases: selectedRevision.aliases,
      sourceLearningCandidateId: selectedRevision.source_learning_candidate_id,
      effectiveAt: selectedRevision.effective_at,
      expiresAt: selectedRevision.expires_at,
      bindings: selectedRevision.bindings.map((binding) => ({
        bindingKind: binding.binding_kind,
        bindingTargetId: binding.binding_target_id,
        bindingTargetLabel: binding.binding_target_label,
      })),
    },
    contentBlocksDraft: [...selectedRevision.content_blocks],
    semanticLayerDraft: selectedRevision.semantic_layer,
    warnings: [],
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
