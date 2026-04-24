import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeReviewDetailPane,
} = await import("../src/features/knowledge-review/knowledge-review-detail-pane.tsx");
const {
  KnowledgeReviewQueuePane,
} = await import("../src/features/knowledge-review/knowledge-review-queue-pane.tsx");

test("knowledge review queue pane prefers structured binding hints over legacy flattened template ids", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeReviewQueuePane
      filters={{
        searchText: "",
        knowledgeKind: "all",
        moduleScope: "all",
      }}
      queue={[
        {
          id: "knowledge-1-revision-2",
          asset_id: "knowledge-1",
          revision_id: "knowledge-1-revision-2",
          title: "Structured binding review item",
          canonical_text: "Structured binding review item",
          knowledge_kind: "rule",
          status: "pending_review",
          routing: {
            module_scope: "editing",
            manuscript_types: ["clinical_study"],
            risk_tags: ["statistics"],
          },
          evidence_level: "high",
          binding_targets: {
            journal_template_ids: ["journal-template-1"],
            general_package_ids: ["general_style_package"],
          },
          template_bindings: ["legacy-template-binding"],
        },
      ]}
      totalQueueCount={1}
      activeItemId="knowledge-1-revision-2"
      isLoading={false}
      loadErrorMessage={null}
      isQueueEmpty={false}
      isNoResults={false}
      onSearchTextChange={() => undefined}
      onKnowledgeKindChange={() => undefined}
      onModuleScopeChange={() => undefined}
      onSelectItem={() => undefined}
      onRetryQueue={() => undefined}
    />,
  );

  assert.match(markup, /期刊模板: journal-template-1/u);
  assert.match(markup, /通用包: general_style_package/u);
  assert.match(markup, /风险: statistics/u);
  assert.doesNotMatch(markup, /模板: legacy-template-binding/u);
});

test("knowledge review detail pane renders grouped structured bindings in the detail grid", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeReviewDetailPane
      item={{
        id: "knowledge-1-revision-2",
        asset_id: "knowledge-1",
        revision_id: "knowledge-1-revision-2",
        title: "Structured binding review item",
        canonical_text: "Structured binding review item",
        summary: "Queue detail summary",
        knowledge_kind: "rule",
        status: "pending_review",
        routing: {
          module_scope: "proofreading",
          manuscript_types: ["case_report"],
        },
        evidence_level: "high",
        binding_targets: {
          module_template_ids: ["template-proofreading-1"],
          medical_package_ids: ["medical-package-version-2"],
        },
        template_bindings: ["legacy-template-binding"],
      }}
      history={{
        revisionId: "knowledge-1-revision-2",
        status: "ready",
        actions: [],
        errorMessage: null,
      }}
      isUsingStableSnapshot={false}
      historyScopeNote={null}
      onRetryHistory={() => undefined}
    />,
  );

  assert.match(markup, /结构化绑定/u);
  assert.match(markup, /模块模板: template-proofreading-1/u);
  assert.match(markup, /医学专用包: medical-package-version-2/u);
  assert.doesNotMatch(markup, /模板绑定/u);
  assert.doesNotMatch(markup, /legacy-template-binding/u);
});
