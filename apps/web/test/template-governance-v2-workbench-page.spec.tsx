import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceV2WorkbenchPage } from "../src/features/template-governance/template-governance-v2-workbench-page.tsx";
import type { TemplateGovernanceV2SectionData } from "../src/features/template-governance/template-governance-v2-data.ts";

test("rule center V2 page imports scoped V2 css dynamically", () => {
  const source = readFileSync(
    new URL(
      "../src/features/template-governance/template-governance-v2-workbench-page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /template-governance-v2-workbench\.css/u);
});

test("rule center V2 page renders rules route inside the new shell", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceV2WorkbenchPage
      initialView="rule-ledger"
      initialSelectedRuleLedgerRowId="rule-row-1"
      initialSectionData={createRulesData()}
    />,
  );

  assert.match(markup, /rule-center-v2/u);
  assert.match(markup, /data-active-section="rules"/u);
  assert.match(markup, /data-v2-queue-section="rules"/u);
  assert.match(markup, /规则一/u);
  assert.match(markup, /data-v2-detail-panel="rule-detail"/u);
  assert.match(markup, /规则一/u);
  assert.doesNotMatch(markup, /template-governance-overview-page/u);
});

test("rule center V2 page keeps recovery candidate and review handoffs in the V2 panel", () => {
  const candidateMarkup = renderToStaticMarkup(
    <TemplateGovernanceV2WorkbenchPage
      initialView="rule-ledger"
      initialMode="learning"
      initialSelectedLearningCandidateId="candidate-1"
      initialSectionData={createRecoveryData()}
    />,
  );
  const reviewMarkup = renderToStaticMarkup(
    <TemplateGovernanceV2WorkbenchPage
      initialView="rule-ledger"
      initialMode="learning"
      initialSelectedReviewItemId="review-1"
      initialSectionData={createRecoveryData()}
    />,
  );

  assert.match(candidateMarkup, /data-active-section="recovery"/u);
  assert.match(candidateMarkup, /data-initial-candidate-id="candidate-1"/u);
  assert.match(reviewMarkup, /data-active-section="recovery"/u);
  assert.match(reviewMarkup, /data-initial-review-item-id="review-1"/u);
});

test("rule center V2 page renders advanced compatibility inside the V2 shell", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceV2WorkbenchPage
      initialView="classic"
      initialSectionData={createAdvancedData()}
    />,
  );

  assert.match(markup, /data-active-section="advanced"/u);
  assert.match(markup, /data-v2-advanced-panel="true"/u);
  assert.doesNotMatch(markup, /template-governance-workbench > .template-governance-card/u);
});

function createRulesData(): TemplateGovernanceV2SectionData {
  return {
    section: "rules",
    overview: createOverview(),
    ledger: {
      rows: [
        {
          id: "rule-row-1",
          asset_kind: "rule",
          title: "规则一",
          module_label: "编辑",
          manuscript_type_label: "临床研究",
          semantic_status: "已确认",
          publish_status: "草稿",
          contributor_label: "admin",
          updated_at: "2026-04-29T00:00:00.000Z",
        },
      ],
      category: "all",
      searchQuery: "",
      selectedRowId: "rule-row-1",
      selectedRow: {
        id: "rule-row-1",
        asset_kind: "rule",
        title: "规则一",
        module_label: "编辑",
        manuscript_type_label: "临床研究",
        semantic_status: "已确认",
        publish_status: "草稿",
        contributor_label: "admin",
        updated_at: "2026-04-29T00:00:00.000Z",
      },
      filters: {
        categories: [],
        modules: [],
        manuscriptTypes: [],
        publishStatuses: [],
        semanticStatuses: [],
      },
      summary: {
        totalCount: 1,
        ruleCount: 1,
        largeTemplateCount: 0,
        journalTemplateCount: 0,
        generalPackageCount: 0,
        medicalPackageCount: 0,
        recycledCandidateCount: 0,
      },
    },
  } as unknown as TemplateGovernanceV2SectionData;
}

function createRecoveryData(): TemplateGovernanceV2SectionData {
  return {
    section: "recovery",
    candidates: [
      {
        id: "candidate-1",
        type: "rule_candidate",
        title: "回流候选一",
        status: "pending_review",
        module: "editing",
        manuscript_type: "clinical_study",
        created_by: "reviewer",
        updated_at: "2026-04-29T00:00:00.000Z",
        governed_provenance_kind: "residual_issue",
        candidate_payload: {},
      },
    ],
    reviewItems: [
      {
        id: "review-1",
        type: "rule_candidate",
        title: "复核项一",
        source_kind: "residual_issue",
        review_status: "pending",
        risk_level: "medium",
      },
    ],
  } as unknown as TemplateGovernanceV2SectionData;
}

function createAdvancedData(): TemplateGovernanceV2SectionData {
  return {
    section: "advanced",
    overview: createOverview(),
  };
}

function createOverview() {
  return {
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
      latestRun: null,
      signals: [],
      snapshotSummaries: [],
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
  } as never;
}
