import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceOverviewPage } from "../src/features/template-governance/template-governance-overview-page.tsx";

test("rule center overview renders compact entries only", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceOverviewPage
      metrics={{
        templateCount: 4,
        moduleCount: 9,
        pendingKnowledgeCount: 3,
        extractionAwaitingConfirmationCount: 6,
      }}
    />,
  );

  assert.match(markup, /template-governance-overview-page/u);
  assert.match(markup, /\u89c4\u5219\u4e2d\u5fc3\u603b\u89c8/u);
  assert.match(markup, /\u89c4\u5219\u53f0\u8d26/u);
  assert.match(markup, /\u65b0\u5efa\u89c4\u5219/u);
  assert.match(markup, /\u8fdb\u5165\u89c4\u5219\u53f0\u8d26/u);
  assert.match(markup, /\u67e5\u770b\u5f85\u5ba1\u6838/u);
  assert.match(markup, /\u5927\u6a21\u677f\u53f0\u8d26/u);
  assert.match(markup, /\u671f\u520a\u6a21\u677f\u53f0\u8d26/u);
  assert.match(markup, /\u901a\u7528\u5305\u53f0\u8d26/u);
  assert.match(markup, /\u533b\u5b66\u4e13\u7528\u5305\u53f0\u8d26/u);
  assert.match(markup, /\u539f\u7a3f\/\u7f16\u8f91\u7a3f\u63d0\u53d6\u53f0\u8d26/u);
  assert.doesNotMatch(markup, /\u89c4\u5219\u5f55\u5165/u);
  assert.doesNotMatch(markup, /template-governance-hero/u);
});
