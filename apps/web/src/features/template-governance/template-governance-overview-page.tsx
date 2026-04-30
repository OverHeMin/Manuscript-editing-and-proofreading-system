import type {
  RuleCenterMode,
  TemplateGovernanceView,
} from "../../app/workbench-routing.ts";
import { createTemplateGovernanceNavigationItems } from "./template-governance-navigation.ts";

export interface TemplateGovernanceOverviewMetrics {
  templateCount: number;
  moduleCount: number;
  pendingKnowledgeCount: number;
  extractionAwaitingConfirmationCount: number;
  retrievalAnswerRelevancy?: number;
  retrievalContextPrecision?: number;
  retrievalContextRecall?: number;
  pendingReviewCount?: number;
  harnessQueuedCount?: number;
  harnessPassedCount?: number;
  harnessFailedCount?: number;
  ruleDraftWritebackDraftCount?: number;
  ruleDraftWritebackAppliedCount?: number;
  candidateRuleSetCount?: number;
  canaryRuleSetCount?: number;
  activeRuleSetCount?: number;
  rolledBackRuleSetCount?: number;
  blockedReleaseCount?: number;
}
export interface TemplateGovernanceOverviewPendingItem {
  id: string;
  title: string;
  detail: string;
  emphasis: string;
  actionLabel: string;
  targetView: TemplateGovernanceView;
  targetMode?: RuleCenterMode;
}

export interface TemplateGovernanceOverviewRecentUpdate {
  id: string;
  title: string;
  detail: string;
  statusLabel: string;
  targetView: TemplateGovernanceView;
  targetMode?: RuleCenterMode;
}

export interface TemplateGovernanceOverviewPageProps {
  metrics: TemplateGovernanceOverviewMetrics;
  pendingItems?: readonly TemplateGovernanceOverviewPendingItem[];
  recentUpdates?: readonly TemplateGovernanceOverviewRecentUpdate[];
  onOpenView?: (view: TemplateGovernanceView, mode?: RuleCenterMode) => void;
}

interface TemplateGovernanceOverviewMetricCard {
  kind?: string;
  label: string;
  value: number;
  detail?: string;
}

