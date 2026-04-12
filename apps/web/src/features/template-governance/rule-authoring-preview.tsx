import type { TemplateGovernanceWorkbenchOverview } from "./template-governance-controller.ts";
import { buildRuleAuthoringPreview } from "./rule-authoring-serialization.ts";
import type { RuleAuthoringDraft } from "./rule-authoring-types.ts";

export interface RuleAuthoringPreviewPanelProps {
  overview: TemplateGovernanceWorkbenchOverview | null;
  draft: RuleAuthoringDraft;
}

export function RuleAuthoringPreviewPanel({
  overview,
  draft,
}: RuleAuthoringPreviewPanelProps) {
  const preview = buildRuleAuthoringPreview(draft);

  return (
    <article className="template-governance-card">
      <div className="template-governance-panel-header">
        <div>
          <h3>规则预览</h3>
          <p>在发布前确认规则范围、选择器摘要、自动化姿态与标准示例。</p>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <div>
          <span>模板范围</span>
          <p>{preview.templateScopeSummary}</p>
        </div>
        <div>
          <span>选择器摘要</span>
          <p>{preview.selectorSummary}</p>
        </div>
        <div>
          <span>自动化姿态</span>
          <p>{preview.automationRiskPosture}</p>
        </div>
        <div>
          <span>标准化示例</span>
          <p>{preview.normalizedExample}</p>
        </div>
        <div>
          <span>语义命中</span>
          <p>{preview.semanticHitSummary}</p>
        </div>
        <div>
          <span>预期运行证据</span>
          <p>{preview.expectedEvidenceSummary}</p>
        </div>
        <div className="template-governance-field-full">
          <span>覆盖关系</span>
          <p>{preview.overrideSummary}</p>
        </div>
      </div>

      {overview?.rules.length ? (
        <div className="template-governance-stack">
          {overview.rules.map((rule) => (
            <article key={rule.id} className="template-governance-card">
              <strong>
                {rule.rule_object} | {rule.execution_mode}
              </strong>
              <small>
                {rule.rule_type} | {rule.severity} | {rule.confidence_policy}
              </small>
              <div className="template-governance-detail-grid">
                <div>
                  <span>选择器</span>
                  <code className="template-governance-code">
                    {JSON.stringify(rule.selector ?? {})}
                  </code>
                </div>
                <div>
                  <span>触发条件</span>
                  <code className="template-governance-code">
                    {JSON.stringify(rule.trigger)}
                  </code>
                </div>
                <div>
                  <span>执行动作</span>
                  <code className="template-governance-code">
                    {JSON.stringify(rule.action)}
                  </code>
                </div>
                <div>
                  <span>示例</span>
                  <p>
                    {rule.example_before ?? "暂无"}
                    {" -> "}
                    {rule.example_after ?? "暂无"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="template-governance-empty">当前规则集范围下还没有可对照的既有规则。</p>
      )}
    </article>
  );
}
