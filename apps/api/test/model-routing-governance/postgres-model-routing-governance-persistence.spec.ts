import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresModelRegistryRepository } from "../../src/modules/model-registry/index.ts";
import {
  ModelRoutingGovernanceService,
  PostgresModelRoutingGovernanceRepository,
  type CreateSystemSettingsModuleDefaultInput,
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

test("postgres model routing governance persists system-settings module defaults with temperature", async () => {
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
              '00000000-0000-0000-0000-000000000801',
              'qwen',
              'qwen-screening',
              '2026-04',
              array['screening']::module_type[],
              true
            ),
            (
              '00000000-0000-0000-0000-000000000802',
              'deepseek',
              'deepseek-editing',
              '2026-04',
              array['editing']::module_type[],
              true
            ),
            (
              '00000000-0000-0000-0000-000000000803',
              'openai',
              'gpt-proofreading',
              '2026-04',
              array['proofreading']::module_type[],
              true
            ),
            (
              '00000000-0000-0000-0000-000000000804',
              'anthropic',
              'claude-fallback',
              '4.1',
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
            "00000000-0000-0000-0000-000000000901",
            "00000000-0000-0000-0000-000000001001",
            "00000000-0000-0000-0000-000000001101",
            "00000000-0000-0000-0000-000000000902",
            "00000000-0000-0000-0000-000000001002",
            "00000000-0000-0000-0000-000000001102",
            "00000000-0000-0000-0000-000000000903",
            "00000000-0000-0000-0000-000000001003",
            "00000000-0000-0000-0000-000000001103",
          ];

          return () => {
            const value = ids.shift();
            assert.ok(value, "Expected a postgres module-default id to be available.");
            return value;
          };
        })(),
        now: () => new Date("2026-04-03T08:00:00.000Z"),
      });
      const systemSettingsService = service as typeof service & {
        listSystemSettingsModuleDefaults: () => Promise<
          Array<{
            module_key: "screening" | "editing" | "proofreading";
            primary_model_name?: string;
            fallback_model_name?: string;
            temperature?: number | null;
          }>
        >;
        saveSystemSettingsModuleDefault: (
          actorRole: "admin",
          input: CreateSystemSettingsModuleDefaultInput,
        ) => Promise<{
          module_key: "screening" | "editing" | "proofreading";
          primary_model_name?: string;
          fallback_model_name?: string;
          temperature?: number | null;
        }>;
      };

      await systemSettingsService.saveSystemSettingsModuleDefault("admin", {
        moduleKey: "screening",
        primaryModelId: "00000000-0000-0000-0000-000000000801",
        fallbackModelId: "00000000-0000-0000-0000-000000000804",
        temperature: 0.1,
      });
      await systemSettingsService.saveSystemSettingsModuleDefault("admin", {
        moduleKey: "editing",
        primaryModelId: "00000000-0000-0000-0000-000000000802",
        fallbackModelId: "00000000-0000-0000-0000-000000000804",
        temperature: 0.2,
      });
      await systemSettingsService.saveSystemSettingsModuleDefault("admin", {
        moduleKey: "proofreading",
        primaryModelId: "00000000-0000-0000-0000-000000000803",
        fallbackModelId: "00000000-0000-0000-0000-000000000804",
        temperature: 0.3,
      });

      const reloadedService = new ModelRoutingGovernanceService({
        repository: new PostgresModelRoutingGovernanceRepository({
          client: pool,
        }),
        modelRegistryRepository: new PostgresModelRegistryRepository({
          client: pool,
        }),
        createId: () => "unused",
        now: () => new Date("2026-04-03T08:05:00.000Z"),
      }) as ModelRoutingGovernanceService & {
        listSystemSettingsModuleDefaults: () => Promise<
          Array<{
            module_key: "screening" | "editing" | "proofreading";
            primary_model_name?: string;
            fallback_model_name?: string;
            temperature?: number | null;
          }>
        >;
      };

      const moduleDefaults = await reloadedService.listSystemSettingsModuleDefaults();

      assert.deepEqual(
        moduleDefaults.map((record) => ({
          module_key: record.module_key,
          primary_model_name: record.primary_model_name,
          fallback_model_name: record.fallback_model_name,
          temperature: record.temperature,
        })),
        [
          {
            module_key: "screening",
            primary_model_name: "qwen-screening",
            fallback_model_name: "claude-fallback",
            temperature: 0.1,
          },
          {
            module_key: "editing",
            primary_model_name: "deepseek-editing",
            fallback_model_name: "claude-fallback",
            temperature: 0.2,
          },
          {
            module_key: "proofreading",
            primary_model_name: "gpt-proofreading",
            fallback_model_name: "claude-fallback",
            temperature: 0.3,
          },
        ],
      );
    } finally {
      await pool.end();
    }
  });
});
