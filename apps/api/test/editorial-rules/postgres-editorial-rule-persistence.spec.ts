import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { PostgresEditorialRuleRepository } from "../../src/modules/editorial-rules/postgres-editorial-rule-repository.ts";

test("postgres editorial rule repository persists rule sets, structured rule payloads, and version reservations", async () => {
  await withMigratedEditorialRulePool(async (pool) => {
    const repository = new PostgresEditorialRuleRepository({
      client: pool,
    });

    await repository.saveRuleSet({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      module: "editing",
      version_no: 1,
      status: "draft",
    });
    await repository.saveRule({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      rule_set_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      order_no: 10,
      rule_type: "format",
      execution_mode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      trigger: {
        kind: "exact_text",
        text: "摘要 目的",
      },
      action: {
        kind: "replace_heading",
        to: "（摘要　目的）",
      },
      confidence_policy: "always_auto",
      severity: "error",
      enabled: true,
      example_before: "摘要 目的",
      example_after: "（摘要　目的）",
      manual_review_reason_template: "medical_meaning_risk",
    });

    const loadedRuleSet = await repository.findRuleSetById(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const loadedRule = await repository.findRuleById(
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    );
    const listedRuleSets = await repository.listRuleSetsByTemplateFamilyAndModule(
      "11111111-1111-1111-1111-111111111111",
      "editing",
    );
    const listedRules = await repository.listRulesByRuleSetId(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const nextVersion = await repository.reserveNextRuleSetVersion(
      "11111111-1111-1111-1111-111111111111",
      "editing",
    );

    assert.deepEqual(loadedRuleSet, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      module: "editing",
      version_no: 1,
      status: "draft",
    });
    assert.equal(loadedRule?.action.kind, "replace_heading");
    assert.equal(loadedRule?.action.to, "（摘要　目的）");
    assert.equal(loadedRule?.example_before, "摘要 目的");
    assert.equal(loadedRule?.example_after, "（摘要　目的）");
    assert.equal(listedRuleSets.length, 1);
    assert.equal(listedRules.length, 1);
    assert.equal(nextVersion, 2);
  });
});

async function withMigratedEditorialRulePool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for editorial rule persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await seedEditorialRuleDependencies(pool);
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

async function seedEditorialRuleDependencies(pool: Pool): Promise<void> {
  await pool.query(
    `
      insert into template_families (id, manuscript_type, name, status)
      values ($1, 'clinical_study', 'Editorial family', 'active')
    `,
    ["11111111-1111-1111-1111-111111111111"],
  );
}
