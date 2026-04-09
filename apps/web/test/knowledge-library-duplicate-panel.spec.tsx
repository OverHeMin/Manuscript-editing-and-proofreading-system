import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeLibraryDuplicatePanel,
} = await import("../src/features/knowledge-library/knowledge-library-duplicate-panel.tsx");

test("knowledge library duplicate panel groups matches and renders card details", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicatePanel
      matches={[
        {
          severity: "exact",
          score: 1,
          matched_asset_id: "knowledge-1",
          matched_revision_id: "knowledge-1-revision-2",
          matched_title: "Primary endpoint requirement",
          matched_status: "approved",
          matched_summary: "Exact endpoint requirement summary.",
          reasons: ["canonical_text_exact_match", "same_module_scope"],
        },
        {
          severity: "high",
          score: 0.86,
          matched_asset_id: "knowledge-2",
          matched_revision_id: "knowledge-2-revision-4",
          matched_title: "Endpoint and statistics guidance",
          matched_status: "approved",
          matched_summary: "High-overlap endpoint + statistics rule.",
          reasons: ["canonical_text_high_overlap", "manuscript_type_overlap"],
        },
        {
          severity: "possible",
          score: 0.48,
          matched_asset_id: "knowledge-3",
          matched_revision_id: "knowledge-3-revision-1",
          matched_title: "Terminology checklist",
          matched_status: "draft",
          matched_summary: "Possible overlap in aliases.",
          reasons: ["alias_overlap"],
        },
      ]}
    />,
  );

  assert.match(markup, /Duplicate Signals/);
  assert.match(markup, /Exact Matches/);
  assert.match(markup, /High Similarity/);
  assert.match(markup, /Possible Overlap/);

  assert.match(markup, /Primary endpoint requirement/);
  assert.match(markup, /knowledge-1/);
  assert.match(markup, /knowledge-1-revision-2/);
  assert.match(markup, /approved/);
  assert.match(markup, /Exact endpoint requirement summary\./);
  assert.match(markup, /canonical text exact match/);

  assert.match(markup, /Endpoint and statistics guidance/);
  assert.match(markup, /knowledge-2/);
  assert.match(markup, /knowledge-2-revision-4/);
  assert.match(markup, /High-overlap endpoint \+ statistics rule\./);
  assert.match(markup, /manuscript type overlap/);

  assert.match(markup, /Terminology checklist/);
  assert.match(markup, /knowledge-3/);
  assert.match(markup, /knowledge-3-revision-1/);
  assert.match(markup, /Possible overlap in aliases\./);
  assert.match(markup, /alias overlap/);
});

test("knowledge library duplicate panel hides stale cards while checking", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicatePanel
      checkState="checking"
      matches={[
        {
          severity: "high",
          score: 0.86,
          matched_asset_id: "knowledge-2",
          matched_revision_id: "knowledge-2-revision-4",
          matched_title: "Endpoint and statistics guidance",
          matched_status: "approved",
          matched_summary: "High-overlap endpoint + statistics rule.",
          reasons: ["canonical_text_high_overlap"],
        },
      ]}
      onOpenAsset={() => undefined}
    />,
  );

  assert.match(markup, /Checking duplicates\.\.\./);
  assert.doesNotMatch(markup, /Endpoint and statistics guidance/);
  assert.doesNotMatch(markup, /Open Existing Asset/);
});

test("knowledge library duplicate panel renders explicit duplicate-check failure message", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicatePanel
      checkState="error"
      checkErrorMessage="Duplicate check failed: network timeout"
      matches={[]}
    />,
  );

  assert.match(markup, /Duplicate check failed: network timeout/);
});
