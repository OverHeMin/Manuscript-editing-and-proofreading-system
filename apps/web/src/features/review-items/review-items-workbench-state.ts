import type { ReviewItemViewModel } from "./types.ts";

export interface ReviewItemsWorkbenchState {
  queue: ReviewItemViewModel[];
  activeItemId: string | null;
  selectedItem: ReviewItemViewModel | null;
}

export interface CreateReviewItemsWorkbenchStateInput {
  queue?: readonly ReviewItemViewModel[];
  activeItemId?: string | null;
}

export function createReviewItemsWorkbenchState(
  input: CreateReviewItemsWorkbenchStateInput = {},
): ReviewItemsWorkbenchState {
  const queue = [...(input.queue ?? [])];
  const selectedItem = resolveActiveReviewItem(
    queue,
    input.activeItemId ?? null,
  );

  return {
    queue,
    activeItemId: selectedItem?.id ?? null,
    selectedItem,
  };
}

export function resolveActiveReviewItem(
  queue: readonly ReviewItemViewModel[],
  activeItemId: string | null,
): ReviewItemViewModel | null {
  if (queue.length === 0) {
    return null;
  }

  if (!activeItemId) {
    return queue[0] ?? null;
  }

  return queue.find((item) => item.id === activeItemId) ?? queue[0] ?? null;
}

export function selectReviewItem(
  state: ReviewItemsWorkbenchState,
  itemId: string,
): ReviewItemsWorkbenchState {
  const selectedItem = resolveActiveReviewItem(state.queue, itemId);

  return {
    ...state,
    activeItemId: selectedItem?.id ?? null,
    selectedItem,
  };
}

export function reconcileReviewItemsQueue(
  state: Pick<ReviewItemsWorkbenchState, "activeItemId">,
  queue: readonly ReviewItemViewModel[],
  preferredItemId?: string | null,
): ReviewItemsWorkbenchState {
  return createReviewItemsWorkbenchState({
    queue,
    activeItemId: preferredItemId ?? state.activeItemId,
  });
}
