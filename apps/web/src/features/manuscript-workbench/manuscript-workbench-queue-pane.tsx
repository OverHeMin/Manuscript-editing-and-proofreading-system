import type { JobViewModel } from "../manuscripts/index.ts";
import type { ModuleJobViewModel } from "../screening/index.ts";
import type { ManuscriptWorkbenchLookupPanelProps } from "./manuscript-workbench-controls.tsx";
import type {
  ManuscriptWorkbenchMode,
  ManuscriptWorkbenchWorkspace,
} from "./manuscript-workbench-controller.ts";

type AnyWorkbenchJob = JobViewModel | ModuleJobViewModel;

export interface ManuscriptWorkbenchQueuePaneProps {
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  busy: boolean;
  lookup: ManuscriptWorkbenchLookupPanelProps;
  workspace: ManuscriptWorkbenchWorkspace | null;
  latestJob: AnyWorkbenchJob | null;
}

export function ManuscriptWorkbenchQueuePane({
  mode,
  busy,
  lookup,
  workspace,
  latestJob,
}: ManuscriptWorkbenchQueuePaneProps) {
  const canLoadWorkspace = lookup.manuscriptId.trim().length > 0;
  const queueTitle = `${formatWorkbenchModeLabel(mode)}队列`;
  const queueHint = resolveQueueHint(mode);
  const detectedType = workspace
    ? formatManuscriptTypeLabel(workspace.manuscript.manuscript_type)
    : "待 AI 识别";

  return (
    <aside className="manuscript-workbench-queue-pane">
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

      <div className="manuscript-workbench-queue-list">
        <article className="manuscript-workbench-queue-item is-active">
          <div className="manuscript-workbench-queue-item-header">
            <div>
              <span className="manuscript-workbench-queue-item-kicker">当前关注稿件</span>
              <h4>{workspace?.manuscript.title ?? "等待载入当前稿件"}</h4>
            </div>
            <span className="manuscript-workbench-queue-item-badge">
              {workspace ? formatManuscriptStatusLabel(workspace.manuscript.status) : "待载入"}
            </span>
          </div>
          <dl className="manuscript-workbench-queue-item-meta">
            <div>
              <dt>稿件编号</dt>
              <dd>{workspace?.manuscript.id ?? (lookup.manuscriptId.trim() || "未选择")}</dd>
            </div>
            <div>
              <dt>AI 识别稿件类型</dt>
              <dd>{detectedType}</dd>
            </div>
            <div>
              <dt>最近任务</dt>
              <dd>{latestJob ? formatWorkbenchModeLabel(latestJob.module) : "等待执行记录"}</dd>
            </div>
          </dl>
        </article>

        <div className="manuscript-workbench-queue-tip">
          <strong>队列与单稿分层</strong>
          <p>左侧用于定位当前稿件，中央只保留单稿判断，批量与辅助动作统一收进右侧抽屉。</p>
        </div>
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

function formatManuscriptTypeLabel(manuscriptType: string): string {
  switch (manuscriptType) {
    case "review":
      return "综述";
    case "clinical_study":
      return "临床研究";
    case "case_report":
      return "病例报告";
    default:
      return manuscriptType;
  }
}

function formatManuscriptStatusLabel(status: string): string {
  switch (status) {
    case "uploaded":
      return "已上传";
    case "processing":
      return "处理中";
    case "completed":
      return "已完成";
    case "awaiting_review":
      return "待人工复核";
    default:
      return status;
  }
}
