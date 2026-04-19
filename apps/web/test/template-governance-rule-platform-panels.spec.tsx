import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  EditorialRuleSetViewModel,
  EditorialRuleViewModel,
} from "../src/features/editorial-rules/types.ts";
import { RuleAuthoringExplainability } from "../src/features/template-governance/rule-authoring-explainability.tsx";
import { RuleAuthoringPreviewPanel } from "../src/features/template-governance/rule-authoring-preview.tsx";
import {
  buildRuleAuthoringPreview,
  createRuleAuthoringDraft,
  serializeRuleAuthoringDraft,
} from "../src/features/template-governance/rule-authoring-serialization.ts";
import { RulePlatformConflictPanel } from "../src/features/template-governance/rule-platform-conflict-panel.tsx";
import { RulePlatformMetricsPanel } from "../src/features/template-governance/rule-platform-metrics-panel.tsx";
import { RulePlatformReleasePanel } from "../src/features/template-governance/rule-platform-release-panel.tsx";

test("rule authoring preview exposes explainability reasons for hit, miss, override, and manual review", () => {
  const draft = createRuleAuthoringDraft("table");

  draft.journalTemplateId = "journal-alpha";
  draft.payload.semanticTarget = "header_cell";
  draft.payload.headerPathIncludes = ["Treatment group", "n (%)"];
  draft.payload.columnKey = "Treatment group > n (%)";

  const preview = buildRuleAuthoringPreview(draft);

  assert.match(preview.hitReason, /header_cell/u);
  assert.match(preview.hitReason, /Treatment group > n \(%\)/u);
  assert.match(preview.missReason, /three_line_table/u);
  assert.match(preview.overrideReason, /journal-alpha/u);
  assert.match(preview.manualReviewReason, /人工/u);
});

test("rule authoring explainability and preview panels render the explainability fields", () => {
  const draft = createRuleAuthoringDraft("table");
  draft.journalTemplateId = "journal-alpha";
  draft.payload.semanticTarget = "header_cell";
  draft.payload.headerPathIncludes = ["Treatment group", "n (%)"];
  draft.payload.columnKey = "Treatment group > n (%)";

  const explainabilityMarkup = renderToStaticMarkup(
    React.createElement(RuleAuthoringExplainability, {
      draft,
    }),
  );
  const previewMarkup = renderToStaticMarkup(
    React.createElement(RuleAuthoringPreviewPanel, {
      overview: null,
      draft,
    }),
  );

  assert.match(explainabilityMarkup, /data-rule-hit-reason="field"/u);
  assert.match(explainabilityMarkup, /data-rule-miss-reason="field"/u);
  assert.match(explainabilityMarkup, /data-rule-override-reason="field"/u);
  assert.match(explainabilityMarkup, /data-rule-manual-review-reason="field"/u);
  assert.match(previewMarkup, /data-rule-hit-reason="field"/u);
  assert.match(previewMarkup, /data-rule-manual-review-reason="field"/u);
});

test("rule platform conflict panel classifies override, merge, and exclusive conflict around the current draft", () => {
  const draft = createRuleAuthoringDraft("abstract");
  draft.journalTemplateId = "journal-alpha";
  draft.payload.sourceLabelText = "摘要 目的";
  draft.payload.normalizedLabelText = "（摘要　目的）：";

  const baseDraft = createRuleAuthoringDraft("abstract");
  baseDraft.payload.sourceLabelText = "摘要 目的";
  baseDraft.payload.normalizedLabelText = "（摘要　目的）";

  const mergeDraft = createRuleAuthoringDraft("table");
  mergeDraft.payload.semanticTarget = "header_cell";
  mergeDraft.payload.headerPathIncludes = ["Treatment group", "n (%)"];
  mergeDraft.payload.columnKey = "Treatment group > n (%)";

  const conflictingDraft = createRuleAuthoringDraft("abstract");
  conflictingDraft.payload.sourceLabelText = "摘要 目的";
  conflictingDraft.payload.normalizedLabelText = "（摘要　目的）";

  const overview = createOverview({
    selectedRuleSet: {
      id: "rule-set-journal-1",
      template_family_id: "family-1",
      journal_template_id: "journal-alpha",
      module: "editing",
      version_no: 1,
      status: "draft",
    },
    rules: [
      createRuleViewModel("rule-base-1", "rule-set-base-1", baseDraft),
      createRuleViewModel("rule-merge-1", "rule-set-base-1", mergeDraft),
      createRuleViewModel("rule-conflict-1", "rule-set-journal-1", conflictingDraft, {
        selector: {
          section_selector: "abstract",
          block_selector: "leading_heading",
        },
      }),
    ],
  });

  const markup = renderToStaticMarkup(
    React.createElement(RulePlatformConflictPanel, {
      overview,
      draft,
    }),
  );

  assert.match(markup, /data-rule-conflict-panel="field"/u);
  assert.match(markup, /data-conflict-kind="override"/u);
  assert.match(markup, /data-conflict-kind="merge"/u);
  assert.match(markup, /data-conflict-kind="exclusive_conflict"/u);
  assert.match(markup, /data-conflict-manual-review="true"/u);
});

