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
    manuscriptId: "manuscript-42",
    reviewedCaseSnapshotId: "snapshot-42",
    ruleCenterMode: "learning",
  });

  assert.equal(
    learningHash,
    "#template-governance?manuscriptId=manuscript-42&reviewedCaseSnapshotId=snapshot-42&ruleCenterMode=learning",
  );
  assert.deepEqual(resolveWorkbenchLocation(learningHash), {
    workbenchId: "template-governance",
    manuscriptId: "manuscript-42",
    reviewedCaseSnapshotId: "snapshot-42",
    ruleCenterMode: "learning",
  });
});

test("rule center renders authoring and learning modes while keeping reviewed snapshot context", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      controller: {
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

  assert.match(markup, /\u89c4\u5219\u5f55\u5165\u5de5\u4f5c\u53f0/u);
  assert.match(markup, /\u89c4\u5219\u5b66\u4e60\u5de5\u4f5c\u53f0/u);
  assert.match(
    markup,
    /href="#template-governance\?manuscriptId=manuscript-42&amp;reviewedCaseSnapshotId=snapshot-42&amp;ruleCenterMode=authoring"/,
  );
  assert.match(markup, /snapshot-42/);
});

test("rule center learning mode renders rule candidates with evidence, proposed context, and action choices", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    React.createElement(Page, {
      actorRole: "admin",
      initialMode: "learning",
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

  assert.doesNotMatch(markup, /Knowledge Handoff Bridge/);
  assert.match(markup, /Rule Candidate Review/);
  assert.match(markup, /Abstract heading normalization/);
  assert.match(markup, /Human-reviewed abstract heading normalization\./);
  assert.match(markup, /\u6458\u8981 \u76ee\u7684/);
  assert.match(markup, /\uff08\u6458\u8981\u3000\u76ee\u7684\uff09/);
  assert.match(markup, /family-1/);
  assert.match(markup, /journal-alpha/);
  assert.match(markup, /abstract/);
  assert.match(markup, /section_selector/);
  assert.match(markup, /Approve Candidate/);
  assert.match(markup, /Reject Candidate/);
  assert.match(markup, /Convert To Rule Draft/);
  assert.match(markup, /Convert To Knowledge Explanation/);
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
