import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceTemplateLedgerPage } from "../src/features/template-governance/index.ts";
import type { TemplateGovernanceLedgerSearchState } from "../src/features/template-governance/template-governance-ledger-types.ts";

const templateFixture = {
  templates: [
    {
      id: "template-composition-1",
      name: "临床研究大模板",
      manuscript_type: "clinical_study" as const,
      general_module_ids: ["general-module-1"],
      medical_module_ids: ["medical-module-1"],
      execution_module_scope: ["screening", "editing"] as const,
      version_no: 1,
      status: "draft" as const,
      created_at: "2026-04-13T12:00:00.000Z",
      updated_at: "2026-04-13T12:00:00.000Z",
    },
  ],
  generalModules: [],
  medicalModules: [],
  selectedTemplateId: "template-composition-1",
  selectedTemplate: {
    id: "template-composition-1",
    name: "临床研究大模板",
    manuscript_type: "clinical_study" as const,
    general_module_ids: ["general-module-1"],
    medical_module_ids: ["medical-module-1"],
    execution_module_scope: ["screening", "editing"] as const,
    version_no: 1,
    status: "draft" as const,
    created_at: "2026-04-13T12:00:00.000Z",
    updated_at: "2026-04-13T12:00:00.000Z",
  },
  summary: {
    templateCount: 1,
    draftCount: 1,
    publishedCount: 0,
  },
};

test("large template ledger renders manuscript-family rows", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceTemplateLedgerPage viewModel={templateFixture} />,
  );

  assert.match(markup, /大模板台账/u);
  assert.match(markup, /期刊模板台账/u);
  assert.match(markup, /template-governance-ledger-kpi-strip/u);
  assert.match(markup, /稿件类型/u);
  assert.match(markup, /适用模块/u);
  assert.match(markup, /通用包/u);
  assert.match(markup, /医学专用包/u);
  assert.match(markup, /临床研究大模板/u);
});

test("large template ledger renders inline edit form and search results when requested", () => {
  const searchState: TemplateGovernanceLedgerSearchState = {
    mode: "results",
    query: "临床研究",
    title: "大模板查找结果",
    rows: [
      {
        id: "template-composition-1",
        primary: "临床研究大模板",
        secondary: "适用于临床研究主流程治理。",
        cells: ["clinical_study", "screening / editing", "草稿"],
      },
    ],
  };

  const markup = renderToStaticMarkup(
    <TemplateGovernanceTemplateLedgerPage
      viewModel={templateFixture}
      formMode="edit"
      formValues={{
        name: "临床研究大模板",
        manuscriptType: "clinical_study",
        journalScope: "",
        executionModuleScope: "screening, editing",
        generalModuleIds: "general-module-1",
        medicalModuleIds: "medical-module-1",
        notes: "适用于临床研究主流程治理。",
      }}
      searchState={searchState}
    />,
  );

  assert.match(markup, /编辑大模板/u);
  assert.match(markup, /保存大模板修改/u);
  assert.match(markup, /大模板查找结果/u);
  assert.match(markup, /临床研究大模板/u);
});
