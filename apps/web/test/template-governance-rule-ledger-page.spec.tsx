import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  TemplateGovernanceRuleLedgerPage,
} = await import(
  "../src/features/template-governance/template-governance-rule-ledger-page.tsx"
);

test("rule ledger page renders unified categories and command bar actions", () => {
  const Page = TemplateGovernanceRuleLedgerPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      initialViewModel={{
        category: "all",
        rows: [
          {
            id: "rule-1",
            asset_kind: "rule",
            title: "术语统一规则",
            module_label: "编辑",
            manuscript_type_label: "论著",
            semantic_status: "待确认",
            publish_status: "草稿",
            contributor_label: "editor.zh",
            updated_at: "2026-04-14T09:00:00.000Z",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /规则台账/u);
  assert.match(markup, /全部资产/u);
  assert.match(markup, /回流候选/u);
  assert.match(markup, /术语统一规则/u);
  assert.match(markup, /新建规则/u);
  assert.match(markup, /搜索/u);
  assert.match(markup, /筛选/u);
  assert.match(markup, /批量操作/u);
  assert.match(markup, /导入/u);
});

test("rule ledger page can expose a guided action for the selected item", () => {
  const Page = TemplateGovernanceRuleLedgerPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      selectedItemActionLabel="编辑规则"
      initialViewModel={{
        category: "all",
        rows: [
          {
            id: "rule-1",
            asset_kind: "rule",
            title: "术语统一规则",
            module_label: "编辑",
            manuscript_type_label: "论著",
            semantic_status: "待确认",
            publish_status: "草稿",
            contributor_label: "editor.zh",
            updated_at: "2026-04-14T09:00:00.000Z",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /编辑规则/u);
});
