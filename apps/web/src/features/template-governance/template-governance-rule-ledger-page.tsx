import type { FormEvent } from "react";
import { formatWorkbenchHash } from "../../app/workbench-routing.ts";
import { TemplateGovernanceLedgerSearchPage } from "./template-governance-ledger-search-page.tsx";
import { TemplateGovernanceLedgerToolbar } from "./template-governance-ledger-toolbar.tsx";
import type {
  TemplateGovernanceLedgerSearchState,
  TemplateGovernanceRuleLedgerCategory,
  TemplateGovernanceRuleLedgerRow,
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

export interface TemplateGovernanceRuleLedgerFilterState {
  isOpen: boolean;
  moduleOptions: string[];
  publishStatusOptions: string[];
  semanticStatusOptions: string[];
  moduleValue: string;
  publishStatusValue: string;
  semanticStatusValue: string;
  onModuleValueChange?: (value: string) => void;
  onPublishStatusValueChange?: (value: string) => void;
  onSemanticStatusValueChange?: (value: string) => void;
}

export interface TemplateGovernanceRuleLedgerBulkState {
  isOpen: boolean;
  selectedRowIds: string[];
  showSelectedOnly: boolean;
  onToggleRowSelection?: (rowId: string) => void;
  onSelectVisibleRows?: () => void;
  onClearSelection?: () => void;
  onToggleShowSelectedOnly?: () => void;
}

export interface TemplateGovernanceRuleLedgerClientFilterInput {
  moduleValue: string;
  publishStatusValue: string;
  semanticStatusValue: string;
}

export interface TemplateGovernanceRuleLedgerPageProps {
  initialViewModel?: TemplateGovernanceRuleLedgerViewModel;
  navigationItems?: readonly TemplateGovernanceNavigationItem[];
  searchState?: TemplateGovernanceLedgerSearchState;
  filterState?: TemplateGovernanceRuleLedgerFilterState;
  bulkState?: TemplateGovernanceRuleLedgerBulkState;
  searchValue?: string;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onSearchValueChange?: (value: string) => void;
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onSelectCategory?: (category: TemplateGovernanceRuleLedgerCategory) => void;
  onSelectRow?: (rowId: string) => void;
  onOpenCreateRule?: () => void;
  onOpenSelectedItem?: (rowId: string) => void;
  selectedItemActionLabel?: string;
  onOpenSearch?: () => void;
  onOpenFilter?: () => void;
  onOpenBulkActions?: () => void;
  onImport?: () => void;
}

export function TemplateGovernanceRuleLedgerPage({
  initialViewModel = createEmptyTemplateGovernanceRuleLedgerViewModel(),
  navigationItems,
  searchState = createEmptyRuleLedgerSearchState(),
  filterState = createClosedRuleLedgerFilterState(),
  bulkState = createClosedRuleLedgerBulkState(),
  searchValue = "",
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  onSearchValueChange,
  onSearchSubmit,
  onSelectCategory,
  onSelectRow,
  onOpenCreateRule,
  onOpenSelectedItem,
  selectedItemActionLabel = "编辑规则",
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
  const selectedPackageRules = isPackageRuleLedgerRow(viewModel.selectedRow)
    ? viewModel.selectedRow.related_rules ?? []
    : [];
  const advancedEditorHref = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "classic",
    ruleCenterMode: "authoring",
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
      <TemplateGovernanceLedgerSearchPage searchState={searchState} />

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>规则中心操作说明</h2>
          <p>先分清规则本体、规则包和模板族各自负责什么，再进入具体台账或规则向导。</p>
        </header>
        <div className="template-governance-rule-hint-list">
          <article className="template-governance-rule-hint-card">
            <strong>建立规则</strong>
            <p>从“新建规则”进入五步向导，先录正文和证据，再确认语义、绑定规则包与模板族，最后提交发布。</p>
          </article>
          <article className="template-governance-rule-hint-card">
            <strong>修改规则</strong>
            <p>从规则台账或规则包里的默认规则进入编辑。已批准规则会先派生修订草稿，不直接覆盖当前已发布版本。</p>
          </article>
          <article className="template-governance-rule-hint-card">
            <strong>管理规则</strong>
            <p>规则台账管理规则本体，规则包负责复用组合，模板族决定默认适用稿件范围，三者配合完成治理。</p>
          </article>
        </div>
        <div className="template-governance-actions">
          <a className="template-governance-link-button" href={advancedEditorHref}>
            打开旧版高级工作台
          </a>
        </div>
      </article>

      {filterState.isOpen ? (
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>筛选面板</h2>
            <p>进一步按执行模块、语义状态和发布状态缩小当前台账范围。</p>
          </header>
          <div className="template-governance-detail-grid">
            <label className="template-governance-field">
              <span>执行模块</span>
              <select
                value={filterState.moduleValue}
                onChange={(event) => filterState.onModuleValueChange?.(event.target.value)}
              >
                <option value="all">全部模块</option>
                {filterState.moduleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>发布状态</span>
              <select
                value={filterState.publishStatusValue}
                onChange={(event) =>
                  filterState.onPublishStatusValueChange?.(event.target.value)
                }
              >
                <option value="all">全部状态</option>
                {filterState.publishStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="template-governance-field">
              <span>语义状态</span>
              <select
                value={filterState.semanticStatusValue}
                onChange={(event) =>
                  filterState.onSemanticStatusValueChange?.(event.target.value)
                }
              >
                <option value="all">全部状态</option>
                {filterState.semanticStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </article>
      ) : null}

      {bulkState.isOpen ? (
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>批量操作面板</h2>
            <p>进入多选模式后，可以先圈定当前结果，再决定是否仅查看已选项。</p>
          </header>
          <div className="template-governance-actions">
            <button type="button" onClick={bulkState.onSelectVisibleRows}>
              全选当前结果
            </button>
            <button type="button" onClick={bulkState.onToggleShowSelectedOnly}>
              {bulkState.showSelectedOnly ? "显示全部结果" : "仅看已选"}
            </button>
            <button type="button" onClick={bulkState.onClearSelection}>
              清空选择
            </button>
          </div>
          <p className="template-governance-selected-note">
            当前已选 {bulkState.selectedRowIds.length} 项。
          </p>
        </article>
      ) : null}

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
                {bulkState.isOpen ? <th>选择</th> : null}
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
                    {bulkState.isOpen ? (
                      <td className="template-governance-ledger-table-cell-check">
                        <input
                          type="checkbox"
                          checked={bulkState.selectedRowIds.includes(row.id)}
                          onChange={() => bulkState.onToggleRowSelection?.(row.id)}
                        />
                      </td>
                    ) : null}
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
                  <td colSpan={bulkState.isOpen ? 9 : 8}>当前分类下还没有规则资产。</td>
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
          {isPackageRuleLedgerRow(viewModel.selectedRow) ? (
            <section className="template-governance-card template-governance-ledger-section">
              <header className="template-governance-ledger-section-header">
                <h2>包内默认规则</h2>
                <p>
                  已绑定 {viewModel.selectedRow.default_rule_count ?? selectedPackageRules.length} 条默认规则。
                  点击规则名切到规则本体，再继续编辑或审核。
                </p>
              </header>
              {selectedPackageRules.length ? (
                <ul className="template-governance-list">
                  {selectedPackageRules.map((rule) => (
                    <li key={rule.id}>
                      <button
                        type="button"
                        className="template-governance-list-button"
                        onClick={() => onSelectRow?.(rule.id)}
                      >
                        <span>{rule.title}</span>
                        <small>
                          {rule.publish_status} 路 {rule.module_label}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="template-governance-empty">
                  当前规则包还没有绑定默认规则。
                </p>
              )}
            </section>
          ) : null}
          <div className="template-governance-actions">
            <button type="button" onClick={onOpenCreateRule} disabled={isBusy}>
              {isBusy ? "处理中..." : "新建规则"}
            </button>
            {canOpenSelectedRuleLedgerRow(viewModel.selectedRow) ? (
              <button
                type="button"
                onClick={() => onOpenSelectedItem?.(viewModel.selectedRow!.id)}
                disabled={isBusy}
              >
                {selectedItemActionLabel}
              </button>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}

export function applyTemplateGovernanceRuleLedgerClientFilters(
  rows: readonly TemplateGovernanceRuleLedgerRow[],
  filters: TemplateGovernanceRuleLedgerClientFilterInput,
): TemplateGovernanceRuleLedgerRow[] {
  return rows.filter((row) => {
    const matchesModule =
      filters.moduleValue === "all" || row.module_label === filters.moduleValue;
    const matchesPublishStatus =
      filters.publishStatusValue === "all" || row.publish_status === filters.publishStatusValue;
    const matchesSemanticStatus =
      filters.semanticStatusValue === "all" ||
      row.semantic_status === filters.semanticStatusValue;

    return matchesModule && matchesPublishStatus && matchesSemanticStatus;
  });
}

export function buildTemplateGovernanceRuleLedgerSearchState(
  rows: readonly TemplateGovernanceRuleLedgerRow[],
  query: string,
): TemplateGovernanceLedgerSearchState {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows =
    normalizedQuery.length === 0
      ? rows
      : rows.filter((row) =>
          [
            row.title,
            row.module_label,
            row.manuscript_type_label,
            row.semantic_status,
            row.publish_status,
            row.contributor_label,
          ].some((value) => value.toLowerCase().includes(normalizedQuery)),
        );

  return {
    mode: "results",
    query,
    title: "搜索结果预览",
    rows: filteredRows.map((row) => ({
      id: row.id,
      primary: row.title,
      secondary: `${formatRuleLedgerCategoryLabel(row.asset_kind)} · ${row.publish_status}`,
      cells: [row.module_label, row.manuscript_type_label, row.semantic_status],
    })),
  };
}

export function collectTemplateGovernanceRuleLedgerFilterOptions(
  rows: readonly TemplateGovernanceRuleLedgerRow[],
): Pick<
  TemplateGovernanceRuleLedgerFilterState,
  "moduleOptions" | "publishStatusOptions" | "semanticStatusOptions"
> {
  return {
    moduleOptions: collectUniqueValues(rows.map((row) => row.module_label)),
    publishStatusOptions: collectUniqueValues(rows.map((row) => row.publish_status)),
    semanticStatusOptions: collectUniqueValues(rows.map((row) => row.semantic_status)),
  };
}

function createEmptyRuleLedgerSearchState(): TemplateGovernanceLedgerSearchState {
  return {
    mode: "idle",
    query: "",
    title: "",
    rows: [],
  };
}

function createClosedRuleLedgerFilterState(): TemplateGovernanceRuleLedgerFilterState {
  return {
    isOpen: false,
    moduleOptions: [],
    publishStatusOptions: [],
    semanticStatusOptions: [],
    moduleValue: "all",
    publishStatusValue: "all",
    semanticStatusValue: "all",
  };
}

function createClosedRuleLedgerBulkState(): TemplateGovernanceRuleLedgerBulkState {
  return {
    isOpen: false,
    selectedRowIds: [],
    showSelectedOnly: false,
  };
}

function isPackageRuleLedgerRow(
  row: TemplateGovernanceRuleLedgerRow | null | undefined,
): row is TemplateGovernanceRuleLedgerRow & {
  asset_kind: "general_package" | "medical_package";
} {
  return row?.asset_kind === "general_package" || row?.asset_kind === "medical_package";
}

function canOpenSelectedRuleLedgerRow(
  row: TemplateGovernanceRuleLedgerRow | null | undefined,
): boolean {
  return row?.asset_kind === "rule" || row?.asset_kind === "recycled_candidate";
}

function collectUniqueValues(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
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
