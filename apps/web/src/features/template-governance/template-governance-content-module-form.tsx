import type { Dispatch, SetStateAction } from "react";
import type {
  GovernedContentModuleEvidenceLevel,
  GovernedContentModuleRiskLevel,
} from "../templates/index.ts";

export interface TemplateGovernanceContentModuleFormValues {
  name: string;
  category: string;
  manuscriptTypeScope: string;
  executionModuleScope: string;
  applicableSections: string;
  summary: string;
  guidance: string;
  examples: string;
  evidenceLevel: GovernedContentModuleEvidenceLevel;
  riskLevel: GovernedContentModuleRiskLevel;
}

export interface TemplateGovernanceContentModuleFormProps {
  ledgerKind: "general" | "medical_specialized";
  mode?: "create" | "edit";
  initialValues?: Partial<TemplateGovernanceContentModuleFormValues>;
  isBusy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onChange?: Dispatch<SetStateAction<TemplateGovernanceContentModuleFormValues>>;
  onCancel?: () => void;
  onSubmit?: () => void;
}

const defaultFormValues: TemplateGovernanceContentModuleFormValues = {
  name: "",
  category: "",
  manuscriptTypeScope: "",
  executionModuleScope: "",
  applicableSections: "",
  summary: "",
  guidance: "",
  examples: "",
  evidenceLevel: "unknown",
  riskLevel: "medium",
};

export function TemplateGovernanceContentModuleForm({
  ledgerKind,
  mode = "create",
  initialValues,
  isBusy = false,
  statusMessage = null,
  errorMessage = null,
  onChange,
  onCancel,
  onSubmit,
}: TemplateGovernanceContentModuleFormProps) {
  const values = {
    ...defaultFormValues,
    ...initialValues,
  };

  const formTitle =
    mode === "edit"
      ? ledgerKind === "general"
        ? "编辑通用模块"
        : "编辑医学专用模块"
      : ledgerKind === "general"
        ? "新建通用模块"
        : "新建医学专用模块";
  const submitLabel = mode === "edit" ? "保存模块修改" : "保存模块草稿";

  return (
    <section className="template-governance-form-layer">
      <article className="template-governance-card template-governance-content-module-form">
        <header className="template-governance-form-header">
          <h2>{formTitle}</h2>
          <p>在同一张表单里完成模块录入，取消即可关闭，不保留右侧抽屉。</p>
        </header>
        {statusMessage ? <p className="template-governance-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}
        <div className="template-governance-form-grid">
          <label className="template-governance-field">
            <span>模块名称</span>
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
            <span>{ledgerKind === "general" ? "模块分类" : "医学场景"}</span>
            <input
              value={values.category}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>适用稿件类型</span>
            <input
              value={values.manuscriptTypeScope}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  manuscriptTypeScope: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field">
            <span>执行模块范围</span>
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
            <span>适用区段</span>
            <input
              value={values.applicableSections}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  applicableSections: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field template-governance-field-full">
            <span>摘要说明</span>
            <textarea
              rows={4}
              value={values.summary}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field template-governance-field-full">
            <span>执行 guidance</span>
            <textarea
              rows={3}
              value={values.guidance}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  guidance: event.target.value,
                }))
              }
            />
          </label>
          <label className="template-governance-field template-governance-field-full">
            <span>前后示例</span>
            <textarea
              rows={4}
              value={values.examples}
              readOnly={!onChange}
              onChange={(event) =>
                onChange?.((current) => ({
                  ...current,
                  examples: event.target.value,
                }))
              }
            />
          </label>
          {ledgerKind === "medical_specialized" ? (
            <>
              <label className="template-governance-field">
                <span>证据级别</span>
                <select
                  value={values.evidenceLevel}
                  disabled={!onChange}
                  onChange={(event) =>
                    onChange?.((current) => ({
                      ...current,
                      evidenceLevel: event.target.value as GovernedContentModuleEvidenceLevel,
                    }))
                  }
                >
                  <option value="unknown">未知</option>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="expert_opinion">专家意见</option>
                </select>
              </label>
              <label className="template-governance-field">
                <span>风险级别</span>
                <select
                  value={values.riskLevel}
                  disabled={!onChange}
                  onChange={(event) =>
                    onChange?.((current) => ({
                      ...current,
                      riskLevel: event.target.value as GovernedContentModuleRiskLevel,
                    }))
                  }
                >
                  <option value="low">低风险</option>
                  <option value="medium">中风险</option>
                  <option value="high">高风险</option>
                </select>
              </label>
            </>
          ) : null}
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
