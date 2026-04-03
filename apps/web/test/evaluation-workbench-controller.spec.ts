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

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-1/evidence") {
        return {
          status: 200,
          body: [
            {
              id: "evidence-1",
              kind: "url",
              label: "Historical browser QA",
              uri: "https://example.test/evidence/historical-browser-qa",
              created_at: "2026-03-31T12:11:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-1/finalized-result") {
        return {
          status: 200,
          body: {
            run: {
              id: "run-1",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 2,
              status: "passed",
              evidence_ids: ["evidence-1"],
              started_at: "2026-03-31T12:00:00.000Z",
              finished_at: "2026-03-31T12:12:00.000Z",
            },
            evidence_pack: {
              id: "pack-1",
              experiment_run_id: "run-1",
              summary_status: "recommended",
              score_summary: "Stable historical score.",
              created_at: "2026-03-31T12:12:30.000Z",
            },
            recommendation: {
              id: "recommendation-1",
              experiment_run_id: "run-1",
              evidence_pack_id: "pack-1",
              status: "recommended",
              decision_reason: "Historical run approved.",
              created_at: "2026-03-31T12:12:30.000Z",
            },
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-1/finalized-results") {
        return {
          status: 200,
          body: [
            {
              run: {
                id: "run-1",
                suite_id: "suite-1",
                sample_set_id: "sample-set-1",
                run_item_count: 2,
                status: "passed",
                evidence_ids: ["evidence-1"],
                started_at: "2026-03-31T12:00:00.000Z",
                finished_at: "2026-03-31T12:12:00.000Z",
              },
              evidence_pack: {
                id: "pack-1",
                experiment_run_id: "run-1",
                summary_status: "recommended",
                score_summary: "Stable historical score.",
                created_at: "2026-03-31T12:12:30.000Z",
              },
              recommendation: {
                id: "recommendation-1",
                experiment_run_id: "run-1",
                evidence_pack_id: "pack-1",
                status: "recommended",
                decision_reason: "Historical run approved.",
                created_at: "2026-03-31T12:12:30.000Z",
              },
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items") {
        return {
          status: 200,
          body: [
            {
              id: "sample-item-1",
              sample_set_id: "sample-set-1",
              manuscript_id: "manuscript-1",
              snapshot_asset_id: "snapshot-asset-1",
              reviewed_case_snapshot_id: "reviewed-case-snapshot-1",
              module: "editing",
              manuscript_type: "review",
              risk_tags: ["terminology"],
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
  assert.equal(overview.sampleSetItems.length, 1);
  assert.equal(overview.selectedRunEvidence[0]?.label, "Historical browser QA");
  assert.equal(overview.sampleSetItems[0]?.reviewed_case_snapshot_id, "reviewed-case-snapshot-1");
  assert.equal(overview.selectedRunFinalization?.evidence_pack.id, "pack-1");
  assert.equal(overview.selectedRunFinalization?.recommendation.status, "recommended");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/verification-ops/check-profiles",
      "GET /api/v1/verification-ops/release-check-profiles",
      "GET /api/v1/verification-ops/evaluation-sample-sets",
      "GET /api/v1/verification-ops/evaluation-suites",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/runs",
      "GET /api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items",
      "GET /api/v1/verification-ops/evaluation-runs/run-1/items",
      "GET /api/v1/verification-ops/evaluation-runs/run-1/evidence",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/finalized-results",
    ],
  );
});

test("evaluation workbench controller loads finalized suite history for comparison", async () => {
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
          body: [
            {
              id: "sample-set-1",
              name: "Editing Sample Set",
              module: "editing",
              manuscript_types: ["review"],
              sample_count: 1,
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
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-2"],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:18:00.000Z",
            },
            {
              id: "run-1",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "failed",
              evidence_ids: ["evidence-1"],
              started_at: "2026-03-31T12:00:00.000Z",
              finished_at: "2026-03-31T12:12:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items") {
        return {
          status: 200,
          body: [
            {
              id: "sample-item-1",
              sample_set_id: "sample-set-1",
              manuscript_id: "manuscript-1",
              snapshot_asset_id: "snapshot-asset-1",
              reviewed_case_snapshot_id: "reviewed-case-snapshot-1",
              module: "editing",
              manuscript_type: "review",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/items") {
        return {
          status: 200,
          body: [
            {
              id: "run-item-2",
              evaluation_run_id: "run-2",
              sample_set_item_id: "sample-item-1",
              lane: "candidate",
              result_asset_id: "asset-2",
              hard_gate_passed: true,
              weighted_score: 96,
              requires_human_review: false,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/evidence") {
        return {
          status: 200,
          body: [
            {
              id: "evidence-2",
              kind: "url",
              label: "Latest browser QA",
              uri: "https://example.test/evidence/latest-browser-qa",
              created_at: "2026-03-31T13:17:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-1/evidence") {
        return {
          status: 200,
          body: [
            {
              id: "evidence-1",
              kind: "url",
              label: "Rejected browser QA",
              uri: "https://example.test/evidence/rejected-browser-qa",
              created_at: "2026-03-31T12:11:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/finalized-result") {
        return {
          status: 200,
          body: {
            run: {
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-2"],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:18:00.000Z",
            },
            evidence_pack: {
              id: "pack-2",
              experiment_run_id: "run-2",
              summary_status: "recommended",
              score_summary: "Candidate weighted score 96.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
            recommendation: {
              id: "recommendation-2",
              experiment_run_id: "run-2",
              evidence_pack_id: "pack-2",
              status: "recommended",
              decision_reason: "Latest run is safe to promote.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-1/finalized-result") {
        return {
          status: 200,
          body: {
            run: {
              id: "run-1",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "failed",
              evidence_ids: ["evidence-1"],
              started_at: "2026-03-31T12:00:00.000Z",
              finished_at: "2026-03-31T12:12:00.000Z",
            },
            evidence_pack: {
              id: "pack-1",
              experiment_run_id: "run-1",
              summary_status: "rejected",
              failure_summary: "Previous run failed a hard gate.",
              created_at: "2026-03-31T12:12:30.000Z",
            },
            recommendation: {
              id: "recommendation-1",
              experiment_run_id: "run-1",
              evidence_pack_id: "pack-1",
              status: "rejected",
              decision_reason: "Previous run cannot be promoted.",
              created_at: "2026-03-31T12:12:30.000Z",
            },
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-1/finalized-results") {
        return {
          status: 200,
          body: [
            {
              run: {
                id: "run-2",
                suite_id: "suite-1",
                sample_set_id: "sample-set-1",
                run_item_count: 1,
                status: "passed",
                evidence_ids: ["evidence-2"],
                started_at: "2026-03-31T13:00:00.000Z",
                finished_at: "2026-03-31T13:18:00.000Z",
              },
              evidence_pack: {
                id: "pack-2",
                experiment_run_id: "run-2",
                summary_status: "recommended",
                score_summary: "Candidate weighted score 96.",
                created_at: "2026-03-31T13:18:30.000Z",
              },
              recommendation: {
                id: "recommendation-2",
                experiment_run_id: "run-2",
                evidence_pack_id: "pack-2",
                status: "recommended",
                decision_reason: "Latest run is safe to promote.",
                created_at: "2026-03-31T13:18:30.000Z",
              },
            },
            {
              run: {
                id: "run-1",
                suite_id: "suite-1",
                sample_set_id: "sample-set-1",
                run_item_count: 1,
                status: "failed",
                evidence_ids: ["evidence-1"],
                started_at: "2026-03-31T12:00:00.000Z",
                finished_at: "2026-03-31T12:12:00.000Z",
              },
              evidence_pack: {
                id: "pack-1",
                experiment_run_id: "run-1",
                summary_status: "rejected",
                failure_summary: "Previous run failed a hard gate.",
                created_at: "2026-03-31T12:12:30.000Z",
              },
              recommendation: {
                id: "recommendation-1",
                experiment_run_id: "run-1",
                evidence_pack_id: "pack-1",
                status: "rejected",
                decision_reason: "Previous run cannot be promoted.",
                created_at: "2026-03-31T12:12:30.000Z",
              },
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview({
    selectedSuiteId: "suite-1",
    selectedRunId: "run-2",
  });

  assert.equal(overview.selectedRunId, "run-2");
  assert.equal(overview.selectedRunFinalization?.run.id, "run-2");
  assert.equal(overview.selectedRunEvidence[0]?.label, "Latest browser QA");
  assert.equal(overview.previousRunEvidence[0]?.label, "Rejected browser QA");
  assert.deepEqual(
    overview.finalizedRunHistory.map((entry) => entry.run.id),
    ["run-2", "run-1"],
  );
  assert.equal(
    overview.finalizedRunHistory[0]?.finalized.recommendation.status,
    "recommended",
  );
  assert.equal(
    overview.finalizedRunHistory[1]?.finalized.recommendation.status,
    "rejected",
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/verification-ops/check-profiles",
      "GET /api/v1/verification-ops/release-check-profiles",
      "GET /api/v1/verification-ops/evaluation-sample-sets",
      "GET /api/v1/verification-ops/evaluation-suites",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/runs",
      "GET /api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items",
      "GET /api/v1/verification-ops/evaluation-runs/run-2/items",
      "GET /api/v1/verification-ops/evaluation-runs/run-2/evidence",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/finalized-results",
      "GET /api/v1/verification-ops/evaluation-runs/run-1/evidence",
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

test("evaluation workbench controller creates a run and reloads the selected run overview", async () => {
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
        input.url === "/api/v1/verification-ops/evaluation-runs"
      ) {
        return {
          status: 201,
          body: {
            id: "run-2",
            suite_id: "suite-1",
            sample_set_id: "sample-set-1",
            run_item_count: 1,
            status: "queued",
            evidence_ids: [],
            started_at: "2026-03-31T13:00:00.000Z",
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
          body: [
            {
              id: "sample-set-1",
              name: "Editing Sample Set",
              module: "editing",
              manuscript_types: ["review"],
              sample_count: 1,
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
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-1"],
              started_at: "2026-03-31T12:00:00.000Z",
              finished_at: "2026-03-31T12:08:00.000Z",
            },
            {
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "queued",
              evidence_ids: [],
              started_at: "2026-03-31T13:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/items") {
        return {
          status: 200,
          body: [
            {
              id: "run-item-2",
              evaluation_run_id: "run-2",
              sample_set_item_id: "sample-item-2",
              lane: "candidate",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/finalized-result") {
        return {
          status: 200,
          body: null as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-1/finalized-result") {
        return {
          status: 200,
          body: null as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-1/finalized-results") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items") {
        return {
          status: 200,
          body: [
            {
              id: "sample-item-2",
              sample_set_id: "sample-set-1",
              manuscript_id: "manuscript-2",
              snapshot_asset_id: "snapshot-asset-2",
              reviewed_case_snapshot_id: "reviewed-case-snapshot-2",
              module: "editing",
              manuscript_type: "review",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.createRunAndReload({
    actorRole: "admin",
    suiteId: "suite-1",
    sampleSetId: "sample-set-1",
    baselineBinding: {
      lane: "baseline",
      modelId: "demo-model-prod-1",
      runtimeId: "demo-runtime-prod-1",
      promptTemplateId: "demo-prompt-prod-1",
      skillPackageIds: ["demo-skill-prod-1"],
      moduleTemplateId: "demo-template-prod-1",
    },
    candidateBinding: {
      lane: "candidate",
      modelId: "demo-model-candidate-1",
      runtimeId: "demo-runtime-prod-1",
      promptTemplateId: "demo-prompt-prod-1",
      skillPackageIds: ["demo-skill-prod-1"],
      moduleTemplateId: "demo-template-prod-1",
    },
  });

  assert.equal(result.run.id, "run-2");
  assert.equal(result.overview.selectedSuiteId, "suite-1");
  assert.equal(result.overview.selectedRunId, "run-2");
  assert.equal(result.overview.runItems[0]?.id, "run-item-2");
  assert.equal(
    result.overview.sampleSetItems[0]?.reviewed_case_snapshot_id,
    "reviewed-case-snapshot-2",
  );
  assert.deepEqual(result.overview.selectedRunEvidence, []);
  assert.equal(result.overview.selectedRunFinalization, null);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/verification-ops/evaluation-runs",
      "GET /api/v1/verification-ops/check-profiles",
      "GET /api/v1/verification-ops/release-check-profiles",
      "GET /api/v1/verification-ops/evaluation-sample-sets",
      "GET /api/v1/verification-ops/evaluation-suites",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/runs",
      "GET /api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items",
      "GET /api/v1/verification-ops/evaluation-runs/run-2/items",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/finalized-results",
    ],
  );
});

test("evaluation workbench controller records a run item result and reloads the selected run overview", async () => {
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
        input.url === "/api/v1/verification-ops/evaluation-run-items/run-item-2/result"
      ) {
        return {
          status: 200,
          body: {
            id: "run-item-2",
            evaluation_run_id: "run-2",
            sample_set_item_id: "sample-item-2",
            lane: "candidate",
            result_asset_id: "human-final-demo-1",
            hard_gate_passed: true,
            weighted_score: 97,
            diff_summary: "Candidate improved section normalization.",
            requires_human_review: false,
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
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "running",
              evidence_ids: [],
              started_at: "2026-03-31T13:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/items") {
        return {
          status: 200,
          body: [
            {
              id: "run-item-2",
              evaluation_run_id: "run-2",
              sample_set_item_id: "sample-item-2",
              lane: "candidate",
              result_asset_id: "human-final-demo-1",
              hard_gate_passed: true,
              weighted_score: 97,
              diff_summary: "Candidate improved section normalization.",
              requires_human_review: false,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/finalized-result") {
        return {
          status: 200,
          body: null as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-1/finalized-results") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items") {
        return {
          status: 200,
          body: [
            {
              id: "sample-item-2",
              sample_set_id: "sample-set-1",
              manuscript_id: "manuscript-2",
              snapshot_asset_id: "snapshot-asset-2",
              reviewed_case_snapshot_id: "reviewed-case-snapshot-2",
              module: "editing",
              manuscript_type: "review",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.recordRunItemResultAndReload({
    actorRole: "admin",
    suiteId: "suite-1",
    runId: "run-2",
    runItemId: "run-item-2",
    resultAssetId: "human-final-demo-1",
    hardGatePassed: true,
    weightedScore: 97,
    diffSummary: "Candidate improved section normalization.",
    requiresHumanReview: false,
  });

  assert.equal(result.runItem.id, "run-item-2");
  assert.equal(result.overview.selectedRunId, "run-2");
  assert.equal(result.overview.runItems[0]?.weighted_score, 97);
  assert.equal(result.overview.sampleSetItems[0]?.id, "sample-item-2");
  assert.deepEqual(result.overview.selectedRunEvidence, []);
  assert.equal(result.overview.selectedRunFinalization, null);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/verification-ops/evaluation-run-items/run-item-2/result",
      "GET /api/v1/verification-ops/check-profiles",
      "GET /api/v1/verification-ops/release-check-profiles",
      "GET /api/v1/verification-ops/evaluation-sample-sets",
      "GET /api/v1/verification-ops/evaluation-suites",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/runs",
      "GET /api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items",
      "GET /api/v1/verification-ops/evaluation-runs/run-2/items",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/finalized-results",
    ],
  );
});

test("evaluation workbench controller records evidence, finalizes the run, and returns recommendation state", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createEvaluationWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/verification-ops/evidence") {
        return {
          status: 201,
          body: {
            id: "evidence-2",
            kind: "url",
            label: "Browser QA proof",
            uri: "https://example.test/browser-qa",
            created_at: "2026-03-31T13:15:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/verification-ops/evaluation-runs/run-2/complete"
      ) {
        return {
          status: 200,
          body: {
            id: "run-2",
            suite_id: "suite-1",
            sample_set_id: "sample-set-1",
            run_item_count: 1,
            status: "passed",
            evidence_ids: ["evidence-2"],
            started_at: "2026-03-31T13:00:00.000Z",
            finished_at: "2026-03-31T13:18:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/verification-ops/evaluation-runs/run-2/finalize"
      ) {
        return {
          status: 200,
          body: {
            run: {
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-2"],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:18:00.000Z",
            },
            evidence_pack: {
              id: "pack-1",
              experiment_run_id: "run-2",
              summary_status: "recommended",
              score_summary: "Candidate weighted score 97.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
            recommendation: {
              id: "recommendation-1",
              experiment_run_id: "run-2",
              evidence_pack_id: "pack-1",
              status: "recommended",
              decision_reason: "All hard gates passed with strong score.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
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
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-2"],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:18:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/items") {
        return {
          status: 200,
          body: [
            {
              id: "run-item-2",
              evaluation_run_id: "run-2",
              sample_set_item_id: "sample-item-2",
              lane: "candidate",
              result_asset_id: "human-final-demo-1",
              hard_gate_passed: true,
              weighted_score: 97,
              requires_human_review: false,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/evidence") {
        return {
          status: 200,
          body: [
            {
              id: "evidence-2",
              kind: "url",
              label: "Browser QA proof",
              uri: "https://example.test/browser-qa",
              created_at: "2026-03-31T13:15:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/finalized-result") {
        return {
          status: 200,
          body: {
            run: {
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-2"],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:18:00.000Z",
            },
            evidence_pack: {
              id: "pack-1",
              experiment_run_id: "run-2",
              summary_status: "recommended",
              score_summary: "Candidate weighted score 97.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
            recommendation: {
              id: "recommendation-1",
              experiment_run_id: "run-2",
              evidence_pack_id: "pack-1",
              status: "recommended",
              decision_reason: "All hard gates passed with strong score.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-1/finalized-results") {
        return {
          status: 200,
          body: [
            {
              run: {
                id: "run-2",
                suite_id: "suite-1",
                sample_set_id: "sample-set-1",
                run_item_count: 1,
                status: "passed",
                evidence_ids: ["evidence-2"],
                started_at: "2026-03-31T13:00:00.000Z",
                finished_at: "2026-03-31T13:18:00.000Z",
              },
              evidence_pack: {
                id: "pack-1",
                experiment_run_id: "run-2",
                summary_status: "recommended",
                score_summary: "Candidate weighted score 97.",
                created_at: "2026-03-31T13:18:30.000Z",
              },
              recommendation: {
                id: "recommendation-1",
                experiment_run_id: "run-2",
                evidence_pack_id: "pack-1",
                status: "recommended",
                decision_reason: "All hard gates passed with strong score.",
                created_at: "2026-03-31T13:18:30.000Z",
              },
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items") {
        return {
          status: 200,
          body: [
            {
              id: "sample-item-2",
              sample_set_id: "sample-set-1",
              manuscript_id: "manuscript-2",
              snapshot_asset_id: "snapshot-asset-2",
              reviewed_case_snapshot_id: "reviewed-case-snapshot-2",
              module: "editing",
              manuscript_type: "review",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.completeRunWithEvidenceAndFinalize({
    actorRole: "admin",
    suiteId: "suite-1",
    runId: "run-2",
    status: "passed",
    evidence: {
      kind: "url",
      label: "Browser QA proof",
      uri: "https://example.test/browser-qa",
    },
  });

  assert.equal(result.evidence?.id, "evidence-2");
  assert.equal(result.finalized.evidence_pack.id, "pack-1");
  assert.equal(result.finalized.recommendation.status, "recommended");
  assert.equal(result.overview.selectedRunId, "run-2");
  assert.equal(
    result.overview.sampleSetItems[0]?.reviewed_case_snapshot_id,
    "reviewed-case-snapshot-2",
  );
  assert.equal(result.overview.selectedRunEvidence[0]?.label, "Browser QA proof");
  assert.equal(result.overview.selectedRunFinalization?.evidence_pack.id, "pack-1");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/verification-ops/evidence",
      "POST /api/v1/verification-ops/evaluation-runs/run-2/complete",
      "POST /api/v1/verification-ops/evaluation-runs/run-2/finalize",
      "GET /api/v1/verification-ops/check-profiles",
      "GET /api/v1/verification-ops/release-check-profiles",
      "GET /api/v1/verification-ops/evaluation-sample-sets",
      "GET /api/v1/verification-ops/evaluation-suites",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/runs",
      "GET /api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items",
      "GET /api/v1/verification-ops/evaluation-runs/run-2/items",
      "GET /api/v1/verification-ops/evaluation-runs/run-2/evidence",
      "GET /api/v1/verification-ops/evaluation-suites/suite-1/finalized-results",
    ],
  );
});

test("evaluation workbench controller records artifact evidence before finalizing the run", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createEvaluationWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/verification-ops/evidence") {
        return {
          status: 201,
          body: {
            id: "evidence-artifact-1",
            kind: "artifact",
            label: "Result asset evidence",
            artifact_asset_id: "human-final-demo-1",
            created_at: "2026-03-31T13:15:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/verification-ops/evaluation-runs/run-2/complete"
      ) {
        return {
          status: 200,
          body: {
            id: "run-2",
            suite_id: "suite-1",
            sample_set_id: "sample-set-1",
            run_item_count: 1,
            status: "passed",
            evidence_ids: ["evidence-artifact-1"],
            started_at: "2026-03-31T13:00:00.000Z",
            finished_at: "2026-03-31T13:18:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/verification-ops/evaluation-runs/run-2/finalize"
      ) {
        return {
          status: 200,
          body: {
            run: {
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-artifact-1"],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:18:00.000Z",
            },
            evidence_pack: {
              id: "pack-artifact-1",
              experiment_run_id: "run-2",
              summary_status: "recommended",
              score_summary: "Artifact-backed verification remained stable.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
            recommendation: {
              id: "recommendation-artifact-1",
              experiment_run_id: "run-2",
              evidence_pack_id: "pack-artifact-1",
              status: "recommended",
              decision_reason: "Artifact evidence confirms the governed output.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
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
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-artifact-1"],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:18:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/items") {
        return {
          status: 200,
          body: [
            {
              id: "run-item-2",
              evaluation_run_id: "run-2",
              sample_set_item_id: "sample-item-2",
              lane: "candidate",
              result_asset_id: "human-final-demo-1",
              hard_gate_passed: true,
              weighted_score: 97,
              requires_human_review: false,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/evidence") {
        return {
          status: 200,
          body: [
            {
              id: "evidence-artifact-1",
              kind: "artifact",
              label: "Result asset evidence",
              artifact_asset_id: "human-final-demo-1",
              created_at: "2026-03-31T13:15:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/finalized-result") {
        return {
          status: 200,
          body: {
            run: {
              id: "run-2",
              suite_id: "suite-1",
              sample_set_id: "sample-set-1",
              run_item_count: 1,
              status: "passed",
              evidence_ids: ["evidence-artifact-1"],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:18:00.000Z",
            },
            evidence_pack: {
              id: "pack-artifact-1",
              experiment_run_id: "run-2",
              summary_status: "recommended",
              score_summary: "Artifact-backed verification remained stable.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
            recommendation: {
              id: "recommendation-artifact-1",
              experiment_run_id: "run-2",
              evidence_pack_id: "pack-artifact-1",
              status: "recommended",
              decision_reason: "Artifact evidence confirms the governed output.",
              created_at: "2026-03-31T13:18:30.000Z",
            },
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-1/finalized-results") {
        return {
          status: 200,
          body: [
            {
              run: {
                id: "run-2",
                suite_id: "suite-1",
                sample_set_id: "sample-set-1",
                run_item_count: 1,
                status: "passed",
                evidence_ids: ["evidence-artifact-1"],
                started_at: "2026-03-31T13:00:00.000Z",
                finished_at: "2026-03-31T13:18:00.000Z",
              },
              evidence_pack: {
                id: "pack-artifact-1",
                experiment_run_id: "run-2",
                summary_status: "recommended",
                score_summary: "Artifact-backed verification remained stable.",
                created_at: "2026-03-31T13:18:30.000Z",
              },
              recommendation: {
                id: "recommendation-artifact-1",
                experiment_run_id: "run-2",
                evidence_pack_id: "pack-artifact-1",
                status: "recommended",
                decision_reason: "Artifact evidence confirms the governed output.",
                created_at: "2026-03-31T13:18:30.000Z",
              },
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items") {
        return {
          status: 200,
          body: [
            {
              id: "sample-item-2",
              sample_set_id: "sample-set-1",
              manuscript_id: "manuscript-2",
              snapshot_asset_id: "snapshot-asset-2",
              reviewed_case_snapshot_id: "reviewed-case-snapshot-2",
              module: "editing",
              manuscript_type: "review",
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.completeRunWithEvidenceAndFinalize({
    actorRole: "admin",
    suiteId: "suite-1",
    runId: "run-2",
    status: "passed",
    evidence: {
      kind: "artifact",
      label: "Result asset evidence",
      artifactAssetId: "human-final-demo-1",
    },
  });

  assert.equal(result.evidence?.id, "evidence-artifact-1");
  assert.equal(result.evidence?.kind, "artifact");
  assert.equal(result.evidence?.artifact_asset_id, "human-final-demo-1");
  assert.equal(result.overview.selectedRunEvidence[0]?.artifact_asset_id, "human-final-demo-1");
  assert.deepEqual(requests[0]?.body, {
    actorRole: "admin",
    input: {
      kind: "artifact",
      label: "Result asset evidence",
      uri: undefined,
      artifactAssetId: "human-final-demo-1",
      checkProfileId: undefined,
    },
  });
});

test("evaluation workbench controller creates a governed learning candidate from a finalized run", async () => {
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
        input.url === "/api/v1/verification-ops/evaluation-runs/run-2/learning-candidates"
      ) {
        return {
          status: 201,
          body: {
            id: "candidate-1",
            type: "prompt_optimization_candidate",
            status: "pending_review",
            module: "editing",
            manuscript_type: "review",
            governed_provenance_kind: "evaluation_experiment",
            title: "Promote editing prompt",
            proposal_text: "Promote the candidate binding after evaluation approval.",
            created_by: "dev-admin",
            created_at: "2026-03-31T13:19:00.000Z",
            updated_at: "2026-03-31T13:19:00.000Z",
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const learningCandidate = await controller.createLearningCandidateFromEvaluation({
    actorRole: "admin",
    runId: "run-2",
    evidencePackId: "pack-1",
    reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
    candidateType: "prompt_optimization_candidate",
    title: "Promote editing prompt",
    proposalText: "Promote the candidate binding after evaluation approval.",
    createdBy: "admin-1",
    sourceAssetId: "human-final-demo-1",
  });

  assert.equal(learningCandidate.id, "candidate-1");
  assert.equal(learningCandidate.status, "pending_review");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    ["POST /api/v1/verification-ops/evaluation-runs/run-2/learning-candidates"],
  );
});

test("evaluation workbench controller can preselect the newest run for a handed-off manuscript", async () => {
  const controller = createEvaluationWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
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
          body: [
            {
              id: "sample-set-1",
              name: "Screening Samples",
              module: "screening",
              manuscript_types: ["review"],
              sample_count: 1,
              source_policy: {
                source_kind: "reviewed_case_snapshot",
                requires_deidentification_pass: true,
                requires_human_final_asset: true,
              },
              status: "published",
              admin_only: true,
            },
            {
              id: "sample-set-2",
              name: "Editing Samples",
              module: "editing",
              manuscript_types: ["clinical_study"],
              sample_count: 1,
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
              name: "Screening Regression",
              suite_type: "regression",
              status: "active",
              verification_check_profile_ids: [],
              module_scope: ["screening"],
              supports_ab_comparison: true,
              admin_only: true,
            },
            {
              id: "suite-2",
              name: "Editing Regression",
              suite_type: "regression",
              status: "active",
              verification_check_profile_ids: [],
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
              run_item_count: 1,
              status: "passed",
              evidence_ids: [],
              started_at: "2026-03-31T12:00:00.000Z",
              finished_at: "2026-03-31T12:10:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-2/runs") {
        return {
          status: 200,
          body: [
            {
              id: "run-3",
              suite_id: "suite-2",
              sample_set_id: "sample-set-2",
              run_item_count: 1,
              status: "passed",
              evidence_ids: [],
              started_at: "2026-03-31T14:00:00.000Z",
              finished_at: "2026-03-31T14:20:00.000Z",
            },
            {
              id: "run-2",
              suite_id: "suite-2",
              sample_set_id: "sample-set-2",
              run_item_count: 1,
              status: "passed",
              evidence_ids: [],
              started_at: "2026-03-31T13:00:00.000Z",
              finished_at: "2026-03-31T13:20:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets/sample-set-1/items") {
        return {
          status: 200,
          body: [
            {
              id: "sample-item-1",
              sample_set_id: "sample-set-1",
              manuscript_id: "manuscript-other-1",
              snapshot_asset_id: "snapshot-asset-1",
              reviewed_case_snapshot_id: "reviewed-case-snapshot-1",
              module: "screening",
              manuscript_type: "review",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-sample-sets/sample-set-2/items") {
        return {
          status: 200,
          body: [
            {
              id: "sample-item-2",
              sample_set_id: "sample-set-2",
              manuscript_id: "manuscript-target-1",
              snapshot_asset_id: "snapshot-asset-2",
              reviewed_case_snapshot_id: "reviewed-case-snapshot-2",
              module: "editing",
              manuscript_type: "clinical_study",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-2/items") {
        return {
          status: 200,
          body: [
            {
              id: "run-item-2",
              evaluation_run_id: "run-2",
              sample_set_item_id: "sample-item-2",
              lane: "candidate",
              result_asset_id: "asset-2",
              hard_gate_passed: true,
              weighted_score: 97,
              requires_human_review: false,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-3/items") {
        return {
          status: 200,
          body: [
            {
              id: "run-item-3",
              evaluation_run_id: "run-3",
              sample_set_item_id: "sample-item-2",
              lane: "candidate",
              result_asset_id: "asset-3",
              hard_gate_passed: true,
              weighted_score: 98,
              requires_human_review: false,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-2/finalized-results") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview({
    manuscriptId: "manuscript-target-1",
  } as never);
  const manuscriptContext = (overview as never as {
    manuscriptContext?: {
      manuscriptId?: string;
      matchedSuiteId?: string | null;
      matchedRunId?: string | null;
    } | null;
  }).manuscriptContext;

  assert.equal(overview.selectedSuiteId, "suite-2");
  assert.equal(overview.selectedRunId, "run-3");
  assert.equal(overview.sampleSetItems[0]?.manuscript_id, "manuscript-target-1");
  assert.equal(manuscriptContext?.manuscriptId, "manuscript-target-1");
  assert.equal(manuscriptContext?.matchedSuiteId, "suite-2");
  assert.equal(manuscriptContext?.matchedRunId, "run-3");
  assert.deepEqual(manuscriptContext?.matchedHistoryRunIds, ["run-3", "run-2"]);
});

test("evaluation workbench controller matches governed-source runs for handed-off manuscripts", async () => {
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
              id: "suite-governed",
              name: "Editing Governed Runs",
              suite_type: "release_gate",
              status: "active",
              verification_check_profile_ids: [],
              module_scope: ["editing"],
              supports_ab_comparison: true,
              admin_only: true,
            },
            {
              id: "suite-other",
              name: "Screening Governed Runs",
              suite_type: "release_gate",
              status: "active",
              verification_check_profile_ids: [],
              module_scope: ["screening"],
              supports_ab_comparison: true,
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-governed/runs") {
        return {
          status: 200,
          body: [
            {
              id: "run-governed-newest",
              suite_id: "suite-governed",
              governed_source: {
                source_kind: "governed_module_execution",
                manuscript_id: "manuscript-target-1",
                source_module: "editing",
                agent_execution_log_id: "execution-log-2",
                execution_snapshot_id: "execution-snapshot-2",
                output_asset_id: "output-asset-2",
              },
              run_item_count: 0,
              status: "queued",
              evidence_ids: [],
              started_at: "2026-04-03T04:10:00.000Z",
            },
            {
              id: "run-governed-older",
              suite_id: "suite-governed",
              governed_source: {
                source_kind: "governed_module_execution",
                manuscript_id: "manuscript-target-1",
                source_module: "editing",
                agent_execution_log_id: "execution-log-1",
                execution_snapshot_id: "execution-snapshot-1",
                output_asset_id: "output-asset-1",
              },
              run_item_count: 0,
              status: "queued",
              evidence_ids: [],
              started_at: "2026-04-03T03:10:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-other/runs") {
        return {
          status: 200,
          body: [
            {
              id: "run-other",
              suite_id: "suite-other",
              governed_source: {
                source_kind: "governed_module_execution",
                manuscript_id: "manuscript-other-1",
                source_module: "screening",
                agent_execution_log_id: "execution-log-other",
                execution_snapshot_id: "execution-snapshot-other",
                output_asset_id: "output-asset-other",
              },
              run_item_count: 0,
              status: "queued",
              evidence_ids: [],
              started_at: "2026-04-03T02:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-runs/run-governed-newest/items") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evaluation-suites/suite-governed/finalized-results") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview({
    manuscriptId: "manuscript-target-1",
  } as never);
  const manuscriptContext = (overview as never as {
    manuscriptContext?: {
      manuscriptId?: string;
      matchedSuiteId?: string | null;
      matchedRunId?: string | null;
      matchedHistoryRunIds?: string[];
    } | null;
  }).manuscriptContext;

  assert.equal(overview.selectedSuiteId, "suite-governed");
  assert.equal(overview.selectedRunId, "run-governed-newest");
  assert.equal(overview.runItems.length, 0);
  assert.equal(overview.sampleSetItems.length, 0);
  assert.equal(manuscriptContext?.manuscriptId, "manuscript-target-1");
  assert.equal(manuscriptContext?.matchedSuiteId, "suite-governed");
  assert.equal(manuscriptContext?.matchedRunId, "run-governed-newest");
  assert.deepEqual(manuscriptContext?.matchedHistoryRunIds, [
    "run-governed-newest",
    "run-governed-older",
  ]);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/verification-ops/check-profiles",
      "GET /api/v1/verification-ops/release-check-profiles",
      "GET /api/v1/verification-ops/evaluation-sample-sets",
      "GET /api/v1/verification-ops/evaluation-suites",
      "GET /api/v1/verification-ops/evaluation-suites/suite-governed/runs",
      "GET /api/v1/verification-ops/evaluation-suites/suite-other/runs",
      "GET /api/v1/verification-ops/evaluation-suites/suite-governed/runs",
      "GET /api/v1/verification-ops/evaluation-runs/run-governed-newest/items",
      "GET /api/v1/verification-ops/evaluation-suites/suite-governed/finalized-results",
    ],
  );
});
