import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatWorkbenchHash,
  resolveWorkbenchLocation,
} from "../src/app/workbench-routing.ts";
import {
  buildRuleAuthoringPrefillFromLearningCandidate,
} from "../src/features/learning-review/learning-review-prefill.ts";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  TemplateGovernanceWorkbenchPage,
} = await import("../src/features/template-governance/template-governance-workbench-page.tsx");
const {
  RuleLearningPane,
} = await import("../src/features/template-governance/rule-learning-pane.tsx");

const ABSTRACT_OBJECTIVE_SOURCE = "\u6458\u8981 \u76ee\u7684";
const ABSTRACT_OBJECTIVE_NORMALIZED = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

test("rule center routing preserves learning handoff context when switching modes", () => {
  const learningHash = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "rule-ledger",
    manuscriptId: "manuscript-42",
    reviewedCaseSnapshotId: "snapshot-42",
    ruleCenterMode: "learning",
  });

  assert.match(learningHash, /templateGovernanceView=rule-ledger/);
  assert.match(learningHash, /ruleCenterMode=learning/);
  assert.deepEqual(resolveWorkbenchLocation(learningHash), {
    workbenchId: "template-governance",
    templateGovernanceView: "rule-ledger",
    manuscriptId: "manuscript-42",
    reviewedCaseSnapshotId: "snapshot-42",
    ruleCenterMode: "learning",
  });
});

test("rule center learning mode renders a recovery workspace inside the rule center", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      controller: {
        loadRuleLedger: async () => ({
          category: "recycled_candidate",
          rows: [],
        }),
        loadOverview: async () => {
          throw new Error("not used");
        },
      },
      initialMode: "learning",
      prefilledManuscriptId: "manuscript-42",
      prefilledReviewedCaseSnapshotId: "snapshot-42",
      initialOverview: {
        templateFamilies: [],
        selectedTemplateFamilyId: null,
        selectedTemplateFamily: null,
        journalTemplateProfiles: [],
        selectedJournalTemplateId: null,
        selectedJournalTemplateProfile: null,
        moduleTemplates: [],
        ruleSets: [],
        selectedRuleSetId: null,
        selectedRuleSet: null,
        rules: [],
        instructionTemplates: [],
        selectedInstructionTemplateId: null,
        selectedInstructionTemplate: null,
        retrievalInsights: {
          status: "idle",
          latestRun: null,
          latestSnapshot: null,
          signals: [],
          message: "idle",
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
      },
    }),
  );

  assert.match(markup, /\u56de\u6d41\u5019\u9009\u8f6c\u89c4\u5219/u);
  assert.match(markup, /\u8f6c\u89c4\u5219\u7ad9/u);
  assert.match(markup, /\u7edf\u4e00\u590d\u6838\u4e2d\u5fc3/u);
  assert.match(markup, /\u5f85\u5904\u7406 0/u);
  assert.match(markup, /data-mode="rule-center-recovery"/);
  assert.match(markup, /manuscript-42/);
  assert.match(markup, /snapshot-42/);
  assert.doesNotMatch(
    markup,
    /\u53ea\u5904\u7406\u53ef\u6c89\u6dc0\u4e3a\u89c4\u5219\u8349\u7a3f\u7684\u590d\u6838\u9879\u3002\u5148\u5b8c\u6210\u590d\u6838\u7ed3\u8bba\uff0c\u518d\u8f6c\u6210\u89c4\u5219\u8349\u7a3f\u3002/u,
  );
  assert.doesNotMatch(markup, /\u89c4\u5219\u53f0\u8d26/u);
  assert.doesNotMatch(markup, /\u56de\u6d41\u5de5\u4f5c\u533a/u);
  assert.doesNotMatch(markup, /\u89c4\u5219\u5f55\u5165/u);
  assert.doesNotMatch(markup, /\u7edf\u4e00\u89c4\u5219\u8d44\u4ea7\u8868/u);
});

