import type {
  RulePackageCompilePreviewViewModel,
  RulePackageCompileToDraftResultViewModel,
} from "../editorial-rules/index.ts";
import {
  formatRulePackageCompileReadinessLabel,
  formatRulePackageProjectionKindLabel,
  formatRulePackagePublishReadinessStatusLabel,
  formatRulePackageSemanticFieldLabel,
  formatRulePackageTargetLabel,
  formatRulePackageTargetModeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";

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
          <h3>编译预览</h3>
          <p>
            先确认规则包会怎样映射到
            {formatTemplateGovernanceModuleLabel(targetModule)}
            模块草稿，再决定是否生成规则草稿。
          </p>
        </div>
        <div className="template-governance-actions">
          <button type="button" disabled={!canPreview || isPreviewBusy} onClick={onPreview}>
            {isPreviewBusy ? "预览中..." : "预览编译"}
          </button>
          <button type="button" disabled={!canCompile || isCompileBusy} onClick={onCompile}>
            {isCompileBusy ? "编译中..." : "编译为规则草稿"}
          </button>
        </div>
      </div>

      <div className="template-governance-summary">
        <article className="template-governance-summary-card">
          <span>可直接编译</span>
          <strong>{readinessSummary.ready}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>降级执行</span>
          <strong>{readinessSummary.downgraded}</strong>
        </article>
        <article className="template-governance-summary-card">
          <span>阻塞项</span>
          <strong>{readinessSummary.blocked}</strong>
        </article>
      </div>

      {compilePreview ? (
        <ul className="rule-package-preview-list">
          {compilePreview.packages.map((entry) => (
            <li key={entry.package_id}>
              <p>
                <strong>{entry.package_id}</strong> -{" "}
                {formatRulePackageCompileReadinessLabel(entry.readiness.status)}
              </p>
              <small>
                生成规则对象：
                {entry.draft_rule_seeds.length
                  ? entry.draft_rule_seeds
                      .map((seed) => formatRulePackageTargetLabel(seed.rule_object))
                      .join("、")
                  : "无"}
              </small>
              {entry.warnings.length > 0 ? <small>{entry.warnings.join(" ")}</small> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="template-governance-empty">
          先运行编译预览，确认可编译状态、降级策略和目标规则对象，再生成规则草稿。
        </p>
      )}

      {compileResult ? (
        <article className="rule-package-preview-card">
          <span>规则草稿已就绪</span>
          <p>{compileResult.rule_set_id}</p>
          <small>目标草稿：{formatRulePackageTargetModeLabel(compileResult.target_mode)}</small>
          <small>
            新建规则：{compileResult.created_rule_ids.length}；替换规则：
            {compileResult.replaced_rule_ids.length}；跳过规则包：
            {compileResult.skipped_packages.length}
          </small>
          <small>
            发布就绪度：
            {formatRulePackagePublishReadinessStatusLabel(compileResult.publish_readiness.status)}
          </small>
          <small>
            阻塞：{compileResult.publish_readiness.blocked_package_count}；覆盖：
            {compileResult.publish_readiness.override_count}；谨慎自动：
            {compileResult.publish_readiness.guarded_rule_count}；仅检查：
            {compileResult.publish_readiness.inspect_rule_count}
          </small>
          <div className="rule-package-projection-summary">
            <strong>知识投影预览</strong>
            <small>
              投影类型：
              {compileResult.projection_readiness.projected_kinds.length
                ? compileResult.projection_readiness.projected_kinds
                    .map((kind) => formatRulePackageProjectionKindLabel(kind))
                    .join("、")
                : "无"}
            </small>
            <small>
              已确认语义字段：
              {compileResult.projection_readiness.confirmed_semantic_fields.length
                ? compileResult.projection_readiness.confirmed_semantic_fields
                    .map((field) => formatRulePackageSemanticFieldLabel(field))
                    .join("、")
                : "无"}
            </small>
            <small>
              暂不投影字段：
              {compileResult.projection_readiness.withheld_semantic_fields.length
                ? compileResult.projection_readiness.withheld_semantic_fields
                    .map((field) => formatRulePackageSemanticFieldLabel(field))
                    .join("、")
                : "无"}
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
              打开规则草稿
            </button>
            <button type="button" onClick={onOpenAdvancedRuleEditor}>
              打开高级规则编辑器
            </button>
            <button type="button" onClick={onGoToPublishArea}>
              前往发布区
            </button>
          </div>
        </article>
      ) : null}
    </article>
  );
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
