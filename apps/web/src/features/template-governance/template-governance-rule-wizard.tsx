import {
  getNextRuleWizardStep,
  getPreviousRuleWizardStep,
  getRuleWizardStepLabel,
  getRuleWizardStepLabels,
  type RuleWizardState,
} from "./template-governance-rule-wizard-state.ts";

export interface TemplateGovernanceRuleWizardProps {
  state: RuleWizardState;
  title?: string;
  onBack?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSaveDraft?: () => void;
  onComplete?: () => void;
}

export function TemplateGovernanceRuleWizard({
  state,
  title,
  onBack,
  onPrevious,
  onNext,
  onSaveDraft,
  onComplete,
}: TemplateGovernanceRuleWizardProps) {
  const nextStep = getNextRuleWizardStep(state.step);
  const previousStep = getPreviousRuleWizardStep(state.step);

  return (
    <section className="template-governance-rule-wizard">
      <header className="template-governance-ledger-toolbar">
        <div className="template-governance-ledger-toolbar-copy">
          <p className="template-governance-eyebrow">规则向导</p>
          <h1>{resolveWizardTitle(state.mode, title)}</h1>
          <p>用统一五步完成录入、语义确认、绑定和发布，不再把复杂编辑留在台账页里。</p>
        </div>
        <div className="template-governance-ledger-toolbar-actions template-governance-ledger-toolbar-actions--comfortable">
          <button type="button" onClick={onBack}>
            返回规则台账
          </button>
        </div>
      </header>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>五步流</h2>
          <p>当前步骤聚焦一个治理决定，低频高级项后续放入抽屉，不占壳层顶部。</p>
        </header>
        <ol className="template-governance-list">
          {getRuleWizardStepLabels().map((label) => (
            <li key={label}>
              <div
                className={`template-governance-list-button${
                  label === getRuleWizardStepLabel(state.step) ? " is-active" : ""
                }`}
                aria-current={
                  label === getRuleWizardStepLabel(state.step) ? "step" : undefined
                }
              >
                <span>{label}</span>
                <small>
                  {label === getRuleWizardStepLabel(state.step) ? "当前步骤" : "待完成"}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </article>

      <article className="template-governance-card template-governance-ledger-section">
        <header className="template-governance-ledger-section-header">
          <h2>{getRuleWizardStepLabel(state.step)}</h2>
          <p>{resolveWizardStepHint(state.step)}</p>
        </header>
        <div className="template-governance-detail-grid">
          <div>
            <span>当前模式</span>
            <p>{resolveWizardModeLabel(state.mode)}</p>
          </div>
          <div>
            <span>草稿状态</span>
            <p>{state.dirty ? "有未保存变更" : "已同步"}</p>
          </div>
          <div>
            <span>来源记录</span>
            <p>{title ?? "从统一规则台账打开"}</p>
          </div>
          <div>
            <span>下一步</span>
            <p>{nextStep ? getRuleWizardStepLabel(nextStep) : "保存与发布"}</p>
          </div>
        </div>
      </article>

      <footer className="template-governance-actions">
        {previousStep ? (
          <button type="button" onClick={onPrevious}>
            上一步
          </button>
        ) : null}
        <button type="button" onClick={onSaveDraft}>
          保存草稿
        </button>
        <button type="button" onClick={onNext}>
          下一步：{nextStep ? getRuleWizardStepLabel(nextStep) : "保存与发布"}
        </button>
        <button type="button" onClick={onComplete}>
          完成并返回规则中心
        </button>
      </footer>
    </section>
  );
}

function resolveWizardTitle(mode: RuleWizardState["mode"], title: string | undefined): string {
  if (title) {
    return title;
  }

  switch (mode) {
    case "edit":
      return "编辑规则";
    case "candidate":
      return "回流候选转规则";
    case "create":
    default:
      return "新建规则";
  }
}

function resolveWizardModeLabel(mode: RuleWizardState["mode"]): string {
  switch (mode) {
    case "edit":
      return "编辑已有规则";
    case "candidate":
      return "把回流候选转为规则";
    case "create":
    default:
      return "新建治理规则";
  }
}

function resolveWizardStepHint(step: RuleWizardState["step"]): string {
  switch (step) {
    case "entry":
      return "先收口高频信息与证据块，后续步骤只围绕语义和治理决策继续。";
    case "semantic":
      return "先看 AI 识别出的结构化语义，再决定是否补证据或继续确认。";
    case "confirm":
      return "只修正 AI 结论，不回到原始证据大表单。";
    case "binding":
      return "用业务语言决定它进入哪个模板族、规则包和执行模块。";
    case "publish":
    default:
      return "确认保存方式和回台账后的动作，让发布闭环保持短而清晰。";
  }
}
