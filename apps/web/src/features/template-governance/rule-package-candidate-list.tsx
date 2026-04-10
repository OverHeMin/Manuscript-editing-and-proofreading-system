import type { RulePackageCandidateViewModel } from "../editorial-rules/index.ts";

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
          <h3>Rule Packages</h3>
          <p>Review grouped edit intentions first, then decide which package deserves semantic confirmation.</p>
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
                  <small>{formatPackageKind(candidate.package_kind)}</small>
                  <div className="template-governance-chip-row">
                    <span className="template-governance-chip">
                      {candidate.rule_object}
                    </span>
                    <span className="template-governance-chip template-governance-chip-secondary">
                      {formatSuggestedLayer(candidate.suggested_layer)}
                    </span>
                    <span className="template-governance-chip template-governance-chip-secondary">
                      {candidate.automation_posture}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="template-governance-empty">
          No rule-package candidates are available for the current reviewed case yet.
        </p>
      )}
    </article>
  );
}

function formatPackageKind(packageKind: RulePackageCandidateViewModel["package_kind"]): string {
  switch (packageKind) {
    case "front_matter":
      return "Front matter";
    case "abstract_keywords":
      return "Abstract and keywords";
    case "heading_hierarchy":
      return "Heading hierarchy";
    case "numeric_statistics":
      return "Numeric statistics";
    case "three_line_table":
      return "Three-line table";
    case "reference":
      return "References";
    default:
      return packageKind;
  }
}

function formatSuggestedLayer(
  suggestedLayer: RulePackageCandidateViewModel["suggested_layer"],
): string {
  return suggestedLayer === "journal_template" ? "Journal layer" : "Family layer";
}