export function TemplateGovernanceOverviewPage({
  metrics,
  pendingItems = buildTemplateGovernanceOverviewFallbackPendingItems(metrics),
  recentUpdates = buildTemplateGovernanceOverviewFallbackUpdates(metrics),
  onOpenView,
}: TemplateGovernanceOverviewPageProps) {
  const hasRetrievalGovernanceEvidence =
    metrics.retrievalAnswerRelevancy != null ||
    metrics.retrievalContextPrecision != null ||
    metrics.retrievalContextRecall != null;
  const metricCards: TemplateGovernanceOverviewMetricCard[] = [
    { label: "大模板台账", value: metrics.templateCount },
    { label: "规则台账", value: metrics.moduleCount },
    { label: "待审核知识项", value: metrics.pendingKnowledgeCount },
    { label: "回流候选待确认", value: metrics.extractionAwaitingConfirmationCount },
    { label: "统一复核待处理", value: metrics.pendingReviewCount ?? 0 },
    { label: "Harness 待验证", value: metrics.harnessQueuedCount ?? 0 },
    { label: "Harness 已通过", value: metrics.harnessPassedCount ?? 0 },
    { label: "Harness 未通过", value: metrics.harnessFailedCount ?? 0 },
    { label: "规则草稿待写回", value: metrics.ruleDraftWritebackDraftCount ?? 0 },
    { label: "规则草稿已写回", value: metrics.ruleDraftWritebackAppliedCount ?? 0 },
    { label: "候选规则集", value: metrics.candidateRuleSetCount ?? 0 },
    { label: "Canary 规则集", value: metrics.canaryRuleSetCount ?? 0 },
    { label: "已生效规则集", value: metrics.activeRuleSetCount ?? 0 },
    { label: "已回滚规则集", value: metrics.rolledBackRuleSetCount ?? 0 },
    { label: "发布阻塞项", value: metrics.blockedReleaseCount ?? 0 },
  ].filter((card, index) => index < 10 || shouldShowReleaseMetric(metrics, card.label));
  metricCards.splice(
    0,
    metricCards.length,
    ...buildTemplateGovernanceOverviewMetricCards(metrics),
  );

  return (
    <section className="template-governance-overview-page">
      <div className="template-governance-overview-shell">
        <header className="template-governance-overview-hero">
          <div className="template-governance-overview-hero-copy">
            <p className="template-governance-eyebrow">规则中心运营驾驶舱</p>
            <h1>规则中心总览</h1>
          </div>

          <div className="template-governance-overview-metrics">
            {metricCards.map((card) => (
              <article
                key={card.label}
                className="template-governance-card template-governance-overview-metric"
                data-governance-metric-kind={card.kind}
              >
                <span className="template-governance-overview-metric-label">
                  {card.label}
                </span>
                <strong className="template-governance-overview-metric-value">
                  {card.value}
                </strong>
                {card.detail ? (
                  <small className="template-governance-overview-metric-detail">
                    {card.detail}
                  </small>
                ) : null}
              </article>
            ))}
          </div>

          <nav
            className="template-governance-ledger-nav template-governance-overview-nav"
            aria-label="规则中心导航"
          >
            {createTemplateGovernanceNavigationItems("overview").map((item) => (
              <button
                key={item.key}
                type="button"
                className={`template-governance-ledger-nav-item${item.isActive ? " is-active" : ""}${item.priority === "secondary" ? " is-secondary" : ""}`}
                onClick={
                  item.key === "overview" ? undefined : () => onOpenView?.(item.key)
                }
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="template-governance-overview-main">
          <article className="template-governance-card template-governance-overview-entry template-governance-overview-primary">
            <header className="template-governance-ledger-section-header">
              <h2>规则台账</h2>
            </header>
            <div className="template-governance-actions template-governance-overview-primary-actions">
              <button
                type="button"
                className="template-governance-overview-primary-action"
                onClick={() => onOpenView?.("authoring", "authoring")}
              >
                新建规则
              </button>
              <button type="button" onClick={() => onOpenView?.("rule-ledger", "ai-intake")}>
                新建 AI 规则草稿
              </button>
              <button type="button" onClick={() => onOpenView?.("rule-ledger")}>
                进入规则台账
              </button>
              <button type="button" onClick={() => onOpenView?.("rule-ledger", "learning")}>
                查看待审核
              </button>
            </div>
          </article>

          <div className="template-governance-overview-secondary">
            <article className="template-governance-card template-governance-overview-entry">
              <header className="template-governance-ledger-section-header">
                <h2>检索治理证据</h2>
              </header>
              {hasRetrievalGovernanceEvidence ? (
                <div className="template-governance-chip-row">
                  {metrics.retrievalAnswerRelevancy != null ? (
                    <span className="template-governance-chip">
                      答案相关性{" "}
                      {formatTemplateGovernanceOverviewRetrievalMetric(
                        metrics.retrievalAnswerRelevancy,
                      )}
                    </span>
                  ) : null}
                  {metrics.retrievalContextPrecision != null ? (
                    <span className="template-governance-chip">
                      上下文精确率{" "}
                      {formatTemplateGovernanceOverviewRetrievalMetric(
                        metrics.retrievalContextPrecision,
                      )}
                    </span>
                  ) : null}
                  {metrics.retrievalContextRecall != null ? (
                    <span className="template-governance-chip">
                      上下文召回率{" "}
                      {formatTemplateGovernanceOverviewRetrievalMetric(
                        metrics.retrievalContextRecall,
                      )}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="template-governance-empty">
                  当前还没有可汇总的检索治理指标。
                </p>
              )}
            </article>

            <article className="template-governance-card template-governance-overview-entry">
              <header className="template-governance-ledger-section-header">
                <h2>待处理事项</h2>
              </header>
              {pendingItems.length ? (
                <ul className="template-governance-list">
                  {pendingItems.map((item) => (
                    <li key={item.id}>
                      <div className="template-governance-list-button template-governance-overview-list-item">
                        <span>{item.title}</span>
                        <small>{item.detail}</small>
                        <strong>{item.emphasis}</strong>
                        <button
                          type="button"
                          onClick={() => onOpenView?.(item.targetView, item.targetMode)}
                        >
                          {item.actionLabel}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="template-governance-empty">当前没有待处理事项。</p>
              )}
            </article>

            <article className="template-governance-card template-governance-overview-entry">
              <header className="template-governance-ledger-section-header">
                <h2>最近包 / 模板更新</h2>
              </header>
              {recentUpdates.length ? (
                <ul className="template-governance-list">
                  {recentUpdates.map((item) => (
                    <li key={item.id}>
                      <div className="template-governance-list-button template-governance-overview-list-item">
                        <span>{item.title}</span>
                        <small>{item.detail}</small>
                        <strong>{item.statusLabel}</strong>
                        <button
                          type="button"
                          onClick={() => onOpenView?.(item.targetView, item.targetMode)}
                        >
                          进入台账
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="template-governance-empty">最近没有新的治理更新。</p>
              )}
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export function buildTemplateGovernanceOverviewFallbackPendingItems(
  metrics: TemplateGovernanceOverviewMetrics,
): TemplateGovernanceOverviewPendingItem[] {
  const items: TemplateGovernanceOverviewPendingItem[] = [];

  if ((metrics.pendingReviewCount ?? 0) > 0) {
    items.push({
      id: "pending-review-items",
      title: "统一复核待处理",
      detail: `${metrics.pendingReviewCount} 条高风险命中或残差问题仍在等待人工复核。`,
      emphasis: `待处理 ${metrics.pendingReviewCount} 条`,
      actionLabel: "进入统一复核队列",
      targetView: "rule-ledger",
      targetMode: "learning",
    });
  }

  if ((metrics.harnessQueuedCount ?? 0) > 0) {
    items.push({
      id: "pending-harness-queued",
      title: "待验证",
      detail: `${metrics.harnessQueuedCount} 条规则候选正在等待验证结果回传。`,
      emphasis: `待验证 ${metrics.harnessQueuedCount} 条`,
      actionLabel: "查看待审核",
      targetView: "rule-ledger",
      targetMode: "learning",
    });
  }

  if ((metrics.ruleDraftWritebackDraftCount ?? 0) > 0) {
    items.push({
      id: "pending-rule-writebacks",
      title: "规则草稿待写回",
      detail: `${metrics.ruleDraftWritebackDraftCount} 个规则候选已经生成规则草稿，但还没有完成写回。`,
      emphasis: `待写回 ${metrics.ruleDraftWritebackDraftCount} 个`,
      actionLabel: "查看写回进度",
      targetView: "rule-ledger",
      targetMode: "learning",
    });
  }

  if (metrics.extractionAwaitingConfirmationCount > 0) {
    items.push({
      id: "pending-extraction-candidates",
      title: "回流候选待确认",
      detail: `${metrics.extractionAwaitingConfirmationCount} 条原稿/编辑稿提取结果仍需人工确认后才能进入规则沉淀。`,
      emphasis: `待确认 ${metrics.extractionAwaitingConfirmationCount} 条`,
      actionLabel: "打开原稿/编辑稿提取",
      targetView: "extraction-ledger",
    });
  }

  return items;
}

export function buildTemplateGovernanceOverviewFallbackUpdates(
  metrics: TemplateGovernanceOverviewMetrics,
): TemplateGovernanceOverviewRecentUpdate[] {
  return [
    {
      id: "update-template-ledger",
      title: "临床研究大模板族",
      detail: `当前共有 ${metrics.templateCount} 个大模板版本处于治理视图中。`,
      statusLabel: "大模板台账",
      targetView: "large-template-ledger",
    },
    {
      id: "update-journal-ledger",
      title: "期刊模板台账",
      detail: "继续维护期刊差异化规则与模板绑定。",
      statusLabel: "期刊模板台账",
      targetView: "journal-template-ledger",
    },
    {
      id: "update-general-package-ledger",
      title: "通用包台账",
      detail: `当前共有 ${metrics.moduleCount} 个规则或包资产可复用。`,
      statusLabel: "通用包台账",
      targetView: "general-package-ledger",
    },
    {
      id: "update-medical-package-ledger",
      title: "医学专用包台账",
      detail: "检查医学专用治理包的最新修订与证据补齐情况。",
      statusLabel: "医学专用包台账",
      targetView: "medical-package-ledger",
    },
    {
      id: "update-extraction-ledger",
      title: "原稿/编辑稿提取",
      detail: "继续把人工确认后的候选改动沉淀成规则资产。",
      statusLabel: "原稿/编辑稿提取",
      targetView: "extraction-ledger",
    },
  ];
}

function shouldShowReleaseMetric(
  metrics: TemplateGovernanceOverviewMetrics,
  label: string,
): boolean {
  switch (label) {
    case "候选规则集":
      return metrics.candidateRuleSetCount !== undefined;
    case "Canary 规则集":
      return metrics.canaryRuleSetCount !== undefined;
    case "已生效规则集":
      return metrics.activeRuleSetCount !== undefined;
    case "已回滚规则集":
      return metrics.rolledBackRuleSetCount !== undefined;
    case "发布阻塞项":
      return metrics.blockedReleaseCount !== undefined;
    default:
      return true;
  }
}

function buildTemplateGovernanceOverviewMetricCards(
  metrics: TemplateGovernanceOverviewMetrics,
): TemplateGovernanceOverviewMetricCard[] {
  const cards: TemplateGovernanceOverviewMetricCard[] = [
    {
      kind: "template-ledger",
      label: "\u5927\u6a21\u677f\u53f0\u8d26",
      value: metrics.templateCount,
      detail: `\u89c4\u5219\u53f0\u8d26 ${metrics.moduleCount} \u4e2a\u53ef\u590d\u7528\u8d44\u4ea7`,
    },
    {
      kind: "knowledge-review",
      label: "\u5f85\u5ba1\u6838\u77e5\u8bc6\u9879",
      value: metrics.pendingKnowledgeCount,
    },
    {
      kind: "extraction-confirmation",
      label: "\u56de\u6d41\u5019\u9009\u5f85\u786e\u8ba4",
      value: metrics.extractionAwaitingConfirmationCount,
    },
    {
      kind: "manual-review",
      label: "\u7edf\u4e00\u590d\u6838\u5f85\u5904\u7406",
      value: metrics.pendingReviewCount ?? 0,
      detail: `\u89c4\u5219\u8349\u7a3f\u5f85\u5199\u56de ${metrics.ruleDraftWritebackDraftCount ?? 0} \u4e2a\uff0c\u89c4\u5219\u8349\u7a3f\u5df2\u5199\u56de ${metrics.ruleDraftWritebackAppliedCount ?? 0} \u4e2a`,
    },
    {
      kind: "harness",
      label: "待验证",
      value: metrics.harnessQueuedCount ?? 0,
      detail: `已通过 ${metrics.harnessPassedCount ?? 0} 条，未通过 ${metrics.harnessFailedCount ?? 0} 条`,
    },
  ];

  if (hasTemplateGovernanceReleasePostureMetrics(metrics)) {
    cards.push({
      kind: "release-posture",
      label: "\u53d1\u5e03\u963b\u585e\u9879",
      value: metrics.blockedReleaseCount ?? 0,
      detail:
        `\u5019\u9009\u89c4\u5219\u96c6 ${metrics.candidateRuleSetCount ?? 0} \u4e2a\uff0c` +
        `Canary \u89c4\u5219\u96c6 ${metrics.canaryRuleSetCount ?? 0} \u4e2a\uff0c` +
        `\u5df2\u751f\u6548\u89c4\u5219\u96c6 ${metrics.activeRuleSetCount ?? 0} \u4e2a\uff0c` +
        `\u5df2\u56de\u6eda\u89c4\u5219\u96c6 ${metrics.rolledBackRuleSetCount ?? 0} \u4e2a`,
    });
  }

  return cards;
}

function hasTemplateGovernanceReleasePostureMetrics(
  metrics: TemplateGovernanceOverviewMetrics,
): boolean {
  return (
    metrics.candidateRuleSetCount !== undefined ||
    metrics.canaryRuleSetCount !== undefined ||
    metrics.activeRuleSetCount !== undefined ||
    metrics.rolledBackRuleSetCount !== undefined ||
    metrics.blockedReleaseCount !== undefined
  );
}

function formatTemplateGovernanceOverviewRetrievalMetric(value: number): string {
  return value.toFixed(2);
}
