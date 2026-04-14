import type {
  RuleWizardBindingFormState,
  RuleWizardPublishFormState,
} from "./template-governance-rule-wizard-api.ts";

export interface TemplateGovernanceRuleWizardStepPublishProps {
  value: RuleWizardPublishFormState;
  bindingState: RuleWizardBindingFormState;
  isBusy?: boolean;
  errorMessage?: string | null;
  onChange: (nextValue: RuleWizardPublishFormState) => void;
}

export function TemplateGovernanceRuleWizardStepPublish({
  value,
  bindingState,
  isBusy = false,
  errorMessage = null,
  onChange,
}: TemplateGovernanceRuleWizardStepPublishProps) {
  return (
    <article className="template-governance-card template-governance-ledger-section">
      <header className="template-governance-ledger-section-header">
        <h2>保存与发布</h2>
        <p>确认绑定去向和发布方式，再返回规则中心。</p>
      </header>

      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-detail-grid">
        <div>
          <span>当前规则包</span>
          <p>{bindingState.selectedPackageLabel || "尚未选择规则包"}</p>
        </div>
        <div>
          <span>关联模板族</span>
          <p>
            {bindingState.selectedTemplateFamilies.length
              ? bindingState.selectedTemplateFamilies.map((family) => family.name).join("、")
              : "尚未选择模板族"}
          </p>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <div className="template-governance-field template-governance-field-full">
          <span>发布方式</span>
          <label className="template-governance-field">
            <small>保存草稿</small>
            <input
              type="radio"
              name="rule-wizard-release-action"
              checked={value.releaseAction === "save_draft"}
              disabled={isBusy}
              onChange={() => onChange({ ...value, releaseAction: "save_draft" })}
            />
          </label>
          <label className="template-governance-field">
            <small>提交审核</small>
            <input
              type="radio"
              name="rule-wizard-release-action"
              checked={value.releaseAction === "submit_review"}
              disabled={isBusy}
              onChange={() => onChange({ ...value, releaseAction: "submit_review" })}
            />
          </label>
          <label className="template-governance-field">
            <small>直接发布</small>
            <input
              type="radio"
              name="rule-wizard-release-action"
              checked={value.releaseAction === "publish_now"}
              disabled={isBusy}
              onChange={() => onChange({ ...value, releaseAction: "publish_now" })}
            />
          </label>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <label className="template-governance-field template-governance-field-full">
          <span>审核备注</span>
          <textarea
            rows={3}
            value={value.reviewNote}
            onChange={(event) =>
              onChange({
                ...value,
                reviewNote: event.target.value,
              })
            }
            placeholder="可选：补充提交审核或直接发布的说明"
            disabled={isBusy}
          />
        </label>
      </div>
    </article>
  );
}
