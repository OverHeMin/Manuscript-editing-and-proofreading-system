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
          <h3>Rule Explainability</h3>
          <p>
            Show what this rule is targeting, why its automation posture is safe or inspect-only,
            and which exact example will be used for operator review.
          </p>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <div>
          <span>Object</span>
          <p>{preset.objectLabel}</p>
        </div>
        <div>
          <span>Automation Risk</span>
          <p>{preset.automationRisk}</p>
        </div>
        <div>
          <span>Resolved Scope</span>
          <p>{preview.templateScopeSummary}</p>
        </div>
        <div>
          <span>Selector Summary</span>
          <p>{preview.selectorSummary}</p>
        </div>
        <div className="template-governance-field-full">
          <span>Operator Note</span>
          <p>{preset.description}</p>
        </div>
        <div className="template-governance-field-full">
          <span>Exact Preview</span>
          <p>{preview.normalizedExample}</p>
        </div>
      </div>
    </article>
  );
}
