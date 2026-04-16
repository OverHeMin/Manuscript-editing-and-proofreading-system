import type {
  RuleWizardBindingFormState,
  RuleWizardConfirmFormState,
  RuleWizardEntryFormState,
  RuleWizardPublishFormState,
} from "./template-governance-rule-wizard-api.ts";

export interface TemplateGovernanceRuleWizardStepPublishProps {
  value: RuleWizardPublishFormState;
  entryState: RuleWizardEntryFormState;
  confirmState: RuleWizardConfirmFormState;
  bindingState: RuleWizardBindingFormState;
  isBusy?: boolean;
  errorMessage?: string | null;
  onChange: (nextValue: RuleWizardPublishFormState) => void;
}

export function TemplateGovernanceRuleWizardStepPublish({
  value,
  entryState,
  confirmState,
  bindingState,
  isBusy = false,
  errorMessage = null,
  onChange,
}: TemplateGovernanceRuleWizardStepPublishProps) {
  const checklist = buildChecklist(entryState, confirmState, bindingState);

  return (
    <article className="template-governance-card template-governance-ledger-section">
      <header className="template-governance-ledger-section-header">
        <h2>保存与发布</h2>
        <p>确认绑定去向和发布方式，再返回规则中心。</p>
      </header>

      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-rule-hint-list">
        <div className="template-governance-rule-hint-card">
          <strong>保存草稿适合先留给当前编辑人继续补充</strong>
          <p>当正文、语义或绑定还没完全稳定时，先留在草稿状态，后面可以回到向导继续完善。</p>
        </div>
        <div className="template-governance-rule-hint-card">
          <strong>提交审核会进入规则治理审核队列</strong>
          <p>适合内容已经基本确认，但还需要治理负责人或管理员再看一眼的场景。</p>
        </div>
        <div className="template-governance-rule-hint-card">
          <strong>直接发布只适合已经确认无误的场景</strong>
          <p>只有在规则正文、包绑定和模板族覆盖都确认清楚后，才建议直接走发布闭环。</p>
        </div>
      </div>

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

      <div className="template-governance-rule-impact-grid">
        <section className="template-governance-card template-governance-rule-impact-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>最终摘要</h3>
              <p>把规则内容、语义结论和绑定去向压成最终确认页，避免提交前来回切步骤。</p>
            </div>
          </header>
          <div className="template-governance-rule-impact-list">
            <div>
              <span>规则名称</span>
              <strong>{entryState.title || "未填写规则名称"}</strong>
            </div>
            <div>
              <span>语义摘要</span>
              <strong>{confirmState.semanticSummary || "未确认语义摘要"}</strong>
            </div>
            <div>
              <span>规则类型</span>
              <strong>{formatRuleTypeLabel(confirmState.ruleType)}</strong>
            </div>
            <div>
              <span>绑定去向</span>
              <strong>{bindingState.selectedPackageLabel || "待选择规则包"}</strong>
            </div>
          </div>
        </section>

        <section className="template-governance-card template-governance-rule-impact-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>提交前检查</h3>
              <p>用最小检查单确认录入、语义和绑定都已经闭环。</p>
            </div>
          </header>
          <ul className="template-governance-list">
            {checklist.map((item) => (
              <li key={item.label}>
                <div className="template-governance-list-button">
                  <span>{item.label}</span>
                  <small>{item.done ? "已完成" : "待补充"}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
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

function buildChecklist(
  entryState: RuleWizardEntryFormState,
  confirmState: RuleWizardConfirmFormState,
  bindingState: RuleWizardBindingFormState,
): Array<{ label: string; done: boolean }> {
  return [
    {
      label: "基础录入已补齐正文或来源依据",
      done:
        entryState.ruleBody.trim().length > 0 || entryState.sourceBasis.trim().length > 0,
    },
    {
      label: "语义摘要已人工确认",
      done: confirmState.semanticSummary.trim().length > 0,
    },
    {
      label: "规则包去向已选择",
      done: bindingState.selectedPackageLabel.trim().length > 0,
    },
    {
      label: "模板族绑定已确认",
      done: bindingState.selectedTemplateFamilies.length > 0,
    },
  ];
}

function formatRuleTypeLabel(value: RuleWizardConfirmFormState["ruleType"]): string {
  switch (value) {
    case "terminology_consistency":
      return "术语统一";
    case "format_normalization":
      return "格式规范";
    case "content_requirement":
      return "内容要求";
    case "citation_requirement":
      return "引文要求";
    case "other":
    default:
      return "其他规则";
  }
}
