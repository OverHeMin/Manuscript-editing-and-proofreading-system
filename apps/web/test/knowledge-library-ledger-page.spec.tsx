import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createEmptyLedgerComposer,
  type KnowledgeLibraryLedgerComposer,
} from "../src/features/knowledge-library/knowledge-library-ledger-composer.ts";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const { KnowledgeLibraryLedgerPage } = await import(
  "../src/features/knowledge-library/knowledge-library-ledger-page.tsx"
);
const AiIntakeLedgerPage = KnowledgeLibraryLedgerPage as unknown as (
  props: Record<string, unknown>,
) => React.JSX.Element;

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

function buildPersistedDraftComposer(): KnowledgeLibraryLedgerComposer {
  return {
    mode: "existing_revision",
    persistedAssetId: "knowledge-1",
    persistedRevisionId: "knowledge-1-revision-2",
    aiIntakeSourceText: "",
    draft: {
      title: "Primary endpoint rule draft",
      canonicalText:
        "Clinical studies must define the primary endpoint before screening sign-off.",
      summary: "Screening knowledge.",
      knowledgeKind: "rule",
      moduleScope: "screening",
      manuscriptTypes: ["clinical_study"],
      riskTags: ["endpoint"],
    },
    contentBlocksDraft: [
      {
        id: "knowledge-1-revision-2-block-1",
        revision_id: "knowledge-1-revision-2",
        block_type: "text_block",
        order_no: 0,
        status: "active",
        content_payload: {
          text: "Block content",
        },
      },
    ],
    semanticLayerDraft: {
      revision_id: "knowledge-1-revision-2",
      status: "confirmed",
      page_summary: "Operator-confirmed summary.",
      retrieval_terms: ["primary endpoint"],
      retrieval_snippets: ["Use for endpoint screening review."],
    },
    warnings: [],
  };
}

test("knowledge library ledger page renders the approved toolbar and default columns for the final operator posture", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage initialViewModel={buildLedgerViewModel()} />,
  );

  assert.match(markup, /知识库/u);
  assert.match(markup, /knowledge-library-ledger-toolbar/u);
  assert.match(markup, /knowledge-library-ledger-grid/u);
  assert.match(markup, /data-toolbar-action="search"/u);
  assert.match(markup, /data-toolbar-action="create"/u);
  assert.match(markup, /data-toolbar-action="ai-intake"/u);
  assert.match(markup, /data-toolbar-action="column-order"/u);
  assert.match(markup, /data-toolbar-action="filters"/u);
  assert.match(markup, /data-toolbar-action="scope-active"/u);
  assert.match(markup, /data-toolbar-action="scope-all"/u);
  assert.match(markup, /data-toolbar-action="scope-archived"/u);
  assert.match(markup, /name="knowledge-library-inline-search"/u);
  assert.match(markup, /data-column="title"/u);
  assert.match(markup, /data-column="status"/u);
  assert.match(markup, /data-column="category"/u);
  assert.match(markup, /data-column="moduleScope"/u);
  assert.match(markup, /data-column="manuscriptTypes"/u);
  assert.match(markup, /data-column="answer"/u);
  assert.match(markup, /data-column="detail"/u);
  assert.match(markup, /data-column="attachments"/u);
  assert.match(markup, /data-column="semanticStatus"/u);
  assert.match(markup, /data-column="semanticSummary"/u);
  assert.match(markup, /data-column="retrievalTerms"/u);
  assert.match(markup, /data-column="aliases"/u);
  assert.match(markup, /data-column="scenarios"/u);
  assert.match(markup, /data-column="riskTags"/u);
  assert.match(markup, /data-column="contributor"/u);
  assert.match(markup, /data-column="revisionId"/u);
  assert.match(markup, /data-column="archivedAt"/u);
  assert.match(markup, /data-column="archivedBy"/u);
  assert.match(markup, /data-column="date"/u);
  assert.match(markup, /data-pinned-boundary="true"/u);
  assert.match(markup, /knowledge-library-ledger-grid__pinned-shell/u);
  assert.match(markup, /data-row-action="edit"/u);
  assert.match(markup, /data-row-action="archive"/u);
  assert.doesNotMatch(markup, /data-row-action="priority-up"/u);
  assert.doesNotMatch(markup, /data-row-action="priority-down"/u);
  assert.doesNotMatch(markup, /knowledge-library-ledger-search/u);
  assert.doesNotMatch(markup, /Knowledge Library/u);
  assert.doesNotMatch(markup, /knowledge-library-record-drawer/u);
});

