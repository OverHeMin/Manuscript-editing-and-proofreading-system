import type { KnowledgeItemViewModel } from "../knowledge/index.ts";
import {
  createKnowledgeDraftRevision,
  createKnowledgeLibraryDraft,
  getKnowledgeAssetDetail,
  listKnowledgeLibraryAssets,
  submitKnowledgeRevisionForReview,
  updateKnowledgeRevisionDraft,
  type KnowledgeLibraryHttpClient,
} from "./knowledge-library-api.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeLibraryFilterState,
  KnowledgeLibraryWorkbenchViewModel,
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
}

export interface KnowledgeLibraryWorkbenchController {
  loadWorkbench(
    input?: LoadKnowledgeLibraryWorkbenchInput,
  ): Promise<KnowledgeLibraryWorkbenchViewModel>;
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
}

const defaultFilters: KnowledgeLibraryFilterState = {
  searchText: "",
  status: "all",
  knowledgeKind: "all",
};

export function createKnowledgeLibraryWorkbenchController(
  client: KnowledgeLibraryHttpClient,
): KnowledgeLibraryWorkbenchController {
  return {
    loadWorkbench(input = {}) {
      return loadKnowledgeLibraryWorkbench(client, input);
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
      const detail = (
        await submitKnowledgeRevisionForReview(client, input.revisionId)
      ).body;
      return loadKnowledgeLibraryWorkbench(client, {
        selectedAssetId: detail.asset.id,
        selectedRevisionId: detail.selected_revision.id,
        filters: input.filters,
      });
    },
  };
}

async function loadKnowledgeLibraryWorkbench(
  client: KnowledgeLibraryHttpClient,
  input: LoadKnowledgeLibraryWorkbenchInput = {},
): Promise<KnowledgeLibraryWorkbenchViewModel> {
  const library = (await listKnowledgeLibraryAssets(client)).body;
  const filters = createKnowledgeLibraryFilterState(input.filters);
  const visibleLibrary = applyKnowledgeLibraryFilters(library, filters);
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
  };
}

export function applyKnowledgeLibraryFilters(
  library: readonly KnowledgeItemViewModel[],
  filters: KnowledgeLibraryFilterState,
): KnowledgeItemViewModel[] {
  const query = filters.searchText.trim().toLowerCase();

  return library.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    if (filters.knowledgeKind !== "all" && item.knowledge_kind !== filters.knowledgeKind) {
      return false;
    }

    if (query.length === 0) {
      return true;
    }

    const fields = [
      item.title,
      item.canonical_text,
      item.summary ?? "",
      ...(item.aliases ?? []),
      ...(item.template_bindings ?? []),
    ];

    return fields.some((value) => value.toLowerCase().includes(query));
  });
}

function resolveSelectedSummary(
  library: readonly KnowledgeItemViewModel[],
  visibleLibrary: readonly KnowledgeItemViewModel[],
  preferredAssetId: string | null,
): KnowledgeItemViewModel | null {
  if (preferredAssetId) {
    return (
      library.find((item) => item.id === preferredAssetId) ??
      visibleLibrary.find((item) => item.id === preferredAssetId) ??
      null
    );
  }

  return visibleLibrary[0] ?? library[0] ?? null;
}
