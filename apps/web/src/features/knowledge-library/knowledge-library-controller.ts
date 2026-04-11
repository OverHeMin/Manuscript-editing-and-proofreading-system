import {
  checkKnowledgeDuplicates,
  confirmKnowledgeSemanticLayer,
  createKnowledgeDraftRevision,
  createKnowledgeLibraryDraft,
  getKnowledgeAssetDetail,
  listKnowledgeLibraryAssets,
  type KnowledgeLibraryListItemResponseBody,
  regenerateKnowledgeSemanticLayer,
  replaceKnowledgeRevisionContentBlocks,
  type DuplicateKnowledgeAcknowledgementPayload,
  submitKnowledgeRevisionForReview,
  uploadKnowledgeImage,
  updateKnowledgeRevisionDraft,
  type KnowledgeLibraryHttpClient,
} from "./knowledge-library-api.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  DuplicateKnowledgeCheckInput,
  DuplicateKnowledgeMatchViewModel,
  DuplicateWarningAcknowledgementInput,
  KnowledgeContentBlockViewModel,
  KnowledgeLibraryFilterState,
  KnowledgeLibrarySummaryViewModel,
  KnowledgeLibraryWorkbenchViewModel,
  KnowledgeSemanticLayerInput,
  KnowledgeUploadInput,
  KnowledgeUploadViewModel,
  UpdateKnowledgeLibraryDraftInput,
} from "./types.ts";

export interface LoadKnowledgeLibraryWorkbenchInput {
  selectedAssetId?: string | null;
  selectedRevisionId?: string | null;
  filters?: Partial<KnowledgeLibraryFilterState>;
}

export interface KnowledgeLibraryMutationOptions {
  filters?: Partial<KnowledgeLibraryFilterState>;
}

export interface CreateKnowledgeLibraryDraftAndLoadInput
  extends CreateKnowledgeLibraryDraftInput,
    KnowledgeLibraryMutationOptions {}

export interface SaveKnowledgeLibraryDraftAndLoadInput
  extends KnowledgeLibraryMutationOptions {
  revisionId: string;
  input: UpdateKnowledgeLibraryDraftInput;
}

export interface CreateKnowledgeLibraryDerivedDraftAndLoadInput
  extends KnowledgeLibraryMutationOptions {
  assetId: string;
}

export interface SubmitKnowledgeLibraryDraftAndLoadInput
  extends KnowledgeLibraryMutationOptions {
  revisionId: string;
  duplicateAcknowledgement?: DuplicateWarningAcknowledgementInput;
}

export interface ReplaceKnowledgeRevisionContentBlocksAndLoadInput
  extends KnowledgeLibraryMutationOptions {
  revisionId: string;
  blocks: readonly KnowledgeContentBlockViewModel[];
}

export interface UpdateKnowledgeSemanticLayerAndLoadInput
  extends KnowledgeLibraryMutationOptions {
  revisionId: string;
  input?: KnowledgeSemanticLayerInput;
}

