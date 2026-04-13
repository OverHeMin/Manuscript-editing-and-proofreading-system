import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TemplateGovernanceContentModuleForm,
  TemplateGovernanceContentModuleLedgerPage,
} from "../src/features/template-governance/index.ts";
import type { TemplateGovernanceLedgerSearchState } from "../src/features/template-governance/template-governance-ledger-types.ts";

test("general package ledger renders reusable package table", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleLedgerPage
      ledgerKind="general"
      viewModel={{
        modules: [
          {
            id: "general-module-1",
            module_class: "general",
            name: "参考文献格式统一",
            category: "reference",
            manuscript_type_scope: ["review"],
            execution_module_scope: ["editing"],
            summary: "统一参考文献著录顺序与标点。",
            template_usage_count: 2,
            status: "draft",
            created_at: "2026-04-13T12:00:00.000Z",
            updated_at: "2026-04-13T12:00:00.000Z",
          },
        ],
        selectedModuleId: "general-module-1",
        selectedModule: {
          id: "general-module-1",
          module_class: "general",
          name: "参考文献格式统一",
          category: "reference",
          manuscript_type_scope: ["review"],
          execution_module_scope: ["editing"],
          summary: "统一参考文献著录顺序与标点。",
          template_usage_count: 2,
          status: "draft",
          created_at: "2026-04-13T12:00:00.000Z",
          updated_at: "2026-04-13T12:00:00.000Z",
        },
        summary: {
          totalCount: 1,
          draftCount: 1,
          publishedCount: 0,
        },
      }}
    />,
  );

  assert.match(markup, /通用包台账/u);
  assert.match(markup, /总览/u);
  assert.match(markup, /大模板台账/u);
  assert.match(markup, /template-governance-ledger-kpi-strip/u);
  assert.match(markup, /加入大模板/u);
  assert.match(markup, /参考文献格式统一/u);
});

test("medical package ledger renders inline edit form and search results when requested", () => {
  const searchState: TemplateGovernanceLedgerSearchState = {
    mode: "results",
    query: "伦理",
    title: "医学专用包查找结果",
    rows: [
      {
        id: "medical-module-1",
        primary: "伦理声明核查",
        secondary: "核对伦理审批号与知情同意表述。",
        cells: ["ethics", "临床研究", "高证据 / 高风险"],
      },
    ],
  };

  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleLedgerPage
      ledgerKind="medical_specialized"
      viewModel={{
        modules: [
          {
            id: "medical-module-1",
            module_class: "medical_specialized",
            name: "伦理声明核查",
            category: "ethics",
            manuscript_type_scope: ["clinical_study"],
            execution_module_scope: ["screening", "editing"],
            summary: "核对伦理审批号与知情同意表述。",
            evidence_level: "high",
            risk_level: "high",
            template_usage_count: 2,
            status: "draft",
            created_at: "2026-04-13T12:00:00.000Z",
            updated_at: "2026-04-13T12:00:00.000Z",
          },
        ],
        selectedModuleId: "medical-module-1",
        selectedModule: {
          id: "medical-module-1",
          module_class: "medical_specialized",
          name: "伦理声明核查",
          category: "ethics",
          manuscript_type_scope: ["clinical_study"],
          execution_module_scope: ["screening", "editing"],
          summary: "核对伦理审批号与知情同意表述。",
          evidence_level: "high",
          risk_level: "high",
          template_usage_count: 2,
          status: "draft",
          created_at: "2026-04-13T12:00:00.000Z",
          updated_at: "2026-04-13T12:00:00.000Z",
        },
        summary: {
          totalCount: 1,
          draftCount: 1,
          publishedCount: 0,
        },
      }}
      formMode="edit"
      formValues={{
        name: "伦理声明核查",
        category: "ethics",
        manuscriptTypeScope: "clinical_study",
        executionModuleScope: "screening, editing",
        applicableSections: "ethics",
        summary: "核对伦理审批号与知情同意表述。",
        guidance: "缺失审批号时转人工复核",
        examples: "",
        evidenceLevel: "high",
        riskLevel: "high",
      }}
      searchState={searchState}
    />,
  );

  assert.match(markup, /医学专用包台账/u);
  assert.match(markup, /保存模块修改/u);
  assert.match(markup, /医学专用包查找结果/u);
  assert.match(markup, /伦理声明核查/u);
});

test("medical module form renders medical-only governance fields", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleForm
      ledgerKind="medical_specialized"
      initialValues={{
        name: "伦理声明核查",
        category: "ethics",
        manuscriptTypeScope: "clinical_study",
        executionModuleScope: "screening, editing",
        applicableSections: "ethics",
        summary: "检查伦理批准与知情同意表述。",
        guidance: "",
        examples: "",
        evidenceLevel: "high",
        riskLevel: "high",
      }}
    />,
  );

  assert.match(markup, /证据级别/u);
  assert.match(markup, /风险级别/u);
});
