import type { TemplateGovernanceView } from "../../app/workbench-routing.ts";
import { createTemplateGovernanceNavigationItems } from "./template-governance-navigation.ts";

export interface TemplateGovernanceOverviewMetrics {
  templateCount: number;
  moduleCount: number;
  pendingKnowledgeCount: number;
  extractionAwaitingConfirmationCount: number;
}

export interface TemplateGovernanceOverviewPendingItem {
  id: string;
  title: string;
  detail: string;
  emphasis: string;
  actionLabel: string;
  targetView: TemplateGovernanceView;
}

export interface TemplateGovernanceOverviewRecentUpdate {
  id: string;
  title: string;
  detail: string;
  statusLabel: string;
  targetView: TemplateGovernanceView;
}

export interface TemplateGovernanceOverviewPageProps {
  metrics: TemplateGovernanceOverviewMetrics;
  pendingItems?: readonly TemplateGovernanceOverviewPendingItem[];
  recentUpdates?: readonly TemplateGovernanceOverviewRecentUpdate[];
  onOpenView?: (view: TemplateGovernanceView) => void;
}

export function TemplateGovernanceOverviewPage({
  metrics,
  pendingItems = buildTemplateGovernanceOverviewFallbackPendingItems(metrics),
  recentUpdates = buildTemplateGovernanceOverviewFallbackUpdates(metrics),
  onOpenView,
}: TemplateGovernanceOverviewPageProps) {
  return (
    <section className="template-governance-overview-page">
      <div className="template-governance-overview-shell">
        <header className="template-governance-overview-hero">
          <div className="template-governance-overview-hero-copy">
            <p className="template-governance-eyebrow">规则中心总览</p>
            <h1>规则中心</h1>
            <p>
              首页只保留规则录入、待处理事项和最新资产进展，低频子台账入口统一放在顶部导航里。
            </p>
          </div>

          <div className="template-governance-overview-metrics">
            <article className="template-governance-card template-governance-overview-metric">
              <span className="template-governance-overview-metric-label">大模板数</span>
              <strong className="template-governance-overview-metric-value">
                {metrics.templateCount}
              </strong>
            </article>
            <article className="template-governance-card template-governance-overview-metric">
              <span className="template-governance-overview-metric-label">规则包数</span>
              <strong className="template-governance-overview-metric-value">
                {metrics.moduleCount}
              </strong>
            </article>
            <article className="template-governance-card template-governance-overview-metric">
              <span className="template-governance-overview-metric-label">待整理知识项</span>
              <strong className="template-governance-overview-metric-value">
                {metrics.pendingKnowledgeCount}
              </strong>
            </article>
            <article className="template-governance-card template-governance-overview-metric">
              <span className="template-governance-overview-metric-label">
                待确认提取候选
              </span>
              <strong className="template-governance-overview-metric-value">
                {metrics.extractionAwaitingConfirmationCount}
              </strong>
            </article>
          </div>

          <nav
            className="template-governance-ledger-nav template-governance-overview-nav"
            aria-label="规则中心切换"
          >
            {createTemplateGovernanceNavigationItems("overview").map((item) => (
              <button
                key={item.key}
                type="button"
                className={`template-governance-ledger-nav-item${item.isActive ? " is-active" : ""}${item.priority === "secondary" ? " is-secondary" : ""}`}
                onClick={item.key === "overview" ? undefined : () => onOpenView?.(item.key)}
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
              <p>先进入共享向导录入规则，再回到规则台账完成筛选、浏览和治理。</p>
            </header>
            <div className="template-governance-actions template-governance-overview-primary-actions">
              <button
                type="button"
                className="template-governance-overview-primary-action"
                onClick={() => onOpenView?.("authoring")}
              >
                新建规则
              </button>
              <button type="button" onClick={() => onOpenView?.("rule-ledger")}>
                进入规则台账
              </button>
              <button type="button" onClick={() => onOpenView?.("extraction-ledger")}>
                查看待审核
              </button>
            </div>
          </article>

          <div className="template-governance-overview-secondary">
            <article className="template-governance-card template-governance-overview-entry">
              <header className="template-governance-ledger-section-header">
                <h2>待处理事项</h2>
                <p>先处理会阻塞规则沉淀的事项，让首页保持短、准、可执行。</p>
              </header>
              {pendingItems.length ? (
                <ul className="template-governance-list">
                  {pendingItems.map((item) => (
                    <li key={item.id}>
                      <div className="template-governance-list-button template-governance-overview-list-item">
                        <span>{item.title}</span>
                        <small>{item.detail}</small>
                        <strong>{item.emphasis}</strong>
                        <button type="button" onClick={() => onOpenView?.(item.targetView)}>
                          {item.actionLabel}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="template-governance-empty">当前没有待首页优先处理的规则事项。</p>
              )}
            </article>

            <article className="template-governance-card template-governance-overview-entry">
              <header className="template-governance-ledger-section-header">
                <h2>最近包 / 模板更新</h2>
                <p>让操作者快速知道当前规则包、模板和指令资产的最新关注点。</p>
              </header>
              {recentUpdates.length ? (
                <ul className="template-governance-list">
                  {recentUpdates.map((item) => (
                    <li key={item.id}>
                      <div className="template-governance-list-button template-governance-overview-list-item">
                        <span>{item.title}</span>
                        <small>{item.detail}</small>
                        <strong>{item.statusLabel}</strong>
                        <button type="button" onClick={() => onOpenView?.(item.targetView)}>
                          打开台账
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="template-governance-empty">当前还没有可回看的包或模板更新。</p>
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

  if (metrics.extractionAwaitingConfirmationCount > 0) {
    items.push({
      id: "pending-extraction-candidates",
      title: "回流候选待确认",
      detail: `${metrics.extractionAwaitingConfirmationCount} 条候选等待转成规则或驳回。`,
      emphasis: `待处理 ${metrics.extractionAwaitingConfirmationCount} 条`,
      actionLabel: "处理候选",
      targetView: "extraction-ledger",
    });
  }

  if (metrics.pendingKnowledgeCount > 0) {
    items.push({
      id: "pending-knowledge-items",
      title: "知识规则待整理",
      detail: `${metrics.pendingKnowledgeCount} 条知识规则仍停留在草稿或待审核。`,
      emphasis: `待整理 ${metrics.pendingKnowledgeCount} 条`,
      actionLabel: "打开规则台账",
      targetView: "rule-ledger",
    });
  }

  return items;
}

export function buildTemplateGovernanceOverviewFallbackUpdates(
  metrics: TemplateGovernanceOverviewMetrics,
): TemplateGovernanceOverviewRecentUpdate[] {
  return [
    {
      id: "update-template-family-count",
      title: "大模板治理",
      detail: `当前共管理 ${metrics.templateCount} 个模板族入口。`,
      statusLabel: metrics.templateCount > 0 ? "持续维护" : "待补齐",
      targetView: "large-template-ledger",
    },
    {
      id: "update-package-count",
      title: "规则包与模块模板",
      detail: `当前共沉淀 ${metrics.moduleCount} 个模块模板或规则包入口。`,
      statusLabel: metrics.moduleCount > 0 ? "已有沉淀" : "待建立",
      targetView: "general-package-ledger",
    },
  ];
}
