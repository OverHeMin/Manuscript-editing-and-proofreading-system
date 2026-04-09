import type { DuplicateKnowledgeMatchViewModel, DuplicateKnowledgeReason } from "./types.ts";

type DuplicatePanelCheckState = "not_checked" | "checking" | "checked" | "error";

export interface KnowledgeLibraryDuplicatePanelProps {
  matches: DuplicateKnowledgeMatchViewModel[];
  checkState?: DuplicatePanelCheckState;
  checkErrorMessage?: string | null;
  onOpenAsset?: (match: DuplicateKnowledgeMatchViewModel) => void;
}

interface DuplicatePanelSeveritySection {
  heading: "Exact Matches" | "High Similarity" | "Possible Overlap";
  severity: DuplicateKnowledgeMatchViewModel["severity"];
  matches: DuplicateKnowledgeMatchViewModel[];
}

export function KnowledgeLibraryDuplicatePanel({
  matches,
  checkState = "not_checked",
  checkErrorMessage = null,
  onOpenAsset,
}: KnowledgeLibraryDuplicatePanelProps) {
  const sections = createSeveritySections(matches);

  return (
    <section className="knowledge-library-panel knowledge-library-duplicate-panel">
      <header className="knowledge-library-panel-header">
        <div>
          <h2>Duplicate Signals</h2>
          <p>
            Review exact, high, and possible overlap matches before sending a draft to
            review.
          </p>
        </div>
      </header>

      {checkState === "checking" ? (
        <p className="knowledge-library-empty">Checking duplicates...</p>
      ) : checkState === "error" ? (
        <p className="knowledge-library-empty">
          {checkErrorMessage ?? "Duplicate check failed. Please retry duplicate check."}
        </p>
      ) : matches.length === 0 ? (
        <p className="knowledge-library-empty">
          Run duplicate checks to inspect similar knowledge assets.
        </p>
      ) : (
        <div className="knowledge-library-duplicate-sections">
          {sections.map((section) => (
            <section key={section.severity} className="knowledge-library-duplicate-section">
              <h3>{section.heading}</h3>
              {section.matches.length === 0 ? (
                <p className="knowledge-library-empty">
                  No {section.heading.toLowerCase()} in the latest duplicate check.
                </p>
              ) : (
                <ul className="knowledge-library-duplicate-list">
                  {section.matches.map((match) => (
                    <li
                      key={`${match.matched_asset_id}:${match.matched_revision_id}:${match.severity}`}
                      className="knowledge-library-duplicate-card"
                    >
                      <div className="knowledge-library-duplicate-card-head">
                        <strong>{match.matched_title}</strong>
                        <span>{match.severity}</span>
                      </div>
                      <dl className="knowledge-library-duplicate-card-meta">
                        <div>
                          <dt>Asset ID</dt>
                          <dd>{match.matched_asset_id}</dd>
                        </div>
                        <div>
                          <dt>Revision ID</dt>
                          <dd>{match.matched_revision_id}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>{match.matched_status}</dd>
                        </div>
                      </dl>
                      {match.matched_summary ? (
                        <p className="knowledge-library-duplicate-summary">
                          {match.matched_summary}
                        </p>
                      ) : null}
                      <p className="knowledge-library-duplicate-reasons">
                        Reasons: {match.reasons.map(formatDuplicateReason).join(", ")}
                      </p>
                      {onOpenAsset ? (
                        <button
                          type="button"
                          onClick={() => onOpenAsset(match)}
                          className="knowledge-library-duplicate-open-button"
                        >
                          Open Existing Asset
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function createSeveritySections(
  matches: DuplicateKnowledgeMatchViewModel[],
): DuplicatePanelSeveritySection[] {
  return [
    {
      heading: "Exact Matches",
      severity: "exact",
      matches: matches.filter((match) => match.severity === "exact"),
    },
    {
      heading: "High Similarity",
      severity: "high",
      matches: matches.filter((match) => match.severity === "high"),
    },
    {
      heading: "Possible Overlap",
      severity: "possible",
      matches: matches.filter((match) => match.severity === "possible"),
    },
  ];
}

function formatDuplicateReason(reason: DuplicateKnowledgeReason): string {
  return reason.replaceAll("_", " ");
}
