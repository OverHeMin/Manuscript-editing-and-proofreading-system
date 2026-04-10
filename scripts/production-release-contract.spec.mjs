import assert from "node:assert/strict";
import test from "node:test";

import * as releaseContract from "./production-release-contract.mjs";

test("buildPredeploySteps returns the standard production verification order", () => {
  const steps = releaseContract.buildPredeploySteps();

  assert.deepEqual(
    steps.map((step) => step.command),
    [
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "pnpm --filter @medical/api run smoke:boot",
      "pnpm --filter @medsys/web run smoke:boot",
      "pnpm --filter @medical/worker-py run smoke:boot",
      "pnpm verify:manuscript-workbench",
    ],
  );
});

test("verifyPostdeployHealth returns a compact summary when healthz and readyz are healthy", async () => {
  const result = await releaseContract.verifyPostdeployHealth({
    baseUrl: "http://127.0.0.1:3001",
    fetchImpl: createFetchStub({
      "/healthz": { status: 200, body: { status: "ok" } },
      "/readyz": {
        status: 200,
        body: {
          status: "ready",
          components: {
            runtimeContract: "ok",
            database: "ok",
            uploadRoot: "ok",
          },
        },
      },
    }),
  });

  assert.deepEqual(result, {
    status: "ready",
    baseUrl: "http://127.0.0.1:3001",
    healthz: { statusCode: 200, body: { status: "ok" } },
    readyz: {
      statusCode: 200,
      body: {
        status: "ready",
        components: {
          runtimeContract: "ok",
          database: "ok",
          uploadRoot: "ok",
        },
      },
    },
  });
});

test("verifyPostdeployHealth fails when healthz is not 200", async () => {
  await assert.rejects(
    () =>
      releaseContract.verifyPostdeployHealth({
        baseUrl: "http://127.0.0.1:3001",
        fetchImpl: createFetchStub({
          "/healthz": { status: 503, body: { status: "failed" } },
          "/readyz": {
            status: 200,
            body: { status: "ready", components: { runtimeContract: "ok" } },
          },
        }),
      }),
    /healthz.*503/i,
  );
});

test("verifyPostdeployHealth fails when readyz is not 200 and includes the compact readiness payload", async () => {
  await assert.rejects(
    () =>
      releaseContract.verifyPostdeployHealth({
        baseUrl: "http://127.0.0.1:3001",
        fetchImpl: createFetchStub({
          "/healthz": { status: 200, body: { status: "ok" } },
          "/readyz": {
            status: 503,
            body: {
              status: "not_ready",
              components: {
                runtimeContract: "ok",
                database: "failed",
                uploadRoot: "ok",
              },
            },
          },
        }),
      }),
    /readyz.*"database":"failed"/i,
  );
});

test("validateReleaseManifest accepts a complete schema-changing manifest", () => {
  assert.equal(typeof releaseContract.validateReleaseManifest, "function");

  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      schemaChangeRequired: "yes",
      storageImpactRequired: "no",
    }),
  );

  assert.equal(validation.status, "ok");
  assert.equal(validation.schemaChangeRequired, true);
  assert.equal(validation.upgradeRehearsalRequired, true);
  assert.deepEqual(validation.missingFields, []);
});

test("validateReleaseManifest reports missing release summary fields", () => {
  assert.equal(typeof releaseContract.validateReleaseManifest, "function");

  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      environment: "",
      operator: "",
      commitSha: "",
      releasePurpose: "",
    }),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, [
    "Release Summary.Environment",
    "Release Summary.Operator",
    "Release Summary.Commit SHA",
    "Change Scope.Release purpose",
  ]);
});

test("validateReleaseManifest requires a PostgreSQL backup artifact for schema-changing releases", () => {
  assert.equal(typeof releaseContract.validateReleaseManifest, "function");

  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      schemaChangeRequired: "yes",
      postgresqlBackupArtifact: "",
    }),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, ["Backup And Restore Point.PostgreSQL backup artifact"]);
});

