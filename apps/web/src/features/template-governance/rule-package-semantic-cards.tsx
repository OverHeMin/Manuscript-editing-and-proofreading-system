import type { RulePackageDraftViewModel } from "../editorial-rules/index.ts";

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
            <h3>Semantic Cards</h3>
            <p>Select a rule package to inspect its AI-readable understanding layer.</p>
          </div>
        </div>
        <p className="template-governance-empty">
          No rule package is selected yet.
        </p>
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
            <p>Keep the package name, target object, and publishing layer concise enough for quick confirmation.</p>
          </div>
        </div>
        <div className="rule-package-definition-grid">
          <div>
            <span>规则名</span>
            <p>{packageDraft.cards.rule_what.title}</p>
          </div>
          <div>
            <span>规则对象</span>
            <p>{packageDraft.cards.rule_what.object}</p>
          </div>
          <div>
            <span>发布层级</span>
            <p>{formatPublishLayer(packageDraft.cards.rule_what.publish_layer)}</p>
          </div>
        </div>
      </article>

      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>AI怎么理解它</h3>
            <p>Expose the sentence-level intent that the AI should use when deciding whether this package applies.</p>
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
            <p>{joinValues(packageDraft.cards.ai_understanding.hit_objects)}</p>
          </div>
          <div>
            <span>命中位置</span>
            <p>{joinValues(packageDraft.cards.ai_understanding.hit_locations)}</p>
          </div>
        </div>
      </article>

      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>适用于哪里</h3>
            <p>Keep scope grounded in manuscript type, module, section, and table semantics instead of low-level selectors.</p>
          </div>
        </div>
        <div className="rule-package-definition-grid">
          <div>
            <span>稿件类型</span>
            <p>{joinValues(packageDraft.cards.applicability.manuscript_types)}</p>
          </div>
          <div>
            <span>适用模块</span>
            <p>{joinValues(packageDraft.cards.applicability.modules)}</p>
          </div>
          <div className="template-governance-field-full">
            <span>章节/块</span>
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
            <p>{joinValues(packageDraft.cards.applicability.table_targets)}</p>
          </div>
        </div>
      </article>

      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>前后示例</h3>
            <p>Keep at least one grounded before/after pair so operators can see why the package exists.</p>
          </div>
        </div>
        {evidenceExamples.length ? (
          <div className="rule-package-evidence-grid">
            <article>
              <label className="template-governance-field">
                <span>Before</span>
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
                <span>After</span>
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
          <p className="template-governance-empty">
            No evidence examples have been attached yet.
          </p>
        )}
      </article>

      <article className="template-governance-card rule-package-panel">
        <div className="template-governance-panel-header">
          <div>
            <h3>什么时候不要用</h3>
            <p>Make the package fail safely by surfacing non-applicable boundaries and mandatory human review moments.</p>
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
            <p>{packageDraft.cards.exclusions.risk_posture}</p>
          </div>
        </div>
      </article>
    </section>
  );
}

function formatPublishLayer(
  publishLayer: RulePackageDraftViewModel["cards"]["rule_what"]["publish_layer"],
): string {
  return publishLayer === "journal_template" ? "期刊小模板" : "大模板";
}

function joinValues(values: readonly string[]): string {
  return values.length > 0 ? values.join("，") : "未限定";
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
