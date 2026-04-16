import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  applyTemplateGovernanceRuleLedgerClientFilters,
  buildTemplateGovernanceRuleLedgerSearchState,
  TemplateGovernanceRuleLedgerPage,
} = await import(
  "../src/features/template-governance/template-governance-rule-ledger-page.tsx"
);

test("rule ledger page explains how to create modify and manage rules", () => {
  const Page = TemplateGovernanceRuleLedgerPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      initialViewModel={{
        category: "all",
        rows: [],
      }}
    />,
  );

  assert.match(markup, /规则中心操作说明/u);
  assert.match(markup, /建立规则/u);
  assert.match(markup, /修改规则/u);
  assert.match(markup, /管理规则/u);
});

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

test("rule ledger page can render search, filter, and bulk command panels", () => {
  const Page = TemplateGovernanceRuleLedgerPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const rows = [
    {
      id: "rule-1",
      asset_kind: "rule" as const,
      title: "术语统一规则",
      module_label: "编辑",
      manuscript_type_label: "论著",
      semantic_status: "待确认",
      publish_status: "草稿",
      contributor_label: "editor.zh",
      updated_at: "2026-04-14T09:00:00.000Z",
    },
  ];
  const markup = renderToStaticMarkup(
    <Page
      initialViewModel={{
        category: "all",
        rows,
      }}
      searchState={buildTemplateGovernanceRuleLedgerSearchState(rows, "术语")}
      filterState={{
        isOpen: true,
        moduleOptions: ["编辑"],
        publishStatusOptions: ["草稿"],
        semanticStatusOptions: ["待确认"],
        moduleValue: "编辑",
        publishStatusValue: "草稿",
        semanticStatusValue: "待确认",
      }}
      bulkState={{
        isOpen: true,
        selectedRowIds: ["rule-1"],
        showSelectedOnly: false,
      }}
    />,
  );

  assert.match(markup, /当前搜索词/u);
  assert.match(markup, /筛选面板/u);
  assert.match(markup, /发布状态/u);
  assert.match(markup, /语义状态/u);
  assert.match(markup, /批量操作面板/u);
  assert.match(markup, /全选当前结果/u);
  assert.match(markup, /仅看已选/u);
});

test("rule ledger client filters can narrow rows by module and publish status", () => {
  const rows = [
    {
      id: "rule-1",
      asset_kind: "rule" as const,
      title: "术语统一规则",
      module_label: "编辑",
      manuscript_type_label: "论著",
      semantic_status: "待确认",
      publish_status: "草稿",
      contributor_label: "editor.zh",
      updated_at: "2026-04-14T09:00:00.000Z",
    },
    {
      id: "rule-2",
      asset_kind: "medical_package" as const,
      title: "医学专业校对包",
      module_label: "校对",
      manuscript_type_label: "临床研究",
      semantic_status: "已确认",
      publish_status: "已发布",
      contributor_label: "chief.zh",
      updated_at: "2026-04-14T10:00:00.000Z",
    },
  ];

  assert.deepEqual(
    applyTemplateGovernanceRuleLedgerClientFilters(rows, {
      moduleValue: "编辑",
      publishStatusValue: "草稿",
      semanticStatusValue: "all",
    }).map((row) => row.id),
    ["rule-1"],
  );
});
