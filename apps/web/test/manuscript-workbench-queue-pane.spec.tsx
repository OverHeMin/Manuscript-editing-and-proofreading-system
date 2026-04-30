import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchQueuePane } from "../src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx";

test("queue pane renders uploaded manuscripts with a compact capacity summary", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchQueuePane
      mode="screening"
      busy={false}
      lookup={{
        manuscriptId: "",
        onChange: () => {},
        onLoad: () => {},
      }}
      workspace={
        {
          moduleExecutionConcurrency: {
            active: {
              global: 1,
              screening: 1,
              editing: 0,
              proofreading: 0,
            },
            queued: {
              global: 2,
              screening: 1,
              editing: 1,
              proofreading: 0,
            },
            limits: {
              global: 2,
              screening: 2,
              editing: 1,
              proofreading: 1,
            },
          },
        } as never
      }
      latestJob={null}
      queueItems={[
        {
          manuscriptId: "manuscript-1",
          title: "Batch Review A",
          manuscriptTypeLabel: "Review",
          statusLabel: "Queued",
          activityLabel: "Waiting for screening slot",
          queueScope: "batch",
          queueStatus: "pending",
          isActive: true,
        },
        {
          manuscriptId: "manuscript-2",
          title: "Batch Review B",
          manuscriptTypeLabel: "Clinical study",
          statusLabel: "Failed",
          activityLabel: "Latest screening run failed",
          queueScope: "recent",
          queueStatus: "failed",
          isActive: false,
        },
      ]}
      activeQueueFilter="all"
      onQueueFilterChange={() => {}}
      onOpenQueueItem={() => {}}
      onArchiveQueueItem={() => {}}
    />,
  );

  assert.match(markup, /data-queue-view="worklist"/);
  assert.doesNotMatch(markup, /data-queue-filter="all"/);
  assert.doesNotMatch(markup, /data-queue-filter="pending"/);
  assert.doesNotMatch(markup, /data-queue-filter="in_progress"/);
  assert.doesNotMatch(markup, /data-queue-filter="completed"/);
  assert.doesNotMatch(markup, /data-queue-filter="failed"/);
  assert.match(markup, /稿件查找/u);
  assert.match(markup, /placeholder="搜索完整稿件名或编号"/u);
  assert.match(markup, /value=""/);
  assert.match(markup, /data-queue-item-status="pending"/);
  assert.match(markup, /data-queue-item-status="failed"/);
  assert.match(markup, /data-queue-row-action="open"/);
  assert.match(markup, /data-queue-row-action="archive"/);
  assert.match(markup, /已上传稿件/u);
  assert.match(markup, /总并发 2，初筛并发 2，超出自动排队。/u);
  assert.match(markup, /Batch Review A/);
  assert.match(markup, /Batch Review B/);
  assert.doesNotMatch(markup, /data-concurrency-scope=/);
  assert.doesNotMatch(markup, /data-queue-view="focus-card"/);
});

test("queue pane keeps the worklist compact without the legacy lookup field", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchQueuePane
      mode="proofreading"
      busy={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      workspace={
        {
          manuscript: {
            id: "manuscript-1",
            title: "语义浏览器验收稿件",
          },
        } as never
      }
      latestJob={null}
      queueItems={[]}
      activeQueueFilter="all"
      onQueueFilterChange={() => {}}
      onOpenQueueItem={() => {}}
      onArchiveQueueItem={() => {}}
    />,
  );

  assert.match(markup, /稿件队列/u);
  assert.doesNotMatch(markup, /value="语义浏览器验收稿件"/u);
  assert.match(markup, /value="manuscript-1"/);
  assert.match(markup, /placeholder="搜索完整稿件名或编号"/u);
});
