import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceContentModuleLedgerPage } from "../src/features/template-governance/index.ts";

test("selected package explains how to add or supplement default rules", () => {
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
            default_rule_count: 0,
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
          default_rule_count: 0,
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
    />,
  );

  assert.match(markup, /给这个包补规则的常用路径/u);
  assert.match(markup, /去新建规则/u);
  assert.match(markup, /去规则台账找已有规则/u);
  assert.match(markup, /templateGovernanceView=authoring/u);
  assert.match(markup, /templateGovernanceView=rule-ledger/u);
});

test("medical specialized package guidance explains governed statistical capabilities", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleLedgerPage
      ledgerKind="medical_specialized"
      viewModel={{
        modules: [
          {
            id: "medical-module-1",
            module_class: "medical_specialized",
            name: "医学统计深度校验包",
            category: "medical_statistics",
            manuscript_type_scope: ["clinical_trial"],
            execution_module_scope: ["proofreading"],
            summary: "覆盖医学稿件中的诊断学、回归和推断统计校验。",
            guidance: [
              "当前包重点治理 AUC、sensitivity、specificity 的诊断学描述。",
              "当前包要求 beta、SE、95% CI 与 P 保持一致。",
            ],
            template_usage_count: 3,
            default_rule_count: 2,
            evidence_level: "high",
            risk_level: "high",
            status: "published",
            created_at: "2026-04-17T12:00:00.000Z",
            updated_at: "2026-04-17T12:00:00.000Z",
          },
        ],
        selectedModuleId: "medical-module-1",
        selectedModule: {
          id: "medical-module-1",
          module_class: "medical_specialized",
          name: "医学统计深度校验包",
          category: "medical_statistics",
          manuscript_type_scope: ["clinical_trial"],
          execution_module_scope: ["proofreading"],
          summary: "覆盖医学稿件中的诊断学、回归和推断统计校验。",
          guidance: [
            "当前包重点治理 AUC、sensitivity、specificity 的诊断学描述。",
            "当前包要求 beta、SE、95% CI 与 P 保持一致。",
          ],
          template_usage_count: 3,
          default_rule_count: 2,
          evidence_level: "high",
          risk_level: "high",
          status: "published",
          created_at: "2026-04-17T12:00:00.000Z",
          updated_at: "2026-04-17T12:00:00.000Z",
        },
        summary: {
          totalCount: 1,
          draftCount: 0,
          publishedCount: 1,
        },
        selectedModuleRules: [],
      }}
    />,
  );

  assert.match(markup, /当前包已声明的统计治理要点/u);
  assert.match(markup, /当前包重点治理 AUC、sensitivity、specificity/u);
  assert.match(markup, /当前包要求 beta、SE、95% CI 与 P 保持一致/u);
  assert.match(markup, /平台当前支持的医学统计校验能力/u);
  assert.match(markup, /AUC、sensitivity、specificity/u);
  assert.match(markup, /beta、SE、95% CI/u);
  assert.match(markup, /chi-square、t、F、P/u);
  assert.match(markup, /均值±标准差/u);
  assert.match(markup, /重算/u);
  assert.match(markup, /策略/u);
});
