import type { RulePackagePreviewViewModel } from "../editorial-rules/index.ts";

export interface RulePackagePreviewPanelProps {
  preview: RulePackagePreviewViewModel | null;
  isRefreshing?: boolean;
  onRefreshPreview?: () => void;
}

export function RulePackagePreviewPanel({
  preview,
  isRefreshing = false,
  onRefreshPreview,
}: RulePackagePreviewPanelProps) {
  return (
    <article className="template-governance-card rule-package-panel">
      <div className="template-governance-panel-header">
        <div>
          <h3>Preview</h3>
          <p>Show where the package would hit, why it would not hit, and whether the engine should stop for manual review.</p>
        </div>
        {onRefreshPreview ? (
          <div className="template-governance-actions">
            <button type="button" onClick={onRefreshPreview} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh Preview"}
            </button>
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="rule-package-preview-stack">
          <article className="rule-package-preview-card">
            <strong>{preview.hit_summary}</strong>
            <div className="rule-package-definition-grid">
              <div>
                <span>Automation</span>
                <p>{preview.decision.automation_posture}</p>
              </div>
              <div>
                <span>Human Review</span>
                <p>{preview.decision.needs_human_review ? "required" : "not required"}</p>
              </div>
              <div className="template-governance-field-full">
                <span>Decision Reason</span>
                <p>{preview.decision.reason}</p>
              </div>
            </div>
          </article>

          <article className="rule-package-preview-card">
            <h4>命中了哪里</h4>
            {preview.hits.length ? (
              <ul className="rule-package-preview-list">
                {preview.hits.map((hit, index) => (
                  <li key={`hit-${index}`}>
                    <strong>{hit.target}</strong>
                    <p>{hit.reason}</p>
                    {hit.matched_text ? <small>{hit.matched_text}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="template-governance-empty">No hits yet.</p>
            )}
          </article>

          <article className="rule-package-preview-card">
            <h4>为什么不命中</h4>
            {preview.misses.length ? (
              <ul className="rule-package-preview-list">
                {preview.misses.map((miss, index) => (
                  <li key={`miss-${index}`}>
                    <strong>{miss.target}</strong>
                    <p>{miss.reason}</p>
                    {miss.matched_text ? <small>{miss.matched_text}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="template-governance-empty">No misses were reported for this preview.</p>
            )}
          </article>
        </div>
      ) : (
        <p className="template-governance-empty">
          Preview details will appear after a rule package is selected.
        </p>
      )}
    </article>
  );
}
