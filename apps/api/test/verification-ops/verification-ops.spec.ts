import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createToolGatewayApi } from "../../src/modules/tool-gateway/tool-gateway-api.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { createVerificationOpsApi } from "../../src/modules/verification-ops/verification-ops-api.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import {
  VerificationOpsService,
  VerificationEvidenceNotFoundError,
  VerificationCheckProfileDependencyError,
  EvaluationSuiteNotActiveError,
} from "../../src/modules/verification-ops/verification-ops-service.ts";

function createVerificationOpsHarness() {
  const ids = [
    "check-profile-1",
    "release-profile-1",
    "evaluation-suite-1",
    "verification-evidence-1",
    "evaluation-run-1",
    "check-profile-2",
    "release-profile-2",
    "evaluation-suite-2",
    "verification-evidence-2",
    "evaluation-run-2",
    "check-profile-3",
    "release-profile-3",
    "evaluation-suite-3",
    "verification-evidence-3",
    "evaluation-run-3",
    "check-profile-4",
    "release-profile-4",
    "evaluation-suite-4",
    "verification-evidence-4",
    "evaluation-run-4",
  ];
  const toolIds = ["tool-1", "tool-2", "tool-3"];
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const toolGatewayApi = createToolGatewayApi({
    toolGatewayService: new ToolGatewayService({
      repository: toolGatewayRepository,
      createId: () => {
        const value = toolIds.shift();
        assert.ok(value, "Expected a tool id to be available.");
        return value;
      },
    }),
  });
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    toolGatewayRepository,
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a verification ops id to be available.");
      return value;
    },
    now: () => new Date("2026-03-28T14:00:00.000Z"),
  });
  const verificationOpsApi = createVerificationOpsApi({
    verificationOpsService,
  });

  return {
    toolGatewayApi,
    verificationOpsApi,
    verificationOpsService,
    verificationOpsRepository,
  };
}

test("verification ops registries are admin-only and can publish evidence-backed verification assets", async () => {
  const { toolGatewayApi, verificationOpsApi } = createVerificationOpsHarness();

  const browserTool = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.browser.qa",
      scope: "browser_qa",
    },
  });
  const deployTool = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.deploy.verify",
      scope: "deploy_verification",
    },
  });

  await assert.rejects(
    () =>
      verificationOpsApi.createVerificationCheckProfile({
        actorRole: "editor",
        input: {
          name: "Browser QA",
          checkType: "browser_qa",
          toolIds: [browserTool.body.id],
        },
      }),
    AuthorizationError,
  );

  const createdCheckProfile = await verificationOpsApi.createVerificationCheckProfile({
    actorRole: "admin",
    input: {
      name: "Browser QA",
      checkType: "browser_qa",
      toolIds: [browserTool.body.id],
    },
  });
  assert.equal(createdCheckProfile.status, 201);
  assert.equal(createdCheckProfile.body.status, "draft");

  const publishedCheckProfile = await verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: createdCheckProfile.body.id,
  });
  assert.equal(publishedCheckProfile.body.status, "published");

  const createdReleaseProfile = await verificationOpsApi.createReleaseCheckProfile({
    actorRole: "admin",
    input: {
      name: "Release Gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
    },
  });
  const publishedReleaseProfile = await verificationOpsApi.publishReleaseCheckProfile({
    actorRole: "admin",
    profileId: createdReleaseProfile.body.id,
  });
  assert.equal(publishedReleaseProfile.body.status, "published");

  const createdSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Regression",
      suiteType: "regression",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
      moduleScope: ["editing"],
    },
  });
  const activatedSuite = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: createdSuite.body.id,
  });
  assert.equal(activatedSuite.body.status, "active");

  const recordedEvidence = await verificationOpsApi.recordVerificationEvidence({
    actorRole: "admin",
    input: {
      kind: "url",
      label: "Browser QA Report",
      uri: "https://example.test/browser-qa",
      checkProfileId: publishedCheckProfile.body.id,
    },
  });
  assert.equal(recordedEvidence.body.check_profile_id, publishedCheckProfile.body.id);

  const createdRun = await verificationOpsApi.createEvaluationRun({
    actorRole: "admin",
    input: {
      suiteId: activatedSuite.body.id,
      releaseCheckProfileId: publishedReleaseProfile.body.id,
    },
  });
  assert.equal(createdRun.body.status, "queued");

  const completedRun = await verificationOpsApi.completeEvaluationRun({
    actorRole: "admin",
    runId: createdRun.body.id,
    status: "passed",
    evidenceIds: [recordedEvidence.body.id],
  });
  assert.equal(completedRun.body.status, "passed");
  assert.deepEqual(completedRun.body.evidence_ids, [recordedEvidence.body.id]);

  const benchmarkTool = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.benchmark",
      scope: "benchmark",
    },
  });
  assert.equal(benchmarkTool.body.scope, "benchmark");
  assert.equal(deployTool.body.scope, "deploy_verification");
});

