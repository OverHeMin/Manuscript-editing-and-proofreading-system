import test from "node:test";
import assert from "node:assert/strict";
import {
  HarnessIntegrationService,
  HarnessIntegrationValidationError,
  InMemoryHarnessIntegrationRepository,
} from "../../src/modules/harness-integrations/index.ts";

function createHarnessIntegrationHarness() {
  const repository = new InMemoryHarnessIntegrationRepository();
  const timestamps = [
    "2026-04-04T12:00:00.000Z",
    "2026-04-04T12:01:00.000Z",
    "2026-04-04T12:02:00.000Z",
    "2026-04-04T12:03:00.000Z",
    "2026-04-04T12:04:00.000Z",
    "2026-04-04T12:05:00.000Z",
  ];
  const ids = [
    "redaction-profile-1",
    "adapter-1",
    "feature-flag-1",
    "execution-audit-1",
    "feature-flag-2",
    "execution-audit-2",
  ];

  const service = new HarnessIntegrationService({
    repository,
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a harness integration id.");
      return value;
    },
    now: () => {
      const value = timestamps.shift();
      assert.ok(value, "Expected a harness integration timestamp.");
      return new Date(value);
    },
  });

  return {
    repository,
    service,
  };
}

test("harness integration service registers local-first adapters with explicit redaction and additive audit history", async () => {
  const { repository, service } = createHarnessIntegrationHarness();

  const traceProfile = await service.upsertRedactionProfile({
    name: "structured-trace-envelope",
    redactionMode: "structured_only",
    structuredFields: [
      "manuscript_id",
      "template_family_id",
      "dataset_id",
    ],
    allowRawPayloadExport: false,
  });

  const adapter = await service.registerAdapter({
    kind: "promptfoo",
    displayName: "Promptfoo local suite",
    executionMode: "local_cli",
    redactionProfileId: traceProfile.id,
    featureFlagKeys: ["harness.promptfoo.enabled"],
    resultEnvelopeVersion: "v1",
    config: {
      suite: "retrieval-quality",
    },
  });

  const firstFlagChange = await service.recordFeatureFlagChange({
    adapterId: adapter.id,
    flagKey: "harness.promptfoo.enabled",
    enabled: false,
    changedBy: "ops-admin",
    changeReason: "Keep the adapter disabled by default.",
  });

  const secondFlagChange = await service.recordFeatureFlagChange({
    adapterId: adapter.id,
    flagKey: "harness.promptfoo.enabled",
    enabled: true,
    changedBy: "ops-admin",
    changeReason: "Enable the promptfoo harness for a governed local run.",
  });

  const firstAudit = await service.recordExecutionAudit({
    adapterId: adapter.id,
    triggerKind: "operator_requested",
    inputReference: "run-input://retrieval-quality/gold-set-version-1",
    datasetId: "gold-set-version-1",
    artifactUri: "file:///tmp/harness/promptfoo/run-1.json",
    status: "succeeded",
    resultSummary: {
      passed: 11,
      failed: 1,
    },
  });

  const secondAudit = await service.recordExecutionAudit({
    adapterId: adapter.id,
    triggerKind: "operator_requested",
    inputReference: "run-input://retrieval-quality/gold-set-version-1/retry",
    datasetId: "gold-set-version-1",
    artifactUri: "file:///tmp/harness/promptfoo/run-2.json",
    status: "degraded",
    degradationReason: "self-hosted trace sink unavailable",
    resultSummary: {
      passed: 12,
      failed: 0,
    },
  });

  const storedProfile = await repository.findRedactionProfileByName(
    "structured-trace-envelope",
  );
  const latestFlagChange = await repository.findLatestFeatureFlagChange(
    adapter.id,
    "harness.promptfoo.enabled",
  );
  const flagHistory = await repository.listFeatureFlagChangesByAdapterId(
    adapter.id,
  );
  const auditHistory = await repository.listExecutionAuditsByAdapterId(adapter.id);

  assert.equal(adapter.kind, "promptfoo");
  assert.equal(adapter.execution_mode, "local_cli");
  assert.equal(adapter.fail_open, true);
  assert.equal(traceProfile.redaction_mode, "structured_only");
  assert.equal(storedProfile?.id, traceProfile.id);
  assert.equal(firstFlagChange.enabled, false);
  assert.equal(secondFlagChange.enabled, true);
  assert.equal(latestFlagChange?.enabled, true);
  assert.deepEqual(
    flagHistory.map((record) => record.enabled),
    [false, true],
  );
  assert.equal(firstAudit.status, "succeeded");
  assert.equal(secondAudit.status, "degraded");
  assert.deepEqual(
    auditHistory.map((record) => ({
      id: record.id,
      status: record.status,
      degradation_reason: record.degradation_reason,
    })),
    [
      {
        id: firstAudit.id,
        status: "succeeded",
        degradation_reason: undefined,
      },
      {
        id: secondAudit.id,
        status: "degraded",
        degradation_reason: "self-hosted trace sink unavailable",
      },
    ],
  );
});

test("harness integration service rejects adapter registration without a governed redaction profile", async () => {
  const { service } = createHarnessIntegrationHarness();

  await assert.rejects(
    () =>
      service.registerAdapter({
        kind: "promptfoo",
        displayName: "Promptfoo local suite",
        executionMode: "local_cli",
        redactionProfileId: "missing-profile",
        featureFlagKeys: ["harness.promptfoo.enabled"],
        resultEnvelopeVersion: "v1",
      }),
    (error) => {
      assert.ok(error instanceof HarnessIntegrationValidationError);
      assert.match(error.message, /redaction profile/i);
      return true;
    },
  );
});

test("harness integration service rejects adapters that do not declare governance feature flags", async () => {
  const { service } = createHarnessIntegrationHarness();
  const traceProfile = await service.upsertRedactionProfile({
    name: "structured-trace-envelope",
    redactionMode: "structured_only",
    structuredFields: ["dataset_id"],
    allowRawPayloadExport: false,
  });

  await assert.rejects(
    () =>
      service.registerAdapter({
        kind: "simple_evals_local",
        displayName: "Simple evals local runner",
        executionMode: "local_cli",
        redactionProfileId: traceProfile.id,
        featureFlagKeys: [],
        resultEnvelopeVersion: "v1",
      }),
    (error) => {
      assert.ok(error instanceof HarnessIntegrationValidationError);
      assert.match(error.message, /feature flag/i);
      return true;
    },
  );
});
