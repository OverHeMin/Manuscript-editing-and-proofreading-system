import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchPage } from "../src/features/manuscript-workbench/manuscript-workbench-page.tsx";

test("submission workbench renders a real file picker for inline uploads", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchPage
      mode="submission"
      controller={{
        loadWorkspace: async () => {
          throw new Error("not used");
        },
        uploadManuscriptAndLoad: async () => {
          throw new Error("not used");
        },
        runModuleAndLoad: async () => {
          throw new Error("not used");
        },
        finalizeProofreadingAndLoad: async () => {
          throw new Error("not used");
        },
        loadJob: async () => {
          throw new Error("not used");
        },
        exportCurrentAsset: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /type="file"/);
  assert.match(markup, /Storage Key/);
  assert.match(markup, /Upload Manuscript/);
});

test("manuscript workbench page prefills lookup state from a workbench handoff", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchPage
      mode="proofreading"
      prefilledManuscriptId="manuscript-9"
      controller={{
        loadWorkspace: async () => {
          throw new Error("not used");
        },
        uploadManuscriptAndLoad: async () => {
          throw new Error("not used");
        },
        runModuleAndLoad: async () => {
          throw new Error("not used");
        },
        finalizeProofreadingAndLoad: async () => {
          throw new Error("not used");
        },
        loadJob: async () => {
          throw new Error("not used");
        },
        exportCurrentAsset: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /manuscript-9/);
  assert.match(markup, /This workbench was prefilled from the previous manuscript handoff\./);
});
