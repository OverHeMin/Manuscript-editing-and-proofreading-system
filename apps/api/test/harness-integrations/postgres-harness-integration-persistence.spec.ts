import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  HarnessIntegrationService,
  PostgresHarnessIntegrationRepository,
} from "../../src/modules/harness-integrations/index.ts";
import { createPostgresWriteTransactionManager } from "../../src/modules/shared/write-transaction-manager.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres harness integration repository persists adapters, feature flag changes, redaction profiles, and execution audits", async () => {
  await withMigratedHarnessIntegrationPool(async (pool) => {
    const repository = new PostgresHarnessIntegrationRepository({ client: pool });

    await repository.saveRedactionProfile({
      id: "00000000-0000-0000-0000-000000001901",
      name: "structured-trace-envelope",
      redaction_mode: "structured_only",
      structured_fields: [
        "manuscript_id",
        "template_family_id",
        "dataset_id",
      ],
      allow_raw_payload_export: false,
      created_at: "2026-04-04T12:10:00.000Z",
      updated_at: "2026-04-04T12:10:00.000Z",
    });

    await repository.saveAdapter({
      id: "00000000-0000-0000-0000-000000001902",
      kind: "promptfoo",
      display_name: "Promptfoo local suite",
      execution_mode: "local_cli",
      fail_open: true,
      redaction_profile_id: "00000000-0000-0000-0000-000000001901",
      feature_flag_keys: ["harness.promptfoo.enabled"],
      result_envelope_version: "v1",
      config: {
        suite: "retrieval-quality",
      },
      created_at: "2026-04-04T12:11:00.000Z",
      updated_at: "2026-04-04T12:11:00.000Z",
    });

    await repository.saveFeatureFlagChange({
      id: "00000000-0000-0000-0000-000000001903",
      adapter_id: "00000000-0000-0000-0000-000000001902",
      flag_key: "harness.promptfoo.enabled",
      enabled: true,
      changed_by: "ops-admin",
      change_reason: "Enable the governed promptfoo adapter.",
      created_at: "2026-04-04T12:12:00.000Z",
    });

    await repository.saveExecutionAudit({
      id: "00000000-0000-0000-0000-000000001904",
      adapter_id: "00000000-0000-0000-0000-000000001902",
      trigger_kind: "operator_requested",
      input_reference: "run-input://retrieval-quality/gold-set-version-1",
      dataset_id: "gold-set-version-1",
      artifact_uri: "file:///tmp/harness/promptfoo/run-1.json",
      status: "degraded",
      degradation_reason: "self-hosted trace sink unavailable",
      result_summary: {
        passed: 11,
        failed: 1,
      },
      created_at: "2026-04-04T12:13:00.000Z",
    });

    const traceProfile = await repository.findRedactionProfileByName(
      "structured-trace-envelope",
    );
    const adapter = await repository.findAdapterById(
      "00000000-0000-0000-0000-000000001902",
    );
    const latestFlagChange = await repository.findLatestFeatureFlagChange(
      "00000000-0000-0000-0000-000000001902",
      "harness.promptfoo.enabled",
    );
    const audits = await repository.listExecutionAuditsByAdapterId(
      "00000000-0000-0000-0000-000000001902",
    );

    assert.equal(traceProfile?.redaction_mode, "structured_only");
    assert.equal(adapter?.kind, "promptfoo");
    assert.equal(adapter?.execution_mode, "local_cli");
    assert.equal(adapter?.fail_open, true);
    assert.equal(latestFlagChange?.enabled, true);
    assert.equal(audits[0]?.status, "degraded");
    assert.equal(
      audits[0]?.degradation_reason,
      "self-hosted trace sink unavailable",
    );
  });
});

