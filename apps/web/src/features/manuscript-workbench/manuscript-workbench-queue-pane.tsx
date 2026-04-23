import type { JobViewModel } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type { ManuscriptWorkbenchLookupPanelProps } from "./manuscript-workbench-controls.tsx";
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
  lookup: ManuscriptWorkbenchLookupPanelProps;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
  queueItems: ManuscriptWorkbenchQueueItem[];
  activeQueueFilter: ManuscriptWorkbenchQueueFilter;
  onQueueFilterChange(nextFilter: ManuscriptWorkbenchQueueFilter): void;
  onOpenQueueItem(manuscriptId: string): void;
}

export function ManuscriptWorkbenchQueuePane({
  mode,
  busy,
  lookup,
  workspace,
  latestJob,
  queueItems,
  activeQueueFilter,
  onQueueFilterChange,
  onOpenQueueItem,
}: ManuscriptWorkbenchQueuePaneProps) {
  const canLoadWorkspace = lookup.manuscriptId.trim().length > 0;
  const lookupDisplayValue =
    workspace?.manuscript &&
    lookup.manuscriptId.trim() === workspace.manuscript.id
      ? workspace.manuscript.title
      : lookup.manuscriptId;
  const filteredQueueItems =
    activeQueueFilter === "all"
      ? queueItems
      : queueItems.filter((item) => item.queueStatus === activeQueueFilter);
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

      <div className="manuscript-workbench-queue-search">
        <label className={resolveLookupFieldClassName(!canLoadWorkspace)}>
          <span>稿件查找</span>
          <input
            value={lookupDisplayValue}
            onChange={(event) => lookup.onChange(event.target.value)}
            placeholder="输入稿件标题或编号"
          />
        </label>
        <button type="button" disabled={busy || !canLoadWorkspace} onClick={() => lookup.onLoad()}>
          {busy ? "加载中..." : "打开稿件"}
        </button>
      </div>

      <div className="manuscript-workbench-queue-filters" aria-label="队列筛选">
        {QUEUE_FILTER_OPTIONS.map(([filter, label]) => (
          <button
            key={filter}
            type="button"
            data-queue-filter={filter}
            className={
              filter === activeQueueFilter
                ? "manuscript-workbench-queue-filter is-active"
                : "manuscript-workbench-queue-filter"
            }
            onClick={() => onQueueFilterChange(filter)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="manuscript-workbench-queue-list-shell">
        <div className="manuscript-workbench-queue-list-header">
          <strong>已上传稿件</strong>
          <p>{queueListHint}</p>
        </div>
        <div className="manuscript-workbench-queue-list">
          {filteredQueueItems.length > 0 ? (
            filteredQueueItems.map((item) => (
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
                <dl className="manuscript-workbench-queue-item-meta">
                  <div>
                    <dt>稿件类型</dt>
                    <dd>{item.manuscriptTypeLabel}</dd>
                  </div>
                  <div>
                    <dt>当前状态</dt>
                    <dd>{item.activityLabel}</dd>
                  </div>
                </dl>
                <div className="manuscript-workbench-button-row">
                  <button
                    type="button"
                    className="manuscript-workbench-queue-open"
                    disabled={busy}
                    onClick={() => onOpenQueueItem(item.manuscriptId)}
                  >
                    打开稿件
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

const QUEUE_FILTER_OPTIONS: ReadonlyArray<
  readonly [ManuscriptWorkbenchQueueFilter, string]
> = [
  ["all", "全部"],
  ["pending", "待处理"],
  ["in_progress", "处理中"],
  ["completed", "已完成"],
  ["failed", "失败"],
];

function resolveLookupFieldClassName(isInvalid: boolean): string {
  return isInvalid
    ? "manuscript-workbench-queue-field is-invalid"
    : "manuscript-workbench-queue-field";
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
