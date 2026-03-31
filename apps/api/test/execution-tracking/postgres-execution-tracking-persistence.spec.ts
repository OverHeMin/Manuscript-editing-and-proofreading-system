import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { PostgresExecutionTrackingRepository } from "../../src/modules/execution-tracking/index.ts";

test("postgres execution tracking repository persists snapshots and knowledge hit logs", async () => {
  await withMigratedExecutionTrackingPool(async (pool) => {
    const repository = new PostgresExecutionTrackingRepository({
      client: pool,
    });

    await repository.saveSnapshot({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      manuscript_id: "11111111-1111-1111-1111-111111111111",
      module: "editing",
      job_id: "job-1",
      execution_profile_id: "22222222-2222-2222-2222-222222222222",
      module_template_id: "33333333-3333-3333-3333-333333333333",
      module_template_version_no: 3,
      prompt_template_id: "44444444-4444-4444-4444-444444444444",
      prompt_template_version: "1.2.0",
      skill_package_ids: ["55555555-5555-5555-5555-555555555555"],
      skill_package_versions: ["1.0.0"],
      model_id: "66666666-6666-6666-6666-666666666666",
      model_version: "2026-03-01",
      knowledge_item_ids: ["77777777-7777-7777-7777-777777777777"],
      created_asset_ids: ["88888888-8888-8888-8888-888888888888"],
      created_at: "2026-03-30T12:00:00.000Z",
    });
    await repository.saveKnowledgeHitLog({
      id: "99999999-9999-9999-9999-999999999999",
      snapshot_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      knowledge_item_id: "77777777-7777-7777-7777-777777777777",
      binding_rule_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      match_source: "binding_rule",
      match_reasons: ["template_family", "statistics"],
      score: 0.95,
      section: "Methods",
      created_at: "2026-03-30T12:00:00.000Z",
    });

    const snapshot = await repository.findSnapshotById(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const hitLogs = await repository.listKnowledgeHitLogsBySnapshotId(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const snapshots = await repository.listSnapshots();

    assert.deepEqual(snapshot, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      manuscript_id: "11111111-1111-1111-1111-111111111111",
      module: "editing",
      job_id: "job-1",
      execution_profile_id: "22222222-2222-2222-2222-222222222222",
      module_template_id: "33333333-3333-3333-3333-333333333333",
      module_template_version_no: 3,
      prompt_template_id: "44444444-4444-4444-4444-444444444444",
      prompt_template_version: "1.2.0",
      skill_package_ids: ["55555555-5555-5555-5555-555555555555"],
      skill_package_versions: ["1.0.0"],
      model_id: "66666666-6666-6666-6666-666666666666",
      model_version: "2026-03-01",
      knowledge_item_ids: ["77777777-7777-7777-7777-777777777777"],
      created_asset_ids: ["88888888-8888-8888-8888-888888888888"],
      created_at: "2026-03-30T12:00:00.000Z",
    });
    assert.equal(snapshots.length, 1);
    assert.deepEqual(hitLogs, [
      {
        id: "99999999-9999-9999-9999-999999999999",
        snapshot_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        knowledge_item_id: "77777777-7777-7777-7777-777777777777",
        binding_rule_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        match_source: "binding_rule",
        match_reasons: ["template_family", "statistics"],
        score: 0.95,
        section: "Methods",
        created_at: "2026-03-30T12:00:00.000Z",
      },
    ]);
  });
});

async function withMigratedExecutionTrackingPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for execution tracking persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await seedExecutionTrackingDependencies(pool);
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

async function seedExecutionTrackingDependencies(pool: Pool): Promise<void> {
  await pool.query(
    `
      insert into manuscripts (id, title, manuscript_type, status, created_by)
      values ($1, 'Tracked manuscript', 'clinical_study', 'completed', 'seed-user')
    `,
    ["11111111-1111-1111-1111-111111111111"],
  );
  await pool.query(
    `
      insert into execution_profiles (
        id,
        module,
        manuscript_type,
        template_family_id,
        module_template_id,
        prompt_template_id,
        skill_package_ids,
        knowledge_binding_mode,
        status,
        version
      )
      values (
        $1,
        'editing',
        'clinical_study',
        'family-1',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444',
        array['55555555-5555-5555-5555-555555555555']::uuid[],
        'profile_plus_dynamic',
        'active',
        1
      )
    `,
    ["22222222-2222-2222-2222-222222222222"],
  );
  await pool.query(
    `
      insert into knowledge_items (
        id,
        title,
        canonical_text,
        knowledge_kind,
        module_scope,
        manuscript_types,
        status
      )
      values (
        $1,
        'Tracking rule',
        'Knowledge item for execution tracking.',
        'rule',
        'editing',
        array['clinical_study']::manuscript_type[],
        'approved'
      )
    `,
    ["77777777-7777-7777-7777-777777777777"],
  );
  await pool.query(
    `
      insert into knowledge_binding_rules (
        id,
        knowledge_item_id,
        module,
        manuscript_types,
        priority,
        binding_purpose,
        status
      )
      values (
        $1,
        $2,
        'editing',
        array['clinical_study']::manuscript_type[],
        10,
        'required',
        'active'
      )
    `,
    [
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "77777777-7777-7777-7777-777777777777",
    ],
  );
}