test("rule center recovery workspace shows evidence, destination context, and governance actions", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "admin",
      initialMode: "learning",
      controller: {
        loadRuleLedger: async () => ({
          category: "recycled_candidate",
          rows: [],
        }),
        loadOverview: async () => {
          throw new Error("not used");
        },
      },
      prefilledManuscriptId: "manuscript-42",
      prefilledReviewedCaseSnapshotId: "snapshot-42",
      initialLearningCandidates: [
        {
          id: "candidate-abstract-1",
          type: "rule_candidate",
          status: "pending_review",
          module: "editing",
          manuscript_type: "clinical_study",
          governed_provenance_kind: "reviewed_case_snapshot",
          snapshot_asset_id: "snapshot-asset-1",
          title: "Abstract heading normalization",
          proposal_text:
            "Normalize abstract objective headings to the governed journal style.",
          candidate_payload: {
            extraction_kind: "reviewed_fragment_diff",
            before_fragment: ABSTRACT_OBJECTIVE_SOURCE,
            after_fragment: ABSTRACT_OBJECTIVE_NORMALIZED,
            evidence_summary: "Human-reviewed abstract heading normalization.",
            selector: {
              section_selector: "abstract",
              label_selector: {
                text: ABSTRACT_OBJECTIVE_SOURCE,
              },
            },
            trigger: {
              kind: "exact_text",
              text: ABSTRACT_OBJECTIVE_SOURCE,
            },
            action: {
              kind: "replace_heading",
              to: ABSTRACT_OBJECTIVE_NORMALIZED,
            },
          },
          suggested_rule_object: "abstract",
          suggested_template_family_id: "family-1",
          suggested_journal_template_id: "journal-alpha",
          created_by: "editor-1",
          created_at: "2026-04-08T08:00:00.000Z",
          updated_at: "2026-04-08T08:05:00.000Z",
        },
      ],
      initialSelectedLearningCandidateId: "candidate-abstract-1",
      initialOverview: {
        templateFamilies: [],
        selectedTemplateFamilyId: null,
        selectedTemplateFamily: null,
        journalTemplateProfiles: [],
        selectedJournalTemplateId: null,
        selectedJournalTemplateProfile: null,
        moduleTemplates: [],
        ruleSets: [],
        selectedRuleSetId: null,
        selectedRuleSet: null,
        rules: [],
        instructionTemplates: [],
        selectedInstructionTemplateId: null,
        selectedInstructionTemplate: null,
        retrievalInsights: {
          status: "idle",
          latestRun: null,
          latestSnapshot: null,
          signals: [],
          message: "idle",
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
      },
    }),
  );

  assert.match(markup, /\u56de\u6d41\u5019\u9009/u);
  assert.match(markup, /\u7edf\u4e00\u590d\u6838\u4e2d\u5fc3/u);
  assert.match(markup, /\u8bc1\u636e\u6458\u8981/u);
  assert.match(markup, /\u5efa\u8bae\u6a21\u677f\u65cf/u);
  assert.match(markup, /\u5efa\u8bae\u671f\u520a\u6a21\u677f/u);
  assert.match(markup, /\u5ba1\u6838\u901a\u8fc7/u);
  assert.match(markup, /\u8f6c\u6210\u89c4\u5219\u8349\u7a3f/u);
  assert.match(markup, /\u9a73\u56de\u5019\u9009/u);
  assert.match(markup, /\u7edf\u4e00\u590d\u6838\u961f\u5217/u);
  assert.match(markup, /Human-reviewed abstract heading normalization\./);
  assert.match(markup, /Abstract heading normalization/);
  assert.match(markup, /\u7f16\u8f91/u);
  assert.match(markup, /\u4e34\u5e8a\u7814\u7a76/u);
  assert.doesNotMatch(markup, /\u6279\u51c6\u5019\u9009/u);
  assert.doesNotMatch(markup, /RulePackageAuthoringShell/);
});

