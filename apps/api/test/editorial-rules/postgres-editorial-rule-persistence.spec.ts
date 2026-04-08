import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { PostgresEditorialRuleRepository } from "../../src/modules/editorial-rules/postgres-editorial-rule-repository.ts";

test("postgres editorial rule repository persists journal templates, scoped rule sets, and enriched rule payloads", async () => {
  await withMigratedEditorialRulePool(async (pool) => {
    const repository = new PostgresEditorialRuleRepository({
      client: pool,
    });

    await pool.query(
      `
        insert into journal_template_profiles (
          id,
          template_family_id,
          journal_key,
          journal_name,
          status
        )
        values ($1, $2, $3, $4, 'active')
      `,
      [
        "22222222-2222-2222-2222-222222222222",
        "11111111-1111-1111-1111-111111111111",
        "journal-alpha",
        "Journal Alpha",
      ],
    );

    await repository.saveRuleSet({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      module: "editing",
      version_no: 1,
      status: "draft",
    });
    await repository.saveRuleSet({
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      journal_template_id: "22222222-2222-2222-2222-222222222222",
      module: "editing",
      version_no: 1,
      status: "draft",
    });
    await assert.rejects(
      () =>
        repository.saveRuleSet({
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          template_family_id: "11111111-1111-1111-1111-111111111111",
          journal_template_id: "44444444-4444-4444-4444-444444444444",
          module: "editing",
          version_no: 1,
          status: "draft",
        }),
      (error: { code?: string }) => error.code === "23503",
    );

    await repository.saveRule({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      rule_set_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      order_no: 10,
      rule_object: "abstract",
      rule_type: "format",
      execution_mode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      selector: {
        section_selector: "abstract",
        label_selector: { text: "Abstract Purpose" },
      },
      trigger: {
        kind: "exact_text",
        text: "Abstract Purpose",
      },
      action: {
        kind: "replace_heading",
        to: "(Abstract Purpose)",
      },
      authoring_payload: {
        source: "manual_authoring",
        form_version: 1,
      },
      explanation_payload: {
        rationale: "Structured abstract labels must follow the journal house style.",
        correct_example: "（摘要　目的）",
        incorrect_example: "摘要 目的",
        review_prompt: "Confirm the abstract objective heading keeps full-width punctuation.",
      },
      linkage_payload: {
        source_learning_candidate_id: "candidate-abstract-1",
        source_snapshot_asset_id: "snapshot-abstract-1",
        overrides_rule_ids: ["legacy-abstract-rule-1"],
      },
      projection_payload: {
        projection_kind: "rule",
        summary: "Normalize the abstract objective label for this journal profile.",
        standard_example: "（摘要　目的）",
        incorrect_example: "摘要 目的",
      },
      evidence_level: "high",
      confidence_policy: "always_auto",
      severity: "error",
      enabled: true,
      example_before: "Abstract Purpose",
      example_after: "(Abstract Purpose)",
      manual_review_reason_template: "medical_meaning_risk",
    });

    const persistedJournalTemplateResult = await pool.query<{
      id: string;
      template_family_id: string;
      journal_key: string;
      journal_name: string;
      status: string;
    }>(
      `
        select
          id,
          template_family_id,
          journal_key,
          journal_name,
          status::text as status
        from journal_template_profiles
        where id = $1
      `,
      ["22222222-2222-2222-2222-222222222222"],
    );

    const loadedBaseRuleSet = await repository.findRuleSetById(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const loadedJournalRuleSet = await repository.findRuleSetById(
      "cccccccc-cccc-cccc-cccc-cccccccccccc",
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
    const nextBaseVersion = await repository.reserveNextRuleSetVersion(
      "11111111-1111-1111-1111-111111111111",
      "editing",
    );
    const nextJournalVersion = await repository.reserveNextRuleSetVersion(
      "11111111-1111-1111-1111-111111111111",
      "editing",
      "22222222-2222-2222-2222-222222222222",
    );
    const firstOtherJournalVersion = await repository.reserveNextRuleSetVersion(
      "11111111-1111-1111-1111-111111111111",
      "editing",
      "33333333-3333-3333-3333-333333333333",
    );

    assert.deepEqual(persistedJournalTemplateResult.rows[0], {
      id: "22222222-2222-2222-2222-222222222222",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      journal_key: "journal-alpha",
      journal_name: "Journal Alpha",
      status: "active",
    });

    assert.deepEqual(loadedBaseRuleSet, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      module: "editing",
      version_no: 1,
      status: "draft",
    });
    assert.deepEqual(loadedJournalRuleSet, {
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      template_family_id: "11111111-1111-1111-1111-111111111111",
      journal_template_id: "22222222-2222-2222-2222-222222222222",
      module: "editing",
      version_no: 1,
      status: "draft",
    });

    assert.equal(loadedRule?.action.kind, "replace_heading");
    assert.equal(loadedRule?.action.to, "(Abstract Purpose)");
    assert.deepEqual(loadedRule?.selector, {
      section_selector: "abstract",
      label_selector: { text: "Abstract Purpose" },
    });
    assert.deepEqual(loadedRule?.authoring_payload, {
      source: "manual_authoring",
      form_version: 1,
    });
    assert.deepEqual(loadedRule?.explanation_payload, {
      rationale: "Structured abstract labels must follow the journal house style.",
      correct_example: "（摘要　目的）",
      incorrect_example: "摘要 目的",
      review_prompt: "Confirm the abstract objective heading keeps full-width punctuation.",
    });
    assert.deepEqual(loadedRule?.linkage_payload, {
      source_learning_candidate_id: "candidate-abstract-1",
      source_snapshot_asset_id: "snapshot-abstract-1",
      overrides_rule_ids: ["legacy-abstract-rule-1"],
    });
    assert.deepEqual(loadedRule?.projection_payload, {
      projection_kind: "rule",
      summary: "Normalize the abstract objective label for this journal profile.",
      standard_example: "（摘要　目的）",
      incorrect_example: "摘要 目的",
    });
    assert.equal(loadedRule?.example_before, "Abstract Purpose");
    assert.equal(loadedRule?.example_after, "(Abstract Purpose)");

    assert.equal(listedRuleSets.length, 2);
    assert.deepEqual(
      listedRuleSets.map(
        (ruleSet) => ruleSet.journal_template_id ?? null,
      ),
      [null, "22222222-2222-2222-2222-222222222222"],
    );

    assert.equal(listedRules.length, 1);
    assert.equal(nextBaseVersion, 2);
    assert.equal(nextJournalVersion, 2);
    assert.equal(firstOtherJournalVersion, 1);
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
  await pool.query(
    `
      insert into template_families (id, manuscript_type, name, status)
      values ($1, 'review', 'Review family', 'active')
    `,
    ["33333333-3333-3333-3333-333333333333"],
  );
  await pool.query(
    `
      insert into journal_template_profiles (
        id,
        template_family_id,
        journal_key,
        journal_name,
        status
      )
      values ($1, $2, $3, $4, 'active')
    `,
    [
      "44444444-4444-4444-4444-444444444444",
      "33333333-3333-3333-3333-333333333333",
      "journal-beta",
      "Journal Beta",
    ],
  );
}
