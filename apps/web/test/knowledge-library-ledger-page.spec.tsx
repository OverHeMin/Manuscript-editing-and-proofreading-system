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

test("knowledge library ledger page renders the sheet-first shell with command bar tabs and table", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={{
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
            semantic_status: "confirmed",
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
            semantic_status: "confirmed",
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
          semantic_status: "confirmed",
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
            },
            content_blocks: [],
            semantic_layer: {
              revision_id: "knowledge-1-revision-2",
              status: "confirmed",
              page_summary: "Operator-confirmed summary.",
              retrieval_terms: ["endpoint"],
              retrieval_snippets: ["screening rule"],
            },
            bindings: [],
            created_at: "2026-04-08T08:30:00.000Z",
            updated_at: "2026-04-08T08:30:00.000Z",
          },
          revisions: [],
        },
      }}
    />,
  );

  assert.match(markup, /Knowledge Ledger/);
  assert.match(markup, /New Record/);
  assert.match(markup, /AI Parse Intake/);
  assert.match(markup, /Fields/);
  assert.match(markup, /Semantic/);
  assert.match(markup, /Content Blocks/);
  assert.match(markup, /knowledge-library-ledger-table/);
  assert.match(markup, /Primary endpoint rule/);
});

test("knowledge library ledger page renders an unsaved local draft workspace", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={{
        library: [],
        visibleLibrary: [],
        filters: {
          searchText: "",
          queryMode: "keyword",
        },
        selectedAssetId: null,
        selectedRevisionId: null,
        selectedSummary: null,
        detail: null,
      }}
      initialComposer={createEmptyLedgerComposer()}
    />,
  );

  assert.match(markup, /Unsaved local draft/);
  assert.match(markup, /Title/);
  assert.match(markup, /Canonical Text/);
  assert.match(markup, /Save Draft/);
});

test("knowledge library ledger page renders AI parse intake suggestion review controls", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={{
        library: [],
        visibleLibrary: [],
        filters: {
          searchText: "",
          queryMode: "keyword",
        },
        selectedAssetId: null,
        selectedRevisionId: null,
        selectedSummary: null,
        detail: null,
      }}
      initialComposer={createEmptyLedgerComposer()}
      initialAiIntakeOpen={true}
      initialAiIntakeSuggestion={{
        suggestedDraft: {
          title: "Primary endpoint rule",
          canonicalText: "Clinical studies must define the primary endpoint.",
          knowledgeKind: "rule",
          moduleScope: "screening",
          manuscriptTypes: ["clinical_study"],
        },
        suggestedContentBlocks: [],
        warnings: ["No evidence level found in the intake source."],
      }}
    />,
  );

  assert.match(markup, /Paste source text/);
  assert.match(markup, /Apply Suggested Draft/);
  assert.match(markup, /Warnings/);
});

test("knowledge library ledger page renders semantic suggestion review controls", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={{
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
            semantic_status: "confirmed",
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
            semantic_status: "confirmed",
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
          semantic_status: "confirmed",
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
            },
            content_blocks: [],
            semantic_layer: {
              revision_id: "knowledge-1-revision-2",
              status: "confirmed",
              page_summary: "Operator-confirmed summary.",
              retrieval_terms: ["endpoint"],
              retrieval_snippets: ["screening rule"],
            },
            bindings: [],
            created_at: "2026-04-08T08:30:00.000Z",
            updated_at: "2026-04-08T08:30:00.000Z",
          },
          revisions: [],
        },
      }}
      initialWorkspaceTab="semantic"
      initialSemanticSuggestion={{
        suggestedSemanticLayer: {
          pageSummary: "Operator-ready semantic summary.",
          retrievalTerms: ["primary endpoint", "screening"],
          retrievalSnippets: ["Prefer this rule when endpoint wording is vague."],
        },
        suggestedFieldPatch: {
          summary: "Updated semantic summary for endpoint screening.",
          aliases: ["endpoint definition"],
        },
        warnings: ["Title remains user-owned in semantic assist."],
      }}
    />,
  );

  assert.match(markup, /Suggested semantic patch/);
  assert.match(markup, /Apply Suggestion/);
  assert.match(markup, /Discard Suggestion/);
});

test("knowledge library ledger page renders rich-content editing and submit controls for persisted drafts", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={{
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
            semantic_status: "confirmed",
            content_block_count: 1,
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
            semantic_status: "confirmed",
            content_block_count: 1,
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
          semantic_status: "confirmed",
          content_block_count: 1,
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
            },
            content_blocks: [
              {
                id: "knowledge-1-revision-2-block-1",
                revision_id: "knowledge-1-revision-2",
                block_type: "text_block",
                order_no: 0,
                status: "active",
                content_payload: {
                  text: "Existing content block.",
                },
              },
            ],
            semantic_layer: {
              revision_id: "knowledge-1-revision-2",
              status: "confirmed",
              page_summary: "Operator-confirmed summary.",
              retrieval_terms: ["endpoint"],
              retrieval_snippets: ["screening rule"],
            },
            bindings: [],
            created_at: "2026-04-08T08:30:00.000Z",
            updated_at: "2026-04-08T08:30:00.000Z",
          },
          revisions: [],
        },
      }}
      initialWorkspaceTab="content_blocks"
    />,
  );

  assert.match(markup, /Add Text Block/);
  assert.match(markup, /Save Rich Content/);
  assert.match(markup, /Submit To Review/);
});
