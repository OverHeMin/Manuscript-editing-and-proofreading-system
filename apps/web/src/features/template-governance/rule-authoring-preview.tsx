import type { TemplateGovernanceWorkbenchOverview } from "./template-governance-controller.ts";
import {
  buildRuleAuthoringPreview,
} from "./rule-authoring-serialization.ts";
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
          <h3>Rule Authoring Preview</h3>
          <p>
            Check the resolved selector summary, automation posture, and normalized example
            before publishing.
          </p>
        </div>
      </div>

      <div className="template-governance-detail-grid">
        <div>
          <span>Template Scope</span>
          <p>{preview.templateScopeSummary}</p>
        </div>
        <div>
          <span>Resolved Selector</span>
          <p>{preview.selectorSummary}</p>
        </div>
        <div>
          <span>Automation Risk Posture</span>
          <p>{preview.automationRiskPosture}</p>
        </div>
        <div>
          <span>Normalized Example</span>
          <p>{preview.normalizedExample}</p>
        </div>
        <div>
          <span>Semantic Match</span>
          <p>{preview.semanticHitSummary}</p>
        </div>
        <div>
          <span>Expected Runtime Evidence</span>
          <p>{preview.expectedEvidenceSummary}</p>
        </div>
        <div className="template-governance-field-full">
          <span>Override Resolution</span>
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
                  <span>Selector</span>
                  <code className="template-governance-code">
                    {JSON.stringify(rule.selector ?? {})}
                  </code>
                </div>
                <div>
                  <span>Trigger</span>
                  <code className="template-governance-code">
                    {JSON.stringify(rule.trigger)}
                  </code>
                </div>
                <div>
                  <span>Action</span>
                  <code className="template-governance-code">
                    {JSON.stringify(rule.action)}
                  </code>
                </div>
                <div>
                  <span>Example</span>
                  <p>
                    {rule.example_before ?? "n/a"}
                    {" -> "}
                    {rule.example_after ?? "n/a"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="template-governance-empty">
          No existing rules are attached to the current rule-set scope yet.
        </p>
      )}
    </article>
  );
}