test("verification ops enforce published dependencies active suites and known evidence records", async () => {
  const { toolGatewayApi, verificationOpsApi } = createVerificationOpsHarness();

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
      name: "Draft Browser QA",
      checkType: "browser_qa",
      toolIds: [browserTool.body.id],
    },
  });

  const releaseProfile = await verificationOpsApi.createReleaseCheckProfile({
    actorRole: "admin",
    input: {
      name: "Draft Dependency Release Gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [draftCheckProfile.body.id],
    },
  });
  await assert.rejects(
    () =>
      verificationOpsApi.publishReleaseCheckProfile({
        actorRole: "admin",
        profileId: releaseProfile.body.id,
      }),
    VerificationCheckProfileDependencyError,
  );

  const suite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Draft Dependency Suite",
      suiteType: "regression",
      verificationCheckProfileIds: [draftCheckProfile.body.id],
      moduleScope: ["screening"],
    },
  });
  await assert.rejects(
    () =>
      verificationOpsApi.activateEvaluationSuite({
        actorRole: "admin",
        suiteId: suite.body.id,
      }),
    VerificationCheckProfileDependencyError,
  );

  const publishedCheckProfile = await verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: draftCheckProfile.body.id,
  });

  const activeSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Active Suite",
      suiteType: "regression",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
      moduleScope: "any",
    },
  });

  await assert.rejects(
    () =>
      verificationOpsApi.createEvaluationRun({
        actorRole: "admin",
        input: {
          suiteId: activeSuite.body.id,
        },
      }),
    EvaluationSuiteNotActiveError,
  );

  const activatedSuite = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: activeSuite.body.id,
  });
  const run = await verificationOpsApi.createEvaluationRun({
    actorRole: "admin",
    input: {
      suiteId: activatedSuite.body.id,
    },
  });

  await assert.rejects(
    () =>
      verificationOpsApi.completeEvaluationRun({
        actorRole: "admin",
        runId: run.body.id,
        status: "failed",
        evidenceIds: ["missing-evidence"],
      }),
    VerificationEvidenceNotFoundError,
  );
});

