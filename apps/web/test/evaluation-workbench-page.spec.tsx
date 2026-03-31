import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EvaluationWorkbenchPage,
} from "../src/features/evaluation-workbench/evaluation-workbench-page.tsx";

test("evaluation workbench page renders an explicit loading state for server-side shell output", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
        activateSuiteAndReload: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /Evaluation Workbench/);
  assert.match(markup, /Loading suites, runs, and verification assets\.\.\./);
});