test("rule center recovery workspace replaces legacy learning-review copy and shows review history", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "knowledge_reviewer",
      initialMode: "learning",
      controller: {
        loadRuleLedger: async () => ({
          category: "recycled_candidate",
          rows: [],
        }),
        loadOverview: async () => {
          throw new Error("not used");
        },
      },
      initialLearningCandidates: [
        {
          id: "candidate-abstract-2",
          type: "rule_candidate",
          status: "rejected",
          module: "editing",
          manuscript_type: "clinical_study",
          governed_provenance_kind: "reviewed_case_snapshot",
          snapshot_asset_id: "snapshot-asset-2",
          title: "Abstract structure review",
          proposal_text: "Normalize abstract structure before drafting the rule.",
          candidate_payload: {
            before_fragment: ABSTRACT_OBJECTIVE_SOURCE,
            after_fragment: ABSTRACT_OBJECTIVE_NORMALIZED,
            evidence_summary: "Human-reviewed abstract heading normalization.",
          },
          review_actions: [
            {
              action: "submitted_for_review",
              actor_role: "knowledge_reviewer",
              created_at: "2026-04-08T08:00:00.000Z",
            },
            {
              action: "rejected",
              actor_role: "knowledge_reviewer",
              review_note: "Need stronger evidence before reuse.",
              created_at: "2026-04-08T08:10:00.000Z",
            },
          ],
          created_by: "reviewer-1",
          created_at: "2026-04-08T08:00:00.000Z",
          updated_at: "2026-04-08T08:10:00.000Z",
        },
      ],
      initialSelectedLearningCandidateId: "candidate-abstract-2",
      initialOverview: {
        templateFamilies: [],
        selectedTemplateFamilyId: null,
        selectedTemplateFamily: null,
        journalTemplateProfiles: [],
        selectedJournalTemplateId: null,
        selectedJournalTemplateProfile: null,
        moduleTemplates: [],
        ruleSets: [],
        selectedRuleSetId: null,
        selectedRuleSet: null,
        rules: [],
        instructionTemplates: [],
        selectedInstructionTemplateId: null,
        selectedInstructionTemplate: null,
        retrievalInsights: {
          status: "idle",
          latestRun: null,
          latestSnapshot: null,
          signals: [],
          message: "idle",
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
      },
    }),
  );

  assert.match(markup, /\u56de\u6d41\u5019\u9009\u8f6c\u89c4\u5219/u);
  assert.doesNotMatch(markup, /\u5b66\u4e60\u56de\u6d41/u);
  assert.doesNotMatch(markup, /\u56de\u6d41\u5de5\u4f5c\u533a/u);
  assert.match(markup, /\u5ba1\u6838\u5386\u53f2/u);
  assert.match(markup, /Need stronger evidence before reuse\./u);
});

test("rule center recovery workspace renders residual issue provenance truthfully", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "knowledge_reviewer",
      initialMode: "learning",
      controller: {
        loadRuleLedger: async () => ({
          category: "recycled_candidate",
          rows: [],
        }),
        loadOverview: async () => {
          throw new Error("not used");
        },
      },
      initialLearningCandidates: [
        {
          id: "candidate-proofreading-residual-1",
          type: "rule_candidate",
          status: "pending_review",
          module: "proofreading",
          manuscript_type: "clinical_study",
          governed_provenance_kind: "residual_issue",
          snapshot_asset_id: "snapshot-asset-residual-1",
          title: "Unit normalization from governed proofreading residual",
          proposal_text: "Normalize mg per dL to mg/dL after residual validation.",
          candidate_payload: {
            before_fragment: "5 mg per dL",
            after_fragment: "5 mg/dL",
            evidence_summary: "Residual issue surfaced after the governed proofreading pass.",
          },
          created_by: "reviewer-1",
          created_at: "2026-04-18T08:00:00.000Z",
          updated_at: "2026-04-18T08:05:00.000Z",
        },
      ],
      initialSelectedLearningCandidateId: "candidate-proofreading-residual-1",
      initialOverview: {
        templateFamilies: [],
        selectedTemplateFamilyId: null,
        selectedTemplateFamily: null,
        journalTemplateProfiles: [],
        selectedJournalTemplateId: null,
        selectedJournalTemplateProfile: null,
        moduleTemplates: [],
        ruleSets: [],
        selectedRuleSetId: null,
        selectedRuleSet: null,
        rules: [],
        instructionTemplates: [],
        selectedInstructionTemplateId: null,
        selectedInstructionTemplate: null,
        retrievalInsights: {
          status: "idle",
          latestRun: null,
          latestSnapshot: null,
          signals: [],
          message: "idle",
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
      },
    }),
  );

  assert.match(markup, /\u6821\u5bf9\u6b8b\u4f59\u95ee\u9898/u);
  assert.doesNotMatch(markup, /\u672a\u6807\u6ce8/u);
});

