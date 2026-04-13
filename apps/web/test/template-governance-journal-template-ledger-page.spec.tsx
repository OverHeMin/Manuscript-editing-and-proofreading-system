import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceJournalTemplateLedgerPage } from "../src/features/template-governance/index.ts";
import type { TemplateGovernanceLedgerSearchState } from "../src/features/template-governance/template-governance-ledger-types.ts";

const journalFixture = {
  templateFamilies: [
    {
      id: "family-1",
      manuscript_type: "clinical_study" as const,
      name: "临床研究大模板",
      status: "active" as const,
    },
  ],
  selectedTemplateFamilyId: "family-1",
  selectedTemplateFamily: {
    id: "family-1",
    manuscript_type: "clinical_study" as const,
    name: "临床研究大模板",
    status: "active" as const,
  },
  journalTemplates: [
    {
      id: "journal-1",
      template_family_id: "family-1",
      journal_key: "zxyjhzz",
      journal_name: "《中西医结合杂志》",
      status: "active" as const,
    },
  ],
  selectedJournalTemplateId: "journal-1",
  selectedJournalTemplate: {
    id: "journal-1",
    template_family_id: "family-1",
    journal_key: "zxyjhzz",
    journal_name: "《中西医结合杂志》",
    status: "active" as const,
  },
  summary: {
    familyCount: 1,
    journalCount: 1,
    activeCount: 1,
  },
};

test("journal template ledger renders family-scoped journal rows", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceJournalTemplateLedgerPage viewModel={journalFixture} />,
  );

  assert.match(markup, /template-governance-journal-template-ledger-page/u);
  assert.match(markup, /期刊模板台账/u);
  assert.match(markup, /大模板台账/u);
  assert.match(markup, /所属大模板/u);
  assert.match(markup, /期刊键/u);
  assert.match(markup, /《中西医结合杂志》/u);
  assert.match(markup, /新增期刊模板/u);
});

test("journal template ledger renders inline edit form and search results when requested", () => {
  const searchState: TemplateGovernanceLedgerSearchState = {
    mode: "results",
    query: "中西医结合",
    title: "期刊模板查找结果",
    rows: [
      {
        id: "journal-1",
        primary: "《中西医结合杂志》",
        secondary: "临床研究大模板 / zxyjhzz",
        cells: ["clinical_study", "启用中", "active"],
      },
    ],
  };

  const markup = renderToStaticMarkup(
    <TemplateGovernanceJournalTemplateLedgerPage
      viewModel={journalFixture}
      formMode="edit"
      formValues={{
        templateFamilyId: "family-1",
        journalName: "《中西医结合杂志》",
        journalKey: "zxyjhzz",
      }}
      searchState={searchState}
    />,
  );

  assert.match(markup, /编辑期刊模板/u);
  assert.match(markup, /保存期刊模板修改/u);
  assert.match(markup, /期刊模板查找结果/u);
  assert.match(markup, /《中西医结合杂志》/u);
});
