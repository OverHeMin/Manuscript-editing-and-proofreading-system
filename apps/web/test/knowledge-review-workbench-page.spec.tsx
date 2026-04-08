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

test("knowledge review workbench page renders a review-first desk shell around queue, detail, and actions", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeReviewWorkbenchPage controller={controllerStub} />,
  );

  assert.match(markup, /Knowledge Review Desk/u);
  assert.match(markup, /Pending Review Queue/u);
  assert.match(markup, /Knowledge Detail/u);
  assert.match(markup, /Review Actions/u);
  assert.match(markup, /Reviewer Role/u);
  assert.match(markup, /workbench-core-strip-card is-active/);
});
