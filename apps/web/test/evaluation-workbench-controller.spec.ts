import assert from "node:assert/strict";
import test from "node:test";
import {
  createEvaluationWorkbenchController,
} from "../src/features/evaluation-workbench/evaluation-workbench-controller.ts";

test("evaluation workbench controller loads verification assets, suites, runs, and run items", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createEvaluationWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/verification-ops/check-profiles") {
        return {
          status: 200,
          body: [
            {
              id: "check-1",
              name: "Browser QA",
              check_type: "browser_qa",
              status: "published",
              tool_ids: ["browse"],
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/release-check-profiles") {
        return {
          status: 200,
          body: [
            {
              id: "release-1",
              name: "Release Gate",
              check_type: "deploy_verification",
              status: "published",
              verification_check_profile_ids: ["check-1"],
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets") {
        return {
          status: 200,
          body: [
            {
              id: "sample-set-1",
              name: "Editing Reviewed Cases",
              module: "editing",
              manuscript_types: ["review"],
              risk_tags: ["terminology"],
              sample_count: 8,
              source_policy: {
                source_kind: "reviewed_case_snapshot",
                requires_deidentification_pass: true,
                requires_human_final_asset: true,
              },
              status: "published",
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites") {
        return {
          status: 200,
          body: [
            {
              id: "suite-1",
              name: "Editing Regression",
              suite_type: "regression",
              status: "active",
              verification_check_profile_ids: ["check-1"],
              module_scope: ["editing"],
              supports_ab_comparison: true,
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-1/runs") {
        return {
          status: 200,
          body: [
            {
              id: "run-1",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 2,
              status: "passed",
              evidence_ids: ["evidence-1"],
              started_at: "2026-03-31T12:00:00.000Z",
              finished_at: "2026-03-31T12:12:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-1/items") {
        return {
          status: 200,
          body: [
            {
              id: "run-item-1",
              evaluation_run_id: "run-1",
              sample_set_item_id: "sample-item-1",
              lane: "candidate",
              result_asset_id: "asset-1",
              hard_gate_passed: true,
              weighted_score: 94,
              requires_human_review: false,
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.checkProfiles.length, 1);
  assert.equal(overview.releaseCheckProfiles.length, 1);
  assert.equal(overview.sampleSets.length, 1);
  assert.equal(overview.suites.length, 1);
  assert.equal(overview.selectedSuiteId, "suite-1");
  assert.equal(overview.runs.length, 1);
  assert.equal(overview.selectedRunId, "run-1");
  assert.equal(overview.runItems.length, 1);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/verification-ops/check-profiles",
      "GET /api/v1/verification-ops/release-check-profiles",
      "GET /api/v1/verification-ops/evaluation-sample-sets",
      "GET /api/v1/verification-ops/evaluation-suites",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/runs",
      "GET /api/v1/verification-ops/evaluation-runs/run-1/items",
    ],
  );
});

test("evaluation workbench controller activates a suite and reloads the selected overview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createEvaluationWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "POST" &&
        input.url === "/api/v1/verification-ops/evaluation-suites/suite-draft/activate"
      ) {
        return {
          status: 200,
          body: {
            id: "suite-draft",
            name: "Draft Release Gate",
            suite_type: "release_gate",
            status: "active",
            verification_check_profile_ids: ["check-1"],
            module_scope: "any",
            requires_production_baseline: true,
            admin_only: true,
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/check-profiles") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/release-check-profiles") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites") {
        return {
          status: 200,
          body: [
            {
              id: "suite-draft",
              name: "Draft Release Gate",
              suite_type: "release_gate",
              status: "active",
              verification_check_profile_ids: ["check-1"],
              module_scope: "any",
              requires_production_baseline: true,
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-draft/runs") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.activateSuiteAndReload({
    suiteId: "suite-draft",
    actorRole: "admin",
  });

  assert.equal(overview.selectedSuiteId, "suite-draft");
  assert.equal(overview.suites[0]?.status, "active");
  assert.equal(overview.runs.length, 0);
  assert.equal(overview.selectedRunId, null);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/verification-ops/evaluation-suites/suite-draft/activate",
      "GET /api/v1/verification-ops/check-profiles",
      "GET /api/v1/verification-ops/release-check-profiles",
      "GET /api/v1/verification-ops/evaluation-sample-sets",
      "GET /api/v1/verification-ops/evaluation-suites",
      "GET /api/v1/verification-ops/evaluation-suites/suite-draft/runs",
    ],
  );
});
