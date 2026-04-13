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
  assert.match(markup, /规则中心总览/u);
  assert.match(markup, /大模板台账/u);
  assert.match(markup, /期刊模板台账/u);
  assert.match(markup, /通用包台账/u);
  assert.match(markup, /医学专用包台账/u);
  assert.match(markup, /原稿\/编辑稿提取台账/u);
  assert.doesNotMatch(markup, /规则录入/u);
  assert.doesNotMatch(markup, /template-governance-hero/u);
});
