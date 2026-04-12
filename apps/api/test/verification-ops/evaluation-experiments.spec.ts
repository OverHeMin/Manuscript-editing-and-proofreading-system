import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryReviewedCaseSnapshotRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { createToolGatewayApi } from "../../src/modules/tool-gateway/tool-gateway-api.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { createVerificationOpsApi } from "../../src/modules/verification-ops/verification-ops-api.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import {
  EvaluationExperimentBindingError,
  VerificationCheckProfileDependencyError,
  VerificationOpsService,
} from "../../src/modules/verification-ops/verification-ops-service.ts";

function createEvaluationExperimentHarness() {
  const ids = [
    "check-profile-1",
    "sample-set-1",
    "sample-set-item-1",
    "evaluation-suite-1",
    "evaluation-run-1",
    "evaluation-run-item-1",
    "check-profile-2",
    "sample-set-2",
    "sample-set-item-2",
    "evaluation-suite-2",
    "evaluation-run-2",
    "evaluation-run-item-2",
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
        assert.ok(value, "Expected an experiment test tool id to be available.");
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
        assert.ok(value, "Expected an experiment test id to be available.");
        return value;
      },
      now: () => new Date("2026-03-28T16:00:00.000Z"),
    }),
  });

  return {
    toolGatewayApi,
    verificationOpsApi,
    reviewedCaseSnapshotRepository,
  };
}

async function seedPublishedSuiteAndSampleSet() {
  const harness = createEvaluationExperimentHarness();

  await harness.reviewedCaseSnapshotRepository.save({
    id: "reviewed-snapshot-1",
    manuscript_id: "manuscript-1",
    module: "editing",
    manuscript_type: "clinical_study",
    human_final_asset_id: "human-final-1",
    deidentification_passed: true,
    snapshot_asset_id: "snapshot-asset-1",
    created_by: "editor-1",
    created_at: "2026-03-28T15:55:00.000Z",
  });

  const sampleSet = await harness.verificationOpsApi.createEvaluationSampleSet({
    actorRole: "admin",
    input: {
      name: "Editing Regression Samples",
      module: "editing",
      sampleItemInputs: [
        {
          reviewedCaseSnapshotId: "reviewed-snapshot-1",
          riskTags: ["structure"],
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
      name: "Regression Browser QA",
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
      name: "Editing Prompt Regression",
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

  return {
    ...harness,
    sampleSet,
    suite,
  };
}

test("evaluation suites freeze scoring policy and baseline requirements", async () => {
  const { toolGatewayApi, verificationOpsApi } = createEvaluationExperimentHarness();

  const browserTool = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.browser.qa",
      scope: "browser_qa",
    },
  });

  const checkProfile = await verificationOpsApi.createVerificationCheckProfile({
    actorRole: "admin",
    input: {
      name: "Regression Browser QA",
      checkType: "browser_qa",
      toolIds: [browserTool.body.id],
    },
  });

  const publishedCheckProfile = await verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: checkProfile.body.id,
  });

  const created = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Prompt Regression",
      suiteType: "regression",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
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

  assert.equal(created.status, 201);
  assert.equal(created.body.requires_production_baseline, true);
  assert.equal(created.body.supports_ab_comparison, true);
  assert.deepEqual(created.body.hard_gate_policy, {
    must_use_deidentified_samples: true,
    requires_parsable_output: true,
  });
  assert.deepEqual(created.body.score_weights, {
    structure: 25,
    terminology: 20,
    knowledge_coverage: 20,
    risk_detection: 20,
    human_edit_burden: 10,
    cost_and_latency: 5,
  });

  const activated = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: created.body.id,
  });
  assert.equal(activated.body.status, "active");
  assert.equal(activated.body.requires_production_baseline, true);
  assert.equal(activated.body.supports_ab_comparison, true);
});

