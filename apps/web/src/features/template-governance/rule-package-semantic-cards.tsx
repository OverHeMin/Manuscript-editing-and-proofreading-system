import type { RulePackageDraftViewModel } from "../editorial-rules/index.ts";
import {
  formatRulePackageAutomationPostureLabel,
  formatRulePackagePublishLayerLabel,
  formatRulePackageTargetLabel,
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";

export interface RulePackageSemanticCardsProps {
  packageDraft: RulePackageDraftViewModel | null;
  onUpdateDraft?: (
    recipe: (draft: RulePackageDraftViewModel) => RulePackageDraftViewModel,
  ) => void;
}

export function RulePackageSemanticCards({
  packageDraft,
  onUpdateDraft,
}: RulePackageSemanticCardsProps) {
  if (!packageDraft) {
    return (
      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>语义卡片</h3>
            <p>先选择一个规则包，再查看 AI 可读的理解层和适用边界。</p>
          </div>
        </div>
        <p className="template-governance-empty">当前还没有选中规则包。</p>
      </article>
    );
  }

  const evidenceExamples =
    packageDraft.cards.evidence.examples.length > 0
      ? packageDraft.cards.evidence.examples
      : packageDraft.semantic_draft?.evidence_examples ?? [];
  const summary =
    packageDraft.semantic_draft?.semantic_summary ??
    packageDraft.cards.ai_understanding.summary;
  const applicability =
    packageDraft.semantic_draft?.applicability ??
    packageDraft.cards.applicability.sections;
  const failureBoundaries =
    packageDraft.semantic_draft?.failure_boundaries ??
    packageDraft.cards.exclusions.not_applicable_when;
  const reviewPolicy =
    packageDraft.semantic_draft?.review_policy ??
    packageDraft.cards.exclusions.human_review_required_when;
  const primaryEvidenceExample = evidenceExamples[0] ?? {
    before: "",
    after: "",
  };

  return (
    <section className="rule-package-card-stack">
      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>规则是什么</h3>
            <p>先确认规则包名称、作用对象和发布层级，保证录入足够简洁可复核。</p>
          </div>
        </div>
        <div className="rule-package-definition-grid">
          <div>
            <span>规则名</span>
            <p>{packageDraft.cards.rule_what.title}</p>
          </div>
          <div>
            <span>规则对象</span>
            <p>{formatRulePackageTargetLabel(packageDraft.cards.rule_what.object)}</p>
          </div>
          <div>
            <span>发布层级</span>
            <p>{formatRulePackagePublishLayerLabel(packageDraft.cards.rule_what.publish_layer)}</p>
          </div>
        </div>
      </article>

      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>AI 怎么理解它</h3>
            <p>把句子级摘要说清楚，让 AI 知道这个规则包在什么情况下应该生效。</p>
          </div>
        </div>
        <div className="rule-package-definition-grid">
          <div className="template-governance-field-full">
            <span>一句话摘要</span>
            <textarea
              rows={3}
              value={summary}
              onChange={(event) =>
                onUpdateDraft?.((draft) => ({
                  ...draft,
                  semantic_draft: {
                    ...ensureSemanticDraft(draft),
                    semantic_summary: event.target.value,
                  },
                }))
              }
            />
          </div>
          <div>
            <span>命中对象</span>
            <p>{joinValues(packageDraft.cards.ai_understanding.hit_objects, formatRulePackageTargetLabel)}</p>
          </div>
          <div>
            <span>命中位置</span>
            <p>{joinValues(packageDraft.cards.ai_understanding.hit_locations, formatRulePackageTargetLabel)}</p>
          </div>
        </div>
      </article>

      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>适用于哪里</h3>
            <p>按稿件类型、模块和章节语义来定义范围，不把底层选择器直接暴露给操作员。</p>
          </div>
        </div>
        <div className="rule-package-definition-grid">
          <div>
            <span>稿件类型</span>
            <p>
              {joinValues(
                packageDraft.cards.applicability.manuscript_types,
                formatTemplateGovernanceManuscriptTypeLabel,
              )}
            </p>
          </div>
          <div>
            <span>适用模块</span>
            <p>{joinValues(packageDraft.cards.applicability.modules, formatTemplateGovernanceModuleLabel)}</p>
          </div>
          <div className="template-governance-field-full">
            <span>章节 / 块</span>
            <textarea
              rows={3}
              value={joinLines(applicability)}
              onChange={(event) =>
                onUpdateDraft?.((draft) => ({
                  ...draft,
                  semantic_draft: {
                    ...ensureSemanticDraft(draft),
                    applicability: splitLines(event.target.value),
                  },
                }))
              }
            />
          </div>
          <div className="template-governance-field-full">
            <span>表格对象</span>
            <p>{joinValues(packageDraft.cards.applicability.table_targets, formatRulePackageTargetLabel)}</p>
          </div>
        </div>
      </article>

      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>前后示例</h3>
            <p>至少保留一组前后对照，让操作员知道这个规则包到底在修什么。</p>
          </div>
        </div>
        {evidenceExamples.length ? (
          <div className="rule-package-evidence-grid">
            <article>
              <label className="template-governance-field">
                <span>处理前</span>
                <textarea
                  rows={3}
                  value={primaryEvidenceExample.before}
                  onChange={(event) =>
                    onUpdateDraft?.((draft) => ({
                      ...draft,
                      semantic_draft: {
                        ...ensureSemanticDraft(draft),
                        evidence_examples: [
                          {
                            ...primaryEvidenceExample,
                            before: event.target.value,
                          },
                        ],
                      },
                    }))
                  }
                />
              </label>
              <label className="template-governance-field">
                <span>处理后</span>
                <textarea
                  rows={3}
                  value={primaryEvidenceExample.after}
                  onChange={(event) =>
                    onUpdateDraft?.((draft) => ({
                      ...draft,
                      semantic_draft: {
                        ...ensureSemanticDraft(draft),
                        evidence_examples: [
                          {
                            ...primaryEvidenceExample,
                            after: event.target.value,
                          },
                        ],
                      },
                    }))
                  }
                />
              </label>
            </article>
          </div>
        ) : (
          <p className="template-governance-empty">还没有补充前后示例。</p>
        )}
      </article>

      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>什么时候不要用</h3>
            <p>把不适用边界和人工复核条件说清楚，确保规则包可以安全失效。</p>
          </div>
        </div>
        <div className="rule-package-definition-grid">
          <div className="template-governance-field-full">
            <span>不适用边界</span>
            <textarea
              rows={3}
              value={joinLines(failureBoundaries)}
              onChange={(event) =>
                onUpdateDraft?.((draft) => ({
                  ...draft,
                  semantic_draft: {
                    ...ensureSemanticDraft(draft),
                    failure_boundaries: splitLines(event.target.value),
                  },
                }))
              }
            />
          </div>
          <div className="template-governance-field-full">
            <span>人工复核条件</span>
            <textarea
              rows={3}
              value={joinLines(reviewPolicy)}
              onChange={(event) =>
                onUpdateDraft?.((draft) => ({
                  ...draft,
                  semantic_draft: {
                    ...ensureSemanticDraft(draft),
                    review_policy: splitLines(event.target.value),
                  },
                }))
              }
            />
          </div>
          <div>
            <span>风险姿态</span>
            <p>{formatRulePackageAutomationPostureLabel(packageDraft.cards.exclusions.risk_posture)}</p>
          </div>
        </div>
      </article>
    </section>
  );
}

function joinValues(
  values: readonly string[],
  formatter?: (value: string) => string,
): string {
  if (values.length === 0) {
    return "未限定";
  }

  return values.map((value) => (formatter ? formatter(value) : value)).join("、");
}

function joinLines(values: readonly string[]): string {
  return values.join("\n");
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function ensureSemanticDraft(
  draft: RulePackageDraftViewModel,
): NonNullable<RulePackageDraftViewModel["semantic_draft"]> {
  return (
    draft.semantic_draft ?? {
      semantic_summary: draft.cards.ai_understanding.summary,
      hit_scope: [],
      applicability: draft.cards.applicability.sections,
      evidence_examples: draft.cards.evidence.examples,
      failure_boundaries: draft.cards.exclusions.not_applicable_when,
      normalization_recipe: [],
      review_policy: draft.cards.exclusions.human_review_required_when,
      confirmed_fields: [],
    }
  );
}
