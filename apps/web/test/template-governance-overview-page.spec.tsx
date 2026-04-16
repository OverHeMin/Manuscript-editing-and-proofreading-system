import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceOverviewPage } from "../src/features/template-governance/template-governance-overview-page.tsx";

test("rule center overview renders approved A-layout shell", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceOverviewPage
      metrics={{
        templateCount: 4,
        moduleCount: 9,
        pendingKnowledgeCount: 3,
        extractionAwaitingConfirmationCount: 6,
      }}
      pendingItems={[
        {
          id: "pending-recycled-candidate",
          title: "回流候选待确认",
          detail: "6 条候选等待转成规则或驳回",
          emphasis: "待处理 6 条",
          actionLabel: "处理候选",
          targetView: "extraction-ledger",
        },
        {
          id: "pending-rule-draft",
          title: "规则草稿待提交",
          detail: "3 条规则草稿停留在待审核前",
          emphasis: "草稿 3 条",
          actionLabel: "打开规则台账",
          targetView: "rule-ledger",
        },
      ]}
      recentUpdates={[
        {
          id: "update-family",
          title: "临床研究大模板族",
          detail: "当前启用模板族",
          statusLabel: "进行中",
          targetView: "large-template-ledger",
        },
        {
          id: "update-package",
          title: "医学专业校对包",
          detail: "最近进入规则包的业务资产",
          statusLabel: "已更新",
          targetView: "medical-package-ledger",
        },
      ]}
    />,
  );

  assert.match(markup, /template-governance-overview-page/u);
  assert.match(markup, /template-governance-overview-shell/u);
  assert.match(markup, /template-governance-overview-hero/u);
  assert.match(markup, /template-governance-overview-main/u);
  assert.match(markup, /template-governance-overview-primary/u);
  assert.match(markup, /template-governance-overview-secondary/u);
  assert.match(markup, /\u89c4\u5219\u4e2d\u5fc3\u603b\u89c8/u);
  assert.match(markup, /\u89c4\u5219\u53f0\u8d26/u);
  assert.match(markup, /\u65b0\u5efa\u89c4\u5219/u);
  assert.match(markup, /\u8fdb\u5165\u89c4\u5219\u53f0\u8d26/u);
  assert.match(markup, /\u67e5\u770b\u5f85\u5ba1\u6838/u);
  assert.match(markup, /\u5f85\u5904\u7406\u4e8b\u9879/u);
  assert.match(markup, /\u6700\u8fd1\u5305\s*\/\s*\u6a21\u677f\u66f4\u65b0/u);
  assert.match(markup, /\u56de\u6d41\u5019\u9009\u5f85\u786e\u8ba4/u);
  assert.match(markup, /\u4e34\u5e8a\u7814\u7a76\u5927\u6a21\u677f\u65cf/u);
  assert.doesNotMatch(markup, /\u6b21\u7ea7\u53f0\u8d26\u5165\u53e3/u);
  assert.doesNotMatch(markup, /\u5b50\u9875\u9762/u);
  assert.doesNotMatch(markup, /\u5b9a\u4f4d/u);
  assert.match(markup, /\u5927\u6a21\u677f\u53f0\u8d26/u);
  assert.match(markup, /\u671f\u520a\u6a21\u677f\u53f0\u8d26/u);
  assert.match(markup, /\u901a\u7528\u5305\u53f0\u8d26/u);
  assert.match(markup, /\u533b\u5b66\u4e13\u7528\u5305\u53f0\u8d26/u);
  assert.match(markup, /\u539f\u7a3f\/\u7f16\u8f91\u7a3f\u63d0\u53d6/u);
  assert.equal(
    (
      markup.match(
        /template-governance-card template-governance-overview-metric"/g,
      ) ?? []
    ).length,
    4,
  );
  assert.equal(
    (markup.match(/template-governance-overview-metric-value/g) ?? []).length,
    4,
  );
});
