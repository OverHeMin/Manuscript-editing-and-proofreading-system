import type {
  RulePackageCompilePreviewEntryViewModel,
  RulePackageCompilePreviewViewModel,
  RulePackageCompileToDraftResultViewModel,
} from "../editorial-rules/index.ts";

export interface RulePackageCompilePanelProps {
  targetModule: string;
  compilePreview: RulePackageCompilePreviewViewModel | null;
  compileResult: RulePackageCompileToDraftResultViewModel | null;
  canPreview: boolean;
  canCompile: boolean;
  isPreviewBusy: boolean;
  isCompileBusy: boolean;
  onPreview?: () => void;
  onCompile?: () => void;
  onOpenDraftRuleSet?: () => void;
  onOpenAdvancedRuleEditor?: () => void;
  onGoToPublishArea?: () => void;
}

export function RulePackageCompilePanel({
  targetModule,
  compilePreview,
  compileResult,
  canPreview,
  canCompile,
  isPreviewBusy,
  isCompileBusy,
  onPreview,
  onCompile,
  onOpenDraftRuleSet,
  onOpenAdvancedRuleEditor,
  onGoToPublishArea,
}: RulePackageCompilePanelProps) {
  const readinessSummary = summarizeCompilePreview(compilePreview);

  return (
    <article className="template-governance-card rule-package-panel">
      <div className="template-governance-panel-header">
        <div>
          <h3>Compile</h3>
          <p>
            Preview how confirmed package drafts map into the existing editorial
            rule truth source for the {targetModule} module.
          </p>
        </div>
        <div className="template-governance-actions">
          <button type="button" disabled={!canPreview || isPreviewBusy} onClick={onPreview}>
            {isPreviewBusy ? "Previewing..." : "Compile Preview"}
          </button>
          <button type="button" disabled={!canCompile || isCompileBusy} onClick={onCompile}>
            {isCompileBusy ? "Compiling..." : "Compile To Draft Rule Set"}
          </button>
        </div>
      </div>

      <div className="template-governance-summary">
        <article className="template-governance-summary-card">
          <span>Ready Packages</span>
          <strong>{readinessSummary.ready}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Downgraded</span>
          <strong>{readinessSummary.downgraded}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>Blocked</span>
          <strong>{readinessSummary.blocked}</strong>
        </article>
      </div>

      {compilePreview ? (
        <ul className="rule-package-preview-list">
          {compilePreview.packages.map((entry) => (
            <li key={entry.package_id}>
              <p>
                <strong>{entry.package_id}</strong> - {entry.readiness.status}
              </p>
              <small>
                Compiled rules:{" "}
                {entry.draft_rule_seeds.map((seed) => seed.rule_object).join(", ") || "none"}
              </small>
              {entry.warnings.length > 0 ? (
                <small>{entry.warnings.join(" ")}</small>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="template-governance-empty">
          Run compile preview to inspect readiness, override risk, and compiled
          rule objects before writing a draft rule set.
        </p>
      )}

      {compileResult ? (
        <article className="rule-package-preview-card">
          <span>Draft rule set ready</span>
          <p>{compileResult.rule_set_id}</p>
          <small>Target draft: {formatTargetMode(compileResult.target_mode)}</small>
          <small>
            Created rules: {compileResult.created_rule_ids.length}; replaced rules:{" "}
            {compileResult.replaced_rule_ids.length}; skipped packages:{" "}
            {compileResult.skipped_packages.length}
          </small>
          <small>
            Publish readiness: {compileResult.publish_readiness.status}
          </small>
          <small>
            Blocked: {compileResult.publish_readiness.blocked_package_count}; overrides:{" "}
            {compileResult.publish_readiness.override_count}; guarded:{" "}
            {compileResult.publish_readiness.guarded_rule_count}; inspect:{" "}
            {compileResult.publish_readiness.inspect_rule_count}
          </small>
          <div className="rule-package-projection-summary">
            <strong>Knowledge Projection Preview</strong>
            <small>
              Projected kinds:{" "}
              {compileResult.projection_readiness.projected_kinds.join(", ") || "none"}
            </small>
            <small>
              Confirmed semantic fields:{" "}
              {compileResult.projection_readiness.confirmed_semantic_fields.join(", ") ||
                "none"}
            </small>
            <small>
              Withheld semantic fields:{" "}
              {compileResult.projection_readiness.withheld_semantic_fields.join(", ") ||
                "none"}
            </small>
          </div>
          {compileResult.publish_readiness.reasons.length > 0 ? (
            <ul className="rule-package-preview-list">
              {compileResult.publish_readiness.reasons.map((reason) => (
                <li key={reason}>
                  <small>{reason}</small>
                </li>
              ))}
            </ul>
          ) : null}
          {compileResult.projection_readiness.reasons.length > 0 ? (
            <ul className="rule-package-preview-list">
              {compileResult.projection_readiness.reasons.map((reason) => (
                <li key={reason}>
                  <small>{reason}</small>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="template-governance-actions">
            <button type="button" onClick={onOpenDraftRuleSet}>
              Open Draft Rule Set
            </button>
            <button type="button" onClick={onOpenAdvancedRuleEditor}>
              Open Advanced Rule Editor
            </button>
            <button type="button" onClick={onGoToPublishArea}>
              Go To Publish Area
            </button>
          </div>
        </article>
      ) : null}
    </article>
  );
}

function formatTargetMode(
  targetMode: RulePackageCompileToDraftResultViewModel["target_mode"],
): string {
  return targetMode === "reused_selected_draft"
    ? "Reused selected draft"
    : "Created new draft";
}

function summarizeCompilePreview(
  preview: RulePackageCompilePreviewViewModel | null,
): {
  ready: number;
  downgraded: number;
  blocked: number;
} {
  if (!preview) {
    return { ready: 0, downgraded: 0, blocked: 0 };
  }

  return preview.packages.reduce(
    (summary, entry) => {
      if (entry.readiness.status === "ready") {
        summary.ready += 1;
      } else if (entry.readiness.status === "ready_with_downgrade") {
        summary.ready += 1;
        summary.downgraded += 1;
      } else {
        summary.blocked += 1;
      }

      return summary;
    },
    { ready: 0, downgraded: 0, blocked: 0 },
  );
}
