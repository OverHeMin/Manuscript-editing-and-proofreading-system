import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEmptyLedgerComposer } from "../src/features/knowledge-library/knowledge-library-ledger-composer.ts";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const { KnowledgeLibraryLedgerPage } = await import(
  "../src/features/knowledge-library/knowledge-library-ledger-page.tsx"
);

function buildLedgerViewModel() {
  return {
    library: [
      {
        id: "knowledge-1",
        title: "Primary endpoint rule",
        summary: "Screening knowledge.",
        knowledge_kind: "rule",
        status: "draft",
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        selected_revision_id: "knowledge-1-revision-2",
        semantic_status: "pending_confirmation",
        content_block_count: 2,
        contributor_label: "editor.zh",
        updated_at: "2026-04-08T08:30:00.000Z",
      },
    ],
    visibleLibrary: [
      {
        id: "knowledge-1",
        title: "Primary endpoint rule",
        summary: "Screening knowledge.",
        knowledge_kind: "rule",
        status: "draft",
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        selected_revision_id: "knowledge-1-revision-2",
        semantic_status: "pending_confirmation",
        content_block_count: 2,
        contributor_label: "editor.zh",
        updated_at: "2026-04-08T08:30:00.000Z",
      },
    ],
    filters: {
      searchText: "",
      queryMode: "keyword",
    },
    selectedAssetId: "knowledge-1",
    selectedRevisionId: "knowledge-1-revision-2",
    selectedSummary: {
      id: "knowledge-1",
      title: "Primary endpoint rule",
      summary: "Screening knowledge.",
      knowledge_kind: "rule",
      status: "draft",
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
      selected_revision_id: "knowledge-1-revision-2",
      semantic_status: "pending_confirmation",
      content_block_count: 2,
      contributor_label: "editor.zh",
      updated_at: "2026-04-08T08:30:00.000Z",
    },
    detail: {
      asset: {
        id: "knowledge-1",
        status: "active",
        current_revision_id: "knowledge-1-revision-2",
        current_approved_revision_id: "knowledge-1-revision-1",
        created_at: "2026-04-08T08:00:00.000Z",
        updated_at: "2026-04-08T08:30:00.000Z",
      },
      selected_revision: {
        id: "knowledge-1-revision-2",
        asset_id: "knowledge-1",
        revision_no: 2,
        status: "draft",
        title: "Primary endpoint rule draft",
        canonical_text:
          "Clinical studies must define the primary endpoint before screening sign-off.",
        summary: "Screening knowledge.",
        knowledge_kind: "rule",
        routing: {
          module_scope: "screening",
          manuscript_types: ["clinical_study"],
          sections: ["methods"],
          risk_tags: ["endpoint"],
        },
        content_blocks: [],
        semantic_layer: {
          revision_id: "knowledge-1-revision-2",
          status: "pending_confirmation",
          page_summary: "Operator-confirmed summary.",
          retrieval_terms: ["primary endpoint", "screening"],
          retrieval_snippets: ["Use for endpoint screening review."],
        },
        bindings: [],
        aliases: ["endpoint definition"],
        contributor_label: "editor.zh",
        created_at: "2026-04-08T08:30:00.000Z",
        updated_at: "2026-04-08T08:30:00.000Z",
      },
      revisions: [],
    },
  };
}

test("knowledge library ledger page renders a spreadsheet-first toolbar and multidimensional table without a persistent drawer", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage initialViewModel={buildLedgerViewModel()} />,
  );

  assert.match(markup, /knowledge-library-ledger-toolbar/u);
  assert.match(markup, /knowledge-library-ledger-grid/u);
  assert.match(markup, />添加</u);
  assert.match(markup, />删除</u);
  assert.match(markup, />查找</u);
  assert.match(markup, /名称\s*\/\s*关键词/u);
  assert.match(markup, /答案/u);
  assert.match(markup, /类别/u);
  assert.match(markup, /详情/u);
  assert.match(markup, /图片\s*\/\s*附件/u);
  assert.match(markup, /AI状态/u);
  assert.match(markup, /贡献人/u);
  assert.match(markup, /日期/u);
  assert.match(markup, /语义摘要/u);
  assert.match(markup, /检索词/u);
  assert.doesNotMatch(markup, /knowledge-library-record-drawer/u);
  assert.doesNotMatch(markup, /Editable Workspace|Browse Workspace|Record Metadata/u);
  assert.doesNotMatch(markup, /Fields|Semantic|Content Blocks/u);
});

test("knowledge library ledger page renders a reusable entry form that requires AI semantic confirmation before final save", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={buildLedgerViewModel()}
      initialComposer={createEmptyLedgerComposer()}
      initialFormMode="create"
    />,
  );

  assert.match(markup, /knowledge-library-entry-form/u);
  assert.match(markup, /知识录入表单/u);
  assert.match(markup, /生成AI语义/u);
  assert.match(markup, /重新生成/u);
  assert.match(markup, /应用建议/u);
  assert.match(markup, /取消/u);
  assert.match(markup, /<button[^>]*disabled[^>]*>确认录入<\/button>/u);
});

test("knowledge library ledger page renders a dedicated search results surface separate from the main ledger table", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={buildLedgerViewModel()}
      initialSearchOpen={true}
      initialSearchQuery="endpoint"
    />,
  );

  assert.match(markup, /knowledge-library-ledger-search/u);
  assert.match(markup, /搜索结果/u);
  assert.match(markup, /返回台账/u);
  assert.match(markup, /Primary endpoint rule/u);
});
