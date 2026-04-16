import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  KnowledgeReviewWorkbenchController,
} from "../src/features/knowledge-review/workbench-controller.ts";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeReviewWorkbenchPage,
} = await import("../src/features/knowledge-review/knowledge-review-workbench-page.tsx");

const controllerStub: KnowledgeReviewWorkbenchController = {
  loadDesk: async () => {
    throw new Error("not used");
  },
  loadHistory: async () => {
    throw new Error("not used");
  },
  approveItem: async () => {
    throw new Error("not used");
  },
  rejectItem: async () => {
    throw new Error("not used");
  },
};

test("knowledge review workbench page renders a compact review desk around queue, detail, and inline actions", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeReviewWorkbenchPage controller={controllerStub} />,
  );

  assert.match(markup, /data-layout="compact-review-desk"/);
  assert.match(markup, /审核站/u);
  assert.match(markup, /知识审核/u);
  assert.match(
    markup,
    /当前先在审核站完成知识修订结论，通过后再转入规则中心继续治理。/u,
  );
  assert.match(markup, /审核通过/u);
  assert.match(markup, /驳回修订/u);
  assert.match(markup, /knowledge-review-queue-pane/);
  assert.match(markup, /knowledge-review-review-column/);
  assert.match(markup, /knowledge-review-detail-pane/);
  assert.match(markup, /knowledge-review-action-panel/);
  assert.match(markup, /knowledge-review-inline-actions/);
  assert.match(markup, /workbench-core-strip-card is-active/);
  assert.doesNotMatch(markup, /知识审核工作台/u);
  assert.doesNotMatch(markup, /回流候选审核/u);
  assert.doesNotMatch(markup, /knowledge-review-hero/);
  assert.doesNotMatch(markup, /knowledge-review-hero-stats/);
});

test("knowledge review workbench page keeps queue filters compact and near the queue", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeReviewWorkbenchPage controller={controllerStub} />,
  );

  assert.match(markup, /knowledge-review-compact-filters/);
  assert.match(markup, /knowledge-review-queue-summary/);
  assert.doesNotMatch(markup, /knowledge-review-inline-filters/);
});

test("knowledge review workbench page assigns independent scroll ownership to queue and detail", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeReviewWorkbenchPage controller={controllerStub} />,
  );

  assert.match(markup, /data-scroll-owner="queue"/);
  assert.match(markup, /data-scroll-owner="detail"/);
});
