import type { Dispatch, SetStateAction } from "react";

export interface TemplateGovernanceJournalTemplateFormValues {
  templateFamilyId: string;
  journalName: string;
  journalKey: string;
}

export interface TemplateGovernanceJournalTemplateFormProps {
  mode?: "create" | "edit";
  initialValues?: Partial<TemplateGovernanceJournalTemplateFormValues>;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onChange?: Dispatch<SetStateAction<TemplateGovernanceJournalTemplateFormValues>>;
  onCancel?: () => void;
  onSubmit?: () => void;
}

const defaultFormValues: TemplateGovernanceJournalTemplateFormValues = {
  templateFamilyId: "",
  journalName: "",
  journalKey: "",
};

export function TemplateGovernanceJournalTemplateForm({
  mode = "create",
  initialValues,
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  onChange,
  onCancel,
  onSubmit,
}: TemplateGovernanceJournalTemplateFormProps) {
  const values = {
    ...defaultFormValues,
    ...initialValues,
  };
  const submitLabel =
    mode === "edit" ? "保存期刊模板修改" : "保存期刊模板草稿";

  return (
    <section className="template-governance-form-layer">
      <article className="template-governance-card template-governance-template-form">
        <header className="template-governance-form-header">
          <h2>{mode === "edit" ? "编辑期刊模板" : "新建期刊模板"}</h2>
          <p>期刊模板继承大模板能力，只补充期刊或场景级差异。</p>
        </header>
        {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}
        <div className="template-governance-form-grid">
          <label className="template-governance-field">
            <span>所属大模板</span>
            <input
              value={values.templateFamilyId}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  templateFamilyId: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>期刊名称</span>
            <input
              value={values.journalName}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  journalName: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>期刊键</span>
            <input
              value={values.journalKey}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  journalKey: event.target.value,
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
