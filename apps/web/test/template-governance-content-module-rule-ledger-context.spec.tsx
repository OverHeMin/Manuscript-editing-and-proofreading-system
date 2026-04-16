import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceContentModuleLedgerPage } from "../src/features/template-governance/index.ts";

test("package ledger keeps the selected package context in the rule-ledger handoff", () => {
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
            default_rule_count: 1,
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
          default_rule_count: 1,
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
            status: "approved",
            moduleScope: "editing",
            manuscriptTypes: ["review"],
            bindingKind: "general_package",
            updatedAt: "2026-04-15T12:00:00.000Z",
            contentBlocks: [],
            bindings: [],
          },
        ],
      }}
    />,
  );

  assert.match(markup, /在规则台账查看全部默认规则/u);
  assert.match(markup, /templateGovernanceView=rule-ledger/u);
  assert.match(markup, /assetId=general-module-1/u);
});
