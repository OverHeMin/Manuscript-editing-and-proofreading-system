import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryReviewedCaseSnapshotRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { createToolGatewayApi } from "../../src/modules/tool-gateway/tool-gateway-api.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { createVerificationOpsApi } from "../../src/modules/verification-ops/verification-ops-api.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { VerificationOpsService } from "../../src/modules/verification-ops/verification-ops-service.ts";

function createEvaluationRecommendationHarness() {
  const ids = [
    "sample-set-1",
    "sample-set-item-1",
    "check-profile-1",
    "evaluation-suite-1",
    "evaluation-run-1",
    "evaluation-run-item-1",
    "evidence-pack-1",
    "recommendation-1",
    "sample-set-2",
    "sample-set-item-2",
    "check-profile-2",
    "evaluation-suite-2",
    "evaluation-run-2",
    "evaluation-run-item-2",
    "evidence-pack-2",
    "recommendation-2",
  ];
  const toolIds = ["tool-1", "tool-2"];
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const reviewedCaseSnapshotRepository =
    new InMemoryReviewedCaseSnapshotRepository();
  const toolGatewayApi = createToolGatewayApi({
    toolGatewayService: new ToolGatewayService({
      repository: toolGatewayRepository,
      createId: () => {
        const value = toolIds.shift();
        assert.ok(value, "Expected an evaluation recommendation tool id.");
        return value;
      },
    }),
  });
  const verificationOpsApi = createVerificationOpsApi({
    verificationOpsService: new VerificationOpsService({
      repository: new InMemoryVerificationOpsRepository(),
      reviewedCaseSnapshotRepository,
      toolGatewayRepository,
      createId: () => {
        const value = ids.shift();
        assert.ok(value, "Expected an evaluation recommendation id.");
        return value;
      },
      now: () => new Date("2026-03-28T17:00:00.000Z"),
    }),
  });

  return {
    toolGatewayApi,
    verificationOpsApi,
    reviewedCaseSnapshotRepository,
  };
}

async function seedRunForRecommendation() {
  const harness = createEvaluationRecommendationHarness();

  await harness.reviewedCaseSnapshotRepository.save({
    id: "reviewed-snapshot-1",
    manuscript_id: "manuscript-1",
    module: "editing",
    manuscript_type: "clinical_study",
    human_final_asset_id: "human-final-1",
    deidentification_passed: true,
    snapshot_asset_id: "snapshot-asset-1",
    created_by: "editor-1",
    created_at: "2026-03-28T16:50:00.000Z",
  });

  const sampleSet = await harness.verificationOpsApi.createEvaluationSampleSet({
    actorRole: "admin",
    input: {
      name: "Editing Evidence Samples",
      module: "editing",
      sampleItemInputs: [
        {
          reviewedCaseSnapshotId: "reviewed-snapshot-1",
          riskTags: ["risk"],
        },
      ],
    },
  });
  await harness.verificationOpsApi.publishEvaluationSampleSet({
    actorRole: "admin",
    sampleSetId: sampleSet.body.id,
  });

  const browserTool = await harness.toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.browser.qa",
      scope: "browser_qa",
    },
  });

  const checkProfile = await harness.verificationOpsApi.createVerificationCheckProfile({
    actorRole: "admin",
    input: {
      name: "Evidence Browser QA",
      checkType: "browser_qa",
      toolIds: [browserTool.body.id],
    },
  });
  await harness.verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: checkProfile.body.id,
  });

  const suite = await harness.verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Recommendation Suite",
      suiteType: "regression",
      verificationCheckProfileIds: [checkProfile.body.id],
      moduleScope: ["editing"],
      requiresProductionBaseline: true,
      supportsAbComparison: true,
      hardGatePolicy: {
        mustUseDeidentifiedSamples: true,
        requiresParsableOutput: true,
      },
      scoreWeights: {
        structure: 25,
        terminology: 20,
        knowledgeCoverage: 20,
        riskDetection: 20,
        humanEditBurden: 10,
        costAndLatency: 5,
      },
    },
  });
  await harness.verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: suite.body.id,
  });

  const run = await harness.verificationOpsApi.createEvaluationRun({
    actorRole: "admin",
    input: {
      suiteId: suite.body.id,
      sampleSetId: sampleSet.body.id,
      baselineBinding: {
        lane: "baseline",
        modelId: "model-prod-1",
        runtimeId: "runtime-prod-1",
        promptTemplateId: "prompt-prod-1",
        skillPackageIds: ["skill-prod-1"],
        moduleTemplateId: "template-prod-1",
      },
      candidateBinding: {
        lane: "candidate",
        modelId: "model-candidate-1",
        runtimeId: "runtime-prod-1",
        promptTemplateId: "prompt-prod-1",
        skillPackageIds: ["skill-prod-1"],
        moduleTemplateId: "template-prod-1",
      },
    },
  });

  const runItems = await harness.verificationOpsApi.listEvaluationRunItemsByRunId({
    runId: run.body.id,
  });

  return {
    ...harness,
    run,
    runItem: runItems.body[0]!,
  };
}

test("evidence packs summarize regression failures and block recommended outcomes", async () => {
  const { verificationOpsApi, run, runItem } = await seedRunForRecommendation();

  await verificationOpsApi.recordEvaluationRunItemResult({
    actorRole: "admin",
    input: {
      runItemId: runItem.id,
      hardGatePassed: false,
      weightedScore: 41,
      failureKind: "regression_failed",
      failureReason: "Candidate removed a required risk warning.",
      diffSummary: "Baseline kept the warning, candidate removed it.",
      requiresHumanReview: true,
    },
  });

  const finalized = await verificationOpsApi.finalizeEvaluationRun({
    actorRole: "admin",
    runId: run.body.id,
  });

  assert.equal(finalized.status, 200);
  assert.equal(finalized.body.evidence_pack.summary_status, "rejected");
  assert.equal(finalized.body.recommendation.status, "rejected");
  assert.match(
    finalized.body.recommendation.decision_reason ?? "",
    /regression/i,
  );
});

test("incomplete scoring moves evidence packs to needs_review without mutating production state", async () => {
  const { verificationOpsApi, run, runItem } = await seedRunForRecommendation();

  await verificationOpsApi.recordEvaluationRunItemResult({
    actorRole: "admin",
    input: {
      runItemId: runItem.id,
      hardGatePassed: true,
      diffSummary: "Human reviewer noted improvement but score is pending.",
    },
  });

  const finalized = await verificationOpsApi.finalizeEvaluationRun({
    actorRole: "admin",
    runId: run.body.id,
  });

  assert.equal(finalized.body.evidence_pack.summary_status, "needs_review");
  assert.equal(finalized.body.recommendation.status, "needs_review");
  assert.equal(finalized.body.run.status, "queued");
});
