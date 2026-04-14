import type { RuleWizardSemanticViewModel } from "./template-governance-rule-wizard-api.ts";

export interface TemplateGovernanceRuleWizardStepSemanticProps {
  value: RuleWizardSemanticViewModel;
  isBusy?: boolean;
  errorMessage?: string | null;
  onRegenerate?: () => void;
  onBackToEvidence?: () => void;
}

export function TemplateGovernanceRuleWizardStepSemantic({
  value,
  isBusy = false,
  errorMessage = null,
  onRegenerate,
  onBackToEvidence,
}: TemplateGovernanceRuleWizardStepSemanticProps) {
  return (
    <article className="template-governance-card template-governance-ledger-section">
      <header className="template-governance-ledger-section-header">
        <h2>AI 语义层结果</h2>
        <p>先看 AI 如何理解这条规则，再决定是否补证据或进入人工确认。</p>
      </header>

      {errorMessage ? <p className="template-governance-error">{errorMessage}</p> : null}

      <div className="template-governance-detail-grid">
        <div>
          <span>识别可信度</span>
          <p>
            {value.confidenceLabel}（{Math.round(value.confidenceScore * 100)}%）
          </p>
        </div>
        <div>
          <span>规则类型</span>
          <p>{formatRuleTypeLabel(value.ruleType)}</p>
        </div>
        <div>
          <span>风险等级</span>
          <p>{formatRiskLevelLabel(value.riskLevel)}</p>
        </div>
        <div>
          <span>适用场景</span>
          <p>{value.applicableScenario}</p>
        </div>
        <div>
          <span>建议规则包</span>
          <p>{value.suggestedPackage}</p>
        </div>
        <div>
          <span>语义摘要</span>
          <p>{value.semanticSummary || "等待 AI 生成摘要。"}</p>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <div>
          <span>触发解释</span>
          <p>{value.triggerExplanation}</p>
        </div>
        <div>
          <span>不适用条件</span>
          <p>{value.inapplicableConditions}</p>
        </div>
        <div>
          <span>检索词</span>
          <p>{value.retrievalTerms || "等待生成检索词。"}</p>
        </div>
        <div>
          <span>语义状态</span>
          <p>{formatSemanticStatusLabel(value.semanticLayer?.status)}</p>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <div className="template-governance-field template-governance-field-full">
          <span>证据预览</span>
          {value.evidencePreview.length ? (
            <ul className="template-governance-list">
              {value.evidencePreview.map((item) => (
                <li key={item}>
                  <div className="template-governance-list-button">
                    <span>{item}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>还没有可供 AI 识别的证据，请先返回补充。</p>
          )}
        </div>
      </div>

      {value.warnings.length ? (
        <div className="template-governance-detail-grid">
          <div className="template-governance-field template-governance-field-full">
            <span>AI 提示</span>
            <ul className="template-governance-list">
              {value.warnings.map((warning) => (
                <li key={warning}>
                  <div className="template-governance-list-button">
                    <span>{warning}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="template-governance-actions">
        <button type="button" onClick={onRegenerate} disabled={isBusy}>
          {isBusy ? "识别中..." : "重新识别"}
        </button>
        <button type="button" onClick={onBackToEvidence} disabled={isBusy}>
          回到上一步补充证据
        </button>
      </div>
    </article>
  );
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

function formatSemanticStatusLabel(value: string | undefined): string {
  switch (value) {
    case "confirmed":
      return "已确认";
    case "stale":
      return "待刷新";
    case "pending_confirmation":
      return "待人工确认";
    case "not_generated":
    default:
      return "未生成";
  }
}
