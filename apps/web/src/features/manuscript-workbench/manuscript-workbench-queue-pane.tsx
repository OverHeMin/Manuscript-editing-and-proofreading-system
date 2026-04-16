import type { JobViewModel } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type { ManuscriptWorkbenchLookupPanelProps } from "./manuscript-workbench-controls.tsx";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;
export type ManuscriptWorkbenchQueueFilter = "all" | "pending" | "in_progress" | "completed";

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
  const queueTitle = `${formatWorkbenchModeLabel(mode)}队列`;
  const queueHint = resolveQueueHint(mode);
  const filteredQueueItems =
    activeQueueFilter === "all"
      ? queueItems
      : queueItems.filter((item) => item.queueStatus === activeQueueFilter);

  return (
    <aside className="manuscript-workbench-queue-pane" data-queue-view="worklist">
      <header className="manuscript-workbench-queue-pane-header">
        <div>
          <span className="manuscript-workbench-section-eyebrow">待处理队列</span>
          <h3>{queueTitle}</h3>
          <p>{queueHint}</p>
        </div>
      </header>

      <div className="manuscript-workbench-queue-search">
        <label className={resolveLookupFieldClassName(!canLoadWorkspace)}>
          <span>搜索稿件 ID</span>
          <input
            value={lookup.manuscriptId}
            onChange={(event) => lookup.onChange(event.target.value)}
            placeholder="输入稿件 ID 或沿用上一环节移交"
          />
        </label>
        <button type="button" disabled={busy || !canLoadWorkspace} onClick={() => lookup.onLoad()}>
          {busy ? "加载中..." : "进入单稿工作区"}
        </button>
      </div>

      <div className="manuscript-workbench-queue-filters" aria-label="队列筛选">
        {([
          ["all", "全部稿件"],
          ["pending", "待处理"],
          ["in_progress", "处理中"],
          ["completed", "已完成"],
        ] as const).map(([filter, label]) => (
          <button
            key={filter}
            type="button"
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

      <div className="manuscript-workbench-queue-list">
        {filteredQueueItems.length > 0 ? (
          filteredQueueItems.map((item) => (
            <article
              key={item.manuscriptId}
              className={
                item.isActive
                  ? "manuscript-workbench-queue-item is-active"
                  : "manuscript-workbench-queue-item"
              }
            >
              <div className="manuscript-workbench-queue-item-header">
                <div>
                  <span className="manuscript-workbench-queue-item-kicker">
                    {item.queueScope === "batch" ? "当前批次" : "最近进入"}
                  </span>
                  <h4>{item.title}</h4>
                </div>
                <span className="manuscript-workbench-queue-item-badge">{item.statusLabel}</span>
              </div>
              <dl className="manuscript-workbench-queue-item-meta">
                <div>
                  <dt>稿件编号</dt>
                  <dd>{item.manuscriptId}</dd>
                </div>
                <div>
                  <dt>稿件类型</dt>
                  <dd>{item.manuscriptTypeLabel}</dd>
                </div>
                <div>
                  <dt>当前进度</dt>
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
            <strong>当前筛选下还没有稿件</strong>
            <p>
              {workspace
                ? `最近任务：${latestJob ? formatWorkbenchModeLabel(latestJob.module) : "等待执行记录"}`
                : "先上传或载入稿件，左侧队列就会开始形成可切换的工作清单。"}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function resolveLookupFieldClassName(isInvalid: boolean): string {
  return isInvalid
    ? "manuscript-workbench-queue-field is-invalid"
    : "manuscript-workbench-queue-field";
}

function resolveQueueHint(mode: Exclude<ManuscriptWorkbenchMode, "submission">): string {
  if (mode === "screening") {
    return "先看队列，再进入单稿判断，避免初筛页面堆成参数后台。";
  }

  if (mode === "editing") {
    return "围绕当前稿件的结构修订与交接判断组织编辑工作。";
  }

  return "保持终稿确认路径清晰，批量动作不遮挡当前校对判断。";
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