export interface KnowledgeLibraryWorkbenchController {
  loadWorkbench(
    input?: LoadKnowledgeLibraryWorkbenchInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
  checkDuplicates(
    input: DuplicateKnowledgeCheckInput,
  ): Promise<DuplicateKnowledgeMatchViewModel[]>;
  createDraftAndLoad(
    input: CreateKnowledgeLibraryDraftAndLoadInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
  saveDraftAndLoad(
    input: SaveKnowledgeLibraryDraftAndLoadInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
  createDerivedDraftAndLoad(
    input: CreateKnowledgeLibraryDerivedDraftAndLoadInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
  submitDraftAndLoad(
    input: SubmitKnowledgeLibraryDraftAndLoadInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
  replaceContentBlocksAndLoad(
    input: ReplaceKnowledgeRevisionContentBlocksAndLoadInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
  regenerateSemanticLayerAndLoad(
    input: UpdateKnowledgeSemanticLayerAndLoadInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
  confirmSemanticLayerAndLoad(
    input: UpdateKnowledgeSemanticLayerAndLoadInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
  uploadImage(input: KnowledgeUploadInput): Promise<KnowledgeUploadViewModel>;
}

const defaultFilters: KnowledgeLibraryFilterState = {
  searchText: "",
  queryMode: "keyword",
};

export function createKnowledgeLibraryWorkbenchController(
  client: KnowledgeLibraryHttpClient,
): KnowledgeLibraryWorkbenchController {
  return {
    loadWorkbench(input = {}) {
      return loadKnowledgeLibraryWorkbench(client, input);
    },
    async checkDuplicates(input) {
      return (await checkKnowledgeDuplicates(client, input)).body;
    },
    async createDraftAndLoad(input) {
      const { filters, ...draftInput } = input;
      const detail = (await createKnowledgeLibraryDraft(client, draftInput)).body;
      return loadKnowledgeLibraryWorkbench(client, {
        selectedAssetId: detail.asset.id,
        selectedRevisionId: detail.selected_revision.id,
        filters,
      });
    },
    async saveDraftAndLoad(input) {
      const detail = (
        await updateKnowledgeRevisionDraft(client, input.revisionId, input.input)
      ).body;
      return loadKnowledgeLibraryWorkbench(client, {
        selectedAssetId: detail.asset.id,
        selectedRevisionId: detail.selected_revision.id,
        filters: input.filters,
      });
    },
    async createDerivedDraftAndLoad(input) {
      const detail = (await createKnowledgeDraftRevision(client, input.assetId)).body;
      return loadKnowledgeLibraryWorkbench(client, {
        selectedAssetId: detail.asset.id,
        selectedRevisionId: detail.selected_revision.id,
        filters: input.filters,
      });
    },
    async submitDraftAndLoad(input) {
      const duplicateAcknowledgements = toDuplicateAcknowledgements(
        input.duplicateAcknowledgement,
      );
      const detail = (
        await submitKnowledgeRevisionForReview(client, input.revisionId, {
          duplicateAcknowledgements,
        })
      ).body;
      return loadKnowledgeLibraryWorkbench(client, {
        selectedAssetId: detail.asset.id,
        selectedRevisionId: detail.selected_revision.id,
        filters: input.filters,
      });
    },
    async replaceContentBlocksAndLoad(input) {
      const revision = (
        await replaceKnowledgeRevisionContentBlocks(client, input.revisionId, {
          blocks: input.blocks,
        })
      ).body;
      return loadKnowledgeLibraryWorkbench(client, {
        selectedAssetId: revision.asset_id,
        selectedRevisionId: revision.id,
        filters: input.filters,
      });
    },
    async regenerateSemanticLayerAndLoad(input) {
      const revision = (
        await regenerateKnowledgeSemanticLayer(client, input.revisionId, input.input)
      ).body;
      return loadKnowledgeLibraryWorkbench(client, {
        selectedAssetId: revision.asset_id,
        selectedRevisionId: revision.id,
        filters: input.filters,
      });
    },
    async confirmSemanticLayerAndLoad(input) {
      const revision = (
        await confirmKnowledgeSemanticLayer(client, input.revisionId, input.input)
      ).body;
      return loadKnowledgeLibraryWorkbench(client, {
        selectedAssetId: revision.asset_id,
        selectedRevisionId: revision.id,
        filters: input.filters,
      });
    },
    async uploadImage(input) {
      return (await uploadKnowledgeImage(client, input)).body;
    },
  };
}

async function loadKnowledgeLibraryWorkbench(
  client: KnowledgeLibraryHttpClient,
  input: LoadKnowledgeLibraryWorkbenchInput = {},
): Promise<KnowledgeLibraryWorkbenchViewModel> {
  const filters = createKnowledgeLibraryFilterState(input.filters);
  const libraryResponse = (
    await listKnowledgeLibraryAssets(client, {
      searchText: filters.searchText,
      queryMode: filters.queryMode,
    })
  ).body;
  const library = libraryResponse.items.map(mapKnowledgeLibraryListItem);
  const visibleLibrary = applyKnowledgeLibraryFilters(library);
  const selectedSummary = resolveSelectedSummary(
    library,
    visibleLibrary,
    input.selectedAssetId ?? null,
  );
  const detail =
    selectedSummary == null
      ? null
      : (
          await getKnowledgeAssetDetail(
            client,
            selectedSummary.id,
            input.selectedRevisionId ?? undefined,
          )
        ).body;

  return {
    library,
    visibleLibrary,
    filters,
    selectedAssetId: selectedSummary?.id ?? null,
    selectedRevisionId: detail?.selected_revision.id ?? null,
    selectedSummary,
    detail,
  };
}

export function createKnowledgeLibraryFilterState(
  overrides: Partial<KnowledgeLibraryFilterState> = {},
): KnowledgeLibraryFilterState {
  return {
    ...defaultFilters,
    ...overrides,
    searchText: overrides.searchText?.trim() ?? defaultFilters.searchText,
    queryMode: overrides.queryMode === "semantic" ? "semantic" : "keyword",
  };
}

export function applyKnowledgeLibraryFilters(
  library: readonly KnowledgeLibrarySummaryViewModel[],
): KnowledgeLibrarySummaryViewModel[] {
  return [...library];
}

function resolveSelectedSummary(
  library: readonly KnowledgeLibrarySummaryViewModel[],
  visibleLibrary: readonly KnowledgeLibrarySummaryViewModel[],
  preferredAssetId: string | null,
): KnowledgeLibrarySummaryViewModel | null {
  if (preferredAssetId) {
    return (
      library.find((item) => item.id === preferredAssetId) ??
      visibleLibrary.find((item) => item.id === preferredAssetId) ??
      null
    );
  }

  return visibleLibrary[0] ?? library[0] ?? null;
}

function mapKnowledgeLibraryListItem(
  item: KnowledgeLibraryListItemResponseBody,
): KnowledgeLibrarySummaryViewModel {
  return {
    id: item.asset_id,
    title: item.title,
    summary: item.summary,
    knowledge_kind: item.knowledge_kind,
    status: item.status,
    module_scope: item.module_scope,
    manuscript_types: item.manuscript_types,
    selected_revision_id: item.selected_revision_id,
    semantic_status: item.semantic_status,
    content_block_count: item.content_block_count,
    updated_at: item.updated_at,
  };
}

function toDuplicateAcknowledgements(
  input?: DuplicateWarningAcknowledgementInput,
): DuplicateKnowledgeAcknowledgementPayload[] | undefined {
  if (!input?.acknowledged) {
    return undefined;
  }

  const dedupedMatches = Array.from(
    new Map(
      input.matches
        .map((match) => ({
          matched_asset_id: match.matched_asset_id.trim(),
          matched_revision_id: match.matched_revision_id.trim(),
          severity: match.severity,
        }))
        .filter((match) => match.matched_asset_id.length > 0)
        .map((match) => [
          `${match.matched_asset_id}:${match.matched_revision_id}:${match.severity}`,
          match,
        ]),
    ).values(),
  );

  if (dedupedMatches.length === 0) {
    return undefined;
  }

  return dedupedMatches.map((match) => ({
    matched_asset_id: match.matched_asset_id,
    matched_revision_id: match.matched_revision_id,
    severity: match.severity,
  }));
}
