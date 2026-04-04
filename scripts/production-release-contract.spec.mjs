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
    postgresqlBackupArtifact: "backups/postgres-2026-04-04.dump",
    objectStorageBackupArtifact: "backups/minio-2026-04-04.tar",
    uploadRootSnapshot: ".local-data/uploads/production-2026-04-04",
    restorePointSnapshotId: "restore-point-2026-04-04",
    backupVerifiedBy: "operator@example.com",
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

## Backup And Restore Point

- PostgreSQL backup artifact: ${manifest.postgresqlBackupArtifact}
- Object storage backup artifact: ${manifest.objectStorageBackupArtifact}
- Upload root snapshot: ${manifest.uploadRootSnapshot}
- Restore point / snapshot ID: ${manifest.restorePointSnapshotId}
- Backup verified by: ${manifest.backupVerifiedBy}
`;
}
