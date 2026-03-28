import type { AuthRole } from "../auth/index.ts";
import {
  approveKnowledgeItem,
  listKnowledgeReviewActions,
  listPendingKnowledgeReviewItems,
  rejectKnowledgeItem,
  type KnowledgeHttpClient,
  type KnowledgeReviewActionViewModel,
  type KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";
import {
  applyKnowledgeReviewSuccess,
  createKnowledgeReviewFilterState,
  createKnowledgeReviewWorkbenchState,
  receiveKnowledgeReviewQueueRefresh,
  resolveKnowledgeReviewQueueView,
  type KnowledgeReviewFilterState,
  type KnowledgeReviewWorkbenchState,
} from "./workbench-state.ts";

export interface LoadKnowledgeReviewDeskInput {
  state?: KnowledgeReviewWorkbenchState;
  filters?: Partial<KnowledgeReviewFilterState>;
}

export interface KnowledgeReviewDeskLoadResult {
  queue: KnowledgeReviewQueueItemViewModel[];
  visibleQueue: KnowledgeReviewQueueItemViewModel[];
  selectedItem: KnowledgeReviewQueueItemViewModel | null;
  state: KnowledgeReviewWorkbenchState;
}

export interface LoadKnowledgeReviewHistoryInput {
  knowledgeItemId: string;
}

export interface KnowledgeReviewHistoryLoadResult {
  knowledgeItemId: string;
  actions: KnowledgeReviewActionViewModel[];
}

export interface KnowledgeReviewItemActionInput {
  knowledgeItemId: string;
  actorRole: AuthRole;
  reviewNote: string;
  state?: KnowledgeReviewWorkbenchState;
}

export type KnowledgeReviewItemActionResult =
  | {
      status: "success";
      reviewNote: "";
      desk: KnowledgeReviewDeskLoadResult;
      history: KnowledgeReviewHistoryLoadResult | null;
      historyKnowledgeItemId: string | null;
    }
  | {
      status: "error";
      reviewNote: string;
      error: unknown;
    };

export interface KnowledgeReviewWorkbenchController {
  loadDesk(input?: LoadKnowledgeReviewDeskInput): Promise<KnowledgeReviewDeskLoadResult>;
  loadHistory(input: LoadKnowledgeReviewHistoryInput): Promise<KnowledgeReviewHistoryLoadResult>;
  approveItem(input: KnowledgeReviewItemActionInput): Promise<KnowledgeReviewItemActionResult>;
  rejectItem(input: KnowledgeReviewItemActionInput): Promise<KnowledgeReviewItemActionResult>;
}

export function createKnowledgeReviewWorkbenchController(
  client: KnowledgeHttpClient,
): KnowledgeReviewWorkbenchController {
  return {
    loadDesk(input = {}) {
      return loadKnowledgeReviewDesk(client, input);
    },
    loadHistory(input) {
      return loadKnowledgeReviewHistory(client, input);
    },
    approveItem(input) {
      return approveKnowledgeReviewItem(client, input);
    },
    rejectItem(input) {
      return rejectKnowledgeReviewItem(client, input);
    },
  };
}

export async function loadKnowledgeReviewDesk(
  client: KnowledgeHttpClient,
  input: LoadKnowledgeReviewDeskInput = {},
): Promise<KnowledgeReviewDeskLoadResult> {
  const request = await listPendingKnowledgeReviewItems(client);
  const baselineState = input.state ?? createKnowledgeReviewWorkbenchState();
  const nextState: KnowledgeReviewWorkbenchState = {
    ...baselineState,
    filters: createKnowledgeReviewFilterState({
      ...baselineState.filters,
      ...(input.filters ?? {}),
    }),
  };
  const refreshedState = receiveKnowledgeReviewQueueRefresh(nextState, {
    queue: request.body,
  });
  const resolvedState = resolveKnowledgeReviewQueueView(refreshedState);

  return {
    queue: resolvedState.queue,
    visibleQueue: resolvedState.visibleQueue,
    selectedItem: resolvedState.selectedItem,
    state: resolvedState,
  };
}

export async function loadKnowledgeReviewHistory(
  client: KnowledgeHttpClient,
  input: LoadKnowledgeReviewHistoryInput,
): Promise<KnowledgeReviewHistoryLoadResult> {
  const request = await listKnowledgeReviewActions(client, input.knowledgeItemId);

  return {
    knowledgeItemId: input.knowledgeItemId,
    actions: request.body,
  };
}

export async function approveKnowledgeReviewItem(
  client: KnowledgeHttpClient,
  input: KnowledgeReviewItemActionInput,
): Promise<KnowledgeReviewItemActionResult> {
  return runKnowledgeReviewAction(
    client,
    input,
    (httpClient, actionInput) =>
      approveKnowledgeItem(
        httpClient,
        actionInput.knowledgeItemId,
        actionInput.actorRole,
        actionInput.reviewNote,
      ),
  );
}

export async function rejectKnowledgeReviewItem(
  client: KnowledgeHttpClient,
  input: KnowledgeReviewItemActionInput,
): Promise<KnowledgeReviewItemActionResult> {
  return runKnowledgeReviewAction(
    client,
    input,
    (httpClient, actionInput) =>
      rejectKnowledgeItem(
        httpClient,
        actionInput.knowledgeItemId,
        actionInput.actorRole,
        actionInput.reviewNote,
      ),
  );
}

async function runKnowledgeReviewAction(
  client: KnowledgeHttpClient,
  input: KnowledgeReviewItemActionInput,
  action: (
    client: KnowledgeHttpClient,
    input: KnowledgeReviewItemActionInput,
  ) => Promise<unknown>,
): Promise<KnowledgeReviewItemActionResult> {
  try {
    await action(client, input);
    const postSuccessState =
      input.state == null
        ? undefined
        : applyKnowledgeReviewSuccess(input.state, input.knowledgeItemId);
    const desk = await loadKnowledgeReviewDesk(client, {
      state: postSuccessState,
    });
    const historyKnowledgeItemId = desk.selectedItem?.id ?? null;
    const history =
      historyKnowledgeItemId == null
        ? null
        : await loadKnowledgeReviewHistory(client, {
            knowledgeItemId: historyKnowledgeItemId,
          });

    return {
      status: "success",
      reviewNote: "",
      desk,
      history,
      historyKnowledgeItemId,
    };
  } catch (error) {
    return {
      status: "error",
      reviewNote: input.reviewNote,
      error,
    };
  }
}