test("postgres harness integration service keeps feature flag changes and execution audits additive", async () => {
  await withMigratedHarnessIntegrationPool(async (pool) => {
    const repository = new PostgresHarnessIntegrationRepository({ client: pool });
    const timestamps = [
      "2026-04-04T12:20:00.000Z",
      "2026-04-04T12:21:00.000Z",
      "2026-04-04T12:22:00.000Z",
      "2026-04-04T12:23:00.000Z",
      "2026-04-04T12:24:00.000Z",
      "2026-04-04T12:25:00.000Z",
    ];
    const ids = [
      "00000000-0000-0000-0000-000000001911",
      "00000000-0000-0000-0000-000000001912",
      "00000000-0000-0000-0000-000000001913",
      "00000000-0000-0000-0000-000000001914",
      "00000000-0000-0000-0000-000000001915",
      "00000000-0000-0000-0000-000000001916",
    ];
    const service = new HarnessIntegrationService({
      repository,
      transactionManager: createPostgresWriteTransactionManager({
        getClient: async () => pool.connect(),
        createContext: (client) => ({
          repository: new PostgresHarnessIntegrationRepository({ client }),
        }),
      }),
      createId: () => {
        const value = ids.shift();
        assert.ok(value, "Expected a PostgreSQL harness integration id.");
        return value;
      },
      now: () => {
        const value = timestamps.shift();
        assert.ok(value, "Expected a PostgreSQL harness integration timestamp.");
        return new Date(value);
      },
    });

    const traceProfile = await service.upsertRedactionProfile({
      name: "judge-structured-envelope",
      redactionMode: "structured_only",
      structuredFields: ["dataset_id", "batch_id"],
      allowRawPayloadExport: false,
    });

    const adapter = await service.registerAdapter({
      kind: "judge_reliability_local",
      displayName: "Judge reliability local runner",
      executionMode: "local_cli",
      redactionProfileId: traceProfile.id,
      featureFlagKeys: ["harness.judge.enabled"],
      resultEnvelopeVersion: "v1",
    });

    await service.recordFeatureFlagChange({
      adapterId: adapter.id,
      flagKey: "harness.judge.enabled",
      enabled: false,
      changedBy: "ops-admin",
      changeReason: "Disable until the batch is approved.",
    });

    await service.recordFeatureFlagChange({
      adapterId: adapter.id,
      flagKey: "harness.judge.enabled",
      enabled: true,
      changedBy: "ops-admin",
      changeReason: "Enable the local judge calibration run.",
    });

    await service.recordExecutionAudit({
      adapterId: adapter.id,
      triggerKind: "operator_requested",
      inputReference: "run-input://judge-reliability/batch-1",
      datasetId: "judge-calibration-batch-1",
      artifactUri: "file:///tmp/harness/judge/batch-1.json",
      status: "succeeded",
      resultSummary: {
        agreement_rate: 0.82,
      },
    });

    await service.recordExecutionAudit({
      adapterId: adapter.id,
      triggerKind: "operator_requested",
      inputReference: "run-input://judge-reliability/batch-1/retry",
      datasetId: "judge-calibration-batch-1",
      artifactUri: "file:///tmp/harness/judge/batch-1-retry.json",
      status: "degraded",
      degradationReason: "local trace persistence unavailable",
      resultSummary: {
        agreement_rate: 0.84,
      },
    });

    const storedProfile = await repository.findRedactionProfileById(traceProfile.id);
    const flagHistory = await repository.listFeatureFlagChangesByAdapterId(
      adapter.id,
    );
    const audits = await repository.listExecutionAuditsByAdapterId(adapter.id);

    assert.equal(storedProfile?.redaction_mode, "structured_only");
    assert.deepEqual(
      flagHistory.map((record) => record.enabled),
      [false, true],
    );
    assert.deepEqual(
      audits.map((record) => ({
        status: record.status,
        degradation_reason: record.degradation_reason,
      })),
      [
        {
          status: "succeeded",
          degradation_reason: undefined,
        },
        {
          status: "degraded",
          degradation_reason: "local trace persistence unavailable",
        },
      ],
    );
  });
});

async function withMigratedHarnessIntegrationPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary harness integration database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({
      connectionString: databaseUrl,
      max: 8,
    });

    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}
