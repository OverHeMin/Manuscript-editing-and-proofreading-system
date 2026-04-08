import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresLearningCandidateRepository } from "../../src/modules/learning/postgres-learning-repository.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres learning candidate repository persists structured candidate payload and suggested rule scope", async () => {
  await withMigratedLearningPool(async (pool) => {
    await seedLearningTemplateContext(pool);

    const repository = new PostgresLearningCandidateRepository({
      client: pool,
    });

    await repository.save({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      type: "rule_candidate",
      status: "pending_review",
      module: "editing",
      manuscript_type: "clinical_study",
      title: "Abstract objective normalization candidate",
      proposal_text: "Normalize the abstract objective heading with full-width punctuation.",
      candidate_payload: {
        source_fragment: "摘要 目的",
        normalized_fragment: "（摘要　目的）",
        object_key: "abstract",
      },
      suggested_rule_object: "abstract",
      suggested_template_family_id: "11111111-1111-1111-1111-111111111111",
      suggested_journal_template_id: "22222222-2222-2222-2222-222222222222",
      created_by: "reviewer-1",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:05:00.000Z",
    });

    const loaded = await repository.findById(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const listed = await repository.listByStatus("pending_review");

    assert.deepEqual(loaded, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      type: "rule_candidate",
      status: "pending_review",
      module: "editing",
      manuscript_type: "clinical_study",
      title: "Abstract objective normalization candidate",
      proposal_text: "Normalize the abstract objective heading with full-width punctuation.",
      candidate_payload: {
        source_fragment: "摘要 目的",
        normalized_fragment: "（摘要　目的）",
        object_key: "abstract",
      },
      suggested_rule_object: "abstract",
      suggested_template_family_id: "11111111-1111-1111-1111-111111111111",
      suggested_journal_template_id: "22222222-2222-2222-2222-222222222222",
      created_by: "reviewer-1",
      created_at: "2026-04-08T10:00:00.000Z",
      updated_at: "2026-04-08T10:05:00.000Z",
    });
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0]?.candidate_payload, {
      source_fragment: "摘要 目的",
      normalized_fragment: "（摘要　目的）",
      object_key: "abstract",
    });
  });
});

async function withMigratedLearningPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for learning persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

async function seedLearningTemplateContext(pool: Pool): Promise<void> {
  await pool.query(
    `
      insert into template_families (id, manuscript_type, name, status)
      values ($1, 'clinical_study', 'Clinical family', 'active')
    `,
    ["11111111-1111-1111-1111-111111111111"],
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
      "22222222-2222-2222-2222-222222222222",
      "11111111-1111-1111-1111-111111111111",
      "journal-alpha",
      "Journal Alpha",
    ],
  );
}