test("rule platform metrics panel renders activation metrics, release comparison, and per-rule ranking", () => {
  const draft = createRuleAuthoringDraft("abstract");
  draft.payload.sourceLabelText = "摘要 目的";
  draft.payload.normalizedLabelText = "（摘要 目的）";

  const selectedRuleSet: EditorialRuleSetViewModel = {
    id: "rule-set-candidate-1",
    template_family_id: "family-1",
    journal_template_id: "journal-alpha",
    module: "editing",
    version_no: 2,
    status: "candidate",
    metrics_summary: {
      rule_set_id: "rule-set-candidate-1",
      totals: {
        governed_hit_count: 20,
        false_positive_count: 6,
        human_confirmation_count: 9,
        accept_change_only_count: 3,
        evidence_only_archive_count: 1,
        routed_rule_candidate_count: 4,
        routed_knowledge_candidate_count: 1,
        routed_prompt_candidate_count: 1,
        writeback_created_count: 5,
        writeback_applied_count: 3,
      },
      rates: {
        false_positive_rate: 0.3,
        human_confirmation_rate: 0.45,
        evidence_only_archive_rate: 0.05,
        writeback_success_rate: 0.6,
      },
    },
    release_comparison: {
      status: "degraded",
      recommendation: "hold",
      baseline_rule_set_id: "rule-set-active-1",
      compared_rule_set_id: "rule-set-candidate-1",
      baseline_metrics: {
        rule_set_id: "rule-set-active-1",
        totals: {
          governed_hit_count: 18,
          false_positive_count: 2,
          human_confirmation_count: 11,
          accept_change_only_count: 4,
          evidence_only_archive_count: 0,
          routed_rule_candidate_count: 3,
          routed_knowledge_candidate_count: 1,
          routed_prompt_candidate_count: 0,
          writeback_created_count: 4,
          writeback_applied_count: 4,
        },
        rates: {
          false_positive_rate: 0.11,
          human_confirmation_rate: 0.61,
          evidence_only_archive_rate: 0,
          writeback_success_rate: 1,
        },
      },
      candidate_metrics: {
        rule_set_id: "rule-set-candidate-1",
        totals: {
          governed_hit_count: 20,
          false_positive_count: 6,
          human_confirmation_count: 9,
          accept_change_only_count: 3,
          evidence_only_archive_count: 1,
          routed_rule_candidate_count: 4,
          routed_knowledge_candidate_count: 1,
          routed_prompt_candidate_count: 1,
          writeback_created_count: 5,
          writeback_applied_count: 3,
        },
        rates: {
          false_positive_rate: 0.3,
          human_confirmation_rate: 0.45,
          evidence_only_archive_rate: 0.05,
          writeback_success_rate: 0.6,
        },
      },
      reasons: [
        "False-positive rate regressed versus baseline.",
        "Writeback success rate regressed versus baseline.",
      ],
    },
  };

  const markup = renderToStaticMarkup(
    React.createElement(RulePlatformMetricsPanel, {
      selectedRuleSet,
      rules: [
        createRuleViewModel("rule-top-1", "rule-set-candidate-1", draft, {
          metrics_summary: {
            rule_id: "rule-top-1",
            rule_set_id: "rule-set-candidate-1",
            totals: {
              governed_hit_count: 14,
              false_positive_count: 4,
              human_confirmation_count: 6,
              accept_change_only_count: 2,
              evidence_only_archive_count: 0,
              routed_rule_candidate_count: 3,
              routed_knowledge_candidate_count: 1,
              routed_prompt_candidate_count: 0,
              writeback_created_count: 4,
              writeback_applied_count: 2,
            },
            rates: {
              false_positive_rate: 0.29,
              human_confirmation_rate: 0.43,
              evidence_only_archive_rate: 0,
              writeback_success_rate: 0.5,
            },
          },
        }),
        createRuleViewModel("rule-secondary-1", "rule-set-candidate-1", draft, {
          order_no: 20,
          metrics_summary: {
            rule_id: "rule-secondary-1",
            rule_set_id: "rule-set-candidate-1",
            totals: {
              governed_hit_count: 6,
              false_positive_count: 2,
              human_confirmation_count: 3,
              accept_change_only_count: 1,
              evidence_only_archive_count: 1,
              routed_rule_candidate_count: 1,
              routed_knowledge_candidate_count: 0,
              routed_prompt_candidate_count: 1,
              writeback_created_count: 1,
              writeback_applied_count: 1,
            },
            rates: {
              false_positive_rate: 0.33,
              human_confirmation_rate: 0.5,
              evidence_only_archive_rate: 0.17,
              writeback_success_rate: 1,
            },
          },
        }),
      ],
    }),
  );

  assert.match(markup, /data-rule-metrics-panel="field"/u);
  assert.match(markup, /data-release-comparison-status="degraded"/u);
  assert.match(markup, /data-release-comparison-recommendation="hold"/u);
  assert.match(markup, /False-positive rate regressed versus baseline\./u);
  assert.match(markup, /data-rule-metric-row="rule-top-1"/u);
  assert.match(markup, /data-rule-metric-row="rule-secondary-1"/u);
});

