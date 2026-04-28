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
  assert.doesNotMatch(markup, /打开旧版高级工作台/u);
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
  assert.match(markup, /AI 生成规则草稿/u);
  assert.match(markup, /搜索/u);
  assert.match(markup, /筛选/u);
  assert.match(markup, /批量操作/u);
  assert.match(markup, /导入/u);
});

test("rule ledger page renders the rule AI intake panel when opened", () => {
  const Page = TemplateGovernanceRuleLedgerPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      initialViewModel={{
        category: "all",
        rows: [],
      }}
      aiIntakeState={{
        isOpen: true,
        description: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
        isGenerating: false,
        result: {
          draft: {
            source_kind: "manual_description",
            ai_understanding_summary: "摘要缩写首次出现需要中文全称。",
            recommended_governance_layer: "journal_template",
            target_object: "abstract_abbreviation",
            trigger: "first_abbreviation_occurrence",
            action: "manual_review_or_replace",
            scope: { module_scope: "proofreading", sections: ["abstract"] },
            evidence: [{ kind: "user_description", text: "摘要缩写规范。" }],
            confidence: { overall: 0.82 },
            uncertainties: [],
          },
          template_match: { status: "matched", template_id: "abstract_rule_template" },
          similar_rule_matches: [],
          warnings: [],
        },
      }}
    />,
  );

  assert.match(markup, /规则 AI 草稿生成/u);
  assert.match(markup, /自然语言描述/u);
  assert.match(markup, /摘要缩写首次出现需要中文全称/u);
  assert.match(markup, /abstract_rule_template/u);
  assert.match(markup, /应用到五步流/u);
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

test("rule ledger page displays AI source and review metadata without changing the ledger row identity", () => {
  const Page = TemplateGovernanceRuleLedgerPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      initialViewModel={{
        category: "all",
        rows: [
          {
            id: "rule-ai-1",
            asset_kind: "rule",
            title: "摘要缩写规则",
            module_label: "校对",
            manuscript_type_label: "临床研究",
            semantic_status: "待确认",
            publish_status: "草稿",
            contributor_label: "editor.zh",
            updated_at: "2026-04-14T09:00:00.000Z",
            source_label: "AI 草稿生成",
            ai_participation_label: "AI 生成草稿",
            review_status_label: "待审核",
            similarity_resolution_label: "相似规则需人工确认",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /来源/u);
  assert.match(markup, /AI 参与/u);
  assert.match(markup, /审核状态/u);
  assert.match(markup, /AI 草稿生成/u);
  assert.match(markup, /AI 生成草稿/u);
  assert.match(markup, /待审核/u);
  assert.match(markup, /相似规则需人工确认/u);
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
