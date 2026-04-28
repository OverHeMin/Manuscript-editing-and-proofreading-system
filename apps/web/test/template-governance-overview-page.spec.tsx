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
        pendingReviewCount: 5,
        harnessQueuedCount: 2,
        harnessPassedCount: 4,
        harnessFailedCount: 1,
        ruleDraftWritebackDraftCount: 2,
        ruleDraftWritebackAppliedCount: 7,
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
  assert.match(markup, /\u65b0\u5efa AI \u89c4\u5219\u8349\u7a3f/u);
  assert.match(markup, /\u8fdb\u5165\u89c4\u5219\u53f0\u8d26/u);
  assert.match(markup, /\u67e5\u770b\u5f85\u5ba1\u6838/u);
  assert.match(markup, /\u5f85\u5904\u7406\u4e8b\u9879/u);
  assert.match(markup, /\u7edf\u4e00\u590d\u6838\u5f85\u5904\u7406/u);
  assert.match(markup, /Harness \u5f85\u9a8c\u8bc1/u);
  assert.match(markup, /Harness \u5df2\u901a\u8fc7/u);
  assert.match(markup, /Harness \u672a\u901a\u8fc7/u);
  assert.match(markup, /\u89c4\u5219\u8349\u7a3f\u5f85\u5199\u56de/u);
  assert.match(markup, /\u89c4\u5219\u8349\u7a3f\u5df2\u5199\u56de/u);
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
    5,
  );
  assert.equal(
    (markup.match(/template-governance-overview-metric-value/g) ?? []).length,
    5,
  );
});

test("rule center overview collapses duplicate operational metrics into decision cards", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceOverviewPage
      metrics={{
        templateCount: 4,
        moduleCount: 9,
        pendingKnowledgeCount: 3,
        extractionAwaitingConfirmationCount: 6,
        pendingReviewCount: 5,
        harnessQueuedCount: 2,
        harnessPassedCount: 4,
        harnessFailedCount: 1,
        ruleDraftWritebackDraftCount: 2,
        ruleDraftWritebackAppliedCount: 7,
      }}
    />,
  );

  assert.equal(
    (
      markup.match(
        /template-governance-card template-governance-overview-metric"/g,
      ) ?? []
    ).length,
    5,
  );
  assert.match(markup, /data-governance-metric-kind="harness"/u);
  assert.match(markup, /data-governance-metric-kind="manual-review"/u);
  assert.doesNotMatch(markup, /data-governance-metric-kind="harness-passed"/u);
  assert.doesNotMatch(markup, /data-governance-metric-kind="harness-failed"/u);
  assert.doesNotMatch(markup, /data-governance-metric-kind="rule-writeback-applied"/u);
});

test("rule center overview surfaces release posture and blocked promotion metrics", () => {
  const Page = TemplateGovernanceOverviewPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      metrics={{
        templateCount: 4,
        moduleCount: 9,
        pendingKnowledgeCount: 3,
        extractionAwaitingConfirmationCount: 6,
        pendingReviewCount: 5,
        harnessQueuedCount: 2,
        harnessPassedCount: 4,
        harnessFailedCount: 1,
        ruleDraftWritebackDraftCount: 2,
        ruleDraftWritebackAppliedCount: 7,
        candidateRuleSetCount: 2,
        canaryRuleSetCount: 1,
        activeRuleSetCount: 4,
        rolledBackRuleSetCount: 1,
        blockedReleaseCount: 3,
      }}
    />,
  );

  assert.match(markup, /\u5019\u9009\u89c4\u5219\u96c6/u);
  assert.match(markup, /Canary \u89c4\u5219\u96c6/u);
  assert.match(markup, /\u5df2\u751f\u6548\u89c4\u5219\u96c6/u);
  assert.match(markup, /\u5df2\u56de\u6eda\u89c4\u5219\u96c6/u);
  assert.match(markup, /\u53d1\u5e03\u963b\u585e\u9879/u);
  assert.equal(
    (
      markup.match(
        /template-governance-card template-governance-overview-metric"/g,
      ) ?? []
    ).length,
    6,
  );
});

test("rule center overview bridges retrieval quality into governed evidence wording", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceOverviewPage
      metrics={{
        templateCount: 4,
        moduleCount: 9,
        pendingKnowledgeCount: 3,
        extractionAwaitingConfirmationCount: 6,
        pendingReviewCount: 5,
        harnessQueuedCount: 2,
        harnessPassedCount: 4,
        harnessFailedCount: 1,
        ruleDraftWritebackDraftCount: 2,
        ruleDraftWritebackAppliedCount: 7,
        retrievalAnswerRelevancy: 0.71,
        retrievalContextPrecision: 0.68,
        retrievalContextRecall: 0.62,
      }}
    />,
  );

  assert.match(markup, /\u68c0\u7d22\u6cbb\u7406\u8bc1\u636e/u);
  assert.match(
    markup,
    /\u8fd9\u4e9b\u6307\u6807\u7528\u4e8e\u5224\u65ad\u53d7\u6cbb\u7406\u68c0\u7d22\u662f\u5426\u7a33\u5b9a\u652f\u6491\u89c4\u5219\u4e0e\u77e5\u8bc6\u6c89\u6dc0\uff0c\u4e0d\u4ee3\u8868\u901a\u7528 AI \u51c6\u786e\u7387\u3002/u,
  );
  assert.match(markup, /\u7b54\u6848\u76f8\u5173\u6027 0\.71/u);
  assert.match(markup, /\u4e0a\u4e0b\u6587\u7cbe\u786e\u7387 0\.68/u);
  assert.match(markup, /\u4e0a\u4e0b\u6587\u53ec\u56de\u7387 0\.62/u);
  assert.match(
    markup,
    /Harness \u5f85\u9a8c\u8bc1 2 \u6761\uff0c\u5df2\u901a\u8fc7 4 \u6761\uff0c\u672a\u901a\u8fc7 1 \u6761\u3002/u,
  );
});
