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
  ];
  const toolIds = ["tool-1", "tool-2", "tool-3"];
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
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
  const verificationOpsApi = createVerificationOpsApi({
    verificationOpsService: new VerificationOpsService({
      repository: new InMemoryVerificationOpsRepository(),
      toolGatewayRepository,
      createId: () => {
        const value = ids.shift();
        assert.ok(value, "Expected a verification ops id to be available.");
        return value;
      },
      now: () => new Date("2026-03-28T14:00:00.000Z"),
    }),
  });

  return {
    toolGatewayApi,
    verificationOpsApi,
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
