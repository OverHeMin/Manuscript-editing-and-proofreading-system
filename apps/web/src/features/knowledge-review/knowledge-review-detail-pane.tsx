import type {
  KnowledgeReviewActionViewModel,
  KnowledgeReviewQueueItemViewModel,
} from "../knowledge/index.ts";

export interface KnowledgeReviewHistoryViewState {
  revisionId: string | null;
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
  return (
    <section className="knowledge-review-panel knowledge-review-detail-pane">
      <header className="knowledge-review-pane-header knowledge-review-pane-header-compact">
        {item == null ? (
          <div>
            <h2>知识修订详情</h2>
            <p>详情区集中展示当前待审修订的上下文、证据和审核轨迹。</p>
          </div>
        ) : (
          <div>
            <h2>{item.title}</h2>
            <p>
              {isUsingStableSnapshot
                ? "实时队列暂时不可用，当前保留最近一次稳定选择供继续核对。"
                : "在审核站里集中核对规范文本、适用范围与审核轨迹。"}
            </p>
          </div>
        )}
      </header>

      <div className="knowledge-review-detail-scroll" data-scroll-owner="detail">
        {item == null ? (
          <div className="knowledge-review-empty-state knowledge-review-neutral-empty">
            请选择一条待审修订，以加载对应资产、修订上下文与审核历史。
          </div>
        ) : (
          <>
            <dl className="knowledge-review-detail-grid">
              <div>
                <dt>资产 ID</dt>
                <dd>{item.asset_id}</dd>
              </div>
              <div>
                <dt>修订 ID</dt>
                <dd>{item.revision_id}</dd>
              </div>
              <div>
                <dt>修订状态</dt>
                <dd>{renderStatus(item.status)}</dd>
              </div>
              <div>
                <dt>证据等级</dt>
                <dd>{renderEvidenceLevel(item.evidence_level)}</dd>
              </div>
              <div>
                <dt>来源类型</dt>
                <dd>{item.source_type ? renderSourceType(item.source_type) : "未填写"}</dd>
              </div>
              <div>
                <dt>生效区间</dt>
                <dd>{renderEffectiveWindow(item.effective_at, item.expires_at)}</dd>
              </div>
              <div>
                <dt>适用范围</dt>
                <dd>{renderRoutingScope(item)}</dd>
              </div>
              <div>
                <dt>模板绑定</dt>
                <dd>{item.template_bindings?.length ? item.template_bindings.join("、") : "无"}</dd>
              </div>
              <div className="knowledge-review-detail-span-full">
                <dt>规范文本</dt>
                <dd className="knowledge-review-canonical-text">{item.canonical_text}</dd>
              </div>
              <div className="knowledge-review-detail-span-full">
                <dt>摘要</dt>
                <dd>{item.summary?.trim().length ? item.summary : "未填写"}</dd>
              </div>
              <div className="knowledge-review-detail-span-full">
                <dt>来源链接</dt>
                <dd>
                  {item.source_link ? (
                    <a href={item.source_link} target="_blank" rel="noreferrer">
                      {item.source_link}
                    </a>
                  ) : (
                    "未填写"
                  )}
                </dd>
              </div>
            </dl>

            <section className="knowledge-review-history">
              <header>
                <h3>审核历史</h3>
                <p>按修订维度追踪审核结论与审核备注。</p>
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
                    刷新历史
                  </button>
                </div>
              ) : null}

              {history.actions.length === 0 && history.status !== "loading" ? (
                <p className="knowledge-review-history-state">暂未记录审核动作。</p>
              ) : null}

              {history.actions.length > 0 ? (
                <ol className="knowledge-review-history-list">
                  {history.actions.map((action) => (
                    <li key={action.id}>
                      <p className="knowledge-review-history-event">
                        {eventLabel(action.action)} · {actorLabel(action.actor_role)}
                      </p>
                      <p className="knowledge-review-history-event">
                        修订 {action.revision_id ?? action.knowledge_item_id}
                      </p>
                      <p className="knowledge-review-history-time">
                        {formatTimestamp(action.created_at)}
                      </p>
                      <p className="knowledge-review-history-note">
                        {action.review_note?.trim().length
                          ? action.review_note
                          : "未记录审核备注。"}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function renderEvidenceLevel(
  evidenceLevel: KnowledgeReviewQueueItemViewModel["evidence_level"],
): string {
  if (!evidenceLevel) {
    return "未填写";
  }

  if (evidenceLevel === "expert_opinion") {
    return "专家意见";
  }

  return renderEvidenceLevelValue(evidenceLevel);
}

function renderRoutingScope(item: KnowledgeReviewQueueItemViewModel): string {
  const moduleScope =
    item.routing.module_scope === "any"
      ? "任意模块"
      : renderModuleScope(item.routing.module_scope);
  const manuscriptScope =
    item.routing.manuscript_types === "any"
      ? "任意稿件类型"
      : item.routing.manuscript_types.map(renderManuscriptType).join("、");

  return `${moduleScope} · ${manuscriptScope}`;
}

function renderEffectiveWindow(
  effectiveAt: string | undefined,
  expiresAt: string | undefined,
): string {
  if (!effectiveAt && !expiresAt) {
    return "长期生效";
  }

  const start = effectiveAt ? formatTimestamp(effectiveAt) : "立即生效";
  const end = expiresAt ? formatTimestamp(expiresAt) : "无失效时间";
  return `${start} 至 ${end}`;
}

function renderStatus(status: KnowledgeReviewQueueItemViewModel["status"]): string {
  switch (status) {
    case "pending_review":
      return "待审核";
    case "approved":
      return "审核通过";
    case "draft":
      return "草稿";
    case "deprecated":
      return "已停用";
    case "superseded":
      return "已被替代";
    case "archived":
      return "已归档";
    default:
      return startCase(status);
  }
}

function eventLabel(action: KnowledgeReviewActionViewModel["action"]): string {
  switch (action) {
    case "submitted_for_review":
      return "提交审核";
    case "approved":
      return "审核通过";
    case "rejected":
      return "驳回修订";
    default:
      return action;
  }
}

function actorLabel(actorRole: KnowledgeReviewActionViewModel["actor_role"]): string {
  switch (actorRole) {
    case "admin":
      return "管理员";
    case "editor":
      return "编辑";
    case "knowledge_reviewer":
      return "知识审核员";
    case "proofreader":
      return "校对";
    case "screener":
      return "初筛";
    case "user":
      return "用户";
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

function renderModuleScope(value: string): string {
  switch (value) {
    case "upload":
      return "接稿";
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "pdf_consistency":
      return "PDF 一致性";
    case "learning":
      return "学习改写";
    case "manual":
      return "人工整理";
    default:
      return startCase(value);
  }
}

function renderManuscriptType(value: string): string {
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

function renderSourceType(value: string): string {
  switch (value) {
    case "paper":
      return "论文";
    case "guideline":
      return "指南";
    case "book":
      return "书籍";
    case "website":
      return "网站";
    case "internal_case":
      return "内部案例";
    case "other":
    default:
      return "其他";
  }
}

function renderEvidenceLevelValue(value: string): string {
  switch (value) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "expert_opinion":
      return "专家意见";
    case "unknown":
    default:
      return "未知";
  }
}

function startCase(value: string): string {
  return value
    .split("_")
    .map((part) => (part.length === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
}
