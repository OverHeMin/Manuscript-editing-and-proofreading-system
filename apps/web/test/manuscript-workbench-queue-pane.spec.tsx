import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchQueuePane } from "../src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx";

test("queue pane renders a filterable manuscript worklist instead of a single focus card only", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchQueuePane
      mode="screening"
      busy={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      workspace={null}
      latestJob={null}
      queueItems={[
        {
          manuscriptId: "manuscript-1",
          title: "Batch Review A",
          manuscriptTypeLabel: "综述",
          statusLabel: "待处理",
          activityLabel: "等待初筛",
          queueScope: "batch",
          queueStatus: "pending",
          isActive: true,
        },
        {
          manuscriptId: "manuscript-2",
          title: "Batch Review B",
          manuscriptTypeLabel: "临床研究",
          statusLabel: "处理中",
          activityLabel: "已进入编辑",
          queueScope: "recent",
          queueStatus: "in_progress",
          isActive: false,
        },
      ]}
      activeQueueFilter="all"
      onQueueFilterChange={() => {}}
      onOpenQueueItem={() => {}}
    />,
  );

  assert.match(markup, /data-queue-view="worklist"/);
  assert.match(markup, /全部稿件/u);
  assert.match(markup, /待处理/u);
  assert.match(markup, /处理中/u);
  assert.match(markup, /已完成/u);
  assert.match(markup, /Batch Review A/);
  assert.match(markup, /Batch Review B/);
  assert.match(markup, /打开稿件/u);
  assert.doesNotMatch(markup, /当前关注稿件/u);
});
