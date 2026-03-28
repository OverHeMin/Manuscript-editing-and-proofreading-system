import type {
  EvidenceLevel,
  KnowledgeKind,
  KnowledgeReviewQueueItemViewModel,
  KnowledgeSourceType,
} from "../knowledge/index.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";

export interface KnowledgeReviewFilterState {
  moduleScope: ManuscriptModule | "any" | "all";
  manuscriptType: ManuscriptType | "any" | "all";
  knowledgeKind: KnowledgeKind | "all";
  evidenceLevel: EvidenceLevel | "all";
  sourceType: KnowledgeSourceType | "all";
  searchText: string;
}

export interface KnowledgeReviewQueueRefreshPayload {
  queue: readonly KnowledgeReviewQueueItemViewModel[];
}

export interface KnowledgeReviewWorkbenchState {
  filters: KnowledgeReviewFilterState;
  queue: KnowledgeReviewQueueItemViewModel[];
  refreshPayloadQueue: KnowledgeReviewQueueItemViewModel[] | null;
  visibleQueue: KnowledgeReviewQueueItemViewModel[];
  activeItemId: string | null;
  selectedItem: KnowledgeReviewQueueItemViewModel | null;
}

export interface CreateKnowledgeReviewWorkbenchStateInput {
  queue?: readonly KnowledgeReviewQueueItemViewModel[];
  filters?: Partial<KnowledgeReviewFilterState>;
  activeItemId?: string | null;
  refreshPayloadQueue?: readonly KnowledgeReviewQueueItemViewModel[] | null;
}

export interface KnowledgeReviewQueueReconciliationResult {
  visibleQueue: KnowledgeReviewQueueItemViewModel[];
  activeItemId: string | null;
  selectedItem: KnowledgeReviewQueueItemViewModel | null;
}

const defaultKnowledgeReviewFilters: KnowledgeReviewFilterState = {
  moduleScope: "all",
  manuscriptType: "all",
  knowledgeKind: "all",
  evidenceLevel: "all",
  sourceType: "all",
  searchText: "",
};

export function createKnowledgeReviewFilterState(
  overrides: Partial<KnowledgeReviewFilterState> = {},
): KnowledgeReviewFilterState {
  return {
    ...defaultKnowledgeReviewFilters,
    ...overrides,
  };
}

export function createKnowledgeReviewWorkbenchState(
  input: CreateKnowledgeReviewWorkbenchStateInput = {},
): KnowledgeReviewWorkbenchState {
  const filters = createKnowledgeReviewFilterState(input.filters);
  const queue = [...(input.queue ?? [])];
  const refreshPayloadQueue =
    input.refreshPayloadQueue == null ? null : [...input.refreshPayloadQueue];
  const visibleQueue = applyKnowledgeReviewFilters(queue, filters);
  const selectedItem = resolveKnowledgeReviewActiveItem(
    visibleQueue,
    input.activeItemId ?? null,
  );

  return {
    filters,
    queue,
    refreshPayloadQueue,
    visibleQueue,
    activeItemId: selectedItem?.id ?? null,
    selectedItem,
  };
}

export function applyKnowledgeReviewFilters(
  queue: readonly KnowledgeReviewQueueItemViewModel[],
  filters: KnowledgeReviewFilterState,
): KnowledgeReviewQueueItemViewModel[] {
  const query = filters.searchText.trim().toLowerCase();

  return queue.filter((item) => {
    if (!matchesModuleScope(item, filters.moduleScope)) {
      return false;
    }

    if (!matchesManuscriptType(item, filters.manuscriptType)) {
      return false;
    }

    if (filters.knowledgeKind !== "all" && item.knowledge_kind !== filters.knowledgeKind) {
      return false;
    }

    if (filters.evidenceLevel !== "all" && item.evidence_level !== filters.evidenceLevel) {
      return false;
    }

    if (filters.sourceType !== "all" && item.source_type !== filters.sourceType) {
      return false;
    }

    if (query.length > 0 && !matchesSearchQuery(item, query)) {
      return false;
    }

    return true;
  });
}

export function receiveKnowledgeReviewQueueRefresh(
  state: KnowledgeReviewWorkbenchState,
  payload: KnowledgeReviewQueueRefreshPayload,
): KnowledgeReviewWorkbenchState {
  return {
    ...state,
    refreshPayloadQueue: [...payload.queue],
  };
}

