import { formatTemplateGovernanceManuscriptTypeLabel, formatTemplateGovernanceModuleLabel } from "./template-governance-display.ts";
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
          <span>执行模块</span>
          <p>{formatTemplateGovernanceModuleLabel(value.moduleScope)}</p>
        </div>
        <div>
          <span>稿件类型</span>
          <p>{formatManuscriptTypesLabel(value.manuscriptTypes)}</p>
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
          <p>{value.retrievalTerms.length > 0 ? value.retrievalTerms.join("、") : "等待生成检索词。"}</p>
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

      <section className="template-governance-detail-grid" data-rule-wizard-ai-parsing="true">
        <div className="template-governance-field template-governance-field-full">
          <span>AI 解析校验</span>
          {value.aiParsing ? (
            <>
              <p>
                {formatAiParsingConsistencyLabel(value.aiParsing.consistency)}
                {value.aiParsing.requires_human_confirmation ? "（需要人工确认）" : ""}
              </p>
              <p>{value.aiParsing.ai_understanding_summary}</p>
              {value.aiParsing.findings.length > 0 ? (
                <ul className="template-governance-list">
                  {value.aiParsing.findings.map((finding) => (
                    <li key={`${finding.field}-${finding.severity}-${finding.message}`}>
                      <div className="template-governance-list-button">
                        <span>
                          {formatAiParsingFindingSeverityLabel(finding.severity)} ·{" "}
                          {finding.field}
                        </span>
                        <small>{finding.message}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>未发现阻断项。</p>
              )}
            </>
          ) : (
            <p>尚未运行 AI 解析校验。点击重新识别后会同步调用规则中心大模型解析。</p>
          )}
        </div>
      </section>

      <div className="template-governance-actions">
        <button type="button" onClick={onRegenerate} disabled={isBusy}>
          {isBusy ? "识别中..." : "重新识别 / 解析"}
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

function formatAiParsingConsistencyLabel(
  value: NonNullable<RuleWizardSemanticViewModel["aiParsing"]>["consistency"],
): string {
  switch (value) {
    case "consistent":
      return "一致";
    case "partially_inconsistent":
      return "部分不一致";
    case "missing_evidence":
      return "证据不足";
    case "possibly_duplicate":
      return "可能重复";
    case "uncertain":
    default:
      return "不确定";
  }
}

function formatAiParsingFindingSeverityLabel(
  value: NonNullable<RuleWizardSemanticViewModel["aiParsing"]>["findings"][number]["severity"],
): string {
  switch (value) {
    case "blocking":
      return "阻断";
    case "warning":
      return "提醒";
    case "info":
    default:
      return "信息";
  }
}

function formatManuscriptTypesLabel(value: RuleWizardSemanticViewModel["manuscriptTypes"]): string {
  if (value === "any") {
    return "全部 / 任意";
  }

  return value.map((item) => formatTemplateGovernanceManuscriptTypeLabel(item)).join("、");
}
