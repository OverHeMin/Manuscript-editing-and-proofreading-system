import type {
  RuleWizardConfirmFormState,
  RuleWizardSemanticViewModel,
} from "./template-governance-rule-wizard-api.ts";

export interface TemplateGovernanceRuleWizardStepConfirmProps {
  value: RuleWizardConfirmFormState;
  suggestion: RuleWizardSemanticViewModel;
  isBusy?: boolean;
  errorMessage?: string | null;
  onChange: (nextValue: RuleWizardConfirmFormState) => void;
  onAcceptHighConfidence?: () => void;
}

export function TemplateGovernanceRuleWizardStepConfirm({
  value,
  suggestion,
  isBusy = false,
  errorMessage = null,
  onChange,
  onAcceptHighConfidence,
}: TemplateGovernanceRuleWizardStepConfirmProps) {
  const changeSummary = buildChangeSummary(value, suggestion);

  return (
    <article className="template-governance-card template-governance-ledger-section">
      <header className="template-governance-ledger-section-header">
        <h2>人工确认 AI 结果</h2>
        <p>只修正高频语义结论，不回到原始证据大表单。</p>
      </header>

      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-actions">
        <button type="button" onClick={onAcceptHighConfidence} disabled={isBusy}>
          一键采纳高置信结果
        </button>
      </div>

      <div className="template-governance-rule-decision-grid">
        <section className="template-governance-card template-governance-rule-decision-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>规则类型判断</h3>
              <p>先确认这条规则到底属于哪一种治理判断。</p>
            </div>
          </header>
          <div className="template-governance-rule-decision-meta">
            <span>AI 建议</span>
            <strong>{formatRuleTypeLabel(suggestion.ruleType)}</strong>
          </div>
          <label className="template-governance-field">
            <span>人工确认</span>
            <select
              value={value.ruleType}
              onChange={(event) =>
                onChange({
                  ...value,
                  ruleType: event.target.value as RuleWizardConfirmFormState["ruleType"],
                })
              }
            >
              <option value="terminology_consistency">术语统一</option>
              <option value="format_normalization">格式规范</option>
              <option value="content_requirement">内容要求</option>
              <option value="citation_requirement">引文要求</option>
              <option value="other">其他规则</option>
            </select>
          </label>
        </section>

        <section className="template-governance-card template-governance-rule-decision-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>风险等级判断</h3>
              <p>风险越高，后续发布和审核路径越要谨慎。</p>
            </div>
          </header>
          <div className="template-governance-rule-decision-meta">
            <span>AI 建议</span>
            <strong>{formatRiskLevelLabel(suggestion.riskLevel)}</strong>
          </div>
          <label className="template-governance-field">
            <span>人工确认</span>
            <select
              value={value.riskLevel}
              onChange={(event) =>
                onChange({
                  ...value,
                  riskLevel: event.target.value as RuleWizardConfirmFormState["riskLevel"],
                })
              }
            >
              <option value="high">高风险</option>
              <option value="medium">中风险</option>
              <option value="low">低风险</option>
            </select>
          </label>
        </section>

        <section className="template-governance-card template-governance-rule-decision-card">
          <header className="template-governance-rule-section-heading">
            <div>
              <h3>业务适用范围</h3>
              <p>这里决定规则会在哪个业务模块和稿件类型里被调用。</p>
            </div>
          </header>
          <div className="template-governance-rule-decision-meta">
            <span>AI 建议</span>
            <strong>{formatModuleLabel(suggestion.moduleScope)}</strong>
          </div>
          <label className="template-governance-field">
            <span>人工确认</span>
            <select
              value={value.moduleScope}
              onChange={(event) =>
                onChange({
                  ...value,
                  moduleScope: event.target.value as RuleWizardConfirmFormState["moduleScope"],
                })
              }
            >
              <option value="any">全部模块</option>
              <option value="screening">初筛</option>
              <option value="editing">编辑</option>
              <option value="proofreading">校对</option>
            </select>
          </label>
          <label className="template-governance-field">
            <span>人工确认</span>
            <input
              value={value.manuscriptTypes}
              onChange={(event) => onChange({ ...value, manuscriptTypes: event.target.value })}
              placeholder="clinical_study, review"
            />
          </label>
        </section>
      </div>

      <div className="template-governance-detail-grid">
        <label className="template-governance-field template-governance-field-full">
          <span>语义摘要</span>
          <small>AI 建议：{suggestion.semanticSummary || "等待 AI 生成摘要。"}</small>
          <textarea
            rows={4}
            value={value.semanticSummary}
            onChange={(event) =>
              onChange({ ...value, semanticSummary: event.target.value })
            }
          />
        </label>

        <label className="template-governance-field">
          <span>检索词</span>
          <input
            value={value.retrievalTerms}
            onChange={(event) =>
              onChange({ ...value, retrievalTerms: event.target.value })
            }
            placeholder="术语统一, 缩写释义"
          />
        </label>

        <label className="template-governance-field">
          <span>检索片段</span>
          <textarea
            rows={4}
            value={value.retrievalSnippets}
            onChange={(event) =>
              onChange({ ...value, retrievalSnippets: event.target.value })
            }
            placeholder="每行一条检索片段"
          />
        </label>
      </div>

      <div className="template-governance-detail-grid">
        <div className="template-governance-field template-governance-field-full">
          <span>变更摘要</span>
          {changeSummary.length ? (
            <ul className="template-governance-list">
              {changeSummary.map((item) => (
                <li key={item}>
                  <div className="template-governance-list-button">
                    <span>{item}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>当前未做人工修正，保存时将直接采纳 AI 结果。</p>
          )}
        </div>
      </div>
    </article>
  );
}

function buildChangeSummary(
  value: RuleWizardConfirmFormState,
  suggestion: RuleWizardSemanticViewModel,
): string[] {
  const items: string[] = [];

  if (value.ruleType !== suggestion.ruleType) {
    items.push(
      `规则类型：${formatRuleTypeLabel(suggestion.ruleType)} -> ${formatRuleTypeLabel(value.ruleType)}`,
    );
  }

  if (value.riskLevel !== suggestion.riskLevel) {
    items.push(
      `风险等级：${formatRiskLevelLabel(suggestion.riskLevel)} -> ${formatRiskLevelLabel(value.riskLevel)}`,
    );
  }

  if (value.moduleScope !== suggestion.moduleScope) {
    items.push(
      `适用执行模块：${formatModuleLabel(suggestion.moduleScope)} -> ${formatModuleLabel(value.moduleScope)}`,
    );
  }

  if (value.manuscriptTypes.trim() !== suggestion.manuscriptTypes.trim()) {
    items.push(`适用稿件类型：${suggestion.manuscriptTypes || "any"} -> ${value.manuscriptTypes || "any"}`);
  }

  if (value.semanticSummary.trim() !== suggestion.semanticSummary.trim()) {
    items.push("语义摘要已人工修订。");
  }

  if (value.retrievalTerms.trim() !== suggestion.retrievalTerms.trim()) {
    items.push("检索词已人工修订。");
  }

  return items;
}

function formatRuleTypeLabel(value: RuleWizardSemanticViewModel["ruleType"]): string {
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

function formatRiskLevelLabel(value: RuleWizardSemanticViewModel["riskLevel"]): string {
  switch (value) {
    case "high":
      return "高风险";
    case "low":
      return "低风险";
    case "medium":
    default:
      return "中风险";
  }
}

function formatModuleLabel(value: RuleWizardSemanticViewModel["moduleScope"]): string {
  switch (value) {
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "any":
    default:
      return "全部模块";
  }
}
