import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import {
  PostgresVerificationOpsRepository,
} from "../../src/modules/verification-ops/postgres-verification-ops-repository.ts";
import type {
  EvaluationEvidencePackRecord,
  EvaluationPromotionRecommendationRecord,
  EvaluationRunRecord,
  EvaluationRunItemRecord,
  EvaluationSampleSetItemRecord,
  EvaluationSampleSetRecord,
  EvaluationSuiteRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "../../src/modules/verification-ops/verification-ops-record.ts";
import {
  runMigrateProcess,
} from "../database/support/migrate-process.ts";
import {
  withTemporaryDatabase,
} from "../database/support/postgres.ts";

test("postgres verification ops repository persists and reloads governed verification history", { concurrency: false }, async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migration = runMigrateProcess(databaseUrl);
    assert.equal(
      migration.status,
      0,
      `Expected migrations to succeed.\n${migration.stdout}\n${migration.stderr}`,
    );

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const repository = new PostgresVerificationOpsRepository({ client });

      const sampleSet: EvaluationSampleSetRecord = {
        id: "sample-set-1",
        name: "Editing Regression Set",
        module: "editing",
        manuscript_types: ["clinical_study", "review"],
        risk_tags: ["structure", "terminology"],
        sample_count: 2,
        source_policy: {
          source_kind: "reviewed_case_snapshot",
          requires_deidentification_pass: true,
          requires_human_final_asset: true,
        },
        status: "published",
        admin_only: true,
      };
      const sampleSetItems: EvaluationSampleSetItemRecord[] = [
        {
          id: "sample-set-item-1",
          sample_set_id: sampleSet.id,
          manuscript_id: "manuscript-1",
          snapshot_asset_id: "snapshot-asset-1",
          reviewed_case_snapshot_id: "reviewed-snapshot-1",
          module: "editing",
          manuscript_type: "clinical_study",
          risk_tags: ["structure"],
        },
        {
          id: "sample-set-item-2",
          sample_set_id: sampleSet.id,
          manuscript_id: "manuscript-2",
          snapshot_asset_id: "snapshot-asset-2",
          reviewed_case_snapshot_id: "reviewed-snapshot-2",
          module: "editing",
          manuscript_type: "review",
        },
      ];
      const verificationProfile: VerificationCheckProfileRecord = {
        id: "check-profile-1",
        name: "Browser QA",
        check_type: "browser_qa",
        status: "published",
        tool_ids: ["tool-1", "tool-2"],
        admin_only: true,
      };
      const releaseProfile: ReleaseCheckProfileRecord = {
        id: "release-profile-1",
        name: "Release Gate",
        check_type: "deploy_verification",
        status: "published",
        verification_check_profile_ids: [verificationProfile.id],
        admin_only: true,
      };
      const suite: EvaluationSuiteRecord = {
        id: "suite-1",
        name: "Editing Regression",
        suite_type: "regression",
        status: "active",
        verification_check_profile_ids: [verificationProfile.id],
        module_scope: ["editing", "proofreading"],
        requires_production_baseline: true,
        supports_ab_comparison: true,
        hard_gate_policy: {
          must_use_deidentified_samples: true,
          requires_parsable_output: true,
        },
        score_weights: {
          structure: 25,
          terminology: 20,
          knowledge_coverage: 20,
          risk_detection: 20,
          human_edit_burden: 10,
          cost_and_latency: 5,
        },
        admin_only: true,
      };
      const evidence: VerificationEvidenceRecord = {
        id: "evidence-1",
        kind: "artifact",
        label: "Regression QA Bundle",
        artifact_asset_id: "artifact-asset-1",
        check_profile_id: verificationProfile.id,
        created_at: "2026-03-29T08:00:00.000Z",
      };
      const run: EvaluationRunRecord = {
        id: "run-1",
        suite_id: suite.id,
        sample_set_id: sampleSet.id,
        baseline_binding: {
          lane: "baseline",
          model_id: "model-prod-1",
          runtime_id: "runtime-prod-1",
          prompt_template_id: "prompt-prod-1",
          skill_package_ids: ["skill-prod-1"],
          module_template_id: "template-prod-1",
        },
        candidate_binding: {
          lane: "candidate",
          model_id: "model-candidate-1",
          runtime_id: "runtime-prod-1",
          prompt_template_id: "prompt-prod-1",
          skill_package_ids: ["skill-prod-1"],
          module_template_id: "template-prod-1",
        },
        release_check_profile_id: releaseProfile.id,
        run_item_count: 2,
        status: "passed",
        evidence_ids: [evidence.id],
        started_at: "2026-03-29T08:10:00.000Z",
        finished_at: "2026-03-29T08:20:00.000Z",
      };
      const runItems: EvaluationRunItemRecord[] = [
        {
          id: "run-item-1",
          evaluation_run_id: run.id,
          sample_set_item_id: sampleSetItems[0]!.id,
          lane: "candidate",
          result_asset_id: "result-asset-1",
          hard_gate_passed: true,
          weighted_score: 94,
          diff_summary: "Improved risk ordering.",
        },
        {
          id: "run-item-2",
          evaluation_run_id: run.id,
          sample_set_item_id: sampleSetItems[1]!.id,
          lane: "candidate",
          hard_gate_passed: false,
          weighted_score: 41,
          failure_kind: "regression_failed",
          failure_reason: "Dropped a required warning.",
          requires_human_review: true,
        },
      ];
      const evidencePack: EvaluationEvidencePackRecord = {
        id: "evidence-pack-1",
        experiment_run_id: run.id,
        summary_status: "needs_review",
        score_summary: "Average weighted score 67.5 across 2 item(s).",
        regression_summary: "1 regression failure detected.",
        failure_summary: "1 hard gate failure recorded.",
        cost_summary: "Cost tracking unavailable.",
        latency_summary: "Latency tracking unavailable.",
        created_at: "2026-03-29T08:25:00.000Z",
      };
      const recommendation: EvaluationPromotionRecommendationRecord = {
        id: "recommendation-1",
        experiment_run_id: run.id,
        evidence_pack_id: evidencePack.id,
        status: "needs_review",
        decision_reason: "Regression failure requires manual review.",
        learning_candidate_ids: ["candidate-1", "candidate-2"],
        created_at: "2026-03-29T08:25:00.000Z",
      };

      await repository.saveEvaluationSampleSet(sampleSet);
      for (const item of sampleSetItems) {
        await repository.saveEvaluationSampleSetItem(item);
      }
      await repository.saveVerificationCheckProfile(verificationProfile);
      await repository.saveReleaseCheckProfile(releaseProfile);
      await repository.saveEvaluationSuite(suite);
      await repository.saveVerificationEvidence(evidence);
      await repository.saveEvaluationRun(run);
      for (const item of runItems) {
        await repository.saveEvaluationRunItem(item);
      }
      await repository.saveEvaluationEvidencePack(evidencePack);
      await repository.saveEvaluationPromotionRecommendation(recommendation);

      assert.deepEqual(
        await repository.findEvaluationSampleSetById(sampleSet.id),
        sampleSet,
      );
      assert.deepEqual(
        await repository.listEvaluationSampleSets(),
        [sampleSet],
      );
      assert.deepEqual(
        await repository.listEvaluationSampleSetItemsBySampleSetId(sampleSet.id),
        sampleSetItems,
      );
      assert.deepEqual(
        await repository.findVerificationCheckProfileById(verificationProfile.id),
        verificationProfile,
      );
      assert.deepEqual(
        await repository.listVerificationCheckProfiles(),
        [verificationProfile],
      );
      assert.deepEqual(
        await repository.findReleaseCheckProfileById(releaseProfile.id),
        releaseProfile,
      );
      assert.deepEqual(
        await repository.listReleaseCheckProfiles(),
        [releaseProfile],
      );
      assert.deepEqual(
        await repository.findEvaluationSuiteById(suite.id),
        suite,
      );
      assert.deepEqual(
        await repository.listEvaluationSuites(),
        [suite],
      );
      assert.deepEqual(
        await repository.findVerificationEvidenceById(evidence.id),
        evidence,
      );
      assert.deepEqual(
        await repository.listVerificationEvidence(),
        [evidence],
      );
      assert.deepEqual(
        await repository.findEvaluationRunById(run.id),
        run,
      );
      assert.deepEqual(
        await repository.listEvaluationRunsBySuiteId(suite.id),
        [run],
      );
      assert.deepEqual(
        await repository.findEvaluationRunItemById(runItems[0]!.id),
        runItems[0],
      );
      assert.deepEqual(
        await repository.listEvaluationRunItemsByRunId(run.id),
        runItems,
      );
      assert.deepEqual(
        await repository.findEvaluationEvidencePackById(evidencePack.id),
        evidencePack,
      );
    } finally {
      await client.end();
    }
  });
});
