import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  TemplateGovernanceRuleLedgerPage,
} = await import("../src/features/template-governance/template-governance-rule-ledger-page.tsx");

test("rule ledger page shows bound default rules when a package row is selected", () => {
  const Page = TemplateGovernanceRuleLedgerPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      initialViewModel={{
        category: "all",
        selectedRowId: "general-module-1",
        rows: [
          {
            id: "general-module-1",
            asset_kind: "general_package",
            title: "参考文献格式统一",
            module_label: "编辑",
            manuscript_type_label: "综述",
            semantic_status: "已沉淀",
            publish_status: "草稿",
            contributor_label: "reference",
            updated_at: "2026-04-16T09:00:00.000Z",
            default_rule_count: 2,
            related_rules: [
              {
                id: "rule-1",
                title: "参考文献著录顺序",
                publish_status: "已发布",
                module_label: "编辑",
              },
              {
                id: "rule-2",
                title: "参考文献标点格式",
                publish_status: "草稿",
                module_label: "编辑",
              },
            ],
          },
          {
            id: "rule-1",
            asset_kind: "rule",
            title: "参考文献著录顺序",
            module_label: "编辑",
            manuscript_type_label: "综述",
            semantic_status: "已确认",
            publish_status: "已发布",
            contributor_label: "知识规则",
            updated_at: "2026-04-16T08:00:00.000Z",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /已绑定 2 条默认规则/u);
  assert.match(markup, /点击规则名切到规则本体/u);
  assert.match(markup, /参考文献著录顺序/u);
  assert.match(markup, /参考文献标点格式/u);
});
