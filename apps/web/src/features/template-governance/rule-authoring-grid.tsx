import type { EditorialRuleSetViewModel } from "../editorial-rules/index.ts";
import { buildRuleAuthoringPreview } from "./rule-authoring-serialization.ts";
import type { RuleAuthoringDraft } from "./rule-authoring-types.ts";
import type { TemplateGovernanceWorkbenchOverview } from "./template-governance-controller.ts";
import {
  formatTemplateGovernanceConfidencePolicyLabel,
  formatTemplateGovernanceExecutionModeLabel,
  formatTemplateGovernanceModuleLabel,
  formatTemplateGovernanceSeverityLabel,
} from "./template-governance-display.ts";

export interface RuleAuthoringGridProps {
  overview: TemplateGovernanceWorkbenchOverview | null;
  selectedRuleSet: EditorialRuleSetViewModel | null;
  draft: RuleAuthoringDraft;
}

export function RuleAuthoringGrid({
  overview,
  selectedRuleSet,
  draft,
}: RuleAuthoringGridProps) {
  const draftPreview = buildRuleAuthoringPreview(draft);
  const rules = [...(overview?.rules ?? [])].sort((left, right) => left.order_no - right.order_no);

  return (
    <article className="template-governance-card">
      <div className="template-governance-panel-header">
        <div>
          <h3>规则台账</h3>
          <p>
            把引导式录入和批量台账放在一起，便于发布前检查范围、执行姿态和前后示例。
          </p>
        </div>
      </div>

      {selectedRuleSet ? (
        <>
          <p className="template-governance-selected-note">
            当前台账：{formatTemplateGovernanceModuleLabel(selectedRuleSet.module)} 规则集 v
            {selectedRuleSet.version_no}
          </p>
          <div className="template-governance-stack">
            <article className="template-governance-card">
              <strong>当前草稿</strong>
              <small>
                {draft.ruleObject} |{" "}
                {formatTemplateGovernanceExecutionModeLabel(draft.executionMode)} |{" "}
                {formatTemplateGovernanceConfidencePolicyLabel(draft.confidencePolicy)}
              </small>
              <div className="template-governance-detail-grid">
                <div>
                  <span>选择器摘要</span>
                  <p>{draftPreview.selectorSummary}</p>
                </div>
                <div>
                  <span>标准示例</span>
                  <p>{draftPreview.normalizedExample}</p>
                </div>
              </div>
            </article>

            {rules.length > 0 ? (
              rules.map((rule) => (
                <article key={rule.id} className="template-governance-card">
                  <strong>
                    #{rule.order_no} {rule.rule_object}
                  </strong>
                  <small>
                    {formatTemplateGovernanceExecutionModeLabel(rule.execution_mode)} |{" "}
                    {formatTemplateGovernanceSeverityLabel(rule.severity)} |{" "}
                    {formatTemplateGovernanceConfidencePolicyLabel(rule.confidence_policy)}
                  </small>
                  <div className="template-governance-detail-grid">
                    <div>
                      <span>前后示例</span>
                      <p>
                        {rule.example_before ?? "未填写"}
                        {" -> "}
                        {rule.example_after ?? "未填写"}
                      </p>
                    </div>
                    <div>
                      <span>人工复核</span>
                      <p>{rule.manual_review_reason_template ?? "未填写"}</p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="template-governance-empty">
                当前台账里还没有规则。
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="template-governance-empty">
          先创建或选择规则集，再打开规则台账。
        </p>
      )}
    </article>
  );
}
