import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";
import type { KnowledgeKind, KnowledgeReviewQueueItemViewModel } from "../knowledge/index.ts";
import type { KnowledgeReviewFilterState } from "./workbench-state.ts";

export interface KnowledgeReviewQueuePaneProps {
  filters: Pick<KnowledgeReviewFilterState, "searchText" | "knowledgeKind" | "moduleScope">;
  queue: readonly KnowledgeReviewQueueItemViewModel[];
  totalQueueCount: number;
  activeItemId: string | null;
  isLoading: boolean;
  loadErrorMessage: string | null;
  isQueueEmpty: boolean;
  isNoResults: boolean;
  onSearchTextChange(value: string): void;
  onKnowledgeKindChange(value: KnowledgeReviewFilterState["knowledgeKind"]): void;
  onModuleScopeChange(value: KnowledgeReviewFilterState["moduleScope"]): void;
  onSelectItem(itemId: string): void;
  onRetryQueue(): void;
}

const moduleOptions: Array<{
  value: KnowledgeReviewFilterState["moduleScope"];
  label: string;
}> = [
  { value: "all", label: "全部模块" },
  { value: "any", label: "任意模块" },
  { value: "upload", label: "接稿" },
  { value: "screening", label: "初筛" },
  { value: "editing", label: "编辑" },
  { value: "proofreading", label: "校对" },
  { value: "pdf_consistency", label: "PDF 一致性" },
  { value: "learning", label: "学习改写" },
  { value: "manual", label: "人工整理" },
];

const knowledgeKindOptions: Array<{
  value: KnowledgeReviewFilterState["knowledgeKind"];
  label: string;
}> = [
  { value: "all", label: "全部类型" },
  { value: "rule", label: "规则" },
  { value: "case_pattern", label: "案例模式" },
  { value: "checklist", label: "检查清单" },
  { value: "prompt_snippet", label: "提示词片段" },
  { value: "reference", label: "参考资料" },
  { value: "other", label: "其他" },
];

