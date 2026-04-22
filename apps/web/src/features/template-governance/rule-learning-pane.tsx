import { startTransition, useEffect, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type { AuthRole } from "../auth/index.ts";
import {
  applyLearningWriteback,
  createLearningWriteback,
  listLearningWritebacksByCandidate,
  type LearningWritebackViewModel,
} from "../learning-governance/index.ts";
import {
  getLearningCandidate,
  listPendingLearningReviewCandidates,
  type LearningCandidateViewModel,
} from "../learning-review/index.ts";
import {
  createReviewItemsWorkbenchState,
  decideReviewItem,
  formatResidualReviewSourceStatusLabel,
  isGovernedHitReviewItem,
  isLearningCandidateReviewItem,
  isResidualReviewItem,
  listReviewItems,
  reconcileReviewItemsQueue,
  selectApplicableResidualValidationSuiteIds,
  selectReviewItem,
  type LearningCandidateReviewItemViewModel,
  type ListReviewItemsFilters,
  type ReviewItemViewModel,
} from "../review-items/index.ts";
import { listEvaluationSuites } from "../verification-ops/verification-ops-api.ts";
import type { EvaluationSuiteViewModel } from "../verification-ops/types.ts";
import { RuleLearningActions } from "./rule-learning-actions.tsx";
import { RuleLearningDiffCard } from "./rule-learning-diff-card.tsx";
import {
  createDefaultRuleLearningReviewFilters,
  filterRuleLearningReviewItems,
  resolveEditorialRuleDraftWriteback,
  type RuleLearningReviewFilters,
} from "./rule-learning-state.ts";

const defaultClient = createBrowserHttpClient();

export interface RuleLearningPaneProps {
  actorRole?: AuthRole;
  prefilledManuscriptId?: string;
  prefilledReviewedCaseSnapshotId?: string;
  initialCandidates?: readonly LearningCandidateViewModel[];
  initialSelectedCandidateId?: string;
  initialReviewItems?: readonly ReviewItemViewModel[];
  initialSelectedReviewItemId?: string;
}

export function RuleLearningPane({
  actorRole = "admin",
  prefilledManuscriptId,
  prefilledReviewedCaseSnapshotId,
  initialCandidates = [],
  initialSelectedCandidateId,
  initialReviewItems = [],
  initialSelectedReviewItemId,
}: RuleLearningPaneProps) {
  const initialReviewFilters = createDefaultRuleLearningReviewFilters({
    manuscriptId: prefilledManuscriptId,
  });
  const seededQueueFilters =
    initialReviewItems.length > 0
      ? initialReviewFilters
      : createDefaultRuleLearningReviewFilters();
  const seededQueue = filterRuleLearningReviewItems(
    initialReviewItems.length > 0
      ? initialReviewItems
      : initialCandidates.map(toReviewItemFromLearningCandidate),
    seededQueueFilters,
  );
  const initialActiveItemId =
    initialSelectedReviewItemId ?? initialSelectedCandidateId ?? null;
  const initialWorkbenchState = createReviewItemsWorkbenchState({
    queue: seededQueue,
    activeItemId: initialActiveItemId,
  });

  const [isBusy, setIsBusy] = useState(false);
  const [queueStatus, setQueueStatus] = useState<"idle" | "loading" | "ready" | "error">(
    seededQueue.length > 0 ? "ready" : "idle",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedItem, setResolvedItem] = useState<ReviewItemViewModel | null>(null);
  const [validationSuites, setValidationSuites] = useState<
    readonly EvaluationSuiteViewModel[] | null
  >(null);
  const [reviewFilters, setReviewFilters] =
    useState<RuleLearningReviewFilters>(initialReviewFilters);
  const [workbenchState, setWorkbenchState] = useState(() => initialWorkbenchState);
  const [editorialRuleDraftWriteback, setEditorialRuleDraftWriteback] =
    useState<LearningWritebackViewModel | null>(() =>
      resolveCandidateRuleDraftWriteback(initialWorkbenchState.selectedItem),
    );

  const apiFilters = toReviewItemsApiFilters(reviewFilters);
  const selectedItem = resolvedItem ?? workbenchState.selectedItem;
  const pendingCount = workbenchState.queue.length;
  const activeQueueItemId = resolvedItem ? null : workbenchState.selectedItem?.id ?? null;

  useEffect(() => {
    void loadReviewQueue(initialActiveItemId);
  }, [
    initialActiveItemId,
    apiFilters.manuscriptId,
    apiFilters.module,
    apiFilters.reviewStatus,
    apiFilters.riskLevel,
    apiFilters.sourceKind,
  ]);

  useEffect(() => {
    const nextWriteback = resolveCandidateRuleDraftWriteback(selectedItem);
    setEditorialRuleDraftWriteback(nextWriteback);

    if (!isRuleCandidateReviewItem(selectedItem)) {
      return;
    }

    if (
      selectedItem.source_status !== "approved" &&
      (selectedItem.writeback_summaries?.length ?? 0) === 0
    ) {
      return;
    }

    let isCancelled = false;
    void listLearningWritebacksByCandidate(defaultClient, selectedItem.id)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        const resolvedWriteback = resolveEditorialRuleDraftWriteback(response.body);
        setEditorialRuleDraftWriteback(resolvedWriteback);
        setResolvedItem((current) =>
          mergeLearningCandidateWritebacks(current, selectedItem.id, response.body),
        );
      })
      .catch(() => {
        // Keep the current UI state if the background refresh fails.
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedItem?.id, selectedItem?.source_kind, selectedItem?.source_status]);

  async function loadReviewQueue(
    preferredItemId?: string | null,
    nextResolvedItem: ReviewItemViewModel | null = null,
  ) {
    setQueueStatus("loading");

    try {
      const shouldLoadLearningCandidateQueue =
        apiFilters.sourceKind === undefined || apiFilters.sourceKind === "learning_candidate";
      const [response, learningCandidates] = await Promise.all([
        listReviewItems(defaultClient, apiFilters),
        shouldLoadLearningCandidateQueue
          ? listPendingLearningReviewCandidates(defaultClient).then(
              (candidateResponse) => candidateResponse.body,
            )
          : Promise.resolve<LearningCandidateViewModel[]>([]),
      ]);
      const preferredCandidate =
        shouldLoadLearningCandidateQueue && preferredItemId
          ? await resolvePreferredLearningCandidate(preferredItemId, learningCandidates)
          : null;
      const mergedQueue = mergeRuleLearningQueueItems(
        response.body,
        [
          ...learningCandidates.map(toReviewItemFromLearningCandidate),
          ...(preferredCandidate ? [toReviewItemFromLearningCandidate(preferredCandidate)] : []),
        ],
      );
      const queue = ensurePreferredReviewItem(
        filterRuleLearningReviewItems(mergedQueue, reviewFilters),
        mergedQueue,
        preferredItemId,
      );
      startTransition(() => {
        setResolvedItem(nextResolvedItem);
        setWorkbenchState((current) =>
          reconcileReviewItemsQueue(current, queue, preferredItemId),
        );
        setQueueStatus("ready");
        setErrorMessage(null);
      });
    } catch (error) {
      startTransition(() => {
        setQueueStatus("error");
        setErrorMessage(toErrorMessage(error));
      });
    }
  }

  function handleSelectItem(itemId: string) {
    startTransition(() => {
      setResolvedItem(null);
      setWorkbenchState((current) => selectReviewItem(current, itemId));
      setEditorialRuleDraftWriteback(null);
      setStatusMessage(`已切换到复核项：${itemId}`);
      setErrorMessage(null);
    });
  }

  function handleFilterChange(nextFilters: Partial<RuleLearningReviewFilters>) {
    startTransition(() => {
      setResolvedItem(null);
      setReviewFilters((current) => ({
        ...current,
        ...nextFilters,
      }));
      setStatusMessage("已更新统一复核筛选条件。");
      setErrorMessage(null);
    });
  }

  async function handleValidateResidualItem() {
    if (!isResidualReviewItem(selectedItem)) {
      setErrorMessage("请先选择一条待复验的残差问题。");
      return;
    }

    await runBusyTask(async () => {
      const suiteIds = await resolveValidationSuiteIds(selectedItem.module);
      const response = await decideReviewItem(defaultClient, {
        sourceKind: "residual_issue",
        id: selectedItem.id,
        action: "validate",
        suiteIds,
      });

      await loadReviewQueue(response.body.item?.id ?? selectedItem.id);
      startTransition(() => {
        setStatusMessage(`已完成 Harness 复验：${selectedItem.id}`);
      });
    });
  }

  async function handleResolveSelectedItem(
    action:
      | "accept_change_only"
      | "reject_as_false_positive"
      | "archive_as_evidence_only",
  ) {
    if (
      !selectedItem ||
      (!isGovernedHitReviewItem(selectedItem) && !isResidualReviewItem(selectedItem))
    ) {
      setErrorMessage("请先选择一条待处理的复核项。");
      return;
    }

    await runBusyTask(async () => {
      const response = await decideReviewItem(defaultClient, {
        sourceKind: selectedItem.source_kind,
        id: selectedItem.id,
        action,
      });

      await loadReviewQueue(response.body.item?.id ?? null, response.body.item);
      startTransition(() => {
        setStatusMessage(resolveDecisionStatusMessage(action, selectedItem.id));
      });
    });
  }

  async function handleRouteSelectedItem(
    action:
      | "route_to_rule_candidate"
      | "route_to_knowledge_candidate"
      | "route_to_prompt_candidate",
  ) {
    if (
      !selectedItem ||
      (!isGovernedHitReviewItem(selectedItem) && !isResidualReviewItem(selectedItem))
    ) {
      setErrorMessage("请先选择一条可路由的复核项。");
      return;
    }

    await runBusyTask(async () => {
      const response = await decideReviewItem(defaultClient, {
        sourceKind: selectedItem.source_kind,
        id: selectedItem.id,
        action,
        title: selectedItem.title,
        proposalText: resolveProposalText(selectedItem),
      });

      await loadReviewQueue(response.body.item?.id ?? null, response.body.item);
      startTransition(() => {
        setStatusMessage(resolveDecisionStatusMessage(action, selectedItem.id));
      });
    });
  }

  async function handleApproveLearningCandidate() {
    if (!isLearningCandidateReviewItem(selectedItem)) {
      setErrorMessage("请先选择一条待审核的学习候选。");
      return;
    }

    await runBusyTask(async () => {
      const response = await decideReviewItem(defaultClient, {
        sourceKind: "learning_candidate",
        id: selectedItem.id,
        action: "approve",
      });

      await loadReviewQueue(undefined, response.body.item);
      startTransition(() => {
        setStatusMessage(`已审核通过学习候选：${selectedItem.id}`);
      });
    });
  }

  async function handleRejectLearningCandidate() {
    if (!isLearningCandidateReviewItem(selectedItem)) {
      setErrorMessage("请先选择一条待审核的学习候选。");
      return;
    }

    await runBusyTask(async () => {
      const response = await decideReviewItem(defaultClient, {
        sourceKind: "learning_candidate",
        id: selectedItem.id,
        action: "reject",
      });

      await loadReviewQueue(undefined, response.body.item);
      startTransition(() => {
        setStatusMessage(`已驳回学习候选：${selectedItem.id}`);
      });
    });
  }

  async function handleConvertSelectedItemToRuleDraft() {
    if (!isRuleCandidateReviewItem(selectedItem) || selectedItem.source_status !== "approved") {
      setErrorMessage("请先完成审核通过，再转成规则草稿。");
      return;
    }

    if (actorRole !== "admin") {
      setErrorMessage("只有管理员可以完成规则草稿写回。");
      return;
    }

    await runBusyTask(async () => {
      const materialized = await materializeEditorialRuleDraftWriteback(
        selectedItem,
        actorRole,
      );
      await loadReviewQueue(selectedItem.id, materialized.item);
      startTransition(() => {
        setEditorialRuleDraftWriteback(materialized.writeback);
        setStatusMessage(
          materialized.writeback.created_draft_asset_id
            ? `已完成规则草稿写回：${materialized.writeback.created_draft_asset_id}`
            : `已创建规则草稿写回：${materialized.writeback.id}`,
        );
      });
    });
  }

  async function runBusyTask(task: () => Promise<void>) {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      await task();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function resolveValidationSuiteIds(module: string): Promise<string[]> {
    if (actorRole !== "admin") {
      throw new Error("只有管理员可以执行残差 Harness 复验。");
    }

    const suites = validationSuites ?? (await listEvaluationSuites(defaultClient)).body;
    if (!validationSuites) {
      setValidationSuites(suites);
    }

    const suiteIds = selectApplicableResidualValidationSuiteIds(suites, module);
    if (suiteIds.length === 0) {
      throw new Error(`当前没有适用于 ${formatLearningModule(module)} 的 Harness 复验套件。`);
    }

    return suiteIds;
  }

  return (
    <section className="template-governance-recovery-shell">
      {(statusMessage || errorMessage) && (
        <p
          className={errorMessage ? "template-governance-error" : "template-governance-status"}
          role="status"
        >
          {errorMessage ?? statusMessage}
        </p>
      )}

      {prefilledManuscriptId || prefilledReviewedCaseSnapshotId ? (
        <p className="template-governance-context-note">
          {prefilledManuscriptId
            ? `回流来源稿件：${prefilledManuscriptId}`
            : "回流来源稿件待补充"}
          {prefilledReviewedCaseSnapshotId
            ? ` · 复核快照：${prefilledReviewedCaseSnapshotId}`
            : ""}
          。当前统一复核会沿用这条治理证据链，继续处理已发现残差、Harness 复验、候选路由与规则写回。
        </p>
      ) : null}

      <div className="template-governance-recovery-layout">
        <article className="template-governance-card template-governance-recovery-queue">
          <div className="template-governance-panel-header">
            <div>
              <h3>统一复核队列</h3>
              <p>只保留可沉淀为规则草稿的复核项，在这里统一完成复核、候选审核与规则草稿写回。</p>
            </div>

            <div className="template-governance-chip-row">
              <span className="template-governance-chip template-governance-chip-secondary">
                待处理 {pendingCount}
              </span>
              <button type="button" disabled={isBusy} onClick={() => void loadReviewQueue()}>
                刷新队列
              </button>
            </div>
          </div>

          <div className="template-governance-grid-form template-governance-review-filter-grid">
            <label className="template-governance-field">
              <span>来源</span>
              <select
                value={reviewFilters.sourceKind ?? "all"}
                disabled={isBusy}
                onChange={(event) =>
                  handleFilterChange({
                    sourceKind:
                      event.target.value === "all"
                        ? "all"
                        : (event.target.value as RuleLearningReviewFilters["sourceKind"]),
                  })
                }
              >
                <option value="all">全部来源</option>
                <option value="governed_hit">人工反馈命中</option>
                <option value="residual_issue">残差问题</option>
                <option value="learning_candidate">学习候选</option>
              </select>
            </label>

            <label className="template-governance-field">
              <span>模块</span>
              <select
                value={reviewFilters.module ?? "all"}
                disabled={isBusy}
                onChange={(event) =>
                  handleFilterChange({
                    module: event.target.value,
                  })
                }
              >
                <option value="all">全部模块</option>
                <option value="screening">初筛</option>
                <option value="editing">编辑</option>
                <option value="proofreading">校对</option>
                <option value="learning">候选治理</option>
              </select>
            </label>

            <label className="template-governance-field">
              <span>风险</span>
              <select
                value={reviewFilters.riskLevel ?? "all"}
                disabled={isBusy}
                onChange={(event) =>
                  handleFilterChange({
                    riskLevel:
                      event.target.value === "all"
                        ? "all"
                        : (event.target.value as RuleLearningReviewFilters["riskLevel"]),
                  })
                }
              >
                <option value="all">全部风险</option>
                <option value="critical">严重</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>

            <label className="template-governance-field">
              <span>当前状态</span>
              <select
                value={reviewFilters.reviewStatus ?? "all"}
                disabled={isBusy}
                onChange={(event) =>
                  handleFilterChange({
                    reviewStatus:
                      event.target.value === "all"
                        ? "all"
                        : (event.target.value as RuleLearningReviewFilters["reviewStatus"]),
                  })
                }
              >
                <option value="all">全部状态</option>
                <option value="pending">待复核</option>
                <option value="decided">已决定</option>
                <option value="routed">已路由</option>
              </select>
            </label>

            <label className="template-governance-field template-governance-field-full">
              <span>稿件</span>
              <input
                value={reviewFilters.manuscriptId ?? ""}
                disabled={isBusy}
                placeholder="按稿件 ID 过滤"
                onChange={(event) =>
                  handleFilterChange({
                    manuscriptId: event.target.value,
                  })
                }
              />
            </label>
          </div>

          {queueStatus === "loading" && workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">正在加载统一复核队列...</p>
          ) : queueStatus === "error" && workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">统一复核队列加载失败。</p>
          ) : workbenchState.queue.length === 0 ? (
            <p className="template-governance-empty">当前没有待处理的规则治理复核项。</p>
          ) : (
            <div className="template-governance-ledger-table-shell">
              <table className="template-governance-ledger-table">
                <thead>
                  <tr>
                    <th>问题</th>
                    <th>来源</th>
                    <th>模块</th>
                    <th>风险</th>
                    <th>当前状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {workbenchState.queue.map((item) => (
                    <tr
                      key={`${item.source_kind}:${item.id}`}
                      className={
                        activeQueueItemId === item.id
                          ? "template-governance-review-row is-active"
                          : "template-governance-review-row"
                      }
                    >
                      <td>
                        <button
                          type="button"
                          data-review-item-id={item.id}
                          className="template-governance-review-row-button"
                          disabled={isBusy}
                          onClick={() => handleSelectItem(item.id)}
                        >
                          <span>{item.title}</span>
                          <small>{item.id}</small>
                          <small>
                            {item.manuscript_id ?? "未绑定稿件"} ·{" "}
                            {formatLearningManuscriptType(item.manuscript_type)}
                          </small>
                          {item.snapshot_id ? <small>{item.snapshot_id}</small> : null}
                        </button>
                      </td>
                      <td>{formatSourceKind(item.source_kind)}</td>
                      <td>{formatLearningModule(item.module)}</td>
                      <td>{formatRiskLevel(item.risk_level)}</td>
                      <td>{formatSourceStatus(item)}</td>
                      <td>{formatPrimaryAction(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <div className="template-governance-recovery-main">
          <RuleLearningDiffCard
            item={selectedItem}
            editorialRuleDraftWriteback={editorialRuleDraftWriteback}
          />
          <RuleLearningActions
            item={selectedItem}
            actorRole={actorRole}
            editorialRuleDraftWriteback={editorialRuleDraftWriteback}
            isBusy={isBusy}
            onValidateResidualItem={handleValidateResidualItem}
            onAcceptChangeOnly={() => handleResolveSelectedItem("accept_change_only")}
            onRejectFalsePositive={() =>
              handleResolveSelectedItem("reject_as_false_positive")
            }
            onArchiveEvidenceOnly={() =>
              handleResolveSelectedItem("archive_as_evidence_only")
            }
            onRouteToRuleCandidate={() =>
              handleRouteSelectedItem("route_to_rule_candidate")
            }
            onRouteToKnowledgeCandidate={() =>
              handleRouteSelectedItem("route_to_knowledge_candidate")
            }
            onRouteToPromptCandidate={() =>
              handleRouteSelectedItem("route_to_prompt_candidate")
            }
            onApproveLearningCandidate={handleApproveLearningCandidate}
            onConvertToRuleDraft={handleConvertSelectedItemToRuleDraft}
            onRejectLearningCandidate={handleRejectLearningCandidate}
          />
        </div>
      </div>
    </section>
  );
}

function toReviewItemFromLearningCandidate(
  candidate: LearningCandidateViewModel,
): LearningCandidateReviewItemViewModel {
  const originPayload = normalizeOriginPayload(candidate.candidate_payload);
  const payloadManuscriptId =
    typeof originPayload?.manuscriptId === "string" ? originPayload.manuscriptId.trim() : "";
  const payloadSnapshotId =
    typeof originPayload?.reviewedCaseSnapshotId === "string"
      ? originPayload.reviewedCaseSnapshotId.trim()
      : typeof originPayload?.snapshotId === "string"
        ? originPayload.snapshotId.trim()
        : "";

  return {
    ...candidate,
    title: candidate.title ?? `学习候选 ${candidate.id}`,
    source_kind: "learning_candidate",
    source_status: candidate.status,
    review_status: candidate.status === "pending_review" ? "pending" : "decided",
    available_actions: candidate.status === "pending_review" ? ["approve", "reject"] : [],
    summary: candidate.proposal_text,
    manuscript_id:
      candidate.manuscript_id?.trim() || (payloadManuscriptId.length > 0 ? payloadManuscriptId : undefined),
    snapshot_id:
      payloadSnapshotId.length > 0 ? payloadSnapshotId : undefined,
    source_asset_id:
      candidate.snapshot_asset_id ?? candidate.human_final_asset_id ?? candidate.annotated_asset_id,
    candidate_type: candidate.type,
    recommended_route: mapLearningCandidateRoute(candidate.type),
    origin_payload: originPayload,
  };
}

function mergeRuleLearningQueueItems(
  primaryItems: readonly ReviewItemViewModel[],
  supplementalItems: readonly ReviewItemViewModel[],
): ReviewItemViewModel[] {
  const seenKeys = new Set(primaryItems.map((item) => `${item.source_kind}:${item.id}`));
  const merged = [...primaryItems];

  for (const item of supplementalItems) {
    const key = `${item.source_kind}:${item.id}`;
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    merged.push(item);
  }

  return merged;
}

function ensurePreferredReviewItem(
  queue: readonly ReviewItemViewModel[],
  allItems: readonly ReviewItemViewModel[],
  preferredItemId?: string | null,
): ReviewItemViewModel[] {
  if (!preferredItemId) {
    return [...queue];
  }

  if (queue.some((item) => item.id === preferredItemId)) {
    return [...queue];
  }

  const preferredItem = allItems.find((item) => item.id === preferredItemId);
  return preferredItem ? [preferredItem, ...queue] : [...queue];
}

async function resolvePreferredLearningCandidate(
  preferredItemId: string,
  queue: readonly LearningCandidateViewModel[],
): Promise<LearningCandidateViewModel | null> {
  const queuedCandidate = queue.find((candidate) => candidate.id === preferredItemId);
  if (queuedCandidate) {
    return queuedCandidate;
  }

  try {
    return (await getLearningCandidate(defaultClient, preferredItemId)).body;
  } catch {
    return null;
  }
}

function isRuleCandidateReviewItem(
  item: ReviewItemViewModel | null,
): item is LearningCandidateReviewItemViewModel {
  return isLearningCandidateReviewItem(item) && item.type === "rule_candidate";
}

function resolveCandidateRuleDraftWriteback(
  item: ReviewItemViewModel | null,
): LearningWritebackViewModel | null {
  if (!isRuleCandidateReviewItem(item)) {
    return null;
  }

  return resolveEditorialRuleDraftWriteback(item.writeback_summaries ?? []);
}

function mergeLearningCandidateWritebacks(
  item: ReviewItemViewModel | null,
  candidateId: string,
  writebacks: readonly LearningWritebackViewModel[],
): ReviewItemViewModel | null {
  if (!isRuleCandidateReviewItem(item) || item.id !== candidateId) {
    return item;
  }

  return {
    ...item,
    writeback_summaries: [...writebacks],
  };
}

function upsertLearningWriteback(
  writebacks: readonly LearningWritebackViewModel[],
  nextWriteback: LearningWritebackViewModel,
): LearningWritebackViewModel[] {
  return [
    nextWriteback,
    ...writebacks.filter((writeback) => writeback.id !== nextWriteback.id),
  ];
}

async function materializeEditorialRuleDraftWriteback(
  candidate: LearningCandidateReviewItemViewModel,
  actorRole: AuthRole,
): Promise<{
  item: LearningCandidateReviewItemViewModel;
  writeback: LearningWritebackViewModel;
}> {
  const listedWritebacks = (
    await listLearningWritebacksByCandidate(defaultClient, candidate.id)
  ).body;
  let writebacks = [...listedWritebacks];
  let writeback = resolveEditorialRuleDraftWriteback(writebacks);

  if (!writeback || writeback.status === "archived") {
    writeback = (
      await createLearningWriteback(defaultClient, {
        actorRole,
        learningCandidateId: candidate.id,
        targetType: "editorial_rule_draft",
        createdBy: resolveGovernanceActorId(actorRole),
      })
    ).body;
    writebacks = upsertLearningWriteback(writebacks, writeback);
  }

  if (writeback.status !== "applied") {
    writeback = (
      await applyLearningWriteback(defaultClient, {
        actorRole,
        writebackId: writeback.id,
        targetType: "editorial_rule_draft",
        appliedBy: resolveGovernanceActorId(actorRole),
      })
    ).body;
    writebacks = upsertLearningWriteback(writebacks, writeback);
  }

  return {
    item: {
      ...candidate,
      writeback_summaries: writebacks,
    },
    writeback,
  };
}

function resolveGovernanceActorId(actorRole: AuthRole): string {
  return actorRole === "admin" ? "admin-1" : "reviewer-1";
}

function resolveDecisionStatusMessage(
  action:
    | "accept_change_only"
    | "reject_as_false_positive"
    | "archive_as_evidence_only"
    | "route_to_rule_candidate"
    | "route_to_knowledge_candidate"
    | "route_to_prompt_candidate",
  itemId: string,
): string {
  switch (action) {
    case "accept_change_only":
      return `已记录仅人工处理：${itemId}`;
    case "reject_as_false_positive":
      return `已记录误报驳回：${itemId}`;
    case "archive_as_evidence_only":
      return `已归档为证据：${itemId}`;
    case "route_to_rule_candidate":
      return `已转规则候选：${itemId}`;
    case "route_to_knowledge_candidate":
      return `已转知识候选：${itemId}`;
    case "route_to_prompt_candidate":
      return `已转 Prompt 候选：${itemId}`;
    default:
      return itemId;
  }
}

function resolveProposalText(item: ReviewItemViewModel): string | undefined {
  const excerpt = "excerpt" in item ? item.excerpt : undefined;
  const suggestion = "suggestion" in item ? item.suggestion : undefined;

  return item.summary ?? excerpt ?? suggestion;
}

function mapLearningCandidateRoute(
  value: LearningCandidateViewModel["type"],
):
  | "rule_candidate"
  | "knowledge_candidate"
  | "prompt_template_candidate"
  | undefined {
  switch (value) {
    case "rule_candidate":
      return "rule_candidate";
    case "knowledge_candidate":
      return "knowledge_candidate";
    case "prompt_optimization_candidate":
      return "prompt_template_candidate";
    default:
      return undefined;
  }
}

function normalizeOriginPayload(
  payload: LearningCandidateViewModel["candidate_payload"],
): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  return payload;
}

function toReviewItemsApiFilters(
  filters: RuleLearningReviewFilters,
): ListReviewItemsFilters {
  return {
    sourceKind:
      filters.sourceKind && filters.sourceKind !== "all"
        ? filters.sourceKind
        : undefined,
    module:
      filters.module && filters.module !== "all" ? filters.module.trim() : undefined,
    manuscriptId: filters.manuscriptId?.trim() || undefined,
    riskLevel:
      filters.riskLevel && filters.riskLevel !== "all" ? filters.riskLevel : undefined,
    reviewStatus:
      filters.reviewStatus && filters.reviewStatus !== "all"
        ? filters.reviewStatus
        : undefined,
  };
}

function formatSourceKind(value: ReviewItemViewModel["source_kind"]): string {
  switch (value) {
    case "governed_hit":
      return "人工反馈命中";
    case "residual_issue":
      return "残差问题";
    case "learning_candidate":
      return "学习候选";
    default:
      return value;
  }
}

function formatSourceStatus(item: ReviewItemViewModel): string {
  if (item.source_kind === "governed_hit") {
    switch (item.source_status) {
      case "submitted":
        return "待复核";
      case "accepted_change_only":
        return "仅人工处理";
      case "rejected_as_false_positive":
        return "误报驳回";
      case "routed_rule_candidate":
        return "已转规则候选";
      case "routed_knowledge_candidate":
        return "已转知识候选";
      case "routed_prompt_candidate":
        return "已转 Prompt 候选";
      case "archived_as_evidence_only":
        return "只保留证据";
      default:
        return "状态待确认";
    }
  }

  if (item.source_kind === "residual_issue") {
    return formatResidualReviewSourceStatusLabel(item.source_status);
  }

  switch (item.source_status) {
    case "pending_review":
      return "待审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    case "archived":
      return "已归档";
    default:
      return item.source_status;
  }
}

function formatLearningModule(value: string): string {
  switch (value) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "learning":
      return "候选治理";
    default:
      return value;
  }
}

function formatLearningManuscriptType(value: string): string {
  switch (value) {
    case "clinical_study":
      return "临床研究";
    case "systematic_review":
      return "系统综述";
    case "meta_analysis":
      return "Meta 分析";
    case "case_report":
      return "病例报告";
    case "guideline_interpretation":
      return "指南解读";
    case "expert_consensus":
      return "专家共识";
    case "diagnostic_study":
      return "诊断研究";
    case "basic_research":
      return "基础研究";
    case "nursing_study":
      return "护理研究";
    case "methodology_paper":
      return "方法学论文";
    case "brief_report":
      return "简报";
    case "other":
      return "其他";
    case "review":
    default:
      return "综述";
  }
}

function formatRiskLevel(value: ReviewItemViewModel["risk_level"]): string {
  switch (value) {
    case "critical":
      return "严重";
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return "待补充";
  }
}

function formatPrimaryAction(item: ReviewItemViewModel): string {
  if (item.available_actions.includes("route_to_rule_candidate")) {
    return "转规则候选";
  }

  if (item.available_actions.includes("route_to_knowledge_candidate")) {
    return "转知识候选";
  }

  if (item.available_actions.includes("route_to_prompt_candidate")) {
    return "转 Prompt 候选";
  }

  if (item.available_actions.includes("accept_change_only")) {
    return "仅人工处理";
  }

  if (item.available_actions.includes("reject_as_false_positive")) {
    return "误报驳回";
  }

  if (item.available_actions.includes("archive_as_evidence_only")) {
    return "只保留证据";
  }

  if (item.available_actions.includes("approve")) {
    return "审核通过";
  }

  if (item.available_actions.includes("reject")) {
    return "驳回候选";
  }

  return "查看详情";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "统一复核工作台发生未知错误。";
}