test("verification ops seed governed execution runs without sample-set run items", async () => {
  const {
    toolGatewayApi,
    verificationOpsApi,
    verificationOpsService,
  } = createVerificationOpsHarness();

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
      name: "Published Browser QA",
      checkType: "browser_qa",
      toolIds: [browserTool.body.id],
    },
  });
  const publishedCheckProfile = await verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: checkProfile.body.id,
  });

  const releaseProfile = await verificationOpsApi.createReleaseCheckProfile({
    actorRole: "admin",
    input: {
      name: "Published Release Gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
    },
  });
  const publishedReleaseProfile = await verificationOpsApi.publishReleaseCheckProfile({
    actorRole: "admin",
    profileId: releaseProfile.body.id,
  });

  const editingSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Governed Evaluation",
      suiteType: "release_gate",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
      moduleScope: ["editing"],
    },
  });
  const activeEditingSuite = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: editingSuite.body.id,
  });

  const crossModuleSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Cross-Module Governed Evaluation",
      suiteType: "release_gate",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
      moduleScope: ["editing", "proofreading"],
    },
  });
  const activeCrossModuleSuite = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: crossModuleSuite.body.id,
  });

  const seedGovernedExecutionRuns = (
    verificationOpsService as VerificationOpsService & {
      seedGovernedExecutionRuns?: (
        actorRole: "admin",
        input: {
          suiteIds: string[];
          releaseCheckProfileId?: string;
          governedSource: {
            source_kind: "governed_module_execution";
            manuscript_id: string;
            source_module: "editing";
            agent_execution_log_id: string;
            execution_snapshot_id: string;
            output_asset_id: string;
          };
        },
      ) => Promise<
        Array<{
          id: string;
          suite_id: string;
          sample_set_id?: string;
          governed_source?: {
            source_kind: "governed_module_execution";
            manuscript_id: string;
            source_module: "editing";
            agent_execution_log_id: string;
            execution_snapshot_id: string;
            output_asset_id: string;
          };
          release_check_profile_id?: string;
          run_item_count: number;
          status: "queued";
        }>
      >;
    }
  ).seedGovernedExecutionRuns;

  assert.equal(typeof seedGovernedExecutionRuns, "function");

  const seededRuns = await seedGovernedExecutionRuns!.call(
    verificationOpsService,
    "admin",
    {
      suiteIds: [activeEditingSuite.body.id, activeCrossModuleSuite.body.id],
      releaseCheckProfileId: publishedReleaseProfile.body.id,
      governedSource: {
        source_kind: "governed_module_execution",
        manuscript_id: "manuscript-1",
      source_module: "editing",
      agent_execution_log_id: "execution-log-1",
        execution_snapshot_id: "snapshot-1",
        output_asset_id: "asset-1",
      },
    },
  );

  assert.deepEqual(
    seededRuns.map((run) => run.suite_id),
    [activeEditingSuite.body.id, activeCrossModuleSuite.body.id],
  );
  assert.deepEqual(
    seededRuns.map((run) => run.release_check_profile_id),
    [publishedReleaseProfile.body.id, publishedReleaseProfile.body.id],
  );
  assert.deepEqual(
    seededRuns.map((run) => run.governed_source),
    [
      {
        source_kind: "governed_module_execution",
        manuscript_id: "manuscript-1",
        source_module: "editing",
        agent_execution_log_id: "execution-log-1",
        execution_snapshot_id: "snapshot-1",
        output_asset_id: "asset-1",
      },
      {
        source_kind: "governed_module_execution",
        manuscript_id: "manuscript-1",
        source_module: "editing",
        agent_execution_log_id: "execution-log-1",
        execution_snapshot_id: "snapshot-1",
        output_asset_id: "asset-1",
      },
    ],
  );
  assert.deepEqual(
    seededRuns.map((run) => run.sample_set_id),
    [undefined, undefined],
  );
  assert.deepEqual(
    seededRuns.map((run) => run.run_item_count),
    [0, 0],
  );
  assert.deepEqual(
    await Promise.all(
      seededRuns.map((run) =>
        verificationOpsService.listEvaluationRunItemsByRunId(run.id),
      ),
    ),
    [[], []],
  );
});

test("verification ops return no governed execution runs when no suite ids are configured", async () => {
  const { verificationOpsService } = createVerificationOpsHarness();

  const seedGovernedExecutionRuns = (
    verificationOpsService as VerificationOpsService & {
      seedGovernedExecutionRuns?: (
        actorRole: "admin",
        input: {
          suiteIds: string[];
          governedSource: {
            source_kind: "governed_module_execution";
            manuscript_id: string;
            source_module: "screening";
            agent_execution_log_id: string;
            execution_snapshot_id: string;
            output_asset_id: string;
          };
        },
      ) => Promise<unknown[]>;
    }
  ).seedGovernedExecutionRuns;

  assert.equal(typeof seedGovernedExecutionRuns, "function");

  const seededRuns = await seedGovernedExecutionRuns!.call(
    verificationOpsService,
    "admin",
    {
      suiteIds: [],
      governedSource: {
        source_kind: "governed_module_execution",
        manuscript_id: "manuscript-1",
        source_module: "screening",
        agent_execution_log_id: "execution-log-1",
        execution_snapshot_id: "snapshot-1",
        output_asset_id: "asset-1",
      },
    },
  );

  assert.deepEqual(seededRuns, []);
});