test("knowledge library ledger page renders the temporary three-tab board for new entry before a draft exists", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={buildLedgerViewModel()}
      initialComposer={createEmptyLedgerComposer()}
      initialFormMode="create"
    />,
  );

  assert.match(markup, /knowledge-library-entry-form/u);
  assert.match(markup, /data-board-tab="basic"/u);
  assert.match(markup, /data-board-tab="materials"/u);
  assert.match(markup, /data-board-tab="semantic"/u);
  assert.match(markup, /data-entry-toggle="more-info"/u);
  assert.match(markup, /knowledge-library-rich-content-editor/u);
  assert.match(markup, /data-block-action="add-text"/u);
  assert.match(markup, /data-block-action="add-table"/u);
  assert.match(markup, /data-block-action="add-image"/u);
  assert.match(markup, /knowledge-library-attachment-field/u);
  assert.match(markup, /knowledge-library-entry-form__footer/u);
  assert.match(markup, /data-board-action="cancel-create"/u);
  assert.match(markup, /data-board-action="confirm-entry"/u);
  assert.doesNotMatch(markup, /data-board-action="save-draft"/u);
  assert.doesNotMatch(markup, /data-board-action="submit-review"/u);
});

test("knowledge library ledger page switches the board footer to save and submit actions after a draft exists", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={buildLedgerViewModel()}
      initialComposer={buildPersistedDraftComposer()}
      initialFormMode="edit"
    />,
  );

  assert.match(markup, /knowledge-library-entry-form/u);
  assert.match(markup, /data-board-tab="basic"/u);
  assert.match(markup, /data-board-action="cancel-edit"/u);
  assert.match(markup, /data-board-action="save-draft"/u);
  assert.match(markup, /data-board-action="submit-review"/u);
  assert.doesNotMatch(markup, /data-board-action="confirm-entry"/u);
});

test("knowledge library ledger page exposes a column-order manager and honors a custom column order", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={buildLedgerViewModel()}
      initialColumnOrderPanelOpen={true}
      initialColumnOrder={[
        "title",
        "category",
        "status",
        "moduleScope",
        "manuscriptTypes",
        "answer",
        "detail",
        "attachments",
        "semanticStatus",
        "semanticSummary",
        "retrievalTerms",
        "aliases",
        "scenarios",
        "riskTags",
        "contributor",
        "revisionId",
        "archivedAt",
        "archivedBy",
        "date",
      ]}
    />,
  );

  assert.match(markup, /data-toolbar-action="column-order"/u);
  assert.match(markup, /data-column-order-panel="true"/u);
  assert.match(markup, /data-column-order-item="status"/u);
  assert.match(markup, /data-column-order-item="category"/u);
  assert.match(markup, /data-column-order-action="move-left"/u);
  assert.match(markup, /data-column-order-action="move-right"/u);
  assert.match(markup, /data-column-order-action="reset"/u);
  assert.ok(markup.indexOf('data-column="category"') < markup.indexOf('data-column="status"'));
});

test("knowledge library ledger page switches archive rows to restore actions in recycle view", () => {
  const archivedViewModel = {
    ...buildLedgerViewModel(),
    library: [
      {
        ...buildLedgerViewModel().library[0],
        status: "archived" as const,
        archived_by_role: "knowledge_reviewer" as const,
        archived_at: "2026-04-09T09:00:00.000Z",
      },
    ],
    visibleLibrary: [
      {
        ...buildLedgerViewModel().visibleLibrary[0],
        status: "archived" as const,
        archived_by_role: "knowledge_reviewer" as const,
        archived_at: "2026-04-09T09:00:00.000Z",
      },
    ],
    selectedSummary: {
      ...buildLedgerViewModel().selectedSummary,
      status: "archived" as const,
      archived_by_role: "knowledge_reviewer" as const,
      archived_at: "2026-04-09T09:00:00.000Z",
    },
    detail: {
      ...buildLedgerViewModel().detail,
      asset: {
        ...buildLedgerViewModel().detail.asset,
        status: "archived" as const,
      },
      selected_revision: {
        ...buildLedgerViewModel().detail.selected_revision,
        status: "archived" as const,
      },
    },
    filters: {
      ...buildLedgerViewModel().filters,
      assetStatus: "archived" as const,
    },
  };

  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage initialViewModel={archivedViewModel} />,
  );

  assert.match(markup, /data-toolbar-action="scope-archived"[^>]*class="[^"]*is-active/u);
  assert.match(markup, /knowledge-library-ledger-recycle-bar/u);
  assert.match(markup, /data-toolbar-action="restore-selected"/u);
  assert.match(markup, /data-toolbar-action="restore-visible"/u);
  assert.match(markup, /data-row-action="restore"/u);
  assert.doesNotMatch(markup, /data-row-action="archive"/u);
});

