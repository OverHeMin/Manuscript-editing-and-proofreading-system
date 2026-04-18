import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PostgresResidualIssueRepository } from "../../src/modules/residual-learning/postgres-residual-learning-repository.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres residual issue repository persists structured residual issues", async () => {
  await withMigratedResidualPool(async (pool) => {
    await seedResidualLearningContext(pool);

    const repository = new PostgresResidualIssueRepository({
      client: pool,
    });

    await repository.save({
      id: "residual-1",
      module: "proofreading",
      manuscript_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      manuscript_type: "clinical_study",
      job_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      execution_snapshot_id: "snapshot-1",
      agent_execution_log_id: "agent-log-1",
      output_asset_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      execution_profile_id: "execution-profile-1",
      runtime_binding_id: "runtime-binding-1",
      prompt_template_id: "prompt-template-1",
      retrieval_snapshot_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      issue_type: "terminology_gap",
      source_stage: "model_residual",
      excerpt: "HbA1c term appears with inconsistent casing.",
      location: {
        section: "abstract",
        paragraph_index: 1,
      },
      suggestion: "Normalize HbA1c casing across the manuscript.",
      rationale: "Stable terminology should become reusable guidance.",
      related_rule_ids: ["rule-1"],
      related_knowledge_item_ids: ["knowledge-1"],
      related_quality_issue_ids: ["quality-1"],
      novelty_key: "proofreading:terminology_gap:hba1c",
      recurrence_count: 2,
      model_confidence: 0.84,
      signal_breakdown: {
        recurrence: 2,
        evidence_specificity: "high",
      },
      system_confidence_band: "L2_candidate_ready",
      risk_level: "low",
      recommended_route: "knowledge_candidate",
      status: "validation_pending",
      harness_validation_status: "queued",
      created_at: "2026-04-18T08:00:00.000Z",
      updated_at: "2026-04-18T08:05:00.000Z",
    });

    const loaded = await repository.findById("residual-1");
    const listed = await repository.listByHarnessValidationStatus("queued");

    assert.deepEqual(loaded, {
      id: "residual-1",
      module: "proofreading",
      manuscript_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      manuscript_type: "clinical_study",
      job_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      execution_snapshot_id: "snapshot-1",
      agent_execution_log_id: "agent-log-1",
      output_asset_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      execution_profile_id: "execution-profile-1",
      runtime_binding_id: "runtime-binding-1",
      prompt_template_id: "prompt-template-1",
      retrieval_snapshot_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      issue_type: "terminology_gap",
      source_stage: "model_residual",
      excerpt: "HbA1c term appears with inconsistent casing.",
      location: {
        section: "abstract",
        paragraph_index: 1,
      },
      suggestion: "Normalize HbA1c casing across the manuscript.",
      rationale: "Stable terminology should become reusable guidance.",
      related_rule_ids: ["rule-1"],
      related_knowledge_item_ids: ["knowledge-1"],
      related_quality_issue_ids: ["quality-1"],
      novelty_key: "proofreading:terminology_gap:hba1c",
      recurrence_count: 2,
      model_confidence: 0.84,
      signal_breakdown: {
        recurrence: 2,
        evidence_specificity: "high",
      },
      system_confidence_band: "L2_candidate_ready",
      risk_level: "low",
      recommended_route: "knowledge_candidate",
      status: "validation_pending",
      harness_validation_status: "queued",
      created_at: "2026-04-18T08:00:00.000Z",
      updated_at: "2026-04-18T08:05:00.000Z",
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.novelty_key, "proofreading:terminology_gap:hba1c");
  });
});

async function withMigratedResidualPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for residual-learning persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

async function seedResidualLearningContext(pool: Pool): Promise<void> {
  await pool.query(
    `
      insert into manuscripts (
        id,
        title,
        manuscript_type,
        status,
        created_by
      )
      values ($1, $2, 'clinical_study', 'draft', 'author-1')
    `,
    [
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "Residual-learning manuscript",
    ],
  );

  await pool.query(
    `
      insert into jobs (
        id,
        manuscript_id,
        module,
        job_type,
        status,
        requested_by
      )
      values ($1, $2, 'proofreading', 'proofread', 'completed', 'system')
    `,
    [
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    ],
  );

  await pool.query(
    `
      insert into document_assets (
        id,
        manuscript_id,
        asset_type,
        status,
        storage_key,
        mime_type,
        source_module,
        source_job_id,
        created_by,
        version_no,
        is_current
      )
      values (
        $1,
        $2,
        'proofreading_draft_report',
        'active',
        'residual-learning/output-1.json',
        'application/json',
        'proofreading',
        $3,
        'system',
        1,
        true
      )
    `,
    [
      "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    ],
  );
}
