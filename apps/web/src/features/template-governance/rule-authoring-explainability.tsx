import { getRuleAuthoringPreset } from "./rule-authoring-presets.ts";
import { buildRuleAuthoringPreview } from "./rule-authoring-serialization.ts";
import type { RuleAuthoringDraft } from "./rule-authoring-types.ts";

export interface RuleAuthoringExplainabilityProps {
  draft: RuleAuthoringDraft;
}

export function RuleAuthoringExplainability({
  draft,
}: RuleAuthoringExplainabilityProps) {
  const preset = getRuleAuthoringPreset(draft.ruleObject);
  const preview = buildRuleAuthoringPreview(draft);

  return (
    <article className="template-governance-card">
      <div className="template-governance-panel-header">
        <div>
          <h3>规则解释性</h3>
          <p>说明当前规则面向什么对象、为什么适合自动执行或仅检查，以及人工复核时会看到什么示例。</p>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <div>
          <span>对象</span>
          <p>{preset.objectLabel}</p>
        </div>
        <div>
          <span>自动化风险</span>
          <p>{preset.automationRisk}</p>
        </div>
        <div>
          <span>解析范围</span>
          <p>{preview.templateScopeSummary}</p>
        </div>
        <div>
          <span>选择器摘要</span>
          <p>{preview.selectorSummary}</p>
        </div>
        <div className="template-governance-field-full">
          <span>语义命中</span>
          <p>{preview.semanticHitSummary}</p>
        </div>
        <div className="template-governance-field-full">
          <span>预期证据</span>
          <p>{preview.expectedEvidenceSummary}</p>
        </div>
        <div className="template-governance-field-full">
          <span>人工说明</span>
          <p>{preset.description}</p>
        </div>
        <div className="template-governance-field-full">
          <span>覆盖关系</span>
          <p>{preview.overrideSummary}</p>
        </div>
        <div className="template-governance-field-full">
          <span>最终预览</span>
          <p>{preview.normalizedExample}</p>
        </div>
      </div>
    </article>
  );
}