test("rule center recovery workspace keeps proofreading residual progression wording aligned with the workbench handoff", () => {
  const Pane = RuleLearningPane as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Pane, {
      prefilledManuscriptId: "manuscript-42",
      prefilledReviewedCaseSnapshotId: "snapshot-42",
      initialReviewItems: [
        {
          id: "review-item-residual-observed-1",
          source_kind: "residual_issue",
          source_status: "observed",
          review_status: "pending",
          module: "proofreading",
          manuscript_id: "manuscript-42",
          manuscript_type: "clinical_study",
          snapshot_id: "snapshot-42",
          title: "Residual observed",
          summary: "Observed after proofreading confirmation.",
          created_at: "2026-04-18T08:00:00.000Z",
          updated_at: "2026-04-18T08:01:00.000Z",
          available_actions: ["validate"],
          issue_type: "statistical_expression",
          execution_snapshot_id: "snapshot-42",
          recommended_route: "rule_candidate",
          harness_validation_status: "not_required",
        },
        {
          id: "review-item-residual-harness-1",
          source_kind: "residual_issue",
          source_status: "validation_pending",
          review_status: "pending",
          module: "proofreading",
          manuscript_id: "manuscript-42",
          manuscript_type: "clinical_study",
          snapshot_id: "snapshot-43",
          title: "Residual queued for Harness",
          summary: "Queued for Harness validation.",
          created_at: "2026-04-18T08:02:00.000Z",
          updated_at: "2026-04-18T08:03:00.000Z",
          available_actions: ["validate"],
          issue_type: "table_note",
          execution_snapshot_id: "snapshot-43",
          recommended_route: "rule_candidate",
          harness_validation_status: "queued",
        },
        {
          id: "review-item-residual-ready-1",
          source_kind: "residual_issue",
          source_status: "candidate_ready",
          review_status: "pending",
          module: "proofreading",
          manuscript_id: "manuscript-42",
          manuscript_type: "clinical_study",
          snapshot_id: "snapshot-44",
          title: "Residual candidate ready",
          summary: "Ready to create a rule candidate.",
          created_at: "2026-04-18T08:04:00.000Z",
          updated_at: "2026-04-18T08:05:00.000Z",
          available_actions: ["route_to_rule_candidate"],
          issue_type: "unit_normalization",
          execution_snapshot_id: "snapshot-44",
          recommended_route: "rule_candidate",
          harness_validation_status: "passed",
        },
        {
          id: "review-item-residual-created-1",
          source_kind: "residual_issue",
          source_status: "candidate_created",
          review_status: "routed",
          module: "proofreading",
          manuscript_id: "manuscript-42",
          manuscript_type: "clinical_study",
          snapshot_id: "snapshot-45",
          title: "Residual candidate created",
          summary: "A rule candidate has already been created from this residual.",
          created_at: "2026-04-18T08:06:00.000Z",
          updated_at: "2026-04-18T08:07:00.000Z",
          available_actions: [],
          issue_type: "unit_normalization",
          execution_snapshot_id: "snapshot-45",
          recommended_route: "rule_candidate",
          harness_validation_status: "passed",
          learning_candidate_id: "candidate-rule-1",
        },
      ],
      initialSelectedReviewItemId: "review-item-residual-observed-1",
    }),
  );

  assert.match(
    markup,
    /\u5f53\u524d\u7edf\u4e00\u590d\u6838\u4f1a\u6cbf\u7528\u8fd9\u6761\u6cbb\u7406\u8bc1\u636e\u94fe\uff0c\u7ee7\u7eed\u5904\u7406\u5df2\u53d1\u73b0\u6b8b\u5dee\u3001Harness \u590d\u9a8c\u3001\u5019\u9009\u8def\u7531\u4e0e\u89c4\u5219\u5199\u56de\u3002/u,
  );
  assert.match(markup, /\u5df2\u53d1\u73b0\u6b8b\u5dee/u);
  assert.match(markup, /Harness \u5f85\u590d\u9a8c/u);
  assert.match(markup, /\u5019\u9009\u5df2\u5c31\u7eea/u);
  assert.match(markup, /\u5df2\u751f\u6210\u5019\u9009/u);
});

