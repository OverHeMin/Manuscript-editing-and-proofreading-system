import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  searchValue: string;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
  queueItems: ManuscriptWorkbenchQueueItem[];
  activeQueueFilter: ManuscriptWorkbenchQueueFilter;
  onSearchChange(nextSearch: string): void;
  onQueueFilterChange(nextFilter: ManuscriptWorkbenchQueueFilter): void;
  onOpenQueueItem(manuscriptId: string): void;
  onDeleteQueueItem?(manuscriptId: string): void;
}

export function ManuscriptWorkbenchQueuePane({
  mode,
  busy,
  searchValue,
  workspace,
  latestJob,
  queueItems,
  activeQueueFilter,
  onSearchChange,
  onQueueFilterChange,
  onOpenQueueItem,
  onDeleteQueueItem,
}: ManuscriptWorkbenchQueuePaneProps) {
  const normalizedSearchValue = searchValue.trim().toLocaleLowerCase("zh-CN");
  const filteredQueueItems =
    normalizedSearchValue.length === 0
      ? queueItems
      : queueItems.filter((item) =>
          [item.title, item.manuscriptTypeLabel, item.statusLabel]
            .join(" ")
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedSearchValue),
        );
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
        <label className="manuscript-workbench-queue-field">
          <span>稿件查找</span>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="输入稿件标题或编号"
          />
        </label>
        <Button
          type="button"
          size="sm"
          disabled
          onClick={() => undefined}
        >
          {busy ? "加载中..." : "打开稿件"}
        </Button>
      </div>

      <div className="manuscript-workbench-queue-filters" aria-label="队列筛选">
        {QUEUE_FILTER_OPTIONS.map(([filter, label]) => (
          <Button
            key={filter}
            type="button"
            data-queue-filter={filter}
            size="sm"
            variant={filter === activeQueueFilter ? "default" : "secondary"}
            className="h-6 rounded-full px-2 text-xs leading-none"
            onClick={() => onQueueFilterChange(filter)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="manuscript-workbench-queue-list-shell">
        <div className="manuscript-workbench-queue-list-header">
          <strong>已上传稿件</strong>
          <p>{queueListHint}</p>
        </div>
        <div className="manuscript-workbench-queue-list manuscript-workbench-queue-table-shell">
          {filteredQueueItems.length > 0 ? (
            <Table className="manuscript-workbench-queue-table">
              <TableHeader>
                <TableRow>
                  <TableHead>稿件</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueueItems.map((item) => (
                  <TableRow
                    key={item.manuscriptId}
                    data-queue-item-status={item.queueStatus}
                    className={item.isActive ? "bg-[rgba(216,190,132,0.1)]" : undefined}
                  >
                    <TableCell>
                      <div className="grid gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#8b7341]">
                          {item.queueScope === "batch" ? "当前批次" : "最近打开"}
                        </span>
                        <strong className="line-clamp-2 text-sm leading-5 text-[#241d13]">
                          {item.title}
                        </strong>
                        <span className="text-xs text-[#625648]">
                          {item.manuscriptTypeLabel}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-1">
                        <Badge variant={resolveQueueBadgeVariant(item.queueStatus)}>
                          {item.statusLabel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="manuscript-workbench-queue-actions">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        disabled={busy}
                        onClick={() => onOpenQueueItem(item.manuscriptId)}
                      >
                        打开
                      </Button>
                        {onDeleteQueueItem ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs text-[#8a2f20]"
                            disabled={busy}
                            onClick={() => onDeleteQueueItem(item.manuscriptId)}
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    return "左侧只保留查找、状态和队列，把空间留给稿件列表。";
  }

  if (mode === "editing") {
    return "先看稿件状态，再进入右侧结果区继续处理。";
  }

  return "校对入口保持简洁，状态和排队情况在这里直接可见。";
}

function formatWorkbenchModeLabel(mode: string): string {
  if (mode === "screening") return "初筛";
  if (mode === "editing") return "编辑";
  if (mode === "proofreading") return "校对";
  if (mode === "upload") return "上传";
  if (mode === "manual") return "人工";
  return mode;
}

function resolveQueueBadgeVariant(
  status: Exclude<ManuscriptWorkbenchQueueFilter, "all">,
): "default" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "in_progress") return "warning";
  return "default";
}

function formatConcurrencyScopeLabel(
  scope: Exclude<ManuscriptWorkbenchMode, "submission"> | "global",
): string {
  if (scope === "global") return "总队列";
  if (scope === "screening") return "初筛";
  if (scope === "editing") return "编辑";
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