test("knowledge library ledger page reuses the same board for AI-assisted pre-entry with text-first source intake", () => {
  const aiComposer = createEmptyLedgerComposer();
  aiComposer.aiIntakeSourceText =
    "Clinical studies must define the primary endpoint before screening sign-off.";

  const markup = renderToStaticMarkup(
    <AiIntakeLedgerPage
      initialViewModel={buildLedgerViewModel()}
      initialComposer={aiComposer}
      initialFormMode="create"
      initialAiAssistMode="prefill"
    />,
  );

  assert.match(markup, /data-entry-mode="create"/u);
  assert.match(markup, /data-ai-assist-mode="prefill"/u);
  assert.match(markup, /data-ai-assist-toggle="manual"/u);
  assert.match(markup, /data-ai-assist-toggle="prefill"/u);
  assert.match(markup, /data-ai-assist-panel="prefill"/u);
  assert.match(markup, /data-ai-assist-action="prefill"/u);
  assert.match(markup, /data-ai-intake-source="text"/u);
  assert.match(markup, /data-ai-intake-evidence="secondary"/u);
  assert.match(markup, /data-board-tab="basic"/u);
  assert.match(markup, /data-board-tab="materials"/u);
  assert.match(markup, /data-board-tab="semantic"/u);
  assert.match(
    markup,
    /<button[^>]*data-board-action="confirm-entry"[^>]*disabled/u,
  );
  assert.doesNotMatch(markup, /data-board-action="submit-review"/u);
});

test("knowledge library ledger CSS defines an opaque pinned-column shell for every body row", () => {
  const css = readFileSync(
    new URL(
      "../src/features/knowledge-library/knowledge-library-ledger-page.css",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(css, /--knowledge-library-ledger-row-background/u);
  assert.doesNotMatch(
    css,
    /tbody\s+\[data-pinned="true"\]\s*\{[^}]*background:\s*inherit;/u,
  );
});

test("knowledge library ledger page does not let hidden row priority settings affect list order", () => {
  const baseViewModel = buildLedgerViewModel();
  const secondaryItem = {
    ...baseViewModel.visibleLibrary[0],
    id: "knowledge-2",
    title: "Secondary outcome rule",
    selected_revision_id: "knowledge-2-revision-1",
    updated_at: "2026-04-07T08:30:00.000Z",
  };

  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={{
        ...baseViewModel,
        library: [baseViewModel.library[0], secondaryItem],
        visibleLibrary: [baseViewModel.visibleLibrary[0], secondaryItem],
      }}
      initialPriorityOrder={["knowledge-2", "knowledge-1"]}
    />,
  );

  assert.ok(
    markup.indexOf("Primary endpoint rule") < markup.indexOf("Secondary outcome rule"),
  );
});

test("knowledge library ledger page keeps search inline on the main table instead of switching to a dedicated search surface", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryLedgerPage
      initialViewModel={buildLedgerViewModel()}
      initialSearchOpen={true}
      initialSearchQuery="endpoint"
    />,
  );

  assert.match(markup, /knowledge-library-ledger-toolbar/u);
  assert.match(markup, /name="knowledge-library-inline-search"/u);
  assert.match(markup, /value="endpoint"/u);
  assert.match(markup, /Primary endpoint rule/u);
  assert.doesNotMatch(markup, /knowledge-library-ledger-search/u);
  assert.doesNotMatch(markup, /data-toolbar-action="search-results"/u);
});
