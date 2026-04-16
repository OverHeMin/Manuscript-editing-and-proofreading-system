import { useEffect, useRef, useState } from "react";
import { WorkbenchCoreStrip } from "../../app/workbench-core-strip.tsx";
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

if (typeof document !== "undefined") {
  void import("./knowledge-review-workbench.css");
}

export interface KnowledgeReviewWorkbenchPageProps {
  controller?: KnowledgeReviewWorkbenchController;
  actorRole?: AuthRole;
  prefilledRevisionId?: string;
  prefilledAssetId?: string;
}

const defaultWorkbenchController = createKnowledgeReviewWorkbenchController(
  createBrowserHttpClient(),
);

export function KnowledgeReviewWorkbenchPage({
  controller,
  actorRole = "knowledge_reviewer",
  prefilledRevisionId,
  prefilledAssetId,
}: KnowledgeReviewWorkbenchPageProps) {
  const workbenchController = controller ?? defaultWorkbenchController;
  const normalizedPrefilledRevisionId = prefilledRevisionId?.trim() ?? "";
  const normalizedPrefilledAssetId = prefilledAssetId?.trim() ?? "";
  const [filters, setFilters] = useState(() => createKnowledgeReviewFilterState());
  const [desk, setDesk] = useState<KnowledgeReviewDeskLoadResult | null>(null);
  const [queueLoadStatus, setQueueLoadStatus] = useState<"initial" | "loading" | "ready" | "error">(
    "initial",
  );
  const [queueErrorMessage, setQueueErrorMessage] = useState<string | null>(null);
  const [stableSelectionSnapshot, setStableSelectionSnapshot] =
    useState<KnowledgeReviewQueueItemViewModel | null>(null);
  const [history, setHistory] = useState<KnowledgeReviewHistoryViewState>({
    revisionId: null,
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
        normalizedPrefilledRevisionId.length > 0 ? normalizedPrefilledRevisionId : undefined,
      activeAssetId:
        normalizedPrefilledAssetId.length > 0 ? normalizedPrefilledAssetId : undefined,
    });
  }, [
    normalizedPrefilledAssetId,
    normalizedPrefilledRevisionId,
    workbenchController,
  ]);

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
        revisionId: null,
        status: "idle",
        actions: [],
        errorMessage: null,
      });
      return;
    }

    if (queueLoadStatus === "error" && isUsingStableSnapshot) {
      setHistory((current) =>
        current.revisionId === effectiveSelectedItem.revision_id
          ? current
          : {
              revisionId: effectiveSelectedItem.revision_id,
              status: "idle",
              actions: [],
              errorMessage: null,
            },
      );
      return;
    }

    void loadHistory(effectiveSelectedItem.revision_id);
  }, [effectiveSelectedItem?.revision_id, isUsingStableSnapshot, queueLoadStatus]);

  async function loadDesk(input: {
    filters?: Partial<KnowledgeReviewFilterState>;
    showLoading?: boolean;
    activeItemId?: string;
    activeAssetId?: string;
  }): Promise<void> {
    const requestId = ++queueRequestIdRef.current;
    if (input.showLoading ?? true) {
      setQueueLoadStatus("loading");
    }
    setQueueErrorMessage(null);

    try {
      const loadedDesk = await workbenchController.loadDesk({
        state: desk?.state,
        filters: input.filters,
        activeItemId: input.activeItemId,
      });
      const nextDesk = resolvePrefilledDeskSelection(loadedDesk, {
        activeItemId: input.activeItemId,
        activeAssetId: input.activeAssetId,
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
      setQueueErrorMessage(toErrorMessage(error, "审核队列加载失败"));
    }
  }

  async function loadHistory(revisionId: string): Promise<void> {
    const requestId = ++historyRequestIdRef.current;
    setHistory((current) => ({
      revisionId,
      status: "loading",
      actions: current.revisionId === revisionId ? current.actions : [],
      errorMessage: null,
    }));

    try {
      const nextHistory = await workbenchController.loadHistory({ revisionId });
      if (requestId !== historyRequestIdRef.current) {
        return;
      }

      setHistory({
        revisionId: nextHistory.revisionId,
        status: "ready",
        actions: nextHistory.actions,
        errorMessage: null,
      });
    } catch (error) {
      if (requestId !== historyRequestIdRef.current) {
        return;
      }

      setHistory((current) => ({
        revisionId,
        status: "error",
        actions: current.revisionId === revisionId ? current.actions : [],
        errorMessage: toErrorMessage(error, "审核历史加载失败"),
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
      message:
        actionType === "approve"
          ? "正在提交通过结果..."
          : "正在提交驳回并退回草稿...",
    });

    const result =
      actionType === "approve"
        ? await workbenchController.approveItem({
            revisionId: selected.revision_id,
            actorRole,
            reviewNote,
            state: desk.state,
          })
        : await workbenchController.rejectItem({
            revisionId: selected.revision_id,
            actorRole,
            reviewNote,
            state: desk.state,
          });

    if (result.status === "error") {
      setReviewNote(result.reviewNote);
      setActionFeedback({
        status: "error",
        message: toErrorMessage(result.error, "审核提交失败"),
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
        revisionId: result.history.revisionId,
        status: "ready",
        actions: result.history.actions,
        errorMessage: null,
      });
    } else {
      setHistory({
        revisionId: null,
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
          "审核结果已经保存，但系统没能自动切到下一条待审记录。请刷新队列后继续处理。",
      });
      return;
    }

    setActionFeedback({
      status: "success",
      message: actionType === "approve" ? "知识条目已通过审核。" : "知识条目已驳回。",
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

    void loadHistory(retryTarget.revision_id);
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
  const displayedHistory = resolveDisplayedHistory(
    history,
    effectiveSelectedItem?.revision_id ?? null,
  );

  return (
    <main className="knowledge-review-workbench" data-layout="compact-review-desk">
      <header className="knowledge-review-compact-header">
        <div className="knowledge-review-header-main">
          <div className="knowledge-review-header-copy">
            <span className="knowledge-review-eyebrow">知识审核</span>
            <h1>知识审核工作台</h1>
            <p>队列、详情、决策保持同屏，优先支持高频审核流。</p>
          </div>

          <div className="knowledge-review-header-summary" aria-label="当前审核摘要">
            <span className="knowledge-review-summary-chip">
              审核角色：{formatActorRole(actorRole)}
            </span>
            <span className="knowledge-review-summary-chip">
              当前资产：{effectiveSelectedItem?.asset_id ?? "等待选择"}
            </span>
            <span className="knowledge-review-summary-chip">
              当前修订：{effectiveSelectedItem?.revision_id ?? "等待选择"}
            </span>
            <span className="knowledge-review-summary-chip is-muted">
              队列状态：{resolveQueueStatusLabel(queueLoadStatus, queueErrorMessage)}
            </span>
          </div>
        </div>

        <WorkbenchCoreStrip activePillarId="knowledge" />
      </header>

      <div className="knowledge-review-desk">
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

        <section className="knowledge-review-review-column">
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
      </div>
    </main>
  );
}

function resolveQueueStatusLabel(
  queueLoadStatus: "initial" | "loading" | "ready" | "error",
  queueErrorMessage: string | null,
): string {
  if (queueLoadStatus === "error") {
    return queueErrorMessage ? "需要恢复" : "加载失败";
  }

  if (queueLoadStatus === "loading" || queueLoadStatus === "initial") {
    return "正在加载";
  }

  return "已就绪";
}

function resolveDetailSelection(
  queueLoadStatus: "initial" | "loading" | "ready" | "error",
  liveSelection: KnowledgeReviewQueueItemViewModel | null,
  stableSelectionSnapshot: KnowledgeReviewQueueItemViewModel | null,
): KnowledgeReviewQueueItemViewModel | null {
  if (queueLoadStatus === "error") {
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
  displayedRevisionId: string | null,
): {
  history: KnowledgeReviewHistoryViewState;
  scopeNote: string | null;
} {
  if (displayedRevisionId == null) {
    return {
      history: {
        revisionId: null,
        status: "idle",
        actions: [],
        errorMessage: null,
      },
      scopeNote: null,
    };
  }

  if (history.revisionId === displayedRevisionId) {
    return {
      history,
      scopeNote: null,
    };
  }

  return {
    history: {
      revisionId: displayedRevisionId,
      status: "idle",
      actions: [],
      errorMessage: null,
    },
    scopeNote: "当前历史属于另一条修订，刷新后可查看选中修订的审核轨迹。",
  };
}

function formatActorRole(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "knowledge_reviewer":
      return "知识审核员";
    case "editor":
      return "编辑";
    case "proofreader":
      return "校对";
    case "screener":
      return "初筛";
    case "user":
    default:
      return "用户";
  }
}

function resolvePrefilledDeskSelection(
  desk: KnowledgeReviewDeskLoadResult,
  input: {
    activeItemId?: string;
    activeAssetId?: string;
  },
): KnowledgeReviewDeskLoadResult {
  if (input.activeItemId?.trim()) {
    return desk;
  }

  const activeAssetId = input.activeAssetId?.trim();
  if (!activeAssetId) {
    return desk;
  }

  const matchingItem = desk.queue.find((item) => item.asset_id === activeAssetId);
  if (!matchingItem || matchingItem.id === desk.selectedItem?.id) {
    return desk;
  }

  const nextState = createKnowledgeReviewWorkbenchState({
    queue: desk.state.queue,
    filters: desk.state.filters,
    activeItemId: matchingItem.id,
    refreshPayloadQueue: desk.state.refreshPayloadQueue,
  });

  return {
    queue: nextState.queue,
    visibleQueue: nextState.visibleQueue,
    selectedItem: nextState.selectedItem,
    state: nextState,
  };
}
