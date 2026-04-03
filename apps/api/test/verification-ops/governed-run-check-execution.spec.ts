import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { VerificationOpsService } from "../../src/modules/verification-ops/verification-ops-service.ts";

function createGovernedRunExecutionHarness(input?: {
  failingCheckProfileIds?: string[];
}) {
  const ids = [
    "check-profile-1",
    "check-profile-2",
    "check-profile-3",
    "release-profile-1",
    "evaluation-suite-1",
    "evaluation-run-1",
    "verification-evidence-1",
    "verification-evidence-2",
    "verification-evidence-3",
    "check-profile-4",
    "check-profile-5",
    "release-profile-2",
    "evaluation-suite-2",
    "evaluation-run-2",
    "verification-evidence-4",
    "verification-evidence-5",
    "check-profile-6",
    "evaluation-suite-3",
    "evaluation-run-3",
  ];
  const toolIds = ["tool-1", "tool-2", "tool-3"];
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const toolGatewayService = new ToolGatewayService({
    repository: toolGatewayRepository,
    createId: () => {
      const value = toolIds.shift();
      assert.ok(value, "Expected a tool id to be available.");
      return value;
    },
  });
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    toolGatewayRepository,
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a verification ops id to be available.");
      return value;
    },
    now: () => new Date("2026-04-03T10:00:00.000Z"),
    governedRunCheckExecutor: async ({
      checkProfile,
      governedSource,
    }: {
      checkProfile: { id: string; check_type: string; name: string };
      governedSource: { output_asset_id: string };
    }) => {
      const outcome =
        input?.failingCheckProfileIds?.includes(checkProfile.id) ? "failed" : "passed";
      return {
        outcome,
        evidence: {
          kind: "artifact",
          label: `Automatic governed ${checkProfile.check_type} ${outcome} for ${checkProfile.name}`,
          artifactAssetId: governedSource.output_asset_id,
        },
        failureReason:
          outcome === "failed"
            ? "Synthetic failure for governed execution coverage."
            : undefined,
      };
    },
  });

  return {
    toolGatewayService,
    verificationOpsService,
  };
}

async function createPublishedCheckProfiles() {
  const harness = createGovernedRunExecutionHarness();
  const browserTool = await harness.toolGatewayService.createTool("admin", {
    name: "gstack.browser.qa",
    scope: "browser_qa",
  });

  const checkProfile1 = await harness.verificationOpsService.createVerificationCheckProfile(
    "admin",
    {
      name: "Browser QA 1",
      checkType: "browser_qa",
      toolIds: [browserTool.id],
    },
  );
  const checkProfile2 = await harness.verificationOpsService.createVerificationCheckProfile(
    "admin",
    {
      name: "Browser QA 2",
      checkType: "browser_qa",
      toolIds: [browserTool.id],
    },
  );
  const checkProfile3 = await harness.verificationOpsService.createVerificationCheckProfile(
    "admin",
    {
      name: "Browser QA 3",
      checkType: "browser_qa",
      toolIds: [browserTool.id],
    },
  );

  return {
    ...harness,
    checkProfile1: await harness.verificationOpsService.publishVerificationCheckProfile(
      checkProfile1.id,
      "admin",
    ),
    checkProfile2: await harness.verificationOpsService.publishVerificationCheckProfile(
      checkProfile2.id,
      "admin",
    ),
    checkProfile3: await harness.verificationOpsService.publishVerificationCheckProfile(
      checkProfile3.id,
      "admin",
    ),
  };
}

test("seeded governed runs execute merged suite and release checks in deduped order", async () => {
  const {
    verificationOpsService,
    checkProfile1,
    checkProfile2,
    checkProfile3,
  } = await createPublishedCheckProfiles();

  const releaseProfile = await verificationOpsService.createReleaseCheckProfile(
    "admin",
    {
      name: "Governed Release Gate",
      checkType: "deploy_verification",
      verificationCheckProfileIds: [checkProfile2.id, checkProfile3.id],
    },
  );
  const publishedReleaseProfile = await verificationOpsService.publishReleaseCheckProfile(
    releaseProfile.id,
    "admin",
  );

  const suite = await verificationOpsService.createEvaluationSuite("admin", {
    name: "Governed Editing Suite",
    suiteType: "regression",
    verificationCheckProfileIds: [checkProfile1.id, checkProfile2.id],
    moduleScope: ["editing"],
  });
  const activeSuite = await verificationOpsService.activateEvaluationSuite(
    suite.id,
    "admin",
  );

  const [run] = await verificationOpsService.seedGovernedExecutionRuns("admin", {
    suiteIds: [activeSuite.id],
    releaseCheckProfileId: publishedReleaseProfile.id,
    governedSource: {
      source_kind: "governed_module_execution",
      manuscript_id: "manuscript-1",
      source_module: "editing",
      agent_execution_log_id: "execution-log-1",
      execution_snapshot_id: "snapshot-1",
      output_asset_id: "asset-1",
    },
  });

  const completed = await verificationOpsService.executeSeededGovernedRunChecks(
    "admin",
    {
      runId: run.id,
    },
  );

  assert.equal(completed.status, "passed");
  assert.deepEqual(completed.evidence_ids, [
    "verification-evidence-1",
    "verification-evidence-2",
    "verification-evidence-3",
  ]);

  const evidence = await verificationOpsService.listEvaluationRunEvidence(
    "admin",
    run.id,
  );
  assert.deepEqual(
    evidence.map((record) => record.check_profile_id),
    [checkProfile1.id, checkProfile2.id, checkProfile3.id],
  );
  assert.ok(
    evidence.every((record) => record.artifact_asset_id === "asset-1"),
  );
});

