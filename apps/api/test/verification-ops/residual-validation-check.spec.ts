import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { VerificationOpsService } from "../../src/modules/verification-ops/verification-ops-service.ts";

test("failed residual validation marks the residual issue as validation_failed and blocks candidate-ready progression", async () => {
  const verificationIds = [
    "check-profile-1",
    "evaluation-suite-1",
    "evaluation-run-1",
    "verification-evidence-1",
  ];
  const residualIssueRepository = new InMemoryResidualIssueRepository();
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const residualLearningService = new ResidualLearningService({
    residualIssueRepository,
    createId: () => "residual-generated-1",
    now: () => new Date("2026-04-18T11:00:00.000Z"),
  });
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    toolGatewayRepository,
    residualLearningService,
    createId: () => {
      const value = verificationIds.shift();
      assert.ok(value, "Expected a verification ops id to be available.");
      return value;
    },
    now: () => new Date("2026-04-18T11:00:00.000Z"),
    governedRunCheckExecutor: async ({
      checkProfile,
      governedSource,
    }: {
      checkProfile: { id: string; check_type: string; name: string };
      governedSource: { output_asset_id: string };
    }) => ({
      outcome: "failed",
      evidence: {
        kind: "artifact",
        label: `Automatic governed ${checkProfile.check_type} failed for ${checkProfile.name}`,
        artifactAssetId: governedSource.output_asset_id,
      },
      failureReason: "Synthetic residual validation failure.",
    }),
  });

  await residualIssueRepository.save({
    id: "residual-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    execution_snapshot_id: "snapshot-1",
    output_asset_id: "asset-1",
    issue_type: "unit_expression_gap",
    source_stage: "model_residual",
    excerpt: "5 mg per dL",
    novelty_key: "unit_expression_gap:5 mg per dL",
    recurrence_count: 2,
    model_confidence: 0.86,
    system_confidence_band: "L2_candidate_ready",
    risk_level: "low",
    recommended_route: "rule_candidate",
    status: "validation_pending",
    harness_validation_status: "queued",
    created_at: "2026-04-18T10:55:00.000Z",
    updated_at: "2026-04-18T10:55:00.000Z",
  });

  const checkProfile = await verificationOpsService.createVerificationCheckProfile(
    "admin",
    {
      name: "Residual Validation",
      checkType: "residual_issue_validation",
    },
  );
  const publishedCheckProfile =
    await verificationOpsService.publishVerificationCheckProfile(
      checkProfile.id,
      "admin",
    );
  assert.equal(publishedCheckProfile.check_type, "residual_issue_validation");

  const suite = await verificationOpsService.createEvaluationSuite("admin", {
    name: "Residual Validation Suite",
    suiteType: "release_gate",
    verificationCheckProfileIds: [publishedCheckProfile.id],
    moduleScope: ["proofreading"],
  });
  const activeSuite = await verificationOpsService.activateEvaluationSuite(
    suite.id,
    "admin",
  );

  const [run] = await verificationOpsService.seedGovernedExecutionRuns("admin", {
    suiteIds: [activeSuite.id],
    governedSource: {
      source_kind: "governed_module_execution",
      manuscript_id: "manuscript-1",
      source_module: "proofreading",
      agent_execution_log_id: "execution-log-1",
      execution_snapshot_id: "snapshot-1",
      output_asset_id: "asset-1",
      residual_issue_id: "residual-1",
    },
  });
  assert.equal(run.governed_source?.residual_issue_id, "residual-1");

  const completed = await verificationOpsService.executeSeededGovernedRunChecks(
    "admin",
    {
      runId: run.id,
    },
  );
  assert.equal(completed.status, "failed");

  const updatedIssue = await residualIssueRepository.findById("residual-1");
  assert.equal(updatedIssue?.harness_validation_status, "failed");
  assert.equal(updatedIssue?.status, "validation_failed");
  assert.equal(updatedIssue?.harness_run_id, run.id);
  assert.equal(updatedIssue?.system_confidence_band, "L1_review_pending");
});
