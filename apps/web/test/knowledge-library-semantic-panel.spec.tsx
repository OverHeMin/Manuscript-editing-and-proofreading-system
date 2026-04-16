import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const { KnowledgeLibrarySemanticSection } = await import(
  "../src/features/knowledge-library/knowledge-library-semantic-section.tsx"
);

function noop() {}

test("knowledge library semantic section exposes editable semantic fields and explicit action markers", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibrarySemanticSection
      semanticStatusLabel="待确认"
      semanticNotes={["请确认检索词覆盖范围。"]}
      pageSummary="用于初筛主终点定义。"
      retrievalTerms={["主终点", "endpoint"]}
      aliases={["primary endpoint"]}
      scenarios={["方法学初筛"]}
      riskTags={["终点一致性"]}
      isBusy={false}
      canGenerate={true}
      canApply={true}
      onPageSummaryChange={noop}
      onGenerate={noop}
      onApply={noop}
      onAddRetrievalTerm={noop}
      onChangeRetrievalTerm={noop}
      onRemoveRetrievalTerm={noop}
      onAddAlias={noop}
      onChangeAlias={noop}
      onRemoveAlias={noop}
      onAddScenario={noop}
      onChangeScenario={noop}
      onRemoveScenario={noop}
      onAddRiskTag={noop}
      onChangeRiskTag={noop}
      onRemoveRiskTag={noop}
    />,
  );

  assert.match(markup, /data-semantic-action="generate"/u);
  assert.match(markup, /data-semantic-action="regenerate"/u);
  assert.match(markup, /data-semantic-action="apply"/u);
  assert.match(markup, /data-semantic-field="page-summary"/u);
  assert.match(markup, /data-semantic-field="retrieval-terms"/u);
  assert.match(markup, /data-semantic-field="aliases"/u);
  assert.match(markup, /data-semantic-field="scenarios"/u);
  assert.match(markup, /data-semantic-field="risk-tags"/u);
  assert.match(markup, /data-semantic-value="retrieval-terms-0"/u);
  assert.match(markup, /data-semantic-value="aliases-0"/u);
  assert.match(markup, /data-semantic-value="scenarios-0"/u);
  assert.match(markup, /data-semantic-value="risk-tags-0"/u);
  assert.match(markup, /用于初筛主终点定义/u);
  assert.match(markup, /请确认检索词覆盖范围/u);
});
