import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EvaluationWorkbenchPage } from "../src/features/evaluation-workbench/evaluation-workbench-page.tsx";
import type { EvaluationWorkbenchOverview } from "../src/features/evaluation-workbench/evaluation-workbench-controller.ts";

function createOnlineRegressionOverview(): EvaluationWorkbenchOverview {
  return {
    checkProfiles: [],
    releaseCheckProfiles: [],
    sampleSets: [],
    suites: [
      {
        id: "suite-module",
        name: "Editing Module Regression",
        suite_type: "module_regression_suite",
        status: "active",
        verification_check_profile_ids: [],
        module_scope: ["editing"],
        admin_only: true,
      },
      {
        id: "suite-scope",
        name: "Editing Scope Regression",
        suite_type: "scope_regression_suite",
        status: "active",
        verification_check_profile_ids: [],
        module_scope: "any",
        admin_only: true,
      },
      {
        id: "suite-family",
        name: "Table Rule Family Regression",
        suite_type: "rule_family_regression_suite",
        status: "active",
        verification_check_profile_ids: [],
        module_scope: ["proofreading"],
        admin_only: true,
      },
    ],
    selectedSuiteId: "suite-module",
    runs: [],
    selectedRunId: null,
    sampleSetItems: [],
    runItems: [],
    selectedRunEvidence: [],
    previousRunEvidence: [],
    selectedRunFinalization: null,
    finalizedRunHistory: [],
    suiteOperations: {
      defaultWindow: "latest_10",
      visibleHistory: [],
      defaultComparison: null,
      defaultComparisonDetail: null,
      delta: null,
      signals: {
        recommendationDistribution: {
          recommended: 0,
          needs_review: 0,
          rejected: 0,
        },
        evidencePackOutcomeMix: {
          recommended: 0,
          needs_review: 0,
          rejected: 0,
        },
        recurrence: {
          regressionMentions: 0,
          failureMentions: 0,
          runsWithRecurrenceSignals: 0,
        },
      },
      honestDegradation: {
        kind: "comparison_unavailable",
        reason: "fewer_than_two_visible_finalized_runs",
      },
    },
    manuscriptContext: null,
  };
}

test("evaluation workbench labels online execution regression suite families explicitly", () => {
  const overview = createOnlineRegressionOverview();
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      section="runs"
      initialOverview={overview}
    />,
  );

  assert.match(markup, /data-harness-mode="regression_inspection"/u);
  assert.match(markup, /data-evaluation-suite-id="suite-module"/u);
  assert.match(markup, /data-evaluation-suite-type="module_regression_suite"/u);
  assert.match(markup, /data-evaluation-suite-id="suite-scope"/u);
  assert.match(markup, /data-evaluation-suite-type="scope_regression_suite"/u);
  assert.match(markup, /data-evaluation-suite-id="suite-family"/u);
  assert.match(markup, /data-evaluation-suite-type="rule_family_regression_suite"/u);
  assert.match(markup, /data-evaluation-comparison-state="unavailable"/u);
});