test("approved rule candidates surface governed editorial rule draft writeback status", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "admin",
      initialMode: "learning",
      controller: {
        loadRuleLedger: async () => ({
          category: "recycled_candidate",
          rows: [],
        }),
        loadOverview: async () => {
          throw new Error("not used");
        },
      },
      initialLearningCandidates: [
        {
          id: "candidate-rule-writeback-1",
          type: "rule_candidate",
          status: "approved",
          module: "editing",
          manuscript_type: "clinical_study",
          governed_provenance_kind: "residual_issue",
          snapshot_asset_id: "snapshot-asset-writeback-1",
          title: "Abstract heading normalization",
          proposal_text: "Normalize abstract objective headings to the governed journal style.",
          created_by: "editor-1",
          created_at: "2026-04-18T08:00:00.000Z",
          updated_at: "2026-04-18T08:05:00.000Z",
          writeback_summaries: [
            {
              id: "writeback-rule-applied-1",
              learning_candidate_id: "candidate-rule-writeback-1",
              target_type: "editorial_rule_draft",
              status: "applied",
              created_draft_asset_id: "editorial-rule-1",
              created_by: "admin-1",
              created_at: "2026-04-18T08:20:00.000Z",
              applied_by: "admin-1",
              applied_at: "2026-04-18T08:21:00.000Z",
            },
          ],
        },
      ],
      initialSelectedLearningCandidateId: "candidate-rule-writeback-1",
      initialOverview: {
        templateFamilies: [],
        selectedTemplateFamilyId: null,
        selectedTemplateFamily: null,
        journalTemplateProfiles: [],
        selectedJournalTemplateId: null,
        selectedJournalTemplateProfile: null,
        moduleTemplates: [],
        ruleSets: [],
        selectedRuleSetId: null,
        selectedRuleSet: null,
        rules: [],
        instructionTemplates: [],
        selectedInstructionTemplateId: null,
        selectedInstructionTemplate: null,
        retrievalInsights: {
          status: "idle",
          latestRun: null,
          latestSnapshot: null,
          signals: [],
          message: "idle",
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
      },
    }),
  );

  assert.match(markup, /\u89c4\u5219\u8349\u7a3f\u5199\u56de/u);
  assert.match(markup, /\u5df2\u5199\u56de/u);
  assert.match(markup, /editorial-rule-1/);
  assert.match(markup, /\u89c4\u5219\u8349\u7a3f\u5df2\u751f\u6210/u);
});

