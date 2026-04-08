import type {
  KnowledgeReviewActionViewModel,
  KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";

export interface KnowledgeReviewHistoryViewState {
  knowledgeItemId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  actions: readonly KnowledgeReviewActionViewModel[];
  errorMessage: string | null;
}

export interface KnowledgeReviewDetailPaneProps {
  item: KnowledgeReviewQueueItemViewModel | null;
  history: KnowledgeReviewHistoryViewState;
  isUsingStableSnapshot: boolean;
  historyScopeNote: string | null;
  onRetryHistory(): void;
}

export function KnowledgeReviewDetailPane({
  item,
  history,
  isUsingStableSnapshot,
  historyScopeNote,
  onRetryHistory,
}: KnowledgeReviewDetailPaneProps) {
  if (item == null) {
    return (
      <section className="knowledge-review-panel knowledge-review-detail-pane">
        <header className="knowledge-review-pane-header">
          <h2>知识详情</h2>
          <p>请先从队列中选择一条待审核知识。</p>
        </header>
        <div className="knowledge-review-empty-state knowledge-review-neutral-empty">
          从待审核队列中选择一条知识，即可加载完整上下文与审核动作。
        </div>
      </section>
    );
  }

  return (
    <section className="knowledge-review-panel knowledge-review-detail-pane">
      <header className="knowledge-review-pane-header">
        <h2>{item.title}</h2>
        <p>
          {isUsingStableSnapshot
            ? "正在沿用上一次稳定选择，等待队列恢复。"
            : "审核上下文"}
        </p>
      </header>

      <dl className="knowledge-review-detail-grid">
        <div>
          <dt>规范文本</dt>
          <dd className="knowledge-review-canonical-text">{item.canonical_text}</dd>
        </div>
        <div>
          <dt>摘要</dt>
          <dd>{item.summary?.trim().length ? item.summary : "未提供"}</dd>
        </div>
        <div>
          <dt>证据等级</dt>
          <dd>{renderEvidenceLevel(item.evidence_level)}</dd>
        </div>
        <div>
          <dt>来源类型</dt>
          <dd>{item.source_type ? startCase(item.source_type) : "未提供"}</dd>
        </div>
        <div>
          <dt>来源链接</dt>
          <dd>
            {item.source_link ? (
              <a href={item.source_link} target="_blank" rel="noreferrer">
                {item.source_link}
              </a>
            ) : (
              "未提供"
            )}
          </dd>
        </div>
        <div>
          <dt>适用范围</dt>
          <dd>{renderRoutingScope(item)}</dd>
        </div>
        <div>
          <dt>模板绑定</dt>
          <dd>{item.template_bindings?.length ? item.template_bindings.join(", ") : "无"}</dd>
        </div>
      </dl>

      <section className="knowledge-review-history">
        <header>
          <h3>审核历史</h3>
          <p>查看决策轨迹与审核备注。</p>
        </header>

        {historyScopeNote ? (
          <p className="knowledge-review-history-state">{historyScopeNote}</p>
        ) : null}

        {history.status === "loading" ? (
          <p className="knowledge-review-history-state" role="status">
            正在加载审核历史...
          </p>
        ) : null}

        {history.status === "error" ? (
          <div className="knowledge-review-banner knowledge-review-banner-error">
            <p>{history.errorMessage ?? "审核历史加载失败。"}</p>
            <button type="button" onClick={onRetryHistory}>
              重试加载历史
            </button>
          </div>
        ) : null}

        {history.actions.length === 0 && history.status !== "loading" ? (
          <p className="knowledge-review-history-state">暂未记录审核事件。</p>
        ) : null}

        {history.actions.length > 0 ? (
          <ol className="knowledge-review-history-list">
            {history.actions.map((action) => (
              <li key={action.id}>
                <p className="knowledge-review-history-event">
                  {eventLabel(action.action)} | {actorLabel(action.actor_role)}
                </p>
                <p className="knowledge-review-history-time">{formatTimestamp(action.created_at)}</p>
                <p className="knowledge-review-history-note">
                  {action.review_note?.trim().length ? action.review_note : "未填写审核备注"}
                </p>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </section>
  );
}

function renderEvidenceLevel(
  evidenceLevel: KnowledgeReviewQueueItemViewModel["evidence_level"],
): string {
  if (!evidenceLevel) {
    return "未提供";
  }

  if (evidenceLevel === "expert_opinion") {
    return "专家意见";
  }

  return startCase(evidenceLevel);
}

function renderRoutingScope(item: KnowledgeReviewQueueItemViewModel): string {
  const moduleScope =
    item.routing.module_scope === "any" ? "任意模块" : startCase(item.routing.module_scope);
  const manuscriptScope =
    item.routing.manuscript_types === "any"
      ? "不限稿件类型"
      : item.routing.manuscript_types.map(startCase).join(", ");

  return `${moduleScope} | ${manuscriptScope}`;
}

function eventLabel(action: KnowledgeReviewActionViewModel["action"]): string {
  switch (action) {
    case "submitted_for_review":
      return "提交审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return action;
  }
}

function actorLabel(actorRole: KnowledgeReviewActionViewModel["actor_role"]): string {
  switch (actorRole) {
    case "knowledge_reviewer":
      return "知识审核员";
    default:
      return startCase(actorRole);
  }
}

function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }

  return parsed.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startCase(value: string): string {
  return value
    .split("_")
    .map((part) => (part.length === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
}
