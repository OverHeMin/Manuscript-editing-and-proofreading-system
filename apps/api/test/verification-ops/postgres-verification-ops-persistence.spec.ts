import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresVerificationOpsRepository } from "../../src/modules/verification-ops/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres verification ops repository persists governed evaluation run sources", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });

    try {
      const repository = new PostgresVerificationOpsRepository({ client: pool });

      await repository.saveReleaseCheckProfile({
        id: "release-profile-1",
        name: "Release Gate",
        check_type: "deploy_verification",
        status: "published",
        verification_check_profile_ids: [],
        admin_only: true,
      });

      await repository.saveEvaluationSuite({
        id: "suite-1",
        name: "Editing Regression",
        suite_type: "regression",
        status: "active",
        verification_check_profile_ids: [],
        module_scope: ["editing"],
        requires_production_baseline: false,
        supports_ab_comparison: false,
        hard_gate_policy: {
          must_use_deidentified_samples: true,
          requires_parsable_output: true,
        },
        score_weights: {
          structure: 0.2,
          terminology: 0.2,
          knowledge_coverage: 0.2,
          risk_detection: 0.2,
          human_edit_burden: 0.1,
          cost_and_latency: 0.1,
        },
        admin_only: true,
      });

      await repository.saveEvaluationRun({
        id: "run-1",
        suite_id: "suite-1",
        release_check_profile_id: "release-profile-1",
        run_item_count: 0,
        status: "queued",
        evidence_ids: [],
        started_at: "2026-04-03T09:00:00.000Z",
        governed_source: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-1",
          execution_snapshot_id: "snapshot-1",
          output_asset_id: "asset-1",
        },
      } as any);

      await repository.saveEvaluationRun({
        id: "run-2",
        suite_id: "suite-1",
        run_item_count: 0,
        status: "queued",
        evidence_ids: [],
        started_at: "2026-04-03T10:00:00.000Z",
      } as any);

      const loadedGoverned = (await repository.findEvaluationRunById(
        "run-1",
      )) as any;
      const loadedLegacy = (await repository.findEvaluationRunById("run-2")) as any;
      const listedRuns = (await repository.listEvaluationRunsBySuiteId(
        "suite-1",
      )) as any[];

      assert.deepEqual(loadedGoverned?.governed_source, {
        source_kind: "governed_module_execution",
        manuscript_id: "manuscript-1",
        source_module: "editing",
        agent_execution_log_id: "execution-log-1",
        execution_snapshot_id: "snapshot-1",
        output_asset_id: "asset-1",
      });
      assert.equal(loadedLegacy?.governed_source, undefined);
      assert.deepEqual(
        listedRuns.map((record) => record.governed_source),
        [
          {
            source_kind: "governed_module_execution",
            manuscript_id: "manuscript-1",
            source_module: "editing",
            agent_execution_log_id: "execution-log-1",
            execution_snapshot_id: "snapshot-1",
            output_asset_id: "asset-1",
          },
          undefined,
        ],
      );
    } finally {
      await pool.end();
    }
  });
});
