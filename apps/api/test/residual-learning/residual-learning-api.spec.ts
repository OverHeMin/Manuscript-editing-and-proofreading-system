import test from "node:test";
import assert from "node:assert/strict";
import { createResidualLearningApi } from "../../src/modules/residual-learning/residual-learning-api.ts";
import { InMemoryResidualIssueRepository } from "../../src/modules/residual-learning/in-memory-residual-learning-repository.ts";
import { ResidualLearningService } from "../../src/modules/residual-learning/residual-learning-service.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { VerificationOpsService } from "../../src/modules/verification-ops/verification-ops-service.ts";

test("residual learning api lists, fetches, and validates residual issues through Harness", async () => {
  const ids = [
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
    now: () => new Date("2026-04-18T12:00:00.000Z"),
  });
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    toolGatewayRepository,
    residualLearningService,
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a verification ops id to be available.");
      return value;
    },
    now: () => new Date("2026-04-18T12:00:00.000Z"),
    governedRunCheckExecutor: async ({
      checkProfile,
      governedSource,
    }: {
      checkProfile: { check_type: string; name: string };
      governedSource: { output_asset_id: string };
    }) => ({
      outcome: "passed",
      evidence: {
        kind: "artifact",
        label: `Automatic governed ${checkProfile.check_type} passed for ${checkProfile.name}`,
        artifactAssetId: governedSource.output_asset_id,
      },
    }),
  });
  const api = createResidualLearningApi({
    residualLearningService,
    verificationOpsService,
  });

  await residualIssueRepository.save({
    id: "residual-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    execution_snapshot_id: "snapshot-1",
    agent_execution_log_id: "execution-log-1",
    output_asset_id: "asset-1",
    issue_type: "terminology_gap",
    source_stage: "model_residual",
    excerpt: "HbA1c naming drift",
    novelty_key: "terminology_gap:hbA1c naming drift",
    recurrence_count: 1,
    model_confidence: 0.82,
    system_confidence_band: "L1_review_pending",
    risk_level: "low",
    recommended_route: "knowledge_candidate",
    status: "validation_pending",
    harness_validation_status: "queued",
    created_at: "2026-04-18T11:50:00.000Z",
    updated_at: "2026-04-18T11:50:00.000Z",
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
  const suite = await verificationOpsService.createEvaluationSuite("admin", {
    name: "Residual API Suite",
    suiteType: "release_gate",
    verificationCheckProfileIds: [publishedCheckProfile.id],
    moduleScope: ["proofreading"],
  });
  const activeSuite = await verificationOpsService.activateEvaluationSuite(
    suite.id,
    "admin",
  );

  const listed = await api.listIssues();
  assert.equal(listed.status, 200);
  assert.equal(listed.body[0]?.id, "residual-1");

  const fetched = await api.getIssue({ issueId: "residual-1" });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.recommended_route, "knowledge_candidate");

  const validated = await api.validateIssue({
    issueId: "residual-1",
    actorRole: "admin",
    suiteIds: [activeSuite.id],
  });
  assert.equal(validated.status, 200);
  assert.equal(validated.body.run.status, "passed");
  assert.equal(validated.body.issue.harness_validation_status, "passed");
  assert.equal(validated.body.issue.status, "candidate_ready");
});
