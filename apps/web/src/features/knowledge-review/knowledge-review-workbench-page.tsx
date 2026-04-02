import { useEffect, useRef, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import type { KnowledgeReviewQueueItemViewModel } from "../knowledge/index.ts";
import {
  createKnowledgeReviewWorkbenchController,
  type KnowledgeReviewDeskLoadResult,
  type KnowledgeReviewWorkbenchController,
} from "./workbench-controller.ts";
import {
  createKnowledgeReviewFilterState,
  createKnowledgeReviewWorkbenchState,
  isKnowledgeReviewFilterResultEmpty,
  isKnowledgeReviewQueueTrulyEmpty,
  type KnowledgeReviewFilterState,
} from "./workbench-state.ts";
import {
  KnowledgeReviewActionPanel,
  type KnowledgeReviewActionFeedback,
} from "./knowledge-review-action-panel.tsx";
import {
  KnowledgeReviewDetailPane,
  type KnowledgeReviewHistoryViewState,
} from "./knowledge-review-detail-pane.tsx";
import { KnowledgeReviewQueuePane } from "./knowledge-review-queue-pane.tsx";
import "./knowledge-review-workbench.css";

export interface KnowledgeReviewWorkbenchPageProps {
  controller?: KnowledgeReviewWorkbenchController;
  actorRole?: AuthRole;
  prefilledKnowledgeItemId?: string;
}

const defaultWorkbenchController = createKnowledgeReviewWorkbenchController(
  createBrowserHttpClient(),
);

export function KnowledgeReviewWorkbenchPage({
  controller,
  actorRole = "knowledge_reviewer",
  prefilledKnowledgeItemId,
}: KnowledgeReviewWorkbenchPageProps) {
  const workbenchController = controller ?? defaultWorkbenchController;
  const normalizedPrefilledKnowledgeItemId = prefilledKnowledgeItemId?.trim() ?? "";
  const [filters, setFilters] = useState(() => createKnowledgeReviewFilterState());
  const [desk, setDesk] = useState<KnowledgeReviewDeskLoadResult | null>(null);
  const [queueLoadStatus, setQueueLoadStatus] = useState<"initial" | "loading" | "ready" | "error">(
    "initial",
  );
  const [queueErrorMessage, setQueueErrorMessage] = useState<string | null>(null);
  const [stableSelectionSnapshot, setStableSelectionSnapshot] =
    useState<KnowledgeReviewQueueItemViewModel | null>(null);
  const [history, setHistory] = useState<KnowledgeReviewHistoryViewState>({
    knowledgeItemId: null,
    status: "idle",
    actions: [],
    errorMessage: null,
  });
  const [reviewNote, setReviewNote] = useState("");
  const [actionFeedback, setActionFeedback] = useState<KnowledgeReviewActionFeedback>({
    status: "idle",
    message: null,
  });
  const queueRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const selectedItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    void loadDesk({
      showLoading: true,
      activeItemId:
        normalizedPrefilledKnowledgeItemId.length > 0
          ? normalizedPrefilledKnowledgeItemId
          : undefined,
    });
  }, [normalizedPrefilledKnowledgeItemId, workbenchController]);

  const effectiveSelectedItem = resolveDetailSelection(
    queueLoadStatus,
    desk?.selectedItem ?? null,
    stableSelectionSnapshot,
  );
  const isUsingStableSnapshot =
    queueLoadStatus === "error" &&
    desk?.selectedItem == null &&
    stableSelectionSnapshot != null;

  useEffect(() => {
    if (effectiveSelectedItem == null) {
      selectedItemIdRef.current = null;
      setHistory({
        knowledgeItemId: null,
        status: "idle",
        actions: [],
        errorMessage: null,
      });
      return;
    }

    if (queueLoadStatus === "error" && isUsingStableSnapshot) {
      setHistory((current) =>
        current.knowledgeItemId === effectiveSelectedItem.id
          ? current
          : {
              knowledgeItemId: effectiveSelectedItem.id,
              status: "idle",
              actions: [],
              errorMessage: null,
            },
      );
      return;
    }

    void loadHistory(effectiveSelectedItem.id);
  }, [effectiveSelectedItem?.id, isUsingStableSnapshot, queueLoadStatus]);

  async function loadDesk(input: {
    filters?: Partial<KnowledgeReviewFilterState>;
    showLoading?: boolean;
    activeItemId?: string;
  }): Promise<void> {
    const requestId = ++queueRequestIdRef.current;
    if (input.showLoading ?? true) {
      setQueueLoadStatus("loading");
    }
    setQueueErrorMessage(null);

    try {
      const nextDesk = await workbenchController.loadDesk({
        state: desk?.state,
        filters: input.filters,
        activeItemId: input.activeItemId,
      });
      if (requestId !== queueRequestIdRef.current) {
        return;
      }

      const nextSelectedId = nextDesk.selectedItem?.id ?? null;
      if (selectedItemIdRef.current !== nextSelectedId) {
        setReviewNote("");
      }
      selectedItemIdRef.current = nextSelectedId;
      setDesk(nextDesk);
      setFilters(nextDesk.state.filters);
      setQueueLoadStatus("ready");
      setQueueErrorMessage(null);
      if (nextDesk.selectedItem) {
        setStableSelectionSnapshot(nextDesk.selectedItem);
      }
    } catch (error) {
      if (requestId !== queueRequestIdRef.current) {
        return;
      }

      setQueueLoadStatus("error");
      setQueueErrorMessage(toErrorMessage(error, "Queue load failed"));
    }
  }

  async function loadHistory(knowledgeItemId: string): Promise<void> {
    const requestId = ++historyRequestIdRef.current;
    setHistory((current) => ({
      knowledgeItemId,
      status: "loading",
      actions: current.knowledgeItemId === knowledgeItemId ? current.actions : [],
      errorMessage: null,
    }));

    try {
      const nextHistory = await workbenchController.loadHistory({ knowledgeItemId });
      if (requestId !== historyRequestIdRef.current) {
        return;
      }

      setHistory({
        knowledgeItemId: nextHistory.knowledgeItemId,
        status: "ready",
        actions: nextHistory.actions,
        errorMessage: null,
      });
    } catch (error) {
      if (requestId !== historyRequestIdRef.current) {
        return;
      }

      setHistory((current) => ({
        knowledgeItemId,
        status: "error",
        actions: current.knowledgeItemId === knowledgeItemId ? current.actions : [],
        errorMessage: toErrorMessage(error, "History load failed"),
      }));
    }
  }

  function handleSearchTextChange(searchText: string) {
    setFilters((current) => ({ ...current, searchText }));
    setActionFeedback({ status: "idle", message: null });
    void loadDesk({
      filters: { searchText },
      showLoading: true,
    });
  }

  function handleKnowledgeKindChange(knowledgeKind: KnowledgeReviewFilterState["knowledgeKind"]) {
    setFilters((current) => ({ ...current, knowledgeKind }));
    setActionFeedback({ status: "idle", message: null });
    void loadDesk({
      filters: { knowledgeKind },
      showLoading: true,
    });
  }

  function handleModuleScopeChange(moduleScope: KnowledgeReviewFilterState["moduleScope"]) {
    setFilters((current) => ({ ...current, moduleScope }));
    setActionFeedback({ status: "idle", message: null });
    void loadDesk({
      filters: { moduleScope },
      showLoading: true,
    });
  }

  function handleSelectItem(itemId: string) {
    if (!desk) {
      return;
    }

    const nextState = createKnowledgeReviewWorkbenchState({
      queue: desk.state.queue,
      filters: desk.state.filters,
      activeItemId: itemId,
      refreshPayloadQueue: desk.state.refreshPayloadQueue,
    });
    selectedItemIdRef.current = nextState.selectedItem?.id ?? null;
    setReviewNote("");
    setActionFeedback({ status: "idle", message: null });
    setDesk({
      ...desk,
      visibleQueue: nextState.visibleQueue,
      selectedItem: nextState.selectedItem,
      state: nextState,
    });
  }

  async function handleApprove() {
    await runAction("approve");
  }

  async function handleReject() {
    await runAction("reject");
  }

  async function runAction(actionType: "approve" | "reject"): Promise<void> {
    const selected = resolveDetailSelection(
      queueLoadStatus,
      desk?.selectedItem ?? null,
      stableSelectionSnapshot,
    );
    if (!desk || !selected) {
      return;
    }

    setActionFeedback({
      status: "loading",
      message: actionType === "approve" ? "Submitting approval..." : "Submitting rejection...",
    });

    const result =
      actionType === "approve"
        ? await workbenchController.approveItem({
            knowledgeItemId: selected.id,
            actorRole,
            reviewNote,
            state: desk.state,
          })
        : await workbenchController.rejectItem({
            knowledgeItemId: selected.id,
            actorRole,
            reviewNote,
            state: desk.state,
          });

    if (result.status === "error") {
      setReviewNote(result.reviewNote);
      setActionFeedback({
        status: "error",
        message: toErrorMessage(result.error, "Review action failed"),
      });
      return;
    }

    selectedItemIdRef.current = result.desk.selectedItem?.id ?? null;
    setReviewNote(result.reviewNote);
    setDesk(result.desk);
    setFilters(result.desk.state.filters);
    setQueueLoadStatus("ready");
    setQueueErrorMessage(null);
    if (result.desk.selectedItem) {
      setStableSelectionSnapshot(result.desk.selectedItem);
    }

    if (result.history) {
      setHistory({
        knowledgeItemId: result.history.knowledgeItemId,
        status: "ready",
        actions: result.history.actions,
        errorMessage: null,
      });
    } else {
      setHistory({
        knowledgeItemId: null,
        status: "idle",
        actions: [],
        errorMessage: null,
      });
    }

    const autoAdvanceUnresolved =
      result.desk.visibleQueue.length > 0 && result.desk.selectedItem == null;
    if (autoAdvanceUnresolved) {
      setActionFeedback({
        status: "manual_recovery",
        message:
          "Review saved, but the next visible item could not be resolved. Select one manually or reload queue.",
      });
      return;
    }

    setActionFeedback({
      status: "success",
      message: actionType === "approve" ? "Knowledge item approved." : "Knowledge item rejected.",
    });
  }

  function handleRetryQueue() {
    void loadDesk({
      showLoading: true,
      filters: {},
    });
  }

  function handleRetryHistory() {
    const retryTarget = resolveDetailSelection(
      queueLoadStatus,
      desk?.selectedItem ?? null,
      stableSelectionSnapshot,
    );
    if (!retryTarget) {
      return;
    }

    void loadHistory(retryTarget.id);
  }

  function handleManualRecovery() {
    setActionFeedback({ status: "idle", message: null });
    void loadDesk({
      showLoading: true,
      filters: {},
    });
  }

  const visibleQueue = desk?.visibleQueue ?? [];
  const totalQueueCount = desk?.queue.length ?? 0;
  const isQueueEmpty = desk ? isKnowledgeReviewQueueTrulyEmpty(desk.state) : false;
  const isNoResults = desk ? isKnowledgeReviewFilterResultEmpty(desk.state) : false;
  const displayedHistory = resolveDisplayedHistory(history, effectiveSelectedItem?.id ?? null);

  return (
    <main className="knowledge-review-workbench">
      <KnowledgeReviewQueuePane
        filters={{
          searchText: filters.searchText,
          knowledgeKind: filters.knowledgeKind,
          moduleScope: filters.moduleScope,
        }}
        queue={visibleQueue}
        totalQueueCount={totalQueueCount}
        activeItemId={effectiveSelectedItem?.id ?? null}
        isLoading={queueLoadStatus === "initial" || queueLoadStatus === "loading"}
        loadErrorMessage={queueErrorMessage}
        isQueueEmpty={isQueueEmpty}
        isNoResults={isNoResults}
        onSearchTextChange={handleSearchTextChange}
        onKnowledgeKindChange={handleKnowledgeKindChange}
        onModuleScopeChange={handleModuleScopeChange}
        onSelectItem={handleSelectItem}
        onRetryQueue={handleRetryQueue}
      />

      <section className="knowledge-review-main-column">
        <KnowledgeReviewDetailPane
          item={effectiveSelectedItem}
          history={displayedHistory.history}
          isUsingStableSnapshot={isUsingStableSnapshot}
          historyScopeNote={displayedHistory.scopeNote}
          onRetryHistory={handleRetryHistory}
        />
        <KnowledgeReviewActionPanel
          selectedItemId={effectiveSelectedItem?.id ?? null}
          reviewNote={reviewNote}
          feedback={actionFeedback}
          onReviewNoteChange={setReviewNote}
          onApprove={handleApprove}
          onReject={handleReject}
          onManualRecovery={handleManualRecovery}
        />
      </section>
    </main>
  );
}