export function reconcileKnowledgeReviewQueueRefresh(
  state: Pick<KnowledgeReviewWorkbenchState, "filters" | "activeItemId">,
  queue: readonly KnowledgeReviewQueueItemViewModel[],
): KnowledgeReviewQueueReconciliationResult {
  const visibleQueue = applyKnowledgeReviewFilters(queue, state.filters);
  const selectedItem = resolveKnowledgeReviewActiveItem(visibleQueue, state.activeItemId);

  return {
    visibleQueue,
    activeItemId: selectedItem?.id ?? null,
    selectedItem,
  };
}

export function resolveKnowledgeReviewQueueView(
  state: KnowledgeReviewWorkbenchState,
): KnowledgeReviewWorkbenchState {
  const nextQueueSource = state.refreshPayloadQueue ?? state.queue;
  const queue = [...nextQueueSource];
  const reconciled = reconcileKnowledgeReviewQueueRefresh(state, queue);

  return {
    ...state,
    queue,
    refreshPayloadQueue: null,
    visibleQueue: reconciled.visibleQueue,
    activeItemId: reconciled.activeItemId,
    selectedItem: reconciled.selectedItem,
  };
}

export function resolveKnowledgeReviewActiveItem(
  visibleQueue: readonly KnowledgeReviewQueueItemViewModel[],
  activeItemId: string | null,
): KnowledgeReviewQueueItemViewModel | null {
  if (visibleQueue.length === 0) {
    return null;
  }

  if (activeItemId == null) {
    return visibleQueue[0];
  }

  return visibleQueue.find((item) => item.id === activeItemId) ?? visibleQueue[0];
}

export function resolveNextActiveItemAfterReviewSuccess(
  visibleQueue: readonly KnowledgeReviewQueueItemViewModel[],
  reviewedItemId: string,
): string | null {
  if (visibleQueue.length === 0) {
    return null;
  }

  const currentIndex = visibleQueue.findIndex((item) => item.id === reviewedItemId);
  if (currentIndex < 0) {
    return visibleQueue[0]?.id ?? null;
  }

  // Business-critical reviewer behavior: keep flow continuous by preferring the next row.
  const nextItem = visibleQueue[currentIndex + 1] ?? visibleQueue[currentIndex - 1];
  return nextItem?.id ?? null;
}

export function applyKnowledgeReviewSuccess(
  state: KnowledgeReviewWorkbenchState,
  reviewedItemId: string,
): KnowledgeReviewWorkbenchState {
  const queue = state.queue.filter((item) => item.id !== reviewedItemId);
  const refreshPayloadQueue =
    state.refreshPayloadQueue?.filter((item) => item.id !== reviewedItemId) ?? null;
  const visibleQueue = applyKnowledgeReviewFilters(queue, state.filters);
  const activeItemId = resolveNextActiveItemAfterReviewSuccess(visibleQueue, reviewedItemId);
  const selectedItem = resolveKnowledgeReviewActiveItem(visibleQueue, activeItemId);

  return {
    ...state,
    queue,
    refreshPayloadQueue,
    visibleQueue,
    activeItemId: selectedItem?.id ?? null,
    selectedItem,
  };
}

export function isKnowledgeReviewWorkbenchEmpty(state: KnowledgeReviewWorkbenchState): boolean {
  return state.visibleQueue.length === 0 && state.refreshPayloadQueue == null;
}

function matchesModuleScope(
  item: KnowledgeReviewQueueItemViewModel,
  moduleScope: KnowledgeReviewFilterState["moduleScope"],
): boolean {
  if (moduleScope === "all") {
    return true;
  }

  if (moduleScope === "any") {
    return item.routing.module_scope === "any";
  }

  return item.routing.module_scope === "any" || item.routing.module_scope === moduleScope;
}

function matchesManuscriptType(
  item: KnowledgeReviewQueueItemViewModel,
  manuscriptType: KnowledgeReviewFilterState["manuscriptType"],
): boolean {
  if (manuscriptType === "all") {
    return true;
  }

  if (manuscriptType === "any") {
    return item.routing.manuscript_types === "any";
  }

  return (
    item.routing.manuscript_types === "any" ||
    item.routing.manuscript_types.includes(manuscriptType)
  );
}

function matchesSearchQuery(item: KnowledgeReviewQueueItemViewModel, query: string): boolean {
  const fields = [
    item.title,
    item.canonical_text,
    item.summary ?? "",
    ...(item.aliases ?? []),
    ...(item.routing.risk_tags ?? []),
    ...(item.routing.discipline_tags ?? []),
  ];

  return fields.some((value) => value.toLowerCase().includes(query));
}
