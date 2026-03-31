import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { InMemoryLearningCandidateRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { InMemoryKnowledgeRepository, InMemoryKnowledgeReviewActionRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";
import {
  LearningGovernanceConflictError,
  LearningGovernanceService,
} from "../../src/modules/learning-governance/learning-governance-service.ts";
import { PostgresLearningGovernanceRepository } from "../../src/modules/learning-governance/postgres-learning-governance-repository.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { PromptSkillRegistryService } from "../../src/modules/prompt-skill-registry/prompt-skill-service.ts";
import { createPostgresWriteTransactionManager } from "../../src/modules/shared/write-transaction-manager.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { TemplateGovernanceService } from "../../src/modules/templates/template-governance-service.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

test("postgres learning governance repository persists drafts, applied metadata, and candidate ordering", async () => {
  await withMigratedLearningGovernancePool(async (pool) => {
    await seedLearningCandidate(pool, {
      id: "11111111-1111-1111-1111-111111111111",
      type: "rule_candidate",
      module: "screening",
      manuscriptType: "clinical_study",
    });
    const repository = new PostgresLearningGovernanceRepository({ client: pool });

    await repository.save({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      learning_candidate_id: "11111111-1111-1111-1111-111111111111",
      target_type: "knowledge_item",
      status: "draft",
      created_by: "admin-1",
      created_at: "2026-03-30T09:00:00.000Z",
    });
    await repository.save({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      learning_candidate_id: "11111111-1111-1111-1111-111111111111",
      target_type: "module_template",
      status: "applied",
      created_by: "admin-1",
      created_at: "2026-03-30T09:05:00.000Z",
      created_draft_asset_id: "template-draft-1",
      applied_by: "admin-2",
      applied_at: "2026-03-30T09:10:00.000Z",
    });

    const loaded = await repository.findById(
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    );
    const listedByCandidate = await repository.listByCandidateId(
      "11111111-1111-1111-1111-111111111111",
    );

    assert.deepEqual(loaded, {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      learning_candidate_id: "11111111-1111-1111-1111-111111111111",
      target_type: "module_template",
      status: "applied",
      created_by: "admin-1",
      created_at: "2026-03-30T09:05:00.000Z",
      created_draft_asset_id: "template-draft-1",
      applied_by: "admin-2",
      applied_at: "2026-03-30T09:10:00.000Z",
    });
    assert.deepEqual(
      listedByCandidate.map((record) => ({
        id: record.id,
        status: record.status,
        target_type: record.target_type,
        created_draft_asset_id: record.created_draft_asset_id,
      })),
      [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          status: "draft",
          target_type: "knowledge_item",
          created_draft_asset_id: undefined,
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          status: "applied",
          target_type: "module_template",
          created_draft_asset_id: "template-draft-1",
        },
      ],
    );
  });
});

test("postgres learning governance service rejects duplicate active targets at the service layer", async () => {
  await withMigratedLearningGovernancePool(async (pool) => {
    await seedLearningCandidate(pool, {
      id: "11111111-1111-1111-1111-111111111111",
      type: "prompt_optimization_candidate",
      module: "proofreading",
      manuscriptType: "review",
    });
    const { service, learningCandidateRepository, repository } =
      createPostgresLearningGovernanceHarness(pool);

    await learningCandidateRepository.save({
      id: "11111111-1111-1111-1111-111111111111",
      type: "prompt_optimization_candidate",
      status: "approved",
      module: "proofreading",
      manuscript_type: "review",
      created_by: "editor-1",
      created_at: "2026-03-30T08:00:00.000Z",
      updated_at: "2026-03-30T08:05:00.000Z",
    });

    const first = await service.createWriteback("admin", {
      learningCandidateId: "11111111-1111-1111-1111-111111111111",
      targetType: "prompt_template",
      createdBy: "admin-1",
    });

    await assert.rejects(
      () =>
        service.createWriteback("admin", {
          learningCandidateId: "11111111-1111-1111-1111-111111111111",
          targetType: "prompt_template",
          createdBy: "admin-1",
        }),
      LearningGovernanceConflictError,
    );

    const stored = await repository.listByCandidateId(
      "11111111-1111-1111-1111-111111111111",
    );

    assert.equal(first.status, "draft");
    assert.deepEqual(
      stored.map((record) => ({
        id: record.id,
        status: record.status,
        target_type: record.target_type,
      })),
      [
        {
          id: first.id,
          status: "draft",
          target_type: "prompt_template",
        },
      ],
    );
  });
});

test("postgres learning governance service persists applied metadata and created draft asset ids", async () => {
  await withMigratedLearningGovernancePool(async (pool) => {
    await seedLearningCandidate(pool, {
      id: "11111111-1111-1111-1111-111111111111",
      type: "rule_candidate",
      module: "screening",
      manuscriptType: "clinical_study",
    });
    const { service, learningCandidateRepository, repository } =
      createPostgresLearningGovernanceHarness(pool);

    await learningCandidateRepository.save({
      id: "11111111-1111-1111-1111-111111111111",
      type: "rule_candidate",
      status: "approved",
      module: "screening",
      manuscript_type: "clinical_study",
      created_by: "editor-1",
      created_at: "2026-03-30T08:00:00.000Z",
      updated_at: "2026-03-30T08:05:00.000Z",
    });

    const draft = await service.createWriteback("admin", {
      learningCandidateId: "11111111-1111-1111-1111-111111111111",
      targetType: "knowledge_item",
      createdBy: "admin-1",
    });
    const applied = await service.applyWriteback("admin", {
      writebackId: draft.id,
      targetType: "knowledge_item",
      appliedBy: "admin-2",
      title: "Primary endpoint rule",
      canonicalText: "Clinical studies must disclose the primary endpoint.",
      knowledgeKind: "rule",
      moduleScope: "screening",
      manuscriptTypes: ["clinical_study"],
    });
    const loaded = await repository.findById(draft.id);

    assert.equal(applied.status, "applied");
    assert.equal(applied.created_draft_asset_id, "knowledge-1");
    assert.deepEqual(loaded, {
      id: draft.id,
      learning_candidate_id: "11111111-1111-1111-1111-111111111111",
      target_type: "knowledge_item",
      status: "applied",
      created_by: "admin-1",
      created_at: "2026-03-30T08:10:00.000Z",
      created_draft_asset_id: "knowledge-1",
      applied_by: "admin-2",
      applied_at: "2026-03-30T08:10:00.000Z",
    });
  });
});

function createPostgresLearningGovernanceHarness(pool: Pool): {
  service: LearningGovernanceService;
  repository: PostgresLearningGovernanceRepository;
  learningCandidateRepository: InMemoryLearningCandidateRepository;
} {
  const learningCandidateRepository = new InMemoryLearningCandidateRepository();
  const repository = new PostgresLearningGovernanceRepository({ client: pool });
  const knowledgeService = new KnowledgeService({
    repository: new InMemoryKnowledgeRepository(),
    reviewActionRepository: new InMemoryKnowledgeReviewActionRepository(),
    learningCandidateRepository,
    createId: (() => {
      const ids = ["knowledge-1", "review-action-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a PostgreSQL learning governance id.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-30T08:10:00.000Z"),
  });
  const templateService = new TemplateGovernanceService({
    templateFamilyRepository: new InMemoryTemplateFamilyRepository(),
    moduleTemplateRepository: new InMemoryModuleTemplateRepository(),
    learningCandidateRepository,
    createId: (() => {
      const ids = ["family-1", "template-1", "template-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a PostgreSQL template governance id.");
        return value;
      };
    })(),
  });
  const promptSkillRegistryService = new PromptSkillRegistryService({
    repository: new InMemoryPromptSkillRegistryRepository(),
    learningCandidateRepository,
    createId: (() => {
      const ids = ["skill-1", "prompt-1", "skill-2", "prompt-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a PostgreSQL prompt-skill governance id.");
        return value;
      };
    })(),
  });
  const service = new LearningGovernanceService({
    repository,
    learningCandidateRepository,
    knowledgeService,
    templateService,
    promptSkillRegistryService,
    transactionManager: createPostgresWriteTransactionManager({
      getClient: async () => pool.connect(),
      createContext: (client) => ({
        repository: new PostgresLearningGovernanceRepository({ client }),
      }),
    }),
    createId: (() => {
      const ids = [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "cccccccc-cccc-cccc-cccc-cccccccccccc",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a PostgreSQL learning writeback id.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-30T08:10:00.000Z"),
  });

  return {
    service,
    repository,
    learningCandidateRepository,
  };
}

async function withMigratedLearningGovernancePool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary learning governance database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const pool = new Pool({
      connectionString: databaseUrl,
      max: 8,
    });

    try {
      await run(pool);
    } finally {
      await pool.end();
    }
  });
}

async function seedLearningCandidate(
  pool: Pool,
  input: {
    id: string;
    type:
      | "rule_candidate"
      | "prompt_optimization_candidate";
    module: "screening" | "proofreading";
    manuscriptType: "clinical_study" | "review";
  },
): Promise<void> {
  await pool.query(
    `
      insert into learning_candidates (
        id,
        type,
        status,
        module,
        manuscript_type
      )
      values ($1, $2, 'approved', $3, $4)
    `,
    [input.id, input.type, input.module, input.manuscriptType],
  );
}
