import type { AuthRole } from "../auth/index.ts";
import {
  approveKnowledgeItem,
  approveKnowledgeRevision,
  listKnowledgeReviewActions,
  listKnowledgeReviewActionsByRevision,
  listPendingKnowledgeReviewItems,
  rejectKnowledgeItem,
  rejectKnowledgeRevision,
  type KnowledgeItemViewModel,
  type KnowledgeHttpClient,
  type KnowledgeReviewActionViewModel,
  type KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";
import { getKnowledgeAssetDetail } from "../knowledge-library/knowledge-library-api.ts";
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
  activeItemId?: string | null;
}

export interface KnowledgeReviewDeskLoadResult {
  queue: KnowledgeReviewQueueItemViewModel[];
  visibleQueue: KnowledgeReviewQueueItemViewModel[];
  selectedItem: KnowledgeReviewQueueItemViewModel | null;
  state: KnowledgeReviewWorkbenchState;
}

export interface LoadKnowledgeReviewHistoryInput {
  revisionId: string;
}

export interface KnowledgeReviewHistoryLoadResult {
  revisionId: string;
  actions: KnowledgeReviewActionViewModel[];
}

export interface KnowledgeReviewItemActionInput {
  revisionId: string;
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
      historyRevisionId: string | null;
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
  const queue = await Promise.all(
    request.body.map((item) => enrichKnowledgeReviewQueueItem(client, item)),
  );
  const baselineState =
    input.state ??
    createKnowledgeReviewWorkbenchState({
      activeItemId: input.activeItemId ?? null,
    });
  const nextState: KnowledgeReviewWorkbenchState = {
    ...baselineState,
    filters: createKnowledgeReviewFilterState({
      ...baselineState.filters,
      ...(input.filters ?? {}),
    }),
    activeItemId: input.activeItemId ?? baselineState.activeItemId,
  };
  const refreshedState = receiveKnowledgeReviewQueueRefresh(nextState, {
    queue,
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
  const request = await loadKnowledgeReviewActions(client, input.revisionId);

  return {
    revisionId: input.revisionId,
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
      approveKnowledgeRevision(
        httpClient,
        actionInput.revisionId,
        actionInput.actorRole,
        actionInput.reviewNote,
      ),
    (httpClient, actionInput) =>
      approveKnowledgeItem(
        httpClient,
        actionInput.revisionId,
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
      rejectKnowledgeRevision(
        httpClient,
        actionInput.revisionId,
        actionInput.actorRole,
        actionInput.reviewNote,
      ),
    (httpClient, actionInput) =>
      rejectKnowledgeItem(
        httpClient,
        actionInput.revisionId,
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
  fallbackAction?: (
    client: KnowledgeHttpClient,
    input: KnowledgeReviewItemActionInput,
  ) => Promise<unknown>,
): Promise<KnowledgeReviewItemActionResult> {
  try {
    await runKnowledgeReviewMutation(client, input, action, fallbackAction);
    const postSuccessState =
      input.state == null
        ? undefined
        : applyKnowledgeReviewSuccess(input.state, input.revisionId);
    const desk = await loadKnowledgeReviewDesk(client, {
      state: postSuccessState,
    });
    const historyRevisionId = desk.selectedItem?.revision_id ?? null;
    const history =
      historyRevisionId == null
        ? null
        : await loadKnowledgeReviewHistory(client, {
            revisionId: historyRevisionId,
          });

    return {
      status: "success",
      reviewNote: "",
      desk,
      history,
      historyRevisionId,
    };
  } catch (error) {
    return {
      status: "error",
      reviewNote: input.reviewNote,
      error,
    };
  }
}

async function enrichKnowledgeReviewQueueItem(
  client: KnowledgeHttpClient,
  item: KnowledgeReviewQueueSourceItem,
): Promise<KnowledgeReviewQueueItemViewModel> {
  if (isNormalizedQueueItem(item)) {
    return item;
  }

  try {
    const detail = (await getKnowledgeAssetDetail(client, item.id)).body;
    return mapKnowledgeReviewDetailToQueueItem(detail);
  } catch (error) {
    if (isNotFoundLikeError(error)) {
      return mapLegacyKnowledgeRecordToQueueItem(item);
    }

    throw error;
  }
}

type KnowledgeReviewQueueSourceItem =
  | KnowledgeItemViewModel
  | KnowledgeReviewQueueItemViewModel;

function isNormalizedQueueItem(
  item: KnowledgeReviewQueueSourceItem,
): item is KnowledgeReviewQueueItemViewModel {
  return (
    typeof (item as Partial<KnowledgeReviewQueueItemViewModel>).asset_id === "string" &&
    typeof (item as Partial<KnowledgeReviewQueueItemViewModel>).revision_id === "string"
  );
}

function mapKnowledgeReviewDetailToQueueItem(
  detail: Awaited<ReturnType<typeof getKnowledgeAssetDetail>>["body"],
): KnowledgeReviewQueueItemViewModel {
  const revision = detail.selected_revision;

  return {
    id: revision.id,
    asset_id: detail.asset.id,
    revision_id: revision.id,
    title: revision.title,
    canonical_text: revision.canonical_text,
    summary: revision.summary,
    knowledge_kind: revision.knowledge_kind,
    status: revision.status,
    routing: revision.routing,
    evidence_level: revision.evidence_level,
    source_type: revision.source_type,
    source_link: revision.source_link,
    effective_at: revision.effective_at,
    expires_at: revision.expires_at,
    aliases: revision.aliases,
    template_bindings: revision.bindings.map((binding) => binding.binding_target_id),
  };
}

function mapLegacyKnowledgeRecordToQueueItem(
  item: KnowledgeItemViewModel,
): KnowledgeReviewQueueItemViewModel {
  return {
    ...item,
    asset_id: item.id,
    revision_id: item.id,
  };
}

async function loadKnowledgeReviewActions(
  client: KnowledgeHttpClient,
  revisionOrKnowledgeItemId: string,
) {
  try {
    return await listKnowledgeReviewActionsByRevision(client, revisionOrKnowledgeItemId);
  } catch (error) {
    if (!isNotFoundLikeError(error)) {
      throw error;
    }

    return listKnowledgeReviewActions(client, revisionOrKnowledgeItemId);
  }
}

async function runKnowledgeReviewMutation(
  client: KnowledgeHttpClient,
  input: KnowledgeReviewItemActionInput,
  action: (
    client: KnowledgeHttpClient,
    input: KnowledgeReviewItemActionInput,
  ) => Promise<unknown>,
  fallbackAction?: (
    client: KnowledgeHttpClient,
    input: KnowledgeReviewItemActionInput,
  ) => Promise<unknown>,
) {
  try {
    return await action(client, input);
  } catch (error) {
    if (!isNotFoundLikeError(error) || fallbackAction == null) {
      throw error;
    }

    return fallbackAction(client, input);
  }
}

function isNotFoundLikeError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error != null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  ) {
    return true;
  }

  return error instanceof Error && /HTTP 404\b/.test(error.message);
}
