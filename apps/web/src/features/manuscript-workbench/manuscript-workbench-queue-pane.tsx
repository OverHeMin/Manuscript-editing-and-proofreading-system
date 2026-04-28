import type { JobViewModel } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;

export type ManuscriptWorkbenchQueueFilter =
  | "all"
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

export interface ManuscriptWorkbenchQueueItem {
  manuscriptId: string;
  title: string;
  manuscriptTypeLabel: string;
  statusLabel: string;
  activityLabel: string;
  queueScope: "batch" | "recent";
  queueStatus: Exclude<ManuscriptWorkbenchQueueFilter, "all">;
  isActive: boolean;
}

export interface ManuscriptWorkbenchQueuePaneProps {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  busy: boolean;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
  queueItems: ManuscriptWorkbenchQueueItem[];
  onOpenQueueItem(manuscriptId: string): void;
  onArchiveQueueItem(manuscriptId: string): void;
}

export function ManuscriptWorkbenchQueuePane({
  mode,
  busy,
  workspace,
  latestJob,
  queueItems,
  onOpenQueueItem,
  onArchiveQueueItem,
}: ManuscriptWorkbenchQueuePaneProps) {
  const concurrencySnapshot = workspace?.moduleExecutionConcurrency;
  const queueListHint = resolveQueueListHint(mode, concurrencySnapshot);

  return (
    <aside className="manuscript-workbench-queue-pane" data-queue-view="worklist">
      <header className="manuscript-workbench-queue-pane-header">
        <div>
          <span className="manuscript-workbench-section-eyebrow">稿件队列</span>
          <h3>{`${formatWorkbenchModeLabel(mode)}工作区`}</h3>
          <p>{resolveQueueHint(mode)}</p>
        </div>
      </header>

      <div className="manuscript-workbench-queue-list-shell">
        <div className="manuscript-workbench-queue-list-header">
          <strong>已上传稿件</strong>
          <p>{queueListHint}</p>
        </div>
        <div className="manuscript-workbench-queue-list">
          {queueItems.length > 0 ? (
            queueItems.map((item) => (
              <article
                key={item.manuscriptId}
                data-queue-item-status={item.queueStatus}
                className={
                  item.isActive
                    ? "manuscript-workbench-queue-item is-active"
                    : "manuscript-workbench-queue-item"
                }
              >
                <div className="manuscript-workbench-queue-item-header">
                  <div>
                    <span className="manuscript-workbench-queue-item-kicker">
                      {item.queueScope === "batch" ? "当前批次" : "最近打开"}
                    </span>
                    <h4>{item.title}</h4>
                  </div>
                  <span className="manuscript-workbench-queue-item-badge">{item.statusLabel}</span>
                </div>
                <p className="manuscript-workbench-queue-item-type">
                  {item.manuscriptTypeLabel}
                </p>
                <div className="manuscript-workbench-button-row">
                  <button
                    type="button"
                    className="manuscript-workbench-queue-open"
                    data-queue-row-action="open"
                    disabled={busy}
                    onClick={() => onOpenQueueItem(item.manuscriptId)}
                  >
                    打开
                  </button>
                  <button
                    type="button"
                    className="manuscript-workbench-queue-archive"
                    data-queue-row-action="archive"
                    disabled={busy}
                    onClick={() => onArchiveQueueItem(item.manuscriptId)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="manuscript-workbench-queue-empty">
              <strong>当前筛选下没有稿件</strong>
              <p>
                {workspace
                  ? `最近任务：${latestJob ? formatWorkbenchModeLabel(latestJob.module) : "暂无执行记录"}`
                  : "先上传或加载稿件，左侧列表会显示已上传稿件和处理状态。"}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function resolveQueueHint(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "左侧只保留查找、状态和队列，不再堆额外参数。";
  }

  if (mode === "editing") {
    return "先看稿件状态，再进入右侧结果区继续处理。";
  }

  return "校对入口保持简洁，状态和排队情况在这里直接可见。";
}

function formatWorkbenchModeLabel(mode: string): string {
  if (mode === "screening") {
    return "初筛";
  }

  if (mode === "editing") {
    return "编辑";
  }

  if (mode === "proofreading") {
    return "校对";
  }

  if (mode === "upload") {
    return "上传";
  }

  if (mode === "manual") {
    return "人工";
  }

  return mode;
}

function formatConcurrencyScopeLabel(
  scope: Exclude<ManuscriptWorkbenchMode, "submission"> | "global",
): string {
  if (scope === "global") {
    return "总队列";
  }

  if (scope === "screening") {
    return "初筛";
  }

  if (scope === "editing") {
    return "编辑";
  }

  return "校对";
}

function resolveQueueListHint(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  snapshot: ManuscriptWorkbenchWorkspace["moduleExecutionConcurrency"] | undefined,
): string {
  if (!snapshot) {
    return "这里显示已上传稿件和处理状态，打开后继续在右侧处理。";
  }

  return `总并发 ${snapshot.limits.global}，${formatConcurrencyScopeLabel(mode)}并发 ${snapshot.limits[mode]}，超出自动排队。`;
}
