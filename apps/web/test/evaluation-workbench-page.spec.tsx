import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EvaluationWorkbenchPage,
  EvaluationWorkbenchSelectedRunItemDetailCard,
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

test("evaluation workbench run-item detail card renders linked sample context and frozen bindings", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchSelectedRunItemDetailCard
      selectedRun={{
        id: "run-1",
        suite_id: "suite-1",
        sample_set_id: "sample-set-1",
        baseline_binding: {
          lane: "baseline",
          model_id: "baseline-model-1",
          runtime_id: "runtime-prod-1",
          prompt_template_id: "prompt-prod-1",
          skill_package_ids: ["skill-prod-1", "skill-prod-2"],
          module_template_id: "template-prod-1",
        },
        candidate_binding: {
          lane: "candidate",
          model_id: "candidate-model-1",
          runtime_id: "runtime-candidate-1",
          prompt_template_id: "prompt-candidate-1",
          skill_package_ids: ["skill-candidate-1"],
          module_template_id: "template-candidate-1",
        },
        release_check_profile_id: "release-1",
        run_item_count: 1,
        status: "running",
        evidence_ids: [],
        started_at: "2026-04-01T08:00:00.000Z",
      }}
      selectedRunItem={{
        id: "run-item-1",
        evaluation_run_id: "run-1",
        sample_set_item_id: "sample-item-1",
        lane: "candidate",
        result_asset_id: "asset-1",
        hard_gate_passed: false,
        weighted_score: 61,
        failure_kind: "regression_failed",
        failure_reason: "Structure regression triggered the hard gate.",
        diff_summary: "Candidate drifted from the approved editing structure.",
        requires_human_review: true,
      }}
      linkedSampleSetItem={{
        id: "sample-item-1",
        sample_set_id: "sample-set-1",
        manuscript_id: "manuscript-1",
        snapshot_asset_id: "snapshot-asset-1",
        reviewed_case_snapshot_id: "reviewed-case-snapshot-1",
        module: "editing",
        manuscript_type: "clinical_study",
        risk_tags: ["structure", "terminology"],
      }}
    />,
  );

  assert.match(markup, /Selected Sample Detail/);
  assert.match(markup, /sample-item-1/);
  assert.match(markup, /clinical_study/);
  assert.match(markup, /structure, terminology/);
  assert.match(markup, /snapshot-asset-1/);
  assert.match(markup, /reviewed-case-snapshot-1/);
  assert.match(markup, /baseline-model-1/);
  assert.match(markup, /candidate-model-1/);
  assert.match(markup, /skill-prod-1, skill-prod-2/);
  assert.match(markup, /skill-candidate-1/);
});