export function KnowledgeReviewQueuePane({
  filters,
  queue,
  totalQueueCount,
  activeItemId,
  isLoading,
  loadErrorMessage,
  isQueueEmpty,
  isNoResults,
  onSearchTextChange,
  onKnowledgeKindChange,
  onModuleScopeChange,
  onSelectItem,
  onRetryQueue,
}: KnowledgeReviewQueuePaneProps) {
  return (
    <section className="knowledge-review-panel knowledge-review-queue-pane">
      <header className="knowledge-review-pane-header knowledge-review-pane-header-compact">
        <div>
          <h2>待审核队列</h2>
          <p>筛选、选择、切换都保持在队列侧完成，减少审核跳转。</p>
        </div>
        <div className="knowledge-review-queue-summary">
          <span className="knowledge-review-summary-chip is-muted">当前 {queue.length}</span>
          <span className="knowledge-review-summary-chip is-muted">总待审 {totalQueueCount}</span>
        </div>
      </header>

      <div className="knowledge-review-queue-controls knowledge-review-compact-filters">
        <label className="knowledge-review-search-field">
          <span>搜索</span>
          <input
            type="search"
            value={filters.searchText}
            placeholder="搜索标题、规范文本、别名或风险标签"
            onChange={(event) => onSearchTextChange(event.target.value)}
          />
        </label>

        <div className="knowledge-review-compact-filter-row">
          <label>
            <span>知识类型</span>
            <select
              value={filters.knowledgeKind}
              onChange={(event) =>
                onKnowledgeKindChange(
                  event.target.value as KnowledgeReviewFilterState["knowledgeKind"],
                )
              }
            >
              {knowledgeKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>模块范围</span>
            <select
              value={filters.moduleScope}
              onChange={(event) =>
                onModuleScopeChange(
                  event.target.value as KnowledgeReviewFilterState["moduleScope"],
                )
              }
            >
              {moduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="knowledge-review-filter-note">当前仅展示待审核修订。</p>
      </div>

      <div className="knowledge-review-queue-scroll" data-scroll-owner="queue">
        {loadErrorMessage ? (
          <div className="knowledge-review-banner knowledge-review-banner-error" role="status">
            <p>{loadErrorMessage}</p>
            <button type="button" onClick={onRetryQueue}>
              刷新队列
            </button>
          </div>
        ) : null}

        {isLoading && totalQueueCount === 0 ? (
          <div className="knowledge-review-empty-state" role="status">
            正在加载待审核修订...
          </div>
        ) : null}

        {!isLoading && isQueueEmpty ? (
          <div className="knowledge-review-empty-state">当前没有待审核修订。</div>
        ) : null}

        {!isLoading && !isQueueEmpty && isNoResults ? (
          <div className="knowledge-review-empty-state">
            当前筛选条件下没有匹配的队列项。
          </div>
        ) : null}

        {!isQueueEmpty && !isNoResults ? (
          <ul className="knowledge-review-queue-list">
            {queue.map((item) => {
              const isActive = item.id === activeItemId;
              const hints = resolveHintText(item);

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`knowledge-review-queue-item${isActive ? " is-active" : ""}`}
                    onClick={() => onSelectItem(item.id)}
                  >
                    <p className="knowledge-review-queue-title">{item.title}</p>
                    <p className="knowledge-review-queue-meta-row">
                      <span>{item.asset_id}</span>
                      <span>{item.revision_id}</span>
                    </p>
                    <p className="knowledge-review-queue-meta-row">
                      <span>{formatKnowledgeKind(item.knowledge_kind)}</span>
                      <span>{formatModuleScope(item.routing.module_scope)}</span>
                      <span>{formatEvidenceLevel(item.evidence_level)}</span>
                    </p>
                    <p className="knowledge-review-queue-meta-row">
                      {formatManuscriptTypes(item.routing.manuscript_types)}
                    </p>
                    {hints ? <p className="knowledge-review-queue-hints">{hints}</p> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function formatKnowledgeKind(kind: KnowledgeKind): string {
  switch (kind) {
    case "rule":
      return "规则";
    case "case_pattern":
      return "案例模式";
    case "checklist":
      return "检查清单";
    case "prompt_snippet":
      return "提示词片段";
    case "reference":
      return "参考资料";
    case "other":
      return "其他";
    default:
      return startCase(kind);
  }
}

function formatModuleScope(moduleScope: ManuscriptModule | "any"): string {
  if (moduleScope === "any") {
    return "任意模块";
  }

  if (moduleScope === "pdf_consistency") {
    return "PDF 一致性";
  }

  if (moduleScope === "upload") {
    return "接稿";
  }

  if (moduleScope === "screening") {
    return "初筛";
  }

  if (moduleScope === "editing") {
    return "编辑";
  }

  if (moduleScope === "proofreading") {
    return "校对";
  }

  if (moduleScope === "learning") {
    return "学习改写";
  }

  if (moduleScope === "manual") {
    return "人工整理";
  }

  return startCase(moduleScope);
}

function formatEvidenceLevel(
  evidenceLevel: KnowledgeReviewQueueItemViewModel["evidence_level"],
): string {
  if (!evidenceLevel) {
    return "证据等级：未填写";
  }

  if (evidenceLevel === "expert_opinion") {
    return "证据等级：专家意见";
  }

  return `证据等级：${formatEvidenceLevelValue(evidenceLevel)}`;
}

function formatManuscriptTypes(types: ManuscriptType[] | "any"): string {
  if (types === "any") {
    return "稿件类型：任意";
  }

  if (types.length === 0) {
    return "稿件类型：未配置";
  }

  return `稿件类型：${types.map(formatManuscriptType).join("、")}`;
}

function resolveHintText(item: KnowledgeReviewQueueItemViewModel): string {
  const templateHint = compactHint("模板", item.template_bindings);
  const riskHint = compactHint("风险", item.routing.risk_tags);
  const hints = [templateHint, riskHint].filter((value): value is string => Boolean(value));

  return hints.join(" · ");
}

function compactHint(label: string, values: readonly string[] | undefined): string | null {
  if (!values || values.length === 0) {
    return null;
  }

  const renderedValues = values.slice(0, 2);
  const overflow = values.length - renderedValues.length;
  const suffix = overflow > 0 ? ` +${overflow}` : "";

  return `${label}: ${renderedValues.join(", ")}${suffix}`;
}

function formatManuscriptType(type: ManuscriptType): string {
  switch (type) {
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

function formatEvidenceLevelValue(
  evidenceLevel: NonNullable<KnowledgeReviewQueueItemViewModel["evidence_level"]>,
): string {
  switch (evidenceLevel) {
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
