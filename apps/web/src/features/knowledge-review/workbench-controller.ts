import type { AuthRole } from "../auth/index.ts";
import {
  approveKnowledgeRevision,
  listKnowledgeReviewActionsByRevision,
  listPendingKnowledgeReviewItems,
  rejectKnowledgeRevision,
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
    request.body.map((item) => enrichKnowledgeReviewQueueItem(client, item.id)),
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
  const request = await listKnowledgeReviewActionsByRevision(client, input.revisionId);

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
  assetId: string,
): Promise<KnowledgeReviewQueueItemViewModel> {
  const detail = (await getKnowledgeAssetDetail(client, assetId)).body;
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
