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