test("seeded governed runs preserve earlier evidence when a later check fails", async () => {
  const harness = createGovernedRunExecutionHarness({
    failingCheckProfileIds: ["check-profile-2"],
  });
  const browserTool = await harness.toolGatewayService.createTool("admin", {
    name: "gstack.browser.qa",
    scope: "browser_qa",
  });
  const checkProfile1 = await harness.verificationOpsService.createVerificationCheckProfile(
    "admin",
    {
      name: "Browser QA 1",
      checkType: "browser_qa",
      toolIds: [browserTool.id],
    },
  );
  const checkProfile2 = await harness.verificationOpsService.createVerificationCheckProfile(
    "admin",
    {
      name: "Browser QA 2",
      checkType: "browser_qa",
      toolIds: [browserTool.id],
    },
  );
  const publishedCheckProfile1 =
    await harness.verificationOpsService.publishVerificationCheckProfile(
      checkProfile1.id,
      "admin",
    );
  const publishedCheckProfile2 =
    await harness.verificationOpsService.publishVerificationCheckProfile(
      checkProfile2.id,
      "admin",
    );

  const suite = await harness.verificationOpsService.createEvaluationSuite("admin", {
    name: "Governed Proofreading Suite",
    suiteType: "release_gate",
    verificationCheckProfileIds: [
      publishedCheckProfile1.id,
      publishedCheckProfile2.id,
    ],
    moduleScope: ["proofreading"],
  });
  const activeSuite = await harness.verificationOpsService.activateEvaluationSuite(
    suite.id,
    "admin",
  );

  const [run] = await harness.verificationOpsService.seedGovernedExecutionRuns("admin", {
    suiteIds: [activeSuite.id],
    governedSource: {
      source_kind: "governed_module_execution",
      manuscript_id: "manuscript-2",
      source_module: "proofreading",
      agent_execution_log_id: "execution-log-2",
      execution_snapshot_id: "snapshot-2",
      output_asset_id: "asset-2",
    },
  });

  const completed = await harness.verificationOpsService.executeSeededGovernedRunChecks(
    "admin",
    {
      runId: run.id,
    },
  );

  assert.equal(completed.status, "failed");
  assert.equal(completed.evidence_ids.length, 2);
  const evidence = await harness.verificationOpsService.listEvaluationRunEvidence(
    "admin",
    run.id,
  );
  assert.deepEqual(
    evidence.map((record) => record.check_profile_id),
    [publishedCheckProfile1.id, publishedCheckProfile2.id],
  );
});

test("governed run execution rejects runs that are no longer queued", async () => {
  const {
    verificationOpsService,
    checkProfile1,
  } = await createPublishedCheckProfiles();

  const suite = await verificationOpsService.createEvaluationSuite("admin", {
    name: "Governed Screening Suite",
    suiteType: "regression",
    verificationCheckProfileIds: [checkProfile1.id],
    moduleScope: ["screening"],
  });
  const activeSuite = await verificationOpsService.activateEvaluationSuite(
    suite.id,
    "admin",
  );

  const [run] = await verificationOpsService.seedGovernedExecutionRuns("admin", {
    suiteIds: [activeSuite.id],
    governedSource: {
      source_kind: "governed_module_execution",
      manuscript_id: "manuscript-3",
      source_module: "screening",
      agent_execution_log_id: "execution-log-3",
      execution_snapshot_id: "snapshot-3",
      output_asset_id: "asset-3",
    },
  });
  await verificationOpsService.completeEvaluationRun("admin", {
    runId: run.id,
    status: "passed",
    evidenceIds: [],
  });

  await assert.rejects(
    () =>
      verificationOpsService.executeSeededGovernedRunChecks("admin", {
        runId: run.id,
      }),
  );
});
