import {
  EDITORIAL_MANUSCRIPT_TYPE_OPTIONS,
  formatEditorialManuscriptTypeLabel,
} from "../shared/editorial-taxonomy.ts";
import { SearchableMultiSelectField } from "../../lib/searchable-multi-select.tsx";
import {
  formatTemplateGovernanceModuleLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
} from "./template-governance-display.ts";
import type { GovernedContentModuleViewModel, TemplateModule } from "../templates/index.ts";
import type { Dispatch, SetStateAction } from "react";

export interface TemplateGovernanceTemplateFormValues {
  name: string;
  manuscriptType: string;
  journalScope: string;
  executionModuleScope: string[];
  generalModuleIds: string[];
  medicalModuleIds: string[];
  notes: string;
}

export interface TemplateGovernanceTemplateFormModuleOptions {
  generalModules: readonly GovernedContentModuleViewModel[];
  medicalModules: readonly GovernedContentModuleViewModel[];
}

export interface TemplateGovernanceTemplateFormProps {
  mode?: "create" | "edit";
  initialValues?: Partial<TemplateGovernanceTemplateFormValues>;
  moduleOptions?: TemplateGovernanceTemplateFormModuleOptions;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onChange?: Dispatch<SetStateAction<TemplateGovernanceTemplateFormValues>>;
  onCancel?: () => void;
  onSubmit?: () => void;
}

const defaultFormValues: TemplateGovernanceTemplateFormValues = {
  name: "",
  manuscriptType: "",
  journalScope: "",
  executionModuleScope: [],
  generalModuleIds: [],
  medicalModuleIds: [],
  notes: "",
};

export function TemplateGovernanceTemplateForm({
  mode = "create",
  initialValues,
  moduleOptions,
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  onChange,
  onCancel,
  onSubmit,
}: TemplateGovernanceTemplateFormProps) {
  const values = {
    ...defaultFormValues,
    ...initialValues,
  };
  const submitLabel = mode === "edit" ? "保存大模板修改" : "保存大模板草稿";
  const generalModuleOptions = (moduleOptions?.generalModules ?? []).map((module) => ({
    value: module.id,
    label: module.name,
    meta: formatTemplateGovernanceManuscriptTypeLabel(module.manuscript_type_scope[0] ?? "clinical_study"),
    keywords: [module.category, module.summary],
  }));
  const medicalModuleOptions = (moduleOptions?.medicalModules ?? []).map((module) => ({
    value: module.id,
    label: module.name,
    meta: formatTemplateGovernanceManuscriptTypeLabel(module.manuscript_type_scope[0] ?? "clinical_study"),
    keywords: [module.category, module.summary],
  }));

  return (
    <section className="template-governance-form-layer">
      <article className="template-governance-card template-governance-template-form">
        <header className="template-governance-form-header">
          <h2>{mode === "edit" ? "编辑大模板" : "新建大模板"}</h2>
        </header>
        {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}
        <div className="template-governance-form-grid">
          <label className="template-governance-field">
            <span>大模板名称</span>
            <input
              value={values.name}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>稿件类型</span>
            <select
              value={values.manuscriptType}
              disabled={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  manuscriptType: event.target.value,
                }))
              }
            >
              <option value="">请选择稿件类型</option>
              {EDITORIAL_MANUSCRIPT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatEditorialManuscriptTypeLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="template-governance-field">
            <span>期刊/场景范围</span>
            <input
              value={values.journalScope}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  journalScope: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>适用模块</span>
            <select
              value=""
              disabled
              aria-label="适用模块已改为下方多选按钮"
            >
              <option>在下方点选 screening / editing / proofreading</option>
            </select>
          </label>
          <div className="template-governance-field template-governance-field-full">
            <SearchableMultiSelectField
              label="执行模块"
              helpText="直接点选生效环节，避免手填模块代码。"
              value={values.executionModuleScope}
              options={TEMPLATE_MODULE_OPTIONS}
              dataKey="template-execution-modules"
              className="knowledge-library-entry-form__multi-select"
              headerClassName="knowledge-library-entry-form__multi-select-header"
              searchFieldClassName="knowledge-library-entry-form__multi-select-search"
              searchPlaceholder="搜索模块"
              optionsClassName="knowledge-library-entry-form__multi-select-options"
              optionClassName="knowledge-library-entry-form__multi-select-option"
              emptyClassName="knowledge-library-entry-form__multi-select-empty"
              showSelectedSummary
              selectedEmptyText="暂未选择执行模块。"
              onToggleValue={(value) =>
                onChange?.((current) => ({
                  ...current,
                  executionModuleScope: toggleListValue(
                    current.executionModuleScope,
                    value,
                  ),
                }))
              }
            />
          </div>
          <div className="template-governance-field template-governance-field-full">
            <SearchableMultiSelectField
              label="通用包"
              helpText="从现有通用包台账中选择。"
              value={values.generalModuleIds}
              options={generalModuleOptions}
              dataKey="template-general-modules"
              className="knowledge-library-entry-form__multi-select"
              headerClassName="knowledge-library-entry-form__multi-select-header"
              searchFieldClassName="knowledge-library-entry-form__multi-select-search"
              searchPlaceholder="搜索通用包"
              optionsClassName="knowledge-library-entry-form__multi-select-options"
              optionClassName="knowledge-library-entry-form__multi-select-option"
              emptyClassName="knowledge-library-entry-form__multi-select-empty"
              showSelectedSummary
              selectedEmptyText="暂未选择通用包。"
              onToggleValue={(value) =>
                onChange?.((current) => ({
                  ...current,
                  generalModuleIds: toggleListValue(current.generalModuleIds, value),
                }))
              }
            />
          </div>
          <div className="template-governance-field template-governance-field-full">
            <SearchableMultiSelectField
              label="医学专用包"
              helpText="从现有医学专用包台账中选择。"
              value={values.medicalModuleIds}
              options={medicalModuleOptions}
              dataKey="template-medical-modules"
              className="knowledge-library-entry-form__multi-select"
              headerClassName="knowledge-library-entry-form__multi-select-header"
              searchFieldClassName="knowledge-library-entry-form__multi-select-search"
              searchPlaceholder="搜索医学专用包"
              optionsClassName="knowledge-library-entry-form__multi-select-options"
              optionClassName="knowledge-library-entry-form__multi-select-option"
              emptyClassName="knowledge-library-entry-form__multi-select-empty"
              showSelectedSummary
              selectedEmptyText="暂未选择医学专用包。"
              onToggleValue={(value) =>
                onChange?.((current) => ({
                  ...current,
                  medicalModuleIds: toggleListValue(current.medicalModuleIds, value),
                }))
              }
            />
          </div>
          <label className="template-governance-field template-governance-field-full">
            <span>说明</span>
            <textarea
              rows={4}
              value={values.notes}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="template-governance-actions">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button type="button" onClick={onSubmit} disabled={isBusy}>
            {isBusy ? "保存中..." : submitLabel}
          </button>
        </div>
      </article>
    </section>
  );
}

const TEMPLATE_MODULE_OPTIONS: Array<{ value: TemplateModule; label: string }> = [
  {
    value: "screening",
    label: formatTemplateGovernanceModuleLabel("screening"),
  },
  {
    value: "editing",
    label: formatTemplateGovernanceModuleLabel("editing"),
  },
  {
    value: "proofreading",
    label: formatTemplateGovernanceModuleLabel("proofreading"),
  },
];

function toggleListValue(values: readonly string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}
