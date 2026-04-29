import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TemplateGovernanceContentModuleForm,
  TemplateGovernanceContentModuleLedgerPage,
} from "../src/features/template-governance/index.ts";
import type { TemplateGovernanceLedgerSearchState } from "../src/features/template-governance/template-governance-ledger-types.ts";

test("package ledger keeps controls without package instruction copy", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleLedgerPage
      ledgerKind="general"
      viewModel={{
        modules: [],
        selectedModuleId: null,
        selectedModule: null,
        summary: {
          totalCount: 0,
          draftCount: 0,
          publishedCount: 0,
        },
        selectedModuleRules: [],
      }}
    />,
  );

  assert.match(markup, /通用包台账/u);
  assert.match(markup, /新增通用包/u);
  assert.match(markup, /加入大模板/u);
  assert.match(markup, /包名称/u);
  assert.match(markup, /默认规则数/u);
  assert.match(markup, /当前还没有规则包记录。/u);
  assert.doesNotMatch(markup, /规则包使用说明/u);
  assert.doesNotMatch(markup, /规则包是复用容器/u);
  assert.doesNotMatch(markup, /默认规则是包里的具体规则/u);
  assert.doesNotMatch(markup, /打开旧版高级工作台/u);
});

test("general package ledger renders reusable package table and default rule details", () => {
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
        selectedModuleRules: [
          {
            assetId: "knowledge-asset-1",
            revisionId: "knowledge-revision-1",
            title: "参考文献著录顺序",
            summary: "统一作者、题名、期刊名与年份顺序。",
            status: "approved",
            moduleScope: "editing",
            manuscriptTypes: ["review"],
            bindingKind: "general_package",
            updatedAt: "2026-04-15T12:00:00.000Z",
            canonicalText: "作者、题名、期刊名与年份顺序应统一。",
            contentBlocks: [
              {
                id: "block-1",
                revision_id: "knowledge-revision-1",
                block_type: "text_block",
                order_no: 0,
                status: "active",
                content_payload: {
                  label: "规则正文",
                  text: "作者、题名、期刊名与年份顺序应统一。",
                },
              },
              {
                id: "block-2",
                revision_id: "knowledge-revision-1",
                block_type: "table_block",
                order_no: 1,
                status: "active",
                content_payload: {
                  rows: [
                    ["字段", "顺序"],
                    ["参考文献", "作者 > 题名 > 期刊 > 年份"],
                  ],
                },
              },
            ],
            bindings: [
              {
                id: "binding-1",
                revision_id: "knowledge-revision-1",
                binding_kind: "general_package",
                binding_target_id: "general-module-1",
                binding_target_label: "参考文献格式统一",
                created_at: "2026-04-15T12:00:00.000Z",
              },
            ],
          },
        ],
      }}
    />,
  );

  assert.match(markup, /通用包台账/u);
  assert.match(markup, /加入大模板/u);
  assert.match(markup, /参考文献格式统一/u);
  assert.match(markup, /默认规则/u);
  assert.match(markup, /规则详情/u);
  assert.match(markup, /作者、题名、期刊名与年份顺序应统一。/u);
  assert.match(markup, /作者 &gt; 题名 &gt; 期刊 &gt; 年份/u);
  assert.match(markup, /编辑默认规则/u);
});

test("package ledger renders Word table evidence blocks with revision and status", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleLedgerPage
      ledgerKind="general"
      viewModel={{
        modules: [
          {
            id: "general-module-1",
            module_class: "general",
            name: "三线表规则包",
            category: "table",
            manuscript_type_scope: ["clinical_study"],
            execution_module_scope: ["editing"],
            summary: "统一表格格式。",
            template_usage_count: 1,
            status: "draft",
            created_at: "2026-04-13T12:00:00.000Z",
            updated_at: "2026-04-13T12:00:00.000Z",
          },
        ],
        selectedModuleId: "general-module-1",
        selectedModule: {
          id: "general-module-1",
          module_class: "general",
          name: "三线表规则包",
          category: "table",
          manuscript_type_scope: ["clinical_study"],
          execution_module_scope: ["editing"],
          summary: "统一表格格式。",
          template_usage_count: 1,
          status: "draft",
          created_at: "2026-04-13T12:00:00.000Z",
          updated_at: "2026-04-13T12:00:00.000Z",
        },
        summary: {
          totalCount: 1,
          draftCount: 1,
          publishedCount: 0,
        },
        selectedModuleRules: [
          {
            assetId: "knowledge-asset-1",
            revisionId: "knowledge-revision-1",
            title: "三线表证据规则",
            summary: "表格证据必须锁定。",
            status: "approved",
            moduleScope: "editing",
            manuscriptTypes: ["clinical_study"],
            bindingKind: "general_package",
            updatedAt: "2026-04-15T12:00:00.000Z",
            canonicalText: "表格证据必须锁定。",
            contentBlocks: [
              {
                id: "block-1",
                revision_id: "knowledge-revision-1",
                block_type: "table_evidence_block",
                order_no: 0,
                status: "active",
                content_payload: {
                  table_evidence_asset_id: "table-asset-1",
                  table_evidence_revision_id: "table-revision-1",
                  revision_status: "confirmed",
                },
              },
            ],
            bindings: [],
          },
        ],
      }}
    />,
  );

  assert.match(markup, /Word 表格证据/u);
  assert.match(markup, /table-revision-1/u);
  assert.match(markup, /confirmed/u);
  assert.doesNotMatch(markup, /当前文本块还没有内容/u);
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
        selectedModuleRules: [],
      }}
      formMode="edit"
      formValues={{
        name: "伦理声明核查",
        category: "ethics",
        manuscriptTypeScope: "clinical_study",
        executionModuleScope: "screening, editing",
        applicableSections: "ethics",
        summary: "核对伦理审批号与知情同意表述。",
        guidance: "缺失审批号时转人工复核。",
        examples: "",
        evidenceLevel: "high",
        riskLevel: "high",
      }}
      searchState={searchState}
    />,
  );

  assert.match(markup, /医学专用包台账/u);
  assert.match(markup, /保存规则包修改/u);
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