test("validateReleaseManifest requires storage snapshot metadata for storage-impacting releases", () => {
  assert.equal(typeof releaseContract.validateReleaseManifest, "function");

  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      schemaChangeRequired: "no",
      storageImpactRequired: "yes",
      objectStorageBackupArtifact: "",
      uploadRootSnapshot: "",
    }),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, ["Backup And Restore Point.Storage snapshot metadata"]);
});

test("validateReleaseManifest requires secret rotation proof when secret rotation is required", () => {
  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      schemaChangeRequired: "no",
      storageImpactRequired: "no",
      secretRotationRequired: "yes",
      secretRotationNotes: "",
      secretRotationVerifiedBy: "",
    }),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, [
    "Secret Rotation And Upgrade Rehearsal.Secret rotation notes",
    "Secret Rotation And Upgrade Rehearsal.Secret rotation verified by",
  ]);
});

test("validateReleaseManifest requires schema-changing releases to declare upgrade rehearsal", () => {
  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      schemaChangeRequired: "yes",
      storageImpactRequired: "no",
      secretRotationRequired: "no",
      upgradeRehearsalRequired: "no",
      upgradeRehearsalEnvironment: "",
      upgradeRehearsalEvidence: "",
      upgradeRehearsalVerifiedBy: "",
    }),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, [
    "Secret Rotation And Upgrade Rehearsal.Upgrade rehearsal required",
  ]);
});

test("validateReleaseManifest requires rehearsal proof when upgrade rehearsal is required", () => {
  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      upgradeRehearsalRequired: "yes",
      upgradeRehearsalEnvironment: "",
      upgradeRehearsalEvidence: "",
      upgradeRehearsalVerifiedBy: "",
    }),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, [
    "Secret Rotation And Upgrade Rehearsal.Upgrade rehearsal environment",
    "Secret Rotation And Upgrade Rehearsal.Upgrade rehearsal evidence",
    "Secret Rotation And Upgrade Rehearsal.Upgrade rehearsal verified by",
  ]);
});

test("validateReleaseManifest requires AI release gate evidence when the harness release gate is required", () => {
  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      harnessReleaseGateRequired: "yes",
      goldSetVersionsCovered: "",
      evaluationSuitesCovered: "",
      finalizedRunIds: "",
      recommendationStatuses: "",
      manualPromotionDecision: "",
      aiReleaseGateApprovedBy: "",
    }),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, [
    "AI Release Gate.Gold set versions covered",
    "AI Release Gate.Evaluation suites covered",
    "AI Release Gate.Finalized run IDs",
    "AI Release Gate.Recommendation statuses",
    "AI Release Gate.Manual promotion decision",
    "AI Release Gate.Approved by",
  ]);
});

test("validateReleaseManifest rejects non-promotable AI release gate evidence", () => {
  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      harnessReleaseGateRequired: "yes",
      goldSetVersionsCovered: "gold-set/screening-v3, gold-set/editing-v2",
      evaluationSuitesCovered: "suite-screening-1, suite-editing-1",
      finalizedRunIds: "run-screening-final-1, run-editing-final-1",
      recommendationStatuses: "approved, needs_review",
      manualPromotionDecision: "pending",
      aiReleaseGateApprovedBy: "release-approver@example.com",
    }),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, []);
  assert.deepEqual(validation.blockingFields, [
    "AI Release Gate.Recommendation statuses",
    "AI Release Gate.Manual promotion decision",
  ]);
});

test("validateReleaseManifest requires an explicit AI release gate declaration even when the section is omitted", () => {
  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest().replace(
      /\n## AI Release Gate[\s\S]*$/u,
      "\n",
    ),
  );

  assert.equal(validation.status, "error");
  assert.deepEqual(validation.missingFields, [
    "AI Release Gate.Harness release gate required",
  ]);
});

