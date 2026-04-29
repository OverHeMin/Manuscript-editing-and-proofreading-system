import { RuleLearningPane } from "./rule-learning-pane.tsx";
import { RulePlatformReleasePanel } from "./rule-platform-release-panel.tsx";
import { TemplateGovernanceRuleWizard } from "./template-governance-rule-wizard.tsx";
import { createRuleWizardState } from "./template-governance-rule-wizard-state.ts";
import { TemplateGovernanceV2AdvancedPanel } from "./template-governance-v2-advanced-panel.tsx";
import type { TemplateGovernanceV2SectionData } from "./template-governance-v2-data.ts";
import type { TemplateGovernanceV2RouteState } from "./template-governance-v2-types.ts";

export interface TemplateGovernanceV2DetailPanelProps {
  data: TemplateGovernanceV2SectionData | null;
  routeState: TemplateGovernanceV2RouteState;
  initialSelectedLearningCandidateId?: string;
  initialSelectedReviewItemId?: string;
}

export function TemplateGovernanceV2DetailPanel({
  data,
  routeState,
  initialSelectedLearningCandidateId,
  initialSelectedReviewItemId,
}: TemplateGovernanceV2DetailPanelProps) {
  if (routeState.panel === "rule-wizard") {
    return (
      <div data-v2-detail-panel="rule-wizard">
        <TemplateGovernanceRuleWizard
          state={createRuleWizardState("create")}
        />
      </div>
    );
  }

  if (routeState.section === "recovery" && data?.section === "recovery") {
    return (
      <div
        data-v2-detail-panel={routeState.panel}
        data-initial-candidate-id={initialSelectedLearningCandidateId}
        data-initial-review-item-id={initialSelectedReviewItemId}
      >
        <RuleLearningPane
          initialCandidates={data.candidates}
          initialSelectedCandidateId={initialSelectedLearningCandidateId}
          initialReviewItems={data.reviewItems}
          initialSelectedReviewItemId={initialSelectedReviewItemId}
        />
      </div>
    );
  }

  if (routeState.section === "release" && data?.section === "release") {
    const selectedRuleSet = data.overview.selectedRuleSet ?? data.overview.ruleSets[0];
    if (selectedRuleSet) {
      return (
        <div data-v2-detail-panel="release-check">
          <RulePlatformReleasePanel
            selectedRuleSet={selectedRuleSet}
            manuscriptType={data.overview.selectedTemplateFamily?.manuscript_type ?? null}
            rules={data.overview.rules}
            isBusy={false}
            onTransitionRuleSet={() => undefined}
          />
        </div>
      );
    }
  }

  if (routeState.section === "advanced") {
    return (
      <div data-v2-detail-panel="advanced-compatibility">
        <TemplateGovernanceV2AdvancedPanel />
      </div>
    );
  }

  if (data?.section === "rules") {
    const selectedRow = data.ledger.selectedRow ?? data.ledger.rows[0] ?? null;
    return (
      <div data-v2-detail-panel="rule-detail">
        {selectedRow ? (
          <article>
            <strong>{selectedRow.title}</strong>
            <dl>
              <dt>类型</dt>
              <dd>{selectedRow.asset_kind}</dd>
              <dt>模块</dt>
              <dd>{selectedRow.module_label}</dd>
              <dt>发布</dt>
              <dd>{selectedRow.publish_status}</dd>
            </dl>
          </article>
        ) : (
          <p className="template-governance-empty">未选择项目</p>
        )}
      </div>
    );
  }

  return (
    <div data-v2-detail-panel={routeState.panel}>
      <p className="template-governance-empty">未选择项目</p>
    </div>
  );
}
