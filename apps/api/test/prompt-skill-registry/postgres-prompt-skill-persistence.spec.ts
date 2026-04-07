import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { PostgresPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/postgres-prompt-skill-repository.ts";

test("postgres prompt and skill registry repository persists drafts, arrays, and provenance", async () => {
  await withMigratedPromptSkillPool(async (pool) => {
    await seedLearningCandidate(pool, "11111111-1111-1111-1111-111111111111");
    const repository = new PostgresPromptSkillRegistryRepository({
      client: pool,
    });

    await repository.savePromptTemplate({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "proofreading_mainline",
      version: "1.1.0",
      status: "draft",
      module: "proofreading",
      manuscript_types: ["review", "case_report"],
      template_kind: "proofreading_instruction",
      system_instructions:
        "Inspect the manuscript against approved editorial rules.",
      task_frame:
        "Produce a bounded proofreading report without rewriting the manuscript.",
      hard_rule_summary: "摘要 目的 -> （摘要　目的）",
      allowed_content_operations: ["issue_explanation"],
      forbidden_operations: ["rewrite_manuscript"],
      manual_review_policy:
        "Escalate ambiguous medical meaning changes for human review.",
      output_contract: "Return structured findings grouped by severity.",
      report_style: "clinical_report",
      rollback_target_version: "1.0.0",
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });
    await repository.saveSkillPackage({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "editing_skills",
      version: "1.2.0",
      scope: "admin_only",
      status: "draft",
      applies_to_modules: ["editing", "proofreading"],
      dependency_tools: ["python-docx", "libreoffice"],
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });

    const loadedPrompt = await repository.findPromptTemplateById(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const listedPrompts = await repository.listPromptTemplates();
    const namedPrompts = await repository.listPromptTemplatesByNameAndModule(
      "proofreading_mainline",
      "proofreading",
    );
    const loadedSkill = await repository.findSkillPackageById(
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    );
    const listedSkills = await repository.listSkillPackages();
    const namedSkills = await repository.listSkillPackagesByName("editing_skills");

    assert.deepEqual(loadedPrompt, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "proofreading_mainline",
      version: "1.1.0",
      status: "draft",
      module: "proofreading",
      manuscript_types: ["review", "case_report"],
      template_kind: "proofreading_instruction",
      system_instructions:
        "Inspect the manuscript against approved editorial rules.",
      task_frame:
        "Produce a bounded proofreading report without rewriting the manuscript.",
      hard_rule_summary: "摘要 目的 -> （摘要　目的）",
      allowed_content_operations: ["issue_explanation"],
      forbidden_operations: ["rewrite_manuscript"],
      manual_review_policy:
        "Escalate ambiguous medical meaning changes for human review.",
      output_contract: "Return structured findings grouped by severity.",
      report_style: "clinical_report",
      rollback_target_version: "1.0.0",
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });
    assert.deepEqual(listedPrompts, [loadedPrompt]);
    assert.deepEqual(namedPrompts, [loadedPrompt]);
    assert.deepEqual(loadedSkill, {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "editing_skills",
      version: "1.2.0",
      scope: "admin_only",
      status: "draft",
      applies_to_modules: ["editing", "proofreading"],
      dependency_tools: ["python-docx", "libreoffice"],
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });
    assert.deepEqual(listedSkills, [loadedSkill]);
    assert.deepEqual(namedSkills, [loadedSkill]);
  });
});

test("postgres prompt registry preserves any manuscript scope and published ordering", async () => {
  await withMigratedPromptSkillPool(async (pool) => {
    const repository = new PostgresPromptSkillRegistryRepository({
      client: pool,
    });

    await repository.savePromptTemplate({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      name: "screening_mainline",
      version: "1.0.0",
      status: "archived",
      module: "screening",
      manuscript_types: "any",
      template_kind: "editing_instruction",
      system_instructions:
        "Apply governed screening-safe content adjustments only.",
      task_frame: "Operate only within approved screening instruction boundaries.",
      allowed_content_operations: ["sentence_rewrite"],
      forbidden_operations: ["fabricate_data"],
      manual_review_policy: "Escalate uncertain wording changes.",
      output_contract: "Return a bounded editorial payload.",
    });
    await repository.savePromptTemplate({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
      name: "screening_mainline",
      version: "1.1.0",
      status: "published",
      module: "screening",
      manuscript_types: "any",
      template_kind: "editing_instruction",
      system_instructions:
        "Apply governed screening-safe content adjustments only.",
      task_frame: "Operate only within approved screening instruction boundaries.",
      allowed_content_operations: [
        "sentence_rewrite",
        "paragraph_reshape",
      ],
      forbidden_operations: ["fabricate_data", "change_medical_meaning"],
      manual_review_policy: "Escalate uncertain wording changes.",
      output_contract: "Return a bounded editorial payload.",
    });

    const prompts = await repository.listPromptTemplatesByNameAndModule(
      "screening_mainline",
      "screening",
    );

    assert.deepEqual(
      prompts.map((record) => ({
        id: record.id,
        version: record.version,
        status: record.status,
        manuscript_types: record.manuscript_types,
        template_kind: record.template_kind,
      })),
      [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
          version: "1.0.0",
          status: "archived",
          manuscript_types: "any",
          template_kind: "editing_instruction",
        },
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
          version: "1.1.0",
          status: "published",
          manuscript_types: "any",
          template_kind: "editing_instruction",
        },
      ],
    );
  });
});

async function withMigratedPromptSkillPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for prompt/skill persistence test database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

async function seedLearningCandidate(pool: Pool, candidateId: string): Promise<void> {
  await pool.query(
    `
      insert into learning_candidates (
        id,
        type,
        status,
        module,
        manuscript_type,
        created_by,
        title,
        proposal_text,
        created_at,
        updated_at
      )
      values (
        $1,
        'prompt_optimization_candidate',
        'approved',
        'proofreading',
        'review',
        'test-seed',
        'Prompt candidate',
        'Promote reviewed prompt changes.',
        '2026-03-30T09:00:00.000Z',
        '2026-03-30T09:05:00.000Z'
      )
    `,
    [candidateId],
  );
}