test("enforceManifestMigrationConsistency fails when a manifest says no schema change but pending migrations exist", () => {
  assert.equal(typeof releaseContract.enforceManifestMigrationConsistency, "function");

  const validation = releaseContract.validateReleaseManifest(
    createReleaseManifest({
      schemaChangeRequired: "no",
      storageImpactRequired: "no",
    }),
  );

  assert.throws(
    () =>
      releaseContract.enforceManifestMigrationConsistency({
        manifestValidation: validation,
        migrationAudit: {
          status: "clean",
          pendingMigrations: ["0020_agent_execution_model_routing_resolution.sql"],
          repairableMigrations: [],
          blockingMigrations: [],
        },
      }),
    /schema change.*pending migrations/i,
  );
});

test("runMigrationDoctor executes the API migration doctor directly and preserves blocked JSON output", () => {
  const blockedAudit = {
    status: "blocked",
    pendingMigrations: [
      "0029_learning_reviewed_snapshot_source_kind.sql",
      "0030_knowledge_library_v1_revision_governance.sql",
      "0031_knowledge_duplicate_detection_acknowledgements.sql",
    ],
    repairableMigrations: [],
    blockingMigrations: [
      {
        version: "0028_medical_rule_library_v2_foundations.sql",
        reason: "checksum-mismatch",
        expectedChecksum: "expected-checksum",
        databaseChecksum: "database-checksum",
      },
    ],
  };
  const spawnCalls = [];

  const audit = releaseContract.runMigrationDoctor({
    apiPackageRoot: "C:\\repo\\apps\\api",
    migrationDoctorScriptPath:
      "C:\\repo\\apps\\api\\src\\database\\scripts\\migration-doctor.ts",
    spawnSyncImpl(command, args, options) {
      spawnCalls.push({ command, args, options });
      return {
        status: 1,
        stdout: `${JSON.stringify(blockedAudit)}\n`,
        stderr: "",
      };
    },
  });

  assert.deepEqual(audit, blockedAudit);
  assert.deepEqual(spawnCalls, [
    {
      command: process.execPath,
      args: [
        "--import",
        "tsx",
        "C:\\repo\\apps\\api\\src\\database\\scripts\\migration-doctor.ts",
        "--json",
      ],
      options: {
        cwd: "C:\\repo\\apps\\api",
        env: process.env,
        encoding: "utf8",
      },
    },
  ]);
});

test("buildUpgradeRehearsalPlan requires a manifest path", () => {
  assert.equal(typeof releaseContract.buildUpgradeRehearsalPlan, "function");

  assert.throws(
    () =>
      releaseContract.buildUpgradeRehearsalPlan({
        manifestMarkdown: createReleaseManifest(),
      }),
    /manifest/i,
  );
});

test("buildUpgradeRehearsalPlan returns a bounded local-first rehearsal sequence", () => {
  assert.equal(typeof releaseContract.buildUpgradeRehearsalPlan, "function");

  const plan = releaseContract.buildUpgradeRehearsalPlan({
    manifestPath: "docs/operations/releases/phase10h.md",
    manifestMarkdown: createReleaseManifest(),
  });

  assert.equal(plan.status, "ready");
  assert.equal(plan.manifestPath, "docs/operations/releases/phase10h.md");
  assert.match(plan.steps[0].command, /verify:production-preflight/);
  assert.match(plan.steps[1].command, /verify:production-preflight:strict/);
  assert.match(plan.steps[2].command, /db:migration-doctor/);
});

test("buildUpgradeRehearsalPlan fails when the manifest is still incomplete", () => {
  assert.equal(typeof releaseContract.buildUpgradeRehearsalPlan, "function");

  assert.throws(
    () =>
      releaseContract.buildUpgradeRehearsalPlan({
        manifestPath: "docs/operations/releases/phase10h.md",
        manifestMarkdown: createReleaseManifest({
          upgradeRehearsalRequired: "yes",
          upgradeRehearsalEvidence: "",
        }),
      }),
    /incomplete/i,
  );
});

function createFetchStub(routeMap) {
  return async (input) => {
    const url = new URL(input);
    const route = routeMap[url.pathname];

    if (!route) {
      throw new Error(`Unexpected fetch target: ${url.pathname}`);
    }

    return createResponse(route);
  };
}