function resolveDetailSelection(
  queueLoadStatus: "initial" | "loading" | "ready" | "error",
  liveSelection: KnowledgeReviewQueueItemViewModel | null,
  stableSelectionSnapshot: KnowledgeReviewQueueItemViewModel | null,
): KnowledgeReviewQueueItemViewModel | null {
  if (queueLoadStatus === "error") {
    // Keep desk continuity during queue outage to avoid forcing context loss.
    return liveSelection ?? stableSelectionSnapshot;
  }

  return liveSelection;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback}: ${error.message}`;
  }

  return fallback;
}

function resolveDisplayedHistory(
  history: KnowledgeReviewHistoryViewState,
  displayedItemId: string | null,
): {
  history: KnowledgeReviewHistoryViewState;
  scopeNote: string | null;
} {
  if (displayedItemId == null) {
    return {
      history: {
        knowledgeItemId: null,
        status: "idle",
        actions: [],
        errorMessage: null,
      },
      scopeNote: null,
    };
  }

  if (history.knowledgeItemId === displayedItemId) {
    return {
      history,
      scopeNote: null,
    };
  }

  return {
    history: {
      knowledgeItemId: displayedItemId,
      status: "idle",
      actions: [],
      errorMessage: null,
    },
    scopeNote:
      "History currently tracks a different item. Use Retry history to load events for the item shown above.",
  };
}