test("verification ops reject governed execution runs when suite scope excludes the source module", async () => {
  const {
    toolGatewayApi,
    verificationOpsApi,
    verificationOpsService,
  } = createVerificationOpsHarness();

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
      name: "Published Browser QA",
      checkType: "browser_qa",
      toolIds: [browserTool.body.id],
    },
  });
  const publishedCheckProfile = await verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: checkProfile.body.id,
  });

  const releaseProfile = await verificationOpsApi.createReleaseCheckProfile({
    actorRole: "admin",
    input: {
      name: "Published Release Gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
    },
  });
  const publishedReleaseProfile = await verificationOpsApi.publishReleaseCheckProfile({
    actorRole: "admin",
    profileId: releaseProfile.body.id,
  });

  const editingSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Governed Evaluation",
      suiteType: "release_gate",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
      moduleScope: ["editing"],
    },
  });
  const activeEditingSuite = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: editingSuite.body.id,
  });

  const proofreadingSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Proofreading Governed Evaluation",
      suiteType: "release_gate",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
      moduleScope: ["proofreading"],
    },
  });
  const activeProofreadingSuite = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: proofreadingSuite.body.id,
  });

  const seedGovernedExecutionRuns = (
    verificationOpsService as VerificationOpsService & {
      seedGovernedExecutionRuns?: (
        actorRole: "admin",
        input: {
          suiteIds: string[];
          releaseCheckProfileId?: string;
          governedSource: {
            source_kind: "governed_module_execution";
            manuscript_id: string;
            source_module: "editing";
            agent_execution_log_id: string;
            execution_snapshot_id: string;
            output_asset_id: string;
          };
        },
      ) => Promise<unknown[]>;
    }
  ).seedGovernedExecutionRuns;

  assert.equal(typeof seedGovernedExecutionRuns, "function");

  await assert.rejects(
    () =>
      seedGovernedExecutionRuns!.call(verificationOpsService, "admin", {
        suiteIds: [activeEditingSuite.body.id, activeProofreadingSuite.body.id],
        releaseCheckProfileId: publishedReleaseProfile.body.id,
        governedSource: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-1",
          execution_snapshot_id: "snapshot-1",
          output_asset_id: "asset-1",
        },
      }),
    /does not support governed source module/i,
  );

  assert.deepEqual(
    await verificationOpsService.listEvaluationRunsBySuiteId(activeEditingSuite.body.id),
    [],
  );
  assert.deepEqual(
    await verificationOpsService.listEvaluationRunsBySuiteId(
      activeProofreadingSuite.body.id,
    ),
    [],
  );
});

test("verification ops roll back governed execution run seeding when a later suite is inactive", async () => {
  const {
    toolGatewayApi,
    verificationOpsApi,
    verificationOpsService,
  } = createVerificationOpsHarness();

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
      name: "Published Browser QA",
      checkType: "browser_qa",
      toolIds: [browserTool.body.id],
    },
  });
  const publishedCheckProfile = await verificationOpsApi.publishVerificationCheckProfile({
    actorRole: "admin",
    profileId: checkProfile.body.id,
  });

  const releaseProfile = await verificationOpsApi.createReleaseCheckProfile({
    actorRole: "admin",
    input: {
      name: "Published Release Gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
    },
  });
  const publishedReleaseProfile = await verificationOpsApi.publishReleaseCheckProfile({
    actorRole: "admin",
    profileId: releaseProfile.body.id,
  });

  const editingSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Governed Evaluation",
      suiteType: "release_gate",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
      moduleScope: ["editing"],
    },
  });
  const activeEditingSuite = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: editingSuite.body.id,
  });

  const inactiveEditingSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Governed Evaluation Draft",
      suiteType: "release_gate",
      verificationCheckProfileIds: [publishedCheckProfile.body.id],
      moduleScope: ["editing"],
    },
  });

  const seedGovernedExecutionRuns = (
    verificationOpsService as VerificationOpsService & {
      seedGovernedExecutionRuns?: (
        actorRole: "admin",
        input: {
          suiteIds: string[];
          releaseCheckProfileId?: string;
          governedSource: {
            source_kind: "governed_module_execution";
            manuscript_id: string;
            source_module: "editing";
            agent_execution_log_id: string;
            execution_snapshot_id: string;
            output_asset_id: string;
          };
        },
      ) => Promise<unknown[]>;
    }
  ).seedGovernedExecutionRuns;

  assert.equal(typeof seedGovernedExecutionRuns, "function");

  await assert.rejects(
    () =>
      seedGovernedExecutionRuns!.call(verificationOpsService, "admin", {
        suiteIds: [activeEditingSuite.body.id, inactiveEditingSuite.body.id],
        releaseCheckProfileId: publishedReleaseProfile.body.id,
        governedSource: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-1",
          execution_snapshot_id: "snapshot-1",
          output_asset_id: "asset-1",
        },
      }),
    EvaluationSuiteNotActiveError,
  );

  assert.deepEqual(
    await verificationOpsService.listEvaluationRunsBySuiteId(activeEditingSuite.body.id),
    [],
  );
  assert.deepEqual(
    await verificationOpsService.listEvaluationRunsBySuiteId(inactiveEditingSuite.body.id),
    [],
  );
});