function createResponse({ status, body, headers = { "content-type": "application/json" } }) {
  const textBody = typeof body === "string" ? body : JSON.stringify(body);

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null;
      },
    },
    async text() {
      return textBody;
    },
  };
}

function createReleaseManifest(overrides = {}) {
  const manifest = {
    environment: "production",
    operator: "codex",
    date: "2026-04-04",
    commitSha: "abc1234",
    releaseBranchTag: "codex/phase10g-release-migration-reliability-hardening",
    releasePurpose: "Harden release and migration reliability checks.",
    servicesTouched: "api",
    schemaChangeRequired: "yes",
    storageImpactRequired: "no",
    secretRotationRequired: "no",
    secretRotationNotes: "No production secret rotation in this release.",
    secretRotationVerifiedBy: "security-operator@example.com",
    upgradeRehearsalRequired: "yes",
    upgradeRehearsalEnvironment: "staging-local-first",
    upgradeRehearsalEvidence: "docs/operations/rehearsals/2026-04-05-phase10h.md",
    upgradeRehearsalVerifiedBy: "release-operator@example.com",
    postgresqlBackupArtifact: "backups/postgres-2026-04-04.dump",
    objectStorageBackupArtifact: "backups/minio-2026-04-04.tar",
    uploadRootSnapshot: ".local-data/uploads/production-2026-04-04",
    restorePointSnapshotId: "restore-point-2026-04-04",
    backupVerifiedBy: "operator@example.com",
    harnessReleaseGateRequired: "no",
    goldSetVersionsCovered: "",
    evaluationSuitesCovered: "",
    finalizedRunIds: "",
    recommendationStatuses: "",
    manualPromotionDecision: "",
    aiReleaseGateApprovedBy: "",
    aiReleaseGateEvidenceNotesOrUri: "",
    ...overrides,
  };

  return `# Release Manifest

## Release Summary

- Environment: ${manifest.environment}
- Operator: ${manifest.operator}
- Date: ${manifest.date}
- Commit SHA: ${manifest.commitSha}
- Release branch / tag: ${manifest.releaseBranchTag}

## Change Scope

- Release purpose: ${manifest.releasePurpose}
- Services touched: ${manifest.servicesTouched}
- Schema change required: \`${manifest.schemaChangeRequired}\`
- Upload root or object storage impact: \`${manifest.storageImpactRequired}\`
- Secret rotation required: \`${manifest.secretRotationRequired}\`

## Secret Rotation And Upgrade Rehearsal

- Secret rotation notes: ${manifest.secretRotationNotes}
- Secret rotation verified by: ${manifest.secretRotationVerifiedBy}
- Upgrade rehearsal required: \`${manifest.upgradeRehearsalRequired}\`
- Upgrade rehearsal environment: ${manifest.upgradeRehearsalEnvironment}
- Upgrade rehearsal evidence: ${manifest.upgradeRehearsalEvidence}
- Upgrade rehearsal verified by: ${manifest.upgradeRehearsalVerifiedBy}

## Backup And Restore Point

- PostgreSQL backup artifact: ${manifest.postgresqlBackupArtifact}
- Object storage backup artifact: ${manifest.objectStorageBackupArtifact}
- Upload root snapshot: ${manifest.uploadRootSnapshot}
- Restore point / snapshot ID: ${manifest.restorePointSnapshotId}
- Backup verified by: ${manifest.backupVerifiedBy}

## AI Release Gate

- Harness release gate required: \`${manifest.harnessReleaseGateRequired}\`
- Gold set versions covered: ${manifest.goldSetVersionsCovered}
- Evaluation suites covered: ${manifest.evaluationSuitesCovered}
- Finalized run IDs: ${manifest.finalizedRunIds}
- Recommendation statuses: ${manifest.recommendationStatuses}
- Manual promotion decision: ${manifest.manualPromotionDecision}
- Approved by: ${manifest.aiReleaseGateApprovedBy}
- Evidence notes or URI: ${manifest.aiReleaseGateEvidenceNotesOrUri}
`;
}
