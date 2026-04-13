import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { TemplateGovernanceTemplateLedgerViewModel } from "./template-governance-controller.ts";
import { TemplateGovernanceLedgerToolbar } from "./template-governance-ledger-toolbar.tsx";
import {
  createTemplateGovernanceNavigationItems,
  type TemplateGovernanceNavigationItem,
} from "./template-governance-navigation.ts";
import {
  TemplateGovernanceTemplateForm,
  type TemplateGovernanceTemplateFormValues,
} from "./template-governance-template-form.tsx";
import { TemplateGovernanceLedgerSearchPage } from "./template-governance-ledger-search-page.tsx";
import type { TemplateGovernanceLedgerSearchState } from "./template-governance-ledger-types.ts";
import {
  formatTemplateGovernanceGovernedAssetStatusLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";

export interface TemplateGovernanceTemplateLedgerPageProps {
  viewModel: TemplateGovernanceTemplateLedgerViewModel;
  formMode?: "create" | "edit" | null;
  formValues?: Partial<TemplateGovernanceTemplateFormValues>;
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
  onApplyToManuscript?: () => void;
  onSelectTemplate?: (templateId: string) => void;
  onOpenEditForm?: () => void;
  onFormChange?: Dispatch<SetStateAction<TemplateGovernanceTemplateFormValues>>;
  onFormCancel?: () => void;
  onFormSubmit?: () => void;
}

export function TemplateGovernanceTemplateLedgerPage({
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
  onApplyToManuscript,
  onSelectTemplate,
  onOpenEditForm,
  onFormChange,
  onFormCancel,
  onFormSubmit,
}: TemplateGovernanceTemplateLedgerPageProps) {
  const selectedTemplate = viewModel.selectedTemplate;

  return (
    <section className="template-governance-template-ledger-page">
      <TemplateGovernanceLedgerToolbar
        title="大模板台账"
        subtitle="按稿件族集中治理大模板骨架，统一通用包、医学专用包和适用模块。"
        navigationItems={
          navigationItems ??
          createTemplateGovernanceNavigationItems("large-template-ledger")
        }
        searchValue={searchValue}
        searchPlaceholder="搜索大模板"
        onSearchValueChange={onSearchValueChange}
        onSearchSubmit={onSearchSubmit}
        actions={
          <>
            <button type="button" onClick={onOpenCreateForm}>
              新增大模板
            </button>
            <button type="button" onClick={onArchiveSelected}>
              删除
            </button>
            <button type="button" onClick={onApplyToManuscript}>
              套用到稿件
            </button>
          </>
        }
      />
      {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-ledger-kpi-strip">
        <article className="template-governance-ledger-kpi">
          <span>大模板总数</span>
          <strong>{viewModel.summary.templateCount}</strong>
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
          <h2>大模板列表</h2>
          <p>表格优先展示稿件类型、适用模块以及通用包与医学专用包的组合情况。</p>
        </header>
        <div className="template-governance-ledger-table-shell">
          <table className="template-governance-ledger-table">
            <thead>
              <tr>
                <th>大模板名称</th>
                <th>稿件类型</th>
                <th>通用包</th>
                <th>医学专用包</th>
                <th>适用模块</th>
                <th>版本</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {viewModel.templates.length ? (
                viewModel.templates.map((template) => (
                  <tr
                    key={template.id}
                    className={
                      template.id === viewModel.selectedTemplateId
                        ? "template-governance-ledger-row is-selected"
                        : "template-governance-ledger-row"
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="template-governance-ledger-row-button"
                        onClick={() => onSelectTemplate?.(template.id)}
                      >
                        {template.name}
                      </button>
                    </td>
                    <td>
                      {formatTemplateGovernanceManuscriptTypeLabel(
                        template.manuscript_type,
                      )}
                    </td>
                    <td>{template.general_module_ids.length}</td>
                    <td>{template.medical_module_ids.length}</td>
                    <td>
                      {template.execution_module_scope
                        .map((module) => formatTemplateGovernanceModuleLabel(module))
                        .join(" / ")}
                    </td>
                    <td>v{template.version_no}</td>
                    <td>
                      {formatTemplateGovernanceGovernedAssetStatusLabel(
                        template.status,
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>当前还没有大模板记录。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      <TemplateGovernanceLedgerSearchPage searchState={searchState} />

      {selectedTemplate ? (
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>当前大模板</h2>
            <p>选中后先核对包组合与适用边界，再决定是否继续套用到期刊模板或稿件。</p>
          </header>
          <div className="template-governance-detail-grid">
            <div>
              <span>名称</span>
              <p>{selectedTemplate.name}</p>
            </div>
            <div>
              <span>稿件类型</span>
              <p>
                {formatTemplateGovernanceManuscriptTypeLabel(
                  selectedTemplate.manuscript_type,
                )}
              </p>
            </div>
            <div>
              <span>通用包</span>
              <p>{selectedTemplate.general_module_ids.length}</p>
            </div>
            <div>
              <span>医学专用包</span>
              <p>{selectedTemplate.medical_module_ids.length}</p>
            </div>
          </div>
          <div className="template-governance-actions">
            <button type="button" onClick={onApplyToManuscript}>
              套用到稿件
            </button>
            <button type="button" onClick={onOpenEditForm}>
              编辑大模板
            </button>
          </div>
        </article>
      ) : null}

      {formMode ? (
        <TemplateGovernanceTemplateForm
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
