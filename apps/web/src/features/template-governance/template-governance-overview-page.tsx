import type { TemplateGovernanceView } from "../../app/workbench-routing.ts";
import { createTemplateGovernanceNavigationItems } from "./template-governance-navigation.ts";

export interface TemplateGovernanceOverviewMetrics {
  templateCount: number;
  moduleCount: number;
  pendingKnowledgeCount: number;
  extractionAwaitingConfirmationCount: number;
}

type OverviewEntryView =
  | "large-template-ledger"
  | "journal-template-ledger"
  | "extraction-ledger"
  | "general-package-ledger"
  | "medical-package-ledger";

export interface TemplateGovernanceOverviewPageProps {
  metrics: TemplateGovernanceOverviewMetrics;
  onOpenView?: (view: TemplateGovernanceView) => void;
}

interface OverviewEntry {
  view: OverviewEntryView;
  title: string;
  description: string;
}

const overviewEntries: OverviewEntry[] = [
  {
    view: "large-template-ledger",
    title: "大模板台账",
    description: "管理稿件族级的大模板骨架、适用模块和套用边界。",
  },
  {
    view: "journal-template-ledger",
    title: "期刊模板台账",
    description: "在大模板之下管理期刊或场景级的小模板差异。",
  },
  {
    view: "general-package-ledger",
    title: "通用包台账",
    description: "沉淀跨稿件类型可复用的通用规则包与说明层。",
  },
  {
    view: "medical-package-ledger",
    title: "医学专用包台账",
    description: "维护医学专用解析、统计阈值与高风险边界。",
  },
  {
    view: "extraction-ledger",
    title: "原稿/编辑稿提取台账",
    description: "统一管理提取任务、AI 语义确认和候选去向。",
  },
];

export function TemplateGovernanceOverviewPage({
  metrics,
  onOpenView,
}: TemplateGovernanceOverviewPageProps) {
  return (
    <section className="template-governance-overview-page">
      <header className="template-governance-overview-header">
        <div>
          <p className="template-governance-eyebrow">规则中心总览</p>
          <h1>规则中心</h1>
        </div>
      </header>

      <nav className="template-governance-ledger-nav" aria-label="规则中心切换">
        {createTemplateGovernanceNavigationItems("overview").map((item) => (
          <button
            key={item.key}
            type="button"
            className={`template-governance-ledger-nav-item${item.isActive ? " is-active" : ""}`}
            onClick={
              item.key === "overview"
                ? undefined
                : () => onOpenView?.(item.key)
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="template-governance-overview-metrics">
        <article className="template-governance-card">
          <h2>大模板数</h2>
          <p>{metrics.templateCount}</p>
        </article>
        <article className="template-governance-card">
          <h2>规则包数</h2>
          <p>{metrics.moduleCount}</p>
        </article>
        <article className="template-governance-card">
          <h2>待整理知识项</h2>
          <p>{metrics.pendingKnowledgeCount}</p>
        </article>
        <article className="template-governance-card">
          <h2>待确认提取候选</h2>
          <p>{metrics.extractionAwaitingConfirmationCount}</p>
        </article>
      </div>

      <div className="template-governance-overview-entries">
        <article
          className="template-governance-card template-governance-overview-entry"
        >
          <h2>规则台账</h2>
          <p>把规则、规则包和候选去向收拢到同一条主工作线，作为规则中心的日常入口。</p>
          <div className="template-governance-actions">
            <button type="button" onClick={() => onOpenView?.("rule-ledger")}>
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
      </div>

      <div className="template-governance-overview-entries">
        {overviewEntries.map((entry) => (
          <article
            key={entry.view}
            className="template-governance-card template-governance-overview-entry"
          >
            <h2>{entry.title}</h2>
            <p>{entry.description}</p>
            <button type="button" onClick={() => onOpenView?.(entry.view)}>
              打开台账
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function isTemplateGovernanceOverviewEntryView(
  value: TemplateGovernanceView,
): value is OverviewEntryView {
  return overviewEntries.some((entry) => entry.view === value);
}
