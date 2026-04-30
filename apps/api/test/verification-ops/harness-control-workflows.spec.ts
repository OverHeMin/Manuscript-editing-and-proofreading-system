import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryReviewedCaseSnapshotRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { createVerificationOpsApi } from "../../src/modules/verification-ops/verification-ops-api.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { VerificationOpsService } from "../../src/modules/verification-ops/verification-ops-service.ts";

function createHarnessWorkflowHarness() {
  const ids = [
    "sample-set-1",
    "sample-set-item-1",
    "check-profile-1",
    "release-profile-1",
    "suite-ab-1",
    "suite-regression-1",
    "suite-release-1",
    "run-1",
    "run-item-1",
    "evidence-1",
    "evidence-pack-1",
    "recommendation-1",
    "run-2",
    "run-item-2",
    "evidence-2",
    "evidence-pack-2",
    "recommendation-2",
    "run-3",
    "evidence-3",
    "evidence-pack-3",
    "recommendation-3",
  ];
  const reviewedCaseSnapshotRepository =
    new InMemoryReviewedCaseSnapshotRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    reviewedCaseSnapshotRepository,
    toolGatewayRepository: new InMemoryToolGatewayRepository(),
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a harness workflow id.");
      return value;
    },
    now: () => new Date("2026-04-30T10:00:00.000Z"),
  });

  return {
    verificationOpsRepository,
    verificationOpsService,
    verificationOpsApi: createVerificationOpsApi({
      verificationOpsService,
    }),
    reviewedCaseSnapshotRepository,
  };
}

async function seedHarnessWorkflowRegistry() {
  const harness = createHarnessWorkflowHarness();

  await harness.reviewedCaseSnapshotRepository.save({
    id: "snapshot-1",
    manuscript_id: "manuscript-1",
    module: "editing",
    manuscript_type: "clinical_study",
    human_final_asset_id: "human-final-1",
    deidentification_passed: true,
    snapshot_asset_id: "snapshot-asset-1",
    created_by: "editor-1",
    created_at: "2026-04-30T09:00:00.000Z",
  });

  const sampleSet = await harness.verificationOpsApi.createEvaluationSampleSet({
    actorRole: "admin",
    input: {
      name: "Editing validation samples",
      module: "editing",
      sampleItemInputs: [
        {
          reviewedCaseSnapshotId: "snapshot-1",
          riskTags: ["structure"],
        },
      ],
    },
  });
  await harness.verificationOpsApi.publishEvaluationSampleSet({
    actorRole: "admin",
    sampleSetId: sampleSet.body.id,
  });

  const checkProfile = await harness.verificationOpsApi.createVerificationCheckProfile({
    actorRole: "admin",
    input: {
      name: "Harness Browser QA",
      checkType: "browser_qa",
    },
  });
  await harness.verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: checkProfile.body.id,
  });

  const releaseProfile = await harness.verificationOpsApi.createReleaseCheckProfile({
    actorRole: "admin",
    input: {
      name: "Editing release gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [checkProfile.body.id],
    },
  });
  await harness.verificationOpsApi.publishReleaseCheckProfile({
    actorRole: "admin",
    profileId: releaseProfile.body.id,
  });

  const abSuite = await harness.verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing A/B acceptance",
      suiteType: "regression",
      verificationCheckProfileIds: [checkProfile.body.id],
      moduleScope: ["editing"],
      requiresProductionBaseline: true,
      supportsAbComparison: true,
    },
  });
  await harness.verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: abSuite.body.id,
  });

  const regressionSuite = await harness.verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing active regression",
      suiteType: "regression",
      verificationCheckProfileIds: [checkProfile.body.id],
      moduleScope: ["editing"],
      requiresProductionBaseline: false,
      supportsAbComparison: false,
    },
  });
  await harness.verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: regressionSuite.body.id,
  });

  const releaseSuite = await harness.verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing release gate suite",
      suiteType: "release_gate",
      verificationCheckProfileIds: [checkProfile.body.id],
      moduleScope: ["editing"],
      requiresProductionBaseline: true,
      supportsAbComparison: true,
    },
  });
  await harness.verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: releaseSuite.body.id,
  });

  return {
    ...harness,
    sampleSet: sampleSet.body,
    abSuite: abSuite.body,
    regressionSuite: regressionSuite.body,
    releaseSuite: releaseSuite.body,
    releaseProfile: releaseProfile.body,
  };
}

