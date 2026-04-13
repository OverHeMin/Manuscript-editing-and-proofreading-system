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

  assert.match(markup, /Semantic Layer/);
  assert.match(markup, /Pending Confirmation/);
  assert.match(markup, /Page Summary/);
  assert.match(markup, /Retrieval Terms/);
  assert.match(markup, /Retrieval Snippets/);
  assert.match(markup, /Regenerate Semantics/);
  assert.match(markup, /Confirm Semantic Layer/);
  assert.match(markup, /Prefer this rule when endpoint reporting requirements are unclear\./);
  assert.match(markup, /primary endpoint, screening/);
});

test("knowledge library semantic status labels cover stale, pending, and confirmed states", () => {
  assert.equal(formatKnowledgeSemanticStatusLabel("stale"), "Stale");
  assert.equal(
    formatKnowledgeSemanticStatusLabel("pending_confirmation"),
    "Pending Confirmation",
  );
  assert.equal(formatKnowledgeSemanticStatusLabel("confirmed"), "Confirmed");
});
