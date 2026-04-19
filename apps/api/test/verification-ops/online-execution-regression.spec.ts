import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { createVerificationOpsApi } from "../../src/modules/verification-ops/verification-ops-api.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { VerificationOpsService } from "../../src/modules/verification-ops/verification-ops-service.ts";

function createOnlineExecutionRegressionHarness() {
  const ids = [
    "suite-1",
    "suite-2",
    "suite-3",
  ];
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    toolGatewayRepository: new InMemoryToolGatewayRepository(),
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a suite id to be available.");
      return value;
    },
    now: () => new Date("2026-04-19T10:00:00.000Z"),
  });

  return createVerificationOpsApi({
    verificationOpsService,
  });
}

test("verification ops persist distinct online execution regression suite types", async () => {
  const verificationOpsApi = createOnlineExecutionRegressionHarness();

  const moduleSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Module Regression",
      suiteType: "module_regression_suite",
      verificationCheckProfileIds: [],
      moduleScope: ["editing"],
    },
  });
  const scopeSuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Editing Scope Regression",
      suiteType: "scope_regression_suite",
      verificationCheckProfileIds: [],
      moduleScope: "any",
    },
  });
  const ruleFamilySuite = await verificationOpsApi.createEvaluationSuite({
    actorRole: "admin",
    input: {
      name: "Table Rule Family Regression",
      suiteType: "rule_family_regression_suite",
      verificationCheckProfileIds: [],
      moduleScope: ["proofreading"],
    },
  });

  await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: moduleSuite.body.id,
  });
  await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: scopeSuite.body.id,
  });
  await verificationOpsApi.activateEvaluationSuite({
    actorRole: "admin",
    suiteId: ruleFamilySuite.body.id,
  });

  const listedSuites = await verificationOpsApi.listEvaluationSuites();

  assert.deepEqual(
    listedSuites.body.map((suite) => ({
      id: suite.id,
      name: suite.name,
      suite_type: suite.suite_type,
      status: suite.status,
    })),
    [
      {
        id: "suite-1",
        name: "Editing Module Regression",
        suite_type: "module_regression_suite",
        status: "active",
      },
      {
        id: "suite-2",
        name: "Editing Scope Regression",
        suite_type: "scope_regression_suite",
        status: "active",
      },
      {
        id: "suite-3",
        name: "Table Rule Family Regression",
        suite_type: "rule_family_regression_suite",
        status: "active",
      },
    ],
  );
});
