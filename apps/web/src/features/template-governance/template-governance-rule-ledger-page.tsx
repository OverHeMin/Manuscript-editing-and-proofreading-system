import type { FormEvent } from "react";
import { TemplateGovernanceLedgerToolbar } from "./template-governance-ledger-toolbar.tsx";
import type {
  TemplateGovernanceRuleLedgerCategory,
  TemplateGovernanceRuleLedgerViewModel,
} from "./template-governance-ledger-types.ts";
import {
  createEmptyTemplateGovernanceRuleLedgerViewModel,
  createTemplateGovernanceRuleLedgerViewModel,
  templateGovernanceRuleLedgerCategoryOrder,
} from "./template-governance-rule-ledger-state.ts";
import {
  createTemplateGovernanceNavigationItems,
  type TemplateGovernanceNavigationItem,
} from "./template-governance-navigation.ts";

export interface TemplateGovernanceRuleLedgerPageProps {
  initialViewModel?: TemplateGovernanceRuleLedgerViewModel;
  navigationItems?: readonly TemplateGovernanceNavigationItem[];
  searchValue?: string;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onSearchValueChange?: (value: string) => void;
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onSelectCategory?: (category: TemplateGovernanceRuleLedgerCategory) => void;
  onSelectRow?: (rowId: string) => void;
  onOpenCreateRule?: () => void;
  onOpenSearch?: () => void;
  onOpenFilter?: () => void;
  onOpenBulkActions?: () => void;
  onImport?: () => void;
}

export function TemplateGovernanceRuleLedgerPage({
  initialViewModel = createEmptyTemplateGovernanceRuleLedgerViewModel(),
  navigationItems,
  searchValue = "",
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  onSearchValueChange,
  onSearchSubmit,
  onSelectCategory,
  onSelectRow,
  onOpenCreateRule,
  onOpenSearch,
  onOpenFilter,
  onOpenBulkActions,
  onImport,
}: TemplateGovernanceRuleLedgerPageProps) {
  const viewModel = createTemplateGovernanceRuleLedgerViewModel({
    rows: initialViewModel.rows,
    category: initialViewModel.category,
    searchQuery: initialViewModel.searchQuery,
    selectedRowId: initialViewModel.selectedRowId ?? initialViewModel.selectedRow?.id ?? null,
  });

  return (
    <section className="template-governance-rule-ledger-page">
      <TemplateGovernanceLedgerToolbar
        title="规则台账"
        subtitle="把规则、模板、规则包和回流候选放进同一张日常台账，先看表，再做治理。"
        navigationItems={
          navigationItems ?? createTemplateGovernanceNavigationItems("rule-ledger")
        }
        searchValue={searchValue}
        searchPlaceholder="搜索规则、模板、规则包或回流候选"
        onSearchValueChange={onSearchValueChange}
        onSearchSubmit={onSearchSubmit}
        actions={
          <>
            <button type="button" onClick={onOpenCreateRule}>
              新建规则
            </button>
            <button type="button" onClick={onOpenSearch}>
              搜索
            </button>
            <button type="button" onClick={onOpenFilter}>
              筛选
            </button>
            <button type="button" onClick={onOpenBulkActions}>
              批量操作
            </button>
            <button type="button" onClick={onImport}>
              导入
            </button>
          </>
        }
      />

      {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-ledger-kpi-strip">
        <article className="template-governance-ledger-kpi">
          <span>全部资产</span>
          <strong>{viewModel.summary?.totalCount ?? 0}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>当前视图</span>
          <strong>{viewModel.rows.length}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>草稿</span>
          <strong>{viewModel.summary?.draftCount ?? 0}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>已发布</span>
          <strong>{viewModel.summary?.publishedCount ?? 0}</strong>
        </article>
      </div>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>分类视图</h2>
          <p>用同一张表切换规则、模板、规则包和回流候选，不再跳进多个旧工作台。</p>
        </header>
        <div className="template-governance-ledger-nav" aria-label="规则台账分类">
          {templateGovernanceRuleLedgerCategoryOrder.map((category) => (
            <button
              key={category}
              type="button"
              className={`template-governance-ledger-nav-item${
                viewModel.category === category ? " is-active" : ""
              }`}
              onClick={() => onSelectCategory?.(category)}
            >
              {formatRuleLedgerCategoryLabel(category)}
            </button>
          ))}
        </div>
      </article>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>统一规则资产表</h2>
          <p>集中查看适用模块、稿件类型、语义状态和发布状态，选择后在下方看紧凑详情。</p>
        </header>
        <div className="template-governance-ledger-table-shell">
          <table className="template-governance-ledger-table">
            <thead>
              <tr>
                <th>资产名称</th>
                <th>资产类别</th>
                <th>适用模块</th>
                <th>稿件类型</th>
                <th>语义状态</th>
                <th>发布状态</th>
                <th>贡献者</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {viewModel.rows.length ? (
                viewModel.rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.id === viewModel.selectedRowId
                        ? "template-governance-ledger-row is-selected"
                        : "template-governance-ledger-row"
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="template-governance-ledger-row-button"
                        onClick={() => onSelectRow?.(row.id)}
                      >
                        {row.title}
                      </button>
                    </td>
                    <td>{formatRuleLedgerCategoryLabel(row.asset_kind)}</td>
                    <td>{row.module_label}</td>
                    <td>{row.manuscript_type_label}</td>
                    <td>{row.semantic_status}</td>
                    <td>{row.publish_status}</td>
                    <td>{row.contributor_label}</td>
                    <td>{formatRuleLedgerTimestamp(row.updated_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>当前分类下还没有规则资产。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {viewModel.selectedRow ? (
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>当前选中项</h2>
            <p>保持详情面板紧凑，只展示高频判断信息。</p>
          </header>
          <div className="template-governance-detail-grid">
            <div>
              <span>资产名称</span>
              <p>{viewModel.selectedRow.title}</p>
            </div>
            <div>
              <span>资产类别</span>
              <p>{formatRuleLedgerCategoryLabel(viewModel.selectedRow.asset_kind)}</p>
            </div>
            <div>
              <span>适用模块</span>
              <p>{viewModel.selectedRow.module_label}</p>
            </div>
            <div>
              <span>稿件类型</span>
              <p>{viewModel.selectedRow.manuscript_type_label}</p>
            </div>
            <div>
              <span>语义状态</span>
              <p>{viewModel.selectedRow.semantic_status}</p>
            </div>
            <div>
              <span>发布状态</span>
              <p>{viewModel.selectedRow.publish_status}</p>
            </div>
            <div>
              <span>贡献者</span>
              <p>{viewModel.selectedRow.contributor_label}</p>
            </div>
            <div>
              <span>更新时间</span>
              <p>{formatRuleLedgerTimestamp(viewModel.selectedRow.updated_at)}</p>
            </div>
          </div>
          <div className="template-governance-actions">
            <button type="button" onClick={onOpenCreateRule} disabled={isBusy}>
              {isBusy ? "处理中..." : "新建规则"}
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}

function formatRuleLedgerCategoryLabel(category: TemplateGovernanceRuleLedgerCategory): string {
  switch (category) {
    case "all":
      return "全部资产";
    case "rule":
      return "规则";
    case "large_template":
      return "大模板";
    case "journal_template":
      return "期刊模板";
    case "general_package":
      return "通用包";
    case "medical_package":
      return "医学专用包";
    case "recycled_candidate":
      return "回流候选";
    default:
      return category;
  }
}

function formatRuleLedgerTimestamp(value: string | undefined): string {
  if (!value) {
    return "待补充";
  }

  return value.replace("T", " ").replace(".000Z", "");
}