test("extended evaluation suites stay admin-only and keep published-check gates", async () => {
  const { toolGatewayApi, verificationOpsApi } = createEvaluationExperimentHarness();

  const browserTool = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.browser.qa",
      scope: "browser_qa",
    },
  });

  const draftCheckProfile = await verificationOpsApi.createVerificationCheckProfile({
    actorRole: "admin",
    input: {
      name: "Draft Regression Browser QA",
      checkType: "browser_qa",
      toolIds: [browserTool.body.id],
    },
  });

  await assert.rejects(
    () =>
      verificationOpsApi.createEvaluationSuite({
        actorRole: "editor",
        input: {
          name: "Editing Policy Suite",
          suiteType: "regression",
          verificationCheckProfileIds: [draftCheckProfile.body.id],
          moduleScope: ["editing"],
          requiresProductionBaseline: false,
          supportsAbComparison: false,
          hardGatePolicy: {
            mustUseDeidentifiedSamples: true,
            requiresParsableOutput: false,
          },
          scoreWeights: {
            structure: 40,
            terminology: 20,
            knowledgeCoverage: 20,
            riskDetection: 10,
            humanEditBurden: 5,
            costAndLatency: 5,
          },
        },
      }),
    AuthorizationError,
  );

  const created = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Policy Suite",
      suiteType: "regression",
      verificationCheckProfileIds: [draftCheckProfile.body.id],
      moduleScope: ["editing"],
      requiresProductionBaseline: false,
      supportsAbComparison: false,
      hardGatePolicy: {
        mustUseDeidentifiedSamples: true,
        requiresParsableOutput: false,
      },
      scoreWeights: {
        structure: 40,
        terminology: 20,
        knowledgeCoverage: 20,
        riskDetection: 10,
        humanEditBurden: 5,
        costAndLatency: 5,
      },
    },
  });

  assert.equal(created.body.requires_production_baseline, false);
  assert.equal(created.body.supports_ab_comparison, false);

  await assert.rejects(
    () =>
      verificationOpsApi.activateEvaluationSuite({
        actorRole: "admin",
        suiteId: created.body.id,
      }),
    VerificationCheckProfileDependencyError,
  );
});