test("rule platform release panel blocks canary promotion when release comparison is degraded", () => {
  const markup = renderToStaticMarkup(
    React.createElement(RulePlatformReleasePanel, {
      selectedRuleSet: {
        id: "rule-set-canary-1",
        template_family_id: "family-1",
        module: "editing",
        version_no: 3,
        status: "canary",
        online_regression_run_id: "online-regression-run-1",
        online_regression_evidence_pack_id: "online-regression-pack-1",
        release_comparison: {
          status: "degraded",
          recommendation: "hold",
          baseline_rule_set_id: "rule-set-active-1",
          compared_rule_set_id: "rule-set-canary-1",
          baseline_metrics: {
            rule_set_id: "rule-set-active-1",
            totals: {
              governed_hit_count: 18,
              false_positive_count: 2,
              human_confirmation_count: 11,
              accept_change_only_count: 4,
              evidence_only_archive_count: 0,
              routed_rule_candidate_count: 3,
              routed_knowledge_candidate_count: 1,
              routed_prompt_candidate_count: 0,
              writeback_created_count: 4,
              writeback_applied_count: 4,
            },
            rates: {
              false_positive_rate: 0.11,
              human_confirmation_rate: 0.61,
              evidence_only_archive_rate: 0,
              writeback_success_rate: 1,
            },
          },
          candidate_metrics: {
            rule_set_id: "rule-set-canary-1",
            totals: {
              governed_hit_count: 20,
              false_positive_count: 6,
              human_confirmation_count: 9,
              accept_change_only_count: 3,
              evidence_only_archive_count: 1,
              routed_rule_candidate_count: 4,
              routed_knowledge_candidate_count: 1,
              routed_prompt_candidate_count: 1,
              writeback_created_count: 5,
              writeback_applied_count: 3,
            },
            rates: {
              false_positive_rate: 0.3,
              human_confirmation_rate: 0.45,
              evidence_only_archive_rate: 0.05,
              writeback_success_rate: 0.6,
            },
          },
          reasons: ["False-positive rate regressed versus baseline."],
        },
      },
      manuscriptType: "clinical_study",
      rules: [
        createRuleViewModel(
          "rule-top-1",
          "rule-set-canary-1",
          createRuleAuthoringDraft("abstract"),
        ),
      ],
      isBusy: false,
      onTransitionRuleSet: () => undefined,
    }),
  );

  assert.match(markup, /data-rule-release-panel="field"/u);
  assert.match(markup, /data-release-blocked="true"/u);
  assert.match(markup, /data-release-comparison-status="degraded"/u);
  assert.match(markup, /data-release-comparison-recommendation="hold"/u);
  assert.match(markup, /False-positive rate regressed versus baseline\./u);
});

