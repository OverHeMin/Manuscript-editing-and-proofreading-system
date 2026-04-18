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
  assert.match(markup, /\u5148\u5b8c\u6210\u5ba1\u6838\u7ed3\u8bba\uff0c\u518d\u8f6c\u6210\u89c4\u5219\u8349\u7a3f/u);
  assert.match(markup, /data-mode="rule-center-recovery"/);
  assert.match(markup, /manuscript-42/);
  assert.match(markup, /snapshot-42/);
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
  assert.match(markup, /\u8bc1\u636e\u6458\u8981/u);
  assert.match(markup, /\u5efa\u8bae\u6a21\u677f\u65cf/u);
  assert.match(markup, /\u5efa\u8bae\u671f\u520a\u6a21\u677f/u);
  assert.match(markup, /\u5ba1\u6838\u901a\u8fc7/u);
  assert.match(markup, /\u8f6c\u6210\u89c4\u5219\u8349\u7a3f/u);
  assert.match(markup, /\u9a73\u56de\u5019\u9009/u);
  assert.match(markup, /\u5148\u5b8c\u6210\u5ba1\u6838\u7ed3\u8bba\uff0c\u518d\u8f6c\u6210\u89c4\u5219\u8349\u7a3f/u);
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
