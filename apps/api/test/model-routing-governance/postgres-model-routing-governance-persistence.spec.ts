import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresModelRegistryRepository } from "../../src/modules/model-registry/index.ts";
import {
  ModelRoutingGovernanceService,
  PostgresModelRoutingGovernanceRepository,
} from "../../src/modules/model-routing-governance/index.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres model routing governance repository persists versions decisions and active scope pointers", async () => {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query(
        `
          insert into model_registry (
            id,
            provider,
            model_name,
            model_version,
            allowed_modules,
            is_prod_allowed
          )
          values
            (
              '00000000-0000-0000-0000-000000000401',
              'openai',
              'gpt-5-primary',
              '2026-04',
              array['screening', 'editing', 'proofreading']::module_type[],
              true
            ),
            (
              '00000000-0000-0000-0000-000000000402',
              'anthropic',
              'claude-sonnet',
              '4.1',
              array['screening', 'editing', 'proofreading']::module_type[],
              true
            ),
            (
              '00000000-0000-0000-0000-000000000403',
              'google',
              'gemini-fallback',
              '2.5',
              array['screening', 'editing', 'proofreading']::module_type[],
              true
            )
        `,
      );

      const repository = new PostgresModelRoutingGovernanceRepository({
        client: pool,
      });
      const modelRegistryRepository = new PostgresModelRegistryRepository({
        client: pool,
      });
      const service = new ModelRoutingGovernanceService({
        repository,
        modelRegistryRepository,
        createId: (() => {
          const ids = [
            "00000000-0000-0000-0000-000000000501",
            "00000000-0000-0000-0000-000000000601",
            "00000000-0000-0000-0000-000000000701",
            "00000000-0000-0000-0000-000000000702",
            "00000000-0000-0000-0000-000000000703",
            "00000000-0000-0000-0000-000000000704",
            "00000000-0000-0000-0000-000000000602",
            "00000000-0000-0000-0000-000000000705",
          ];

          return () => {
            const value = ids.shift();
            assert.ok(value, "Expected a postgres governance id to be available.");
            return value;
          };
        })(),
        now: () => new Date("2026-04-03T08:00:00.000Z"),
      });

      const created = await service.createPolicy("admin", {
        scopeKind: "template_family",
        scopeValue: "family-1",
        primaryModelId: "00000000-0000-0000-0000-000000000401",
        fallbackModelIds: ["00000000-0000-0000-0000-000000000403"],
        evidenceLinks: [{ kind: "evaluation_run", id: "run-1" }],
        notes: "Seed the initial routing draft.",
      });

      await service.submitVersion(created.version.id, "admin", {
        reason: "Ready for review.",
      });
      await service.approveVersion(created.version.id, "admin", {
        reason: "Approved for activation.",
      });
      await service.activateVersion(created.version.id, "admin", {
        reason: "Make the initial version active.",
      });

      const nextDraft = await service.createDraftVersion(created.policy_id, "admin", {
        primaryModelId: "00000000-0000-0000-0000-000000000402",
        fallbackModelIds: ["00000000-0000-0000-0000-000000000403"],
        evidenceLinks: [{ kind: "evaluation_run", id: "run-2" }],
        notes: "Prepare the next governed version.",
      });

      const reloadedRepository = new PostgresModelRoutingGovernanceRepository({
        client: pool,
      });
      const policies = await reloadedRepository.listPolicies();

      assert.equal(policies.length, 1);
      assert.equal(policies[0]?.scope_kind, "template_family");
      assert.equal(policies[0]?.scope_value, "family-1");
      assert.equal(
        policies[0]?.active_version?.id,
        "00000000-0000-0000-0000-000000000601",
      );
      assert.deepEqual(
        policies[0]?.active_version?.fallback_model_ids,
        ["00000000-0000-0000-0000-000000000403"],
      );
      assert.deepEqual(
        policies[0]?.versions.map((version) => ({
          id: version.id,
          version_no: version.version_no,
          status: version.status,
        })),
        [
          {
            id: "00000000-0000-0000-0000-000000000601",
            version_no: 1,
            status: "active",
          },
          {
            id: "00000000-0000-0000-0000-000000000602",
            version_no: 2,
            status: "draft",
          },
        ],
      );
      assert.deepEqual(
        policies[0]?.decisions.map((decision) => decision.decision_kind),
        ["create_draft", "submit_for_review", "approve", "activate", "create_draft"],
      );
      assert.equal(nextDraft.version.version_no, 2);
      assert.deepEqual(nextDraft.version.evidence_links, [
        { kind: "evaluation_run", id: "run-2" },
      ]);
    } finally {
      await pool.end();
    }
  });
});