test("rule center recovery workspace can render governed-hit review items inside the unified review queue", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "admin",
      initialMode: "learning",
      controller: {
        loadRuleLedger: async () => ({
          category: "recycled_candidate",
          rows: [],
        }),
        loadOverview: async () => {
          throw new Error("not used");
        },
      },
      initialReviewItems: [
        {
          id: "review-item-governed-1",
          source_kind: "governed_hit",
          source_status: "submitted",
          review_status: "pending",
          module: "editing",
          manuscript_id: "manuscript-42",
          manuscript_type: "clinical_study",
          snapshot_id: "snapshot-42",
          source_asset_id: "asset-42",
          title: "Missed governed table rule",
          summary: "A governed formatting hit was missed in the editing output.",
          created_at: "2026-04-18T08:00:00.000Z",
          updated_at: "2026-04-18T08:05:00.000Z",
          available_actions: [
            "accept_change_only",
            "reject_as_false_positive",
            "route_to_rule_candidate",
            "route_to_knowledge_candidate",
            "route_to_prompt_candidate",
            "archive_as_evidence_only",
          ],
          feedback_category: "missed_hit",
          feedback_record_id: "feedback-42",
          recommended_route: "rule_candidate",
          harness_validation_status: "not_required",
          created_by: "editor-1",
        },
      ],
      initialSelectedReviewItemId: "review-item-governed-1",
      initialOverview: {
        templateFamilies: [],
        selectedTemplateFamilyId: null,
        selectedTemplateFamily: null,
        journalTemplateProfiles: [],
        selectedJournalTemplateId: null,
        selectedJournalTemplateProfile: null,
        moduleTemplates: [],
        ruleSets: [],
        selectedRuleSetId: null,
        selectedRuleSet: null,
        rules: [],
        instructionTemplates: [],
        selectedInstructionTemplateId: null,
        selectedInstructionTemplate: null,
        retrievalInsights: {
          status: "idle",
          latestRun: null,
          latestSnapshot: null,
          signals: [],
          message: "idle",
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
      },
    }),
  );

  assert.match(markup, /\u7edf\u4e00\u590d\u6838\u4e2d\u5fc3/u);
  assert.match(markup, /\u6765\u6e90/u);
  assert.match(markup, /\u6a21\u5757/u);
  assert.match(markup, /\u98ce\u9669/u);
  assert.match(markup, /\u5f53\u524d\u72b6\u6001/u);
  assert.match(markup, /\u64cd\u4f5c/u);
  assert.match(markup, /review-item-governed-1/);
  assert.match(markup, /\u4eba\u5de5\u53cd\u9988\u547d\u4e2d/u);
  assert.match(markup, /\u8f6c\u89c4\u5219\u5019\u9009/u);
  assert.match(markup, /\u4ec5\u4eba\u5de5\u5904\u7406/u);
  assert.match(markup, /\u8bef\u62a5\u9a73\u56de/u);
  assert.match(markup, /\u53ea\u4fdd\u7559\u8bc1\u636e/u);
  assert.match(markup, /snapshot-42/);
});

test("rule center recovery workspace excludes non-rule residual issues and non-rule learning candidates", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "admin",
      initialMode: "learning",
      controller: {
        loadRuleLedger: async () => ({
          category: "recycled_candidate",
          rows: [],
        }),
        loadOverview: async () => {
          throw new Error("not used");
        },
      },
      initialReviewItems: [
        {
          id: "review-item-residual-knowledge-1",
          source_kind: "residual_issue",
          source_status: "candidate_ready",
          review_status: "pending",
          module: "editing",
          manuscript_id: "manuscript-42",
          manuscript_type: "clinical_study",
          snapshot_id: "snapshot-42",
          title: "Knowledge-only residual",
          summary: "This issue should go to knowledge review, not rule center.",
          created_at: "2026-04-18T08:00:00.000Z",
          updated_at: "2026-04-18T08:05:00.000Z",
          available_actions: [
            "route_to_rule_candidate",
            "route_to_knowledge_candidate",
            "route_to_prompt_candidate",
          ],
          issue_type: "knowledge_gap",
          execution_snapshot_id: "execution-42",
          recommended_route: "knowledge_candidate",
          harness_validation_status: "passed",
        },
        {
          id: "candidate-knowledge-1",
          source_kind: "learning_candidate",
          source_status: "pending_review",
          review_status: "pending",
          status: "pending_review",
          module: "editing",
          manuscript_type: "clinical_study",
          title: "Knowledge remediation candidate",
          summary: "This candidate belongs to knowledge review.",
          created_at: "2026-04-18T08:06:00.000Z",
          updated_at: "2026-04-18T08:07:00.000Z",
          available_actions: ["approve", "reject"],
          candidate_type: "knowledge_candidate",
          type: "knowledge_candidate",
          created_by: "reviewer-1",
        },
      ],
      initialSelectedReviewItemId: "review-item-residual-knowledge-1",
      initialOverview: {
        templateFamilies: [],
        selectedTemplateFamilyId: null,
        selectedTemplateFamily: null,
        journalTemplateProfiles: [],
        selectedJournalTemplateId: null,
        selectedJournalTemplateProfile: null,
        moduleTemplates: [],
        ruleSets: [],
        selectedRuleSetId: null,
        selectedRuleSet: null,
        rules: [],
        instructionTemplates: [],
        selectedInstructionTemplateId: null,
        selectedInstructionTemplate: null,
        retrievalInsights: {
          status: "idle",
          latestRun: null,
          latestSnapshot: null,
          signals: [],
          message: "idle",
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
      },
    }),
  );

  assert.match(markup, /\u7edf\u4e00\u590d\u6838\u961f\u5217/u);
  assert.match(
    markup,
    /\u5f53\u524d\u6ca1\u6709\u5f85\u5904\u7406\u7684\u89c4\u5219\u6cbb\u7406\u590d\u6838\u9879/u,
  );
  assert.doesNotMatch(markup, /review-item-residual-knowledge-1/);
  assert.doesNotMatch(markup, /candidate-knowledge-1/);
  assert.doesNotMatch(markup, /Knowledge-only residual/);
  assert.doesNotMatch(markup, /Knowledge remediation candidate/);
});