test("experiment runs freeze baseline and candidate bindings with a single primary diff", async () => {
  const { verificationOpsApi, sampleSet, suite } =
    await seedPublishedSuiteAndSampleSet();

  const created = await verificationOpsApi.createEvaluationRun({
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

  assert.equal(created.body.status, "queued");
  assert.equal(created.body.run_item_count, 1);
  assert.equal(created.body.sample_set_id, sampleSet.body.id);
  assert.deepEqual(created.body.baseline_binding, {
    lane: "baseline",
    model_id: "model-prod-1",
    runtime_id: "runtime-prod-1",
    prompt_template_id: "prompt-prod-1",
    skill_package_ids: ["skill-prod-1"],
    module_template_id: "template-prod-1",
  });
  assert.deepEqual(created.body.candidate_binding, {
    lane: "candidate",
    model_id: "model-candidate-1",
    runtime_id: "runtime-prod-1",
    prompt_template_id: "prompt-prod-1",
    skill_package_ids: ["skill-prod-1"],
    module_template_id: "template-prod-1",
  });

  const runItems = await verificationOpsApi.listEvaluationRunItemsByRunId({
    runId: created.body.id,
  });
  assert.equal(runItems.status, 200);
  assert.equal(runItems.body.length, 1);
  assert.equal(runItems.body[0]?.lane, "candidate");

  const updatedItem = await verificationOpsApi.recordEvaluationRunItemResult({
    actorRole: "admin",
    input: {
      runItemId: runItems.body[0]!.id,
      hardGatePassed: true,
      weightedScore: 91,
      diffSummary: "Candidate improved section ordering against production baseline.",
    },
  });
  assert.equal(updatedItem.body.hard_gate_passed, true);
  assert.equal(updatedItem.body.weighted_score, 91);
});

test("experiment runs treat governed binding ids as primary A/B variables", async () => {
  const { verificationOpsApi, sampleSet, suite } =
    await seedPublishedSuiteAndSampleSet();

  const created = await verificationOpsApi.createEvaluationRun({
    actorRole: "admin",
    input: {
      suiteId: suite.body.id,
      sampleSetId: sampleSet.body.id,
      baselineBinding: {
        lane: "baseline",
        executionProfileId: "profile-prod-1",
        retrievalPresetId: "retrieval-prod-1",
        modelId: "model-prod-1",
        runtimeId: "runtime-prod-1",
        promptTemplateId: "prompt-prod-1",
        skillPackageIds: ["skill-prod-1"],
        moduleTemplateId: "template-prod-1",
      },
      candidateBinding: {
        lane: "candidate",
        executionProfileId: "profile-prod-1",
        retrievalPresetId: "retrieval-preview-2",
        modelId: "model-prod-1",
        runtimeId: "runtime-prod-1",
        promptTemplateId: "prompt-prod-1",
        skillPackageIds: ["skill-prod-1"],
        moduleTemplateId: "template-prod-1",
      },
    },
  });

  assert.equal(created.body.status, "queued");
  assert.deepEqual(created.body.baseline_binding, {
    lane: "baseline",
    execution_profile_id: "profile-prod-1",
    retrieval_preset_id: "retrieval-prod-1",
    model_id: "model-prod-1",
    runtime_id: "runtime-prod-1",
    prompt_template_id: "prompt-prod-1",
    skill_package_ids: ["skill-prod-1"],
    module_template_id: "template-prod-1",
  });
  assert.deepEqual(created.body.candidate_binding, {
    lane: "candidate",
    execution_profile_id: "profile-prod-1",
    retrieval_preset_id: "retrieval-preview-2",
    model_id: "model-prod-1",
    runtime_id: "runtime-prod-1",
    prompt_template_id: "prompt-prod-1",
    skill_package_ids: ["skill-prod-1"],
    module_template_id: "template-prod-1",
  });
});

test("experiment runs freeze quality package refs as a primary A/B variable", async () => {
  const { verificationOpsApi, sampleSet, suite } =
    await seedPublishedSuiteAndSampleSet();

  const created = await verificationOpsApi.createEvaluationRun({
    actorRole: "admin",
    input: {
      suiteId: suite.body.id,
      sampleSetId: sampleSet.body.id,
      baselineBinding: {
        lane: "baseline",
        runtimeBindingId: "binding-prod-shared-1",
        modelId: "model-prod-1",
        runtimeId: "runtime-prod-1",
        promptTemplateId: "prompt-prod-1",
        skillPackageIds: ["skill-prod-1"],
        moduleTemplateId: "template-prod-1",
        qualityPackageVersionIds: ["quality-package-version-1"],
      } as never,
      candidateBinding: {
        lane: "candidate",
        runtimeBindingId: "binding-prod-shared-1",
        modelId: "model-prod-1",
        runtimeId: "runtime-prod-1",
        promptTemplateId: "prompt-prod-1",
        skillPackageIds: ["skill-prod-1"],
        moduleTemplateId: "template-prod-1",
        qualityPackageVersionIds: ["quality-package-version-2"],
      } as never,
    },
  });

  assert.equal(created.body.status, "queued");
  assert.deepEqual(created.body.baseline_binding, {
    lane: "baseline",
    runtime_binding_id: "binding-prod-shared-1",
    model_id: "model-prod-1",
    runtime_id: "runtime-prod-1",
    prompt_template_id: "prompt-prod-1",
    skill_package_ids: ["skill-prod-1"],
    quality_package_version_ids: ["quality-package-version-1"],
    module_template_id: "template-prod-1",
  });
  assert.deepEqual(created.body.candidate_binding, {
    lane: "candidate",
    runtime_binding_id: "binding-prod-shared-1",
    model_id: "model-prod-1",
    runtime_id: "runtime-prod-1",
    prompt_template_id: "prompt-prod-1",
    skill_package_ids: ["skill-prod-1"],
    quality_package_version_ids: ["quality-package-version-2"],
    module_template_id: "template-prod-1",
  });
});
test("experiment runs reject multi-variable diffs and persist per-item failure summaries", async () => {
  const { verificationOpsApi, sampleSet, suite } =
    await seedPublishedSuiteAndSampleSet();

  await assert.rejects(
    () =>
      verificationOpsApi.createEvaluationRun({
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
            promptTemplateId: "prompt-candidate-1",
            skillPackageIds: ["skill-prod-1"],
            moduleTemplateId: "template-prod-1",
          },
        },
      }),
    EvaluationExperimentBindingError,
  );

  const created = await verificationOpsApi.createEvaluationRun({
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

  const runItems = await verificationOpsApi.listEvaluationRunItemsByRunId({
    runId: created.body.id,
  });
  const recorded = await verificationOpsApi.recordEvaluationRunItemResult({
    actorRole: "admin",
    input: {
      runItemId: runItems.body[0]!.id,
      hardGatePassed: false,
      weightedScore: 42,
      failureKind: "regression_failed",
      failureReason: "Candidate dropped a required risk section.",
      diffSummary: "Negative regression versus baseline output.",
      requiresHumanReview: true,
    },
  });

  assert.equal(recorded.body.failure_kind, "regression_failed");
  assert.equal(recorded.body.failure_reason, "Candidate dropped a required risk section.");
  assert.equal(recorded.body.requires_human_review, true);
});
