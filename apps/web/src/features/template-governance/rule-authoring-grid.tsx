import type { EditorialRuleSetViewModel } from "../editorial-rules/index.ts";
import { buildRuleAuthoringPreview } from "./rule-authoring-serialization.ts";
import type { RuleAuthoringDraft } from "./rule-authoring-types.ts";
import type { TemplateGovernanceWorkbenchOverview } from "./template-governance-controller.ts";

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
          <h3>Rule Ledger</h3>
          <p>
            Keep guided authoring and batch ledger maintenance in the same place so operators can
            check scope, execution posture, and examples before publishing.
          </p>
        </div>
      </div>

      {selectedRuleSet ? (
        <>
          <p className="template-governance-selected-note">
            Ledger for {selectedRuleSet.module} rule set v{selectedRuleSet.version_no}
          </p>
          <div className="template-governance-stack">
            <article className="template-governance-card">
              <strong>Draft in progress</strong>
              <small>
                {draft.ruleObject} | {draft.executionMode} | {draft.confidencePolicy}
              </small>
              <div className="template-governance-detail-grid">
                <div>
                  <span>Selector</span>
                  <p>{draftPreview.selectorSummary}</p>
                </div>
                <div>
                  <span>Example</span>
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
                    {rule.execution_mode} | {rule.severity} | {rule.confidence_policy}
                  </small>
                  <div className="template-governance-detail-grid">
                    <div>
                      <span>Example</span>
                      <p>
                        {rule.example_before ?? "n/a"}
                        {" -> "}
                        {rule.example_after ?? "n/a"}
                      </p>
                    </div>
                    <div>
                      <span>Manual Review</span>
                      <p>{rule.manual_review_reason_template ?? "n/a"}</p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="template-governance-empty">
                No rules exist in the selected ledger yet.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="template-governance-empty">
          Create or select a rule set before opening the rule ledger.
        </p>
      )}
    </article>
  );
}
