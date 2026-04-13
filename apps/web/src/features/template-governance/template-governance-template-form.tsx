import type { Dispatch, SetStateAction } from "react";

export interface TemplateGovernanceTemplateFormValues {
  name: string;
  manuscriptType: string;
  journalScope: string;
  executionModuleScope: string;
  generalModuleIds: string;
  medicalModuleIds: string;
  notes: string;
}

export interface TemplateGovernanceTemplateFormProps {
  mode?: "create" | "edit";
  initialValues?: Partial<TemplateGovernanceTemplateFormValues>;
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
  executionModuleScope: "",
  generalModuleIds: "",
  medicalModuleIds: "",
  notes: "",
};

export function TemplateGovernanceTemplateForm({
  mode = "create",
  initialValues,
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

  return (
    <section className="template-governance-form-layer">
      <article className="template-governance-card template-governance-template-form">
        <header className="template-governance-form-header">
          <h2>{mode === "edit" ? "编辑大模板" : "新建大模板"}</h2>
          <p>大模板只负责稿件族级组合治理，不在这里直接编辑包内细项。</p>
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
            <input
              value={values.manuscriptType}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  manuscriptType: event.target.value,
                }))
              }
            />
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
            <input
              value={values.executionModuleScope}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  executionModuleScope: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field template-governance-field-full">
            <span>通用包</span>
            <input
              value={values.generalModuleIds}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  generalModuleIds: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field template-governance-field-full">
            <span>医学专用包</span>
            <input
              value={values.medicalModuleIds}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  medicalModuleIds: event.target.value,
                }))
              }
            />
          </label>
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
