import type { RulePackagePreviewViewModel } from "../editorial-rules/index.ts";
import {
  formatRulePackageAutomationPostureLabel,
  formatRulePackageDecisionReviewLabel,
  formatRulePackageTargetLabel,
} from "./template-governance-display.ts";

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
          <h3>命中预览</h3>
          <p>预先查看规则包会命中哪里、为什么不命中，以及是否需要人工复核。</p>
        </div>
        {onRefreshPreview ? (
          <div className="template-governance-actions">
            <button type="button" onClick={onRefreshPreview} disabled={isRefreshing}>
              {isRefreshing ? "刷新中..." : "刷新预览"}
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
                <span>自动化姿态</span>
                <p>{formatRulePackageAutomationPostureLabel(preview.decision.automation_posture)}</p>
              </div>
              <div>
                <span>人工复核</span>
                <p>{formatRulePackageDecisionReviewLabel(preview.decision.needs_human_review)}</p>
              </div>
              <div className="template-governance-field-full">
                <span>决策原因</span>
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
                    <strong>{formatRulePackageTargetLabel(hit.target)}</strong>
                    <p>{hit.reason}</p>
                    {hit.matched_text ? <small>{hit.matched_text}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="template-governance-empty">当前预览还没有命中项。</p>
            )}
          </article>

          <article className="rule-package-preview-card">
            <h4>为什么不命中</h4>
            {preview.misses.length ? (
              <ul className="rule-package-preview-list">
                {preview.misses.map((miss, index) => (
                  <li key={`miss-${index}`}>
                    <strong>{formatRulePackageTargetLabel(miss.target)}</strong>
                    <p>{miss.reason}</p>
                    {miss.matched_text ? <small>{miss.matched_text}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="template-governance-empty">当前预览未发现未命中原因。</p>
            )}
          </article>
        </div>
      ) : (
        <p className="template-governance-empty">选中规则包后，这里会显示命中预览。</p>
      )}
    </article>
  );
}