test("rule center authoring wizard does not bootstrap from non-rule learning candidates", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "admin",
      initialView: "authoring",
      initialLearningCandidates: [
        {
          id: "candidate-knowledge-1",
          type: "knowledge_candidate",
          status: "approved",
          module: "editing",
          manuscript_type: "clinical_study",
          governed_provenance_kind: "human_feedback",
          snapshot_asset_id: "snapshot-asset-knowledge-1",
          title: "Knowledge remediation candidate",
          proposal_text: "This should continue in knowledge review instead of rule authoring.",
          created_by: "reviewer-1",
          created_at: "2026-04-18T08:00:00.000Z",
          updated_at: "2026-04-18T08:05:00.000Z",
        },
      ],
      initialSelectedLearningCandidateId: "candidate-knowledge-1",
    }),
  );

  assert.doesNotMatch(markup, /data-rule-wizard-handoff="candidate"/);
  assert.doesNotMatch(markup, /candidate-knowledge-1/);
  assert.doesNotMatch(markup, /Knowledge remediation candidate/);
  assert.match(markup, /\u89c4\u5219\u8349\u7a3f\u5411\u5bfc/u);
});

test("rule candidate handoff builds an authoring prefill with family journal module and provenance context", () => {
  const prefill = buildRuleAuthoringPrefillFromLearningCandidate(
    {
      id: "candidate-abstract-1",
      type: "rule_candidate",
      status: "approved",
      module: "editing",
      manuscript_type: "clinical_study",
      governed_provenance_kind: "reviewed_case_snapshot",
      snapshot_asset_id: "snapshot-asset-1",
      title: "Abstract heading normalization",
      proposal_text:
        "Normalize abstract objective headings to the governed journal style.",
      candidate_payload: {
        extraction_kind: "reviewed_fragment_diff",
        before_fragment: ABSTRACT_OBJECTIVE_SOURCE,
        after_fragment: ABSTRACT_OBJECTIVE_NORMALIZED,
        evidence_summary: "Human-reviewed abstract heading normalization.",
        selector: {
          section_selector: "abstract",
          label_selector: {
            text: ABSTRACT_OBJECTIVE_SOURCE,
          },
        },
        trigger: {
          kind: "exact_text",
          text: ABSTRACT_OBJECTIVE_SOURCE,
        },
        action: {
          kind: "replace_heading",
          to: ABSTRACT_OBJECTIVE_NORMALIZED,
        },
      },
      suggested_rule_object: "abstract",
      suggested_template_family_id: "family-1",
      suggested_journal_template_id: "journal-alpha",
      created_by: "editor-1",
      created_at: "2026-04-08T08:00:00.000Z",
      updated_at: "2026-04-08T08:05:00.000Z",
    },
    {
      reviewedCaseSnapshotId: "snapshot-42",
    },
  );

  assert.equal(prefill.module, "editing");
  assert.equal(prefill.selectedTemplateFamilyId, "family-1");
  assert.equal(prefill.selectedJournalTemplateId, "journal-alpha");
  assert.equal(prefill.reviewedCaseSnapshotId, "snapshot-42");
  assert.equal(prefill.sourceLearningCandidateId, "candidate-abstract-1");
  assert.equal(prefill.ruleDraft.ruleObject, "abstract");
  assert.equal(prefill.ruleDraft.payload.sourceLabelText, ABSTRACT_OBJECTIVE_SOURCE);
  assert.equal(
    prefill.ruleDraft.payload.normalizedLabelText,
    ABSTRACT_OBJECTIVE_NORMALIZED,
  );
  assert.deepEqual(prefill.linkagePayload, {
    source_learning_candidate_id: "candidate-abstract-1",
    source_snapshot_asset_id: "snapshot-asset-1",
  });
  assert.deepEqual(prefill.projectionPayload, {
    projection_kind: "rule",
    summary: "Normalize abstract objective headings to the governed journal style.",
    standard_example: ABSTRACT_OBJECTIVE_NORMALIZED,
    incorrect_example: ABSTRACT_OBJECTIVE_SOURCE,
  });
});

