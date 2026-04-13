import type { Dispatch, FormEvent, SetStateAction } from "react";
import type {
  JournalTemplateProfileViewModel,
  TemplateFamilyViewModel,
} from "../templates/index.ts";
import {
  formatTemplateGovernanceFamilyStatusLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
} from "./template-governance-display.ts";
import { TemplateGovernanceLedgerToolbar } from "./template-governance-ledger-toolbar.tsx";
import { TemplateGovernanceLedgerSearchPage } from "./template-governance-ledger-search-page.tsx";
import type { TemplateGovernanceLedgerSearchState } from "./template-governance-ledger-types.ts";
import {
  createTemplateGovernanceNavigationItems,
  type TemplateGovernanceNavigationItem,
} from "./template-governance-navigation.ts";
import {
  TemplateGovernanceJournalTemplateForm,
  type TemplateGovernanceJournalTemplateFormValues,
} from "./template-governance-journal-template-form.tsx";

export interface TemplateGovernanceJournalTemplateLedgerSummary {
  familyCount: number;
  journalCount: number;
  activeCount: number;
}

export interface TemplateGovernanceJournalTemplateLedgerViewModel {
  templateFamilies: readonly TemplateFamilyViewModel[];
  selectedTemplateFamilyId: string | null;
  selectedTemplateFamily: TemplateFamilyViewModel | null;
  journalTemplates: readonly JournalTemplateProfileViewModel[];
  selectedJournalTemplateId: string | null;
  selectedJournalTemplate: JournalTemplateProfileViewModel | null;
  summary: TemplateGovernanceJournalTemplateLedgerSummary;
}

export interface TemplateGovernanceJournalTemplateLedgerPageProps {
  viewModel: TemplateGovernanceJournalTemplateLedgerViewModel;
  formMode?: "create" | "edit" | null;
  formValues?: Partial<TemplateGovernanceJournalTemplateFormValues>;
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
  onActivateSelected?: () => void;
  onSelectTemplateFamily?: (templateFamilyId: string) => void;
  onSelectJournalTemplate?: (journalTemplateId: string) => void;
  onOpenEditForm?: () => void;
  onFormChange?: Dispatch<
    SetStateAction<TemplateGovernanceJournalTemplateFormValues>
  >;
  onFormCancel?: () => void;
  onFormSubmit?: () => void;
}

export function TemplateGovernanceJournalTemplateLedgerPage({
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
  onActivateSelected,
  onSelectTemplateFamily,
  onSelectJournalTemplate,
  onOpenEditForm,
  onFormChange,
  onFormCancel,
  onFormSubmit,
}: TemplateGovernanceJournalTemplateLedgerPageProps) {
  return (
    <section className="template-governance-journal-template-ledger-page">
      <TemplateGovernanceLedgerToolbar
        title="期刊模板台账"
        subtitle="在大模板之下维护期刊或场景级差异，保持继承关系清晰。"
        navigationItems={
          navigationItems ??
          createTemplateGovernanceNavigationItems("journal-template-ledger")
        }
        searchValue={searchValue}
        searchPlaceholder="搜索期刊模板"
        onSearchValueChange={onSearchValueChange}
        onSearchSubmit={onSearchSubmit}
        actions={
          <>
            <button type="button" onClick={onOpenCreateForm}>
              新增期刊模板
            </button>
            <button type="button" onClick={onArchiveSelected}>
              删除
            </button>
            <button type="button" onClick={onActivateSelected}>
              启用模板
            </button>
          </>
        }
      />
      {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-ledger-kpi-strip">
        <article className="template-governance-ledger-kpi">
          <span>大模板数</span>
          <strong>{viewModel.summary.familyCount}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>期刊模板数</span>
          <strong>{viewModel.summary.journalCount}</strong>
        </article>
        <article className="template-governance-ledger-kpi">
          <span>启用中</span>
          <strong>{viewModel.summary.activeCount}</strong>
        </article>
      </div>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>大模板范围</h2>
          <p>先锁定所属大模板，再查看或维护该范围下的期刊模板。</p>
        </header>
        <div className="template-governance-actions">
          {viewModel.templateFamilies.map((family) => (
            <button
              key={family.id}
              type="button"
              className={
                family.id === viewModel.selectedTemplateFamilyId ? "is-active" : ""
              }
              onClick={() => onSelectTemplateFamily?.(family.id)}
            >
              {family.name}
            </button>
          ))}
        </div>
      </article>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>期刊模板列表</h2>
          <p>表格集中呈现所属大模板、期刊键和当前状态，便于快速维护。</p>
        </header>
        <div className="template-governance-ledger-table-shell">
          <table className="template-governance-ledger-table">
            <thead>
              <tr>
                <th>期刊名称</th>
                <th>期刊键</th>
                <th>所属大模板</th>
                <th>稿件类型</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {viewModel.journalTemplates.length ? (
                viewModel.journalTemplates.map((template) => {
                  const templateFamily = resolveTemplateFamily(
                    viewModel.templateFamilies,
                    template.template_family_id,
                  );

                  return (
                    <tr
                      key={template.id}
                      className={
                        template.id === viewModel.selectedJournalTemplateId
                          ? "template-governance-ledger-row is-selected"
                          : "template-governance-ledger-row"
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className="template-governance-ledger-row-button"
                          onClick={() => onSelectJournalTemplate?.(template.id)}
                        >
                          {template.journal_name}
                        </button>
                      </td>
                      <td>{template.journal_key}</td>
                      <td>{templateFamily?.name ?? "未绑定"}</td>
                      <td>
                        {templateFamily
                          ? formatTemplateGovernanceManuscriptTypeLabel(
                              templateFamily.manuscript_type,
                            )
                          : "未设置"}
                      </td>
                      <td>{formatTemplateGovernanceFamilyStatusLabel(template.status)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>当前大模板下还没有期刊模板。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      <TemplateGovernanceLedgerSearchPage searchState={searchState} />

      {viewModel.selectedJournalTemplate ? (
        <article className="template-governance-card template-governance-ledger-section">
          <header className="template-governance-ledger-section-header">
            <h2>当前期刊模板</h2>
            <p>确认期刊差异后，可继续启用、编辑或归档。</p>
          </header>
          <div className="template-governance-detail-grid">
            <div>
              <span>期刊名称</span>
              <p>{viewModel.selectedJournalTemplate.journal_name}</p>
            </div>
            <div>
              <span>期刊键</span>
              <p>{viewModel.selectedJournalTemplate.journal_key}</p>
            </div>
            <div>
              <span>所属大模板</span>
              <p>{viewModel.selectedTemplateFamily?.name ?? "未绑定"}</p>
            </div>
            <div>
              <span>状态</span>
              <p>
                {formatTemplateGovernanceFamilyStatusLabel(
                  viewModel.selectedJournalTemplate.status,
                )}
              </p>
            </div>
          </div>
          <div className="template-governance-actions">
            <button type="button" onClick={onActivateSelected}>
              启用模板
            </button>
            <button type="button" onClick={onOpenEditForm}>
              编辑期刊模板
            </button>
          </div>
        </article>
      ) : null}

      {formMode ? (
        <TemplateGovernanceJournalTemplateForm
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

function resolveTemplateFamily(
  families: readonly TemplateFamilyViewModel[],
  templateFamilyId: string,
): TemplateFamilyViewModel | null {
  return families.find((family) => family.id === templateFamilyId) ?? null;
}