test("verification ops freeze the full harness candidate environment on evaluation runs", async () => {
  const { verificationOpsApi, verificationOpsService } = createVerificationOpsHarness();

  const suite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Harness candidate suite",
      suiteType: "regression",
      verificationCheckProfileIds: [],
      moduleScope: ["editing"],
      supportsAbComparison: true,
      hardGatePolicy: {
        mustUseDeidentifiedSamples: true,
        requiresParsableOutput: false,
      },
    },
  });
  const activeSuite = await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: suite.body.id,
  });

  const createdRun = await verificationOpsApi.createEvaluationRun({
    actorRole: "admin",
    input: {
      suiteId: activeSuite.body.id,
      baselineBinding: {
        lane: "baseline",
        executionProfileId: "profile-active-1",
        runtimeBindingId: "binding-active-1",
        modelRoutingPolicyVersionId: "routing-version-active-1",
        retrievalPresetId: "retrieval-active-1",
        manualReviewPolicyId: "manual-review-active-1",
        modelId: "model-active-1",
        runtimeId: "runtime-active-1",
        promptTemplateId: "prompt-active-1",
        skillPackageIds: ["skill-active-1"],
        moduleTemplateId: "template-active-1",
      },
      candidateBinding: {
        lane: "candidate",
        executionProfileId: "profile-active-1",
        runtimeBindingId: "binding-active-1",
        modelRoutingPolicyVersionId: "routing-version-active-1",
        retrievalPresetId: "retrieval-draft-2",
        manualReviewPolicyId: "manual-review-active-1",
        modelId: "model-active-1",
        runtimeId: "runtime-active-1",
        promptTemplateId: "prompt-active-1",
        skillPackageIds: ["skill-active-1"],
        moduleTemplateId: "template-active-1",
      },
    },
  });

  assert.equal(
    createdRun.body.baseline_binding?.execution_profile_id,
    "profile-active-1",
  );
  assert.equal(
    createdRun.body.candidate_binding?.execution_profile_id,
    "profile-active-1",
  );
  assert.equal(
    createdRun.body.candidate_binding?.runtime_binding_id,
    "binding-active-1",
  );
  assert.equal(
    createdRun.body.candidate_binding?.model_routing_policy_version_id,
    "routing-version-active-1",
  );
  assert.equal(
    createdRun.body.candidate_binding?.retrieval_preset_id,
    "retrieval-draft-2",
  );
  assert.equal(
    createdRun.body.candidate_binding?.manual_review_policy_id,
    "manual-review-active-1",
  );

  const persistedRuns = await verificationOpsService.listEvaluationRunsBySuiteId(
    activeSuite.body.id,
  );

  assert.equal(
    persistedRuns[0]?.candidate_binding?.runtime_binding_id,
    "binding-active-1",
  );
  assert.equal(
    persistedRuns[0]?.candidate_binding?.retrieval_preset_id,
    "retrieval-draft-2",
  );
  assert.equal(
    persistedRuns[0]?.candidate_binding?.manual_review_policy_id,
    "manual-review-active-1",
  );
});
