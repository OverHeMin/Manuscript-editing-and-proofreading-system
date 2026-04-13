import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { TemplateGovernanceContentModuleLedgerViewModel } from "./template-governance-controller.ts";
import { TemplateGovernanceLedgerToolbar } from "./template-governance-ledger-toolbar.tsx";
import {
  TemplateGovernanceContentModuleForm,
  type TemplateGovernanceContentModuleFormValues,
} from "./template-governance-content-module-form.tsx";
import { TemplateGovernanceLedgerSearchPage } from "./template-governance-ledger-search-page.tsx";
import type { TemplateGovernanceLedgerSearchState } from "./template-governance-ledger-types.ts";
import {
  createTemplateGovernanceNavigationItems,
  type TemplateGovernanceNavigationItem,
} from "./template-governance-navigation.ts";
import {
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";

export interface TemplateGovernanceContentModuleLedgerPageProps {
  ledgerKind: "general" | "medical_specialized";
  viewModel: TemplateGovernanceContentModuleLedgerViewModel;
  formMode?: "create" | "edit" | null;
  formValues?: Partial<TemplateGovernanceContentModuleFormValues>;
  searchState?: TemplateGovernanceLedgerSearchState;
  searchValue?: string;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  navigationItems?: readonly TemplateGovernanceNavigationItem[];
  onSearchValueChange?: (value: string) => void;
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCreateForm?: () => void;
  onArchiveSelected?: () => void;
  onJoinTemplate?: () => void;
  onSelectModule?: (moduleId: string) => void;
  onOpenEditForm?: () => void;
  onFormChange?: Dispatch<SetStateAction<TemplateGovernanceContentModuleFormValues>>;
  onFormCancel?: () => void;
  onFormSubmit?: () => void;
}

export function TemplateGovernanceContentModuleLedgerPage({
  ledgerKind,
  viewModel,
  formMode = null,
  formValues,
  searchState = {
    mode: "idle",
    query: "",
    title: "",
    rows: [],
  },
  searchValue = "",
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  navigationItems,
  onSearchValueChange,
  onSearchSubmit,
  onOpenCreateForm,
  onArchiveSelected,
  onJoinTemplate,
  onSelectModule,
  onOpenEditForm,
  onFormChange,
  onFormCancel,
  onFormSubmit,
}: TemplateGovernanceContentModuleLedgerPageProps) {
  const pageTitle =
    ledgerKind === "general" ? "通用包台账" : "医学专用包台账";
  const selectedModule = viewModel.selectedModule;

  return (
    <section className="template-governance-content-module-ledger-page">
      <TemplateGovernanceLedgerToolbar
        title={pageTitle}
        subtitle={
          ledgerKind === "general"
            ? "把跨稿件类型可复用的规则与说明沉淀为通用包，再统一挂到大模板。"
            : "把医学专用解析、证据与风险边界整理为医学专用包，再按场景复用。"
        }
        navigationItems={
          navigationItems ??
          createTemplateGovernanceNavigationItems(
            ledgerKind === "general"
              ? "general-package-ledger"
              : "medical-package-ledger",
          )
        }
        searchValue={searchValue}
        searchPlaceholder={`搜索${pageTitle}`}
        onSearchValueChange={onSearchValueChange}
        onSearchSubmit={onSearchSubmit}
        actions={
          <>
            <button type="button" onClick={onOpenCreateForm}>
              新增{ledgerKind === "general" ? "通用包" : "医学包"}
            </button>
            <button type="button" onClick={onArchiveSelected}>
              删除
            </button>
            <button type="button" onClick={onJoinTemplate}>
              加入大模板
            </button>
          </>
        }
      />
      {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-ledger-kpi-strip">
        <article className="template-governance-ledger-kpi">
          <span>包总数</span>
          <strong>{viewModel.summary.totalCount}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>草稿数</span>
          <strong>{viewModel.summary.draftCount}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>已发布数</span>
          <strong>{viewModel.summary.publishedCount}</strong>
        </article>
      </div>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>{pageTitle}</h2>
          <p>表格优先展示所有录入的规则包，再决定是否进入编辑表单。</p>
        </header>
        <div className="template-governance-ledger-table-shell">
          <table className="template-governance-ledger-table">
            <thead>
              <tr>
                <th>包名称</th>
                <th>{ledgerKind === "general" ? "包分类" : "医学场景"}</th>
                <th>适用稿件</th>
                <th>适用模块</th>
                {ledgerKind === "medical_specialized" ? <th>证据/风险</th> : null}
                <th>大模板使用数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {viewModel.modules.length ? (
                viewModel.modules.map((module) => (
                  <tr
                    key={module.id}
                    className={
                      module.id === viewModel.selectedModuleId
                        ? "template-governance-ledger-row is-selected"
                        : "template-governance-ledger-row"
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="template-governance-ledger-row-button"
                        onClick={() => onSelectModule?.(module.id)}
                      >
                        {module.name}
                      </button>
                    </td>
                    <td>{module.category}</td>
                    <td>
                      {module.manuscript_type_scope
                        .map((item) => formatTemplateGovernanceManuscriptTypeLabel(item))
                        .join(" / ")}
                    </td>
                    <td>
                      {module.execution_module_scope
                        .map((item) => formatTemplateGovernanceModuleLabel(item))
                        .join(" / ")}
                    </td>
                    {ledgerKind === "medical_specialized" ? (
                      <td>
                        {module.evidence_level ?? "未知"} / {module.risk_level ?? "未设定"}
                      </td>
                    ) : null}
                    <td>{module.template_usage_count}</td>
                    <td>
                      {formatTemplateGovernanceGovernedAssetStatusLabel(module.status)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={ledgerKind === "medical_specialized" ? 7 : 6}>
                    当前还没有规则包记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      <TemplateGovernanceLedgerSearchPage searchState={searchState} />

      {selectedModule ? (
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>当前规则包</h2>
            <p>选中后查看摘要、边界与复用情况，再决定是否加入大模板。</p>
          </header>
          <div className="template-governance-detail-grid">
            <div>
              <span>名称</span>
              <p>{selectedModule.name}</p>
            </div>
            <div>
              <span>类别</span>
              <p>{selectedModule.category}</p>
            </div>
            <div className="template-governance-field-full">
              <span>摘要</span>
              <p>{selectedModule.summary}</p>
            </div>
          </div>
          <div className="template-governance-actions">
            <button type="button" onClick={onJoinTemplate}>
              加入大模板
            </button>
            <button type="button" onClick={onOpenEditForm}>
              编辑规则包
            </button>
          </div>
        </article>
      ) : null}

      {formMode ? (
        <TemplateGovernanceContentModuleForm
          ledgerKind={ledgerKind}
          mode={formMode}
          initialValues={formValues}
          isBusy={isBusy}
          onChange={onFormChange}
          onCancel={onFormCancel}
          onSubmit={onFormSubmit}
        />
      ) : null}
    </section>
  );
}