const activeBinding = {
  lane: "baseline" as const,
  executionProfileId: "profile-active-1",
  runtimeBindingId: "binding-active-1",
  modelRoutingPolicyVersionId: "routing-active-1",
  retrievalPresetId: "retrieval-active-1",
  manualReviewPolicyId: "manual-review-active-1",
  modelId: "model-active-1",
  runtimeId: "runtime-active-1",
  promptTemplateId: "prompt-active-1",
  skillPackageIds: ["skill-active-1"],
  qualityPackageVersionIds: ["quality-active-1"],
  moduleTemplateId: "template-active-1",
};

const candidateBinding = {
  ...activeBinding,
  lane: "candidate" as const,
  runtimeBindingId: "binding-candidate-1",
};

test("harness A/B acceptance creates a candidate-vs-active run and returns evidence-backed needs-review finalization", async () => {
  const { verificationOpsApi, abSuite, sampleSet } =
    await seedHarnessWorkflowRegistry();

  const result = await verificationOpsApi.runHarnessAbAcceptance({
    actorRole: "admin",
    input: {
      suiteId: abSuite.id,
      sampleSetId: sampleSet.id,
      activeBinding,
      candidateBinding,
    },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.mode, "ab_acceptance");
  assert.equal(result.body.run.baseline_binding?.runtime_binding_id, "binding-active-1");
  assert.equal(result.body.run.candidate_binding?.runtime_binding_id, "binding-candidate-1");
  assert.equal(result.body.run.status, "passed");
  assert.equal(result.body.evidence.length, 1);
  assert.equal(result.body.finalized.recommendation.status, "needs_review");
  assert.match(result.body.summary, /candidate vs active/i);
});

test("harness active regression creates an active-only finalized run without candidate binding", async () => {
  const { verificationOpsApi, regressionSuite, sampleSet } =
    await seedHarnessWorkflowRegistry();

  const result = await verificationOpsApi.runHarnessActiveRegression({
    actorRole: "admin",
    input: {
      suiteId: regressionSuite.id,
      sampleSetId: sampleSet.id,
      activeBinding: {
        ...activeBinding,
        lane: "candidate",
      },
    },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.mode, "regression_inspection");
  assert.equal(result.body.run.baseline_binding, undefined);
  assert.equal(result.body.run.candidate_binding?.runtime_binding_id, "binding-active-1");
  assert.equal(result.body.finalized.recommendation.status, "needs_review");
});

test("harness release gate derives its result from the selected release profile and finalized evidence", async () => {
  const { verificationOpsApi, releaseSuite, sampleSet, releaseProfile } =
    await seedHarnessWorkflowRegistry();

  const result = await verificationOpsApi.runHarnessReleaseGate({
    actorRole: "admin",
    input: {
      suiteId: releaseSuite.id,
      sampleSetId: sampleSet.id,
      releaseCheckProfileId: releaseProfile.id,
      activeBinding,
      candidateBinding,
    },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.mode, "release_gate");
  assert.equal(result.body.run.release_check_profile_id, releaseProfile.id);
  assert.ok(result.body.release_gate);
  assert.equal(result.body.release_gate.profile_id, releaseProfile.id);
  assert.equal(result.body.release_gate.decision, "needs_review");
  assert.equal(result.body.finalized.evidence_pack.experiment_run_id, result.body.run.id);
});

test("harness manuscript diagnosis reports hit and miss context for sample-set and governed runs", async () => {
  const { verificationOpsApi, abSuite, sampleSet } =
    await seedHarnessWorkflowRegistry();
  await verificationOpsApi.runHarnessAbAcceptance({
    actorRole: "admin",
    input: {
      suiteId: abSuite.id,
      sampleSetId: sampleSet.id,
      activeBinding,
      candidateBinding,
    },
  });

  const hit = await verificationOpsApi.diagnoseHarnessManuscript({
    actorRole: "admin",
    input: {
      manuscriptId: "manuscript-1",
    },
  });
  const miss = await verificationOpsApi.diagnoseHarnessManuscript({
    actorRole: "admin",
    input: {
      manuscriptId: "unknown-manuscript",
    },
  });

  assert.equal(hit.status, 200);
  assert.equal(hit.body.status, "hit");
  assert.deepEqual(hit.body.matched_run_ids, ["run-1"]);
  assert.deepEqual(hit.body.sample_contexts.map((item) => item.sample_set_id), [
    sampleSet.id,
  ]);
  assert.equal(miss.body.status, "miss");
  assert.deepEqual(miss.body.matched_run_ids, []);
});