test("rule center authoring wizard keeps candidate handoff details visible after routing", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "admin",
      initialView: "authoring",
      prefilledManuscriptId: "manuscript-42",
      prefilledReviewedCaseSnapshotId: "snapshot-42",
      initialLearningCandidates: [
        {
          id: "candidate-abstract-1",
          type: "rule_candidate",
          status: "approved",
          module: "editing",
          manuscript_type: "clinical_study",
          governed_provenance_kind: "reviewed_case_snapshot",
          snapshot_asset_id: "snapshot-asset-1",
          title: "Abstract heading normalization",
          proposal_text:
            "Normalize abstract objective headings to the governed journal style.",
          candidate_payload: {
            extraction_kind: "reviewed_fragment_diff",
            before_fragment: ABSTRACT_OBJECTIVE_SOURCE,
            after_fragment: ABSTRACT_OBJECTIVE_NORMALIZED,
            evidence_summary: "Human-reviewed abstract heading normalization.",
          },
          suggested_rule_object: "abstract",
          suggested_template_family_id: "family-1",
          suggested_journal_template_id: "journal-alpha",
          created_by: "editor-1",
          created_at: "2026-04-08T08:00:00.000Z",
          updated_at: "2026-04-08T08:05:00.000Z",
        },
      ],
      initialSelectedLearningCandidateId: "candidate-abstract-1",
    }),
  );

  assert.match(markup, /data-rule-wizard-handoff="candidate"/);
  assert.match(markup, /\u6765\u6e90\u4ea4\u63a5\u4fe1\u606f/u);
  assert.match(markup, /\u5b66\u4e60\u5019\u9009/u);
  assert.match(markup, /candidate-abstract-1/);
  assert.match(markup, /\u6765\u6e90\u7a3f\u4ef6/u);
  assert.match(markup, /manuscript-42/);
  assert.match(markup, /\u590d\u6838\u5feb\u7167/u);
  assert.match(markup, /snapshot-42/);
  assert.match(markup, /\u5feb\u7167\u8d44\u4ea7/u);
  assert.match(markup, /snapshot-asset-1/);
  assert.match(markup, /\u8bc1\u636e\u6458\u8981/u);
  assert.match(markup, /Human-reviewed abstract heading normalization\./);
  assert.match(markup, /\u5019\u9009\u5efa\u8bae/u);
  assert.match(markup, /Normalize abstract objective headings to the governed journal style\./);
  assert.match(markup, /\u539f\u59cb\u7247\u6bb5/u);
  assert.match(markup, new RegExp(ABSTRACT_OBJECTIVE_SOURCE));
  assert.match(markup, /\u5efa\u8bae\u6539\u5199/u);
  assert.match(markup, new RegExp(ABSTRACT_OBJECTIVE_NORMALIZED));
});
