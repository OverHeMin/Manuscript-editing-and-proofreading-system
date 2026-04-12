import type { RulePackageCandidateViewModel } from "../editorial-rules/index.ts";
import {
  formatRulePackageAutomationPostureLabel,
  formatRulePackageKindLabel,
  formatRulePackageSuggestedLayerLabel,
  formatRulePackageTargetLabel,
} from "./template-governance-display.ts";

export interface RulePackageCandidateListProps {
  candidates: readonly RulePackageCandidateViewModel[];
  selectedPackageId: string | null;
  onSelectPackage: (packageId: string) => void;
}

export function RulePackageCandidateList({
  candidates,
  selectedPackageId,
  onSelectPackage,
}: RulePackageCandidateListProps) {
  return (
    <article className="template-governance-card rule-package-panel">
      <div className="template-governance-panel-header">
        <div>
          <h3>规则包</h3>
          <p>先按编辑意图分组复核，再决定哪个规则包值得进入语义确认与编译。</p>
        </div>
      </div>

      {candidates.length ? (
        <ul className="template-governance-list">
          {candidates.map((candidate) => {
            const isActive = candidate.package_id === selectedPackageId;

            return (
              <li key={candidate.package_id}>
                <button
                  type="button"
                  className={`template-governance-list-button${isActive ? " is-active" : ""}`}
                  onClick={() => onSelectPackage(candidate.package_id)}
                >
                  <span>{candidate.title}</span>
                  <small>{formatRulePackageKindLabel(candidate.package_kind)}</small>
                  <div className="template-governance-chip-row">
                    <span className="template-governance-chip">
                      {formatRulePackageTargetLabel(candidate.rule_object)}
                    </span>
                    <span className="template-governance-chip template-governance-chip-secondary">
                      {formatRulePackageSuggestedLayerLabel(candidate.suggested_layer)}
                    </span>
                    <span className="template-governance-chip template-governance-chip-secondary">
                      {formatRulePackageAutomationPostureLabel(candidate.automation_posture)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="template-governance-empty">当前复核案例还没有可用的规则包候选。</p>
      )}
    </article>
  );
}
