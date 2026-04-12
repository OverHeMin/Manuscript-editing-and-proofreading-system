import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeLibrarySemanticPanel,
  formatKnowledgeSemanticStatusLabel,
} = await import("../src/features/knowledge-library/knowledge-library-semantic-panel.tsx");

test("knowledge library semantic panel renders editable AI understanding fields and actions", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibrarySemanticPanel
      semanticLayer={{
        revision_id: "knowledge-1-revision-2",
        status: "pending_confirmation",
        page_summary: "Prefer this rule when endpoint reporting requirements are unclear.",
        retrieval_terms: ["primary endpoint", "screening"],
        retrieval_snippets: ["Use for endpoint gating questions."],
      }}
      onChange={() => undefined}
      onRegenerate={() => undefined}
      onConfirm={() => undefined}
    />,
  );

  assert.match(markup, /语义层/);
  assert.match(markup, /待确认/);
  assert.match(markup, /页面摘要/);
  assert.match(markup, /检索词/);
  assert.match(markup, /检索片段/);
  assert.match(markup, /重算语义层/);
  assert.match(markup, /确认语义层/);
  assert.match(markup, /Prefer this rule when endpoint reporting requirements are unclear\./);
  assert.match(markup, /primary endpoint, screening/);
});

test("knowledge library semantic status labels cover stale, pending, and confirmed states", () => {
  assert.equal(formatKnowledgeSemanticStatusLabel("stale"), "待刷新");
  assert.equal(
    formatKnowledgeSemanticStatusLabel("pending_confirmation"),
    "待确认",
  );
  assert.equal(formatKnowledgeSemanticStatusLabel("confirmed"), "已确认");
});