test("rule platform release panel surfaces rollback recommendations for active rule sets", () => {
  const markup = renderToStaticMarkup(
    React.createElement(RulePlatformReleasePanel, {
      selectedRuleSet: {
        id: "rule-set-active-2",
        template_family_id: "family-1",
        module: "editing",
        version_no: 4,
        status: "active",
        release_comparison: {
          status: "degraded",
          recommendation: "rollback_recommended",
          baseline_rule_set_id: "rule-set-active-1",
          compared_rule_set_id: "rule-set-active-2",
          baseline_metrics: {
            rule_set_id: "rule-set-active-1",
            totals: {
              governed_hit_count: 24,
              false_positive_count: 2,
              human_confirmation_count: 14,
              accept_change_only_count: 5,
              evidence_only_archive_count: 0,
              routed_rule_candidate_count: 4,
              routed_knowledge_candidate_count: 1,
              routed_prompt_candidate_count: 0,
              writeback_created_count: 5,
              writeback_applied_count: 5,
            },
            rates: {
              false_positive_rate: 0.08,
              human_confirmation_rate: 0.58,
              evidence_only_archive_rate: 0,
              writeback_success_rate: 1,
            },
          },
          candidate_metrics: {
            rule_set_id: "rule-set-active-2",
            totals: {
              governed_hit_count: 24,
              false_positive_count: 8,
              human_confirmation_count: 9,
              accept_change_only_count: 3,
              evidence_only_archive_count: 2,
              routed_rule_candidate_count: 2,
              routed_knowledge_candidate_count: 1,
              routed_prompt_candidate_count: 1,
              writeback_created_count: 5,
              writeback_applied_count: 3,
            },
            rates: {
              false_positive_rate: 0.33,
              human_confirmation_rate: 0.38,
              evidence_only_archive_rate: 0.08,
              writeback_success_rate: 0.6,
            },
          },
          reasons: ["Writeback success rate regressed versus baseline."],
        },
      },
      manuscriptType: "clinical_study",
      rules: [
        createRuleViewModel(
          "rule-top-2",
          "rule-set-active-2",
          createRuleAuthoringDraft("abstract"),
        ),
      ],
      isBusy: false,
      onTransitionRuleSet: () => undefined,
    }),
  );

  assert.match(markup, /data-release-comparison-recommendation="rollback_recommended"/u);
  assert.match(markup, /data-release-rollback-recommended="true"/u);
  assert.match(markup, /Writeback success rate regressed versus baseline\./u);
});

function createRuleViewModel(
  id: string,
  ruleSetId: string,
  draft: ReturnType<typeof createRuleAuthoringDraft>,
  overrides: Partial<EditorialRuleViewModel> = {},
): EditorialRuleViewModel {
  const serialized = serializeRuleAuthoringDraft(draft);

  return {
    id,
    rule_set_id: ruleSetId,
    order_no: serialized.orderNo,
    priority: serialized.priority,
    rule_object: serialized.ruleObject ?? "generic",
    rule_type: serialized.ruleType,
    execution_mode: serialized.executionMode,
    scope: serialized.scope,
    selector: serialized.selector ?? {},
    trigger: serialized.trigger,
    action: serialized.action,
    authoring_payload: serialized.authoringPayload ?? {},
    explanation_payload: serialized.explanationPayload,
    linkage_payload: serialized.linkagePayload,
    projection_payload: serialized.projectionPayload,
    evidence_level: serialized.evidenceLevel,
    confidence_policy: serialized.confidencePolicy,
    severity: serialized.severity,
    enabled: serialized.enabled ?? true,
    example_before: serialized.exampleBefore,
    example_after: serialized.exampleAfter,
    manual_review_reason_template: serialized.manualReviewReasonTemplate,
    ...overrides,
  };
}

function createOverview(input: {
  selectedRuleSet: EditorialRuleSetViewModel;
  rules: EditorialRuleViewModel[];
}) {
  return {
    templateFamilies: [],
    selectedTemplateFamilyId: "family-1",
    selectedTemplateFamily: {
      id: "family-1",
      manuscript_type: "clinical_study",
      name: "Clinical study family",
      status: "active",
    },
    journalTemplateProfiles: [
      {
        id: "journal-alpha",
        template_family_id: "family-1",
        journal_key: "journal-alpha",
        journal_name: "Journal Alpha",
        status: "active",
      },
    ],
    selectedJournalTemplateId: "journal-alpha",
    selectedJournalTemplateProfile: {
      id: "journal-alpha",
      template_family_id: "family-1",
      journal_key: "journal-alpha",
      journal_name: "Journal Alpha",
      status: "active",
    },
    moduleTemplates: [],
    ruleSets: [input.selectedRuleSet],
    selectedRuleSetId: input.selectedRuleSet.id,
    selectedRuleSet: input.selectedRuleSet,
    rules: input.rules,
    instructionTemplates: [],
    selectedInstructionTemplateId: null,
    selectedInstructionTemplate: null,
    retrievalInsights: {
      status: "idle",
      latestRun: null,
      latestSnapshot: null,
      signals: [],
      message: "",
    },
    knowledgeItems: [],
    visibleKnowledgeItems: [],
    boundKnowledgeItems: [],
    selectedKnowledgeItemId: null,
    selectedKnowledgeItem: null,
    filters: {
      searchText: "",
      knowledgeStatus: "all",
    },
  };
}
