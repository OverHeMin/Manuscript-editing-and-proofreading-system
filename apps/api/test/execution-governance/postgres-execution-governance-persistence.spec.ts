import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { PostgresExecutionGovernanceRepository } from "../../src/modules/execution-governance/index.ts";

test("postgres execution governance repository persists profiles, rules, and version reservations", async () => {
  await withMigratedExecutionGovernancePool(async (pool) => {
    const repository = new PostgresExecutionGovernanceRepository({
      client: pool,
    });

    await repository.saveProfile({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      module_template_id: "22222222-2222-2222-2222-222222222222",
      rule_set_id: "88888888-8888-8888-8888-888888888888",
      prompt_template_id: "33333333-3333-3333-3333-333333333333",
      skill_package_ids: [
        "44444444-4444-4444-4444-444444444444",
        "55555555-5555-5555-5555-555555555555",
      ],
      knowledge_binding_mode: "profile_plus_dynamic",
      status: "active",
      version: 2,
      notes: "Editing production profile.",
    });
    await repository.saveKnowledgeBindingRule({
      id: "66666666-6666-6666-6666-666666666666",
      knowledge_item_id: "77777777-7777-7777-7777-777777777777",
      module: "editing",
      manuscript_types: ["clinical_study"],
      template_family_ids: ["11111111-1111-1111-1111-111111111111"],
      module_template_ids: ["22222222-2222-2222-2222-222222222222"],
      sections: ["methods"],
      risk_tags: ["statistics"],
      priority: 80,
      binding_purpose: "required",
      status: "active",
    });

    const loadedProfile = await repository.findProfileById(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const loadedRule = await repository.findKnowledgeBindingRuleById(
      "66666666-6666-6666-6666-666666666666",
    );
    const profiles = await repository.listProfiles();
    const rules = await repository.listKnowledgeBindingRules();
    const nextVersion = await repository.reserveNextProfileVersion(
      "editing",
      "clinical_study",
      "11111111-1111-1111-1111-111111111111",
    );

    assert.deepEqual(loadedProfile, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      module_template_id: "22222222-2222-2222-2222-222222222222",
      rule_set_id: "88888888-8888-8888-8888-888888888888",
      prompt_template_id: "33333333-3333-3333-3333-333333333333",
      skill_package_ids: [
        "44444444-4444-4444-4444-444444444444",
        "55555555-5555-5555-5555-555555555555",
      ],
      knowledge_binding_mode: "profile_plus_dynamic",
      status: "active",
      version: 2,
      notes: "Editing production profile.",
    });
    assert.deepEqual(loadedRule, {
      id: "66666666-6666-6666-6666-666666666666",
      knowledge_item_id: "77777777-7777-7777-7777-777777777777",
      module: "editing",
      manuscript_types: ["clinical_study"],
      template_family_ids: ["11111111-1111-1111-1111-111111111111"],
      module_template_ids: ["22222222-2222-2222-2222-222222222222"],
      sections: ["methods"],
      risk_tags: ["statistics"],
      priority: 80,
      binding_purpose: "required",
      status: "active",
    });
    assert.equal(profiles.length, 1);
    assert.equal(rules.length, 1);
    assert.equal(nextVersion, 3);
  });
});

async function withMigratedExecutionGovernancePool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for execution governance persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await seedExecutionGovernanceDependencies(pool);
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

async function seedExecutionGovernanceDependencies(pool: Pool): Promise<void> {
  await pool.query(
    `
      insert into template_families (id, manuscript_type, name, status)
      values ($1, 'clinical_study', 'Execution family', 'active')
    `,
    ["11111111-1111-1111-1111-111111111111"],
  );
  await pool.query(
    `
      insert into module_templates (
        id,
        template_family_id,
        module,
        manuscript_type,
        version_no,
        status,
        prompt
      )
      values ($1, $2, 'editing', 'clinical_study', 1, 'published', 'Editing template')
    `,
    [
      "22222222-2222-2222-2222-222222222222",
      "11111111-1111-1111-1111-111111111111",
    ],
  );
  await pool.query(
    `
      insert into editorial_rule_sets (id, template_family_id, module, version_no, status)
      values ($1, $2, 'editing', 1, 'published')
    `,
    [
      "88888888-8888-8888-8888-888888888888",
      "11111111-1111-1111-1111-111111111111",
    ],
  );
  await pool.query(
    `
      insert into prompt_templates (id, name, version, status, module, manuscript_types)
      values ($1, 'editing_mainline', '1.0.0', 'published', 'editing', array['clinical_study']::manuscript_type[])
    `,
    ["33333333-3333-3333-3333-333333333333"],
  );
  await pool.query(
    `
      insert into skill_packages (id, name, version, scope, status, applies_to_modules)
      values
        ($1, 'editing_skills_a', '1.0.0', 'admin_only', 'published', array['editing']::module_type[]),
        ($2, 'editing_skills_b', '1.0.0', 'admin_only', 'published', array['editing']::module_type[])
    `,
    [
      "44444444-4444-4444-4444-444444444444",
      "55555555-5555-5555-5555-555555555555",
    ],
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
        'Execution rule',
        'Approved knowledge item for execution bindings.',
        'rule',
        'editing',
        array['clinical_study']::manuscript_type[],
        'approved'
      )
    `,
    ["77777777-7777-7777-7777-777777777777"],
  );
}
