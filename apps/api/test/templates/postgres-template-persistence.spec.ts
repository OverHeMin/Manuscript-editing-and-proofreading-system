import test from "node:test";
import assert from "node:assert/strict";
import { Pool, type PoolClient } from "pg";
import { InMemoryLearningCandidateRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { createPostgresWriteTransactionManager } from "../../src/modules/shared/write-transaction-manager.ts";
import {
  PostgresModuleTemplateRepository,
  PostgresTemplateFamilyRepository,
} from "../../src/modules/templates/postgres-template-repository.ts";
import {
  TemplateFamilyActiveConflictError,
  TemplateGovernanceService,
} from "../../src/modules/templates/template-governance-service.ts";
import type { ModuleTemplateRecord } from "../../src/modules/templates/template-record.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

class FailingPostgresModuleTemplateRepository extends PostgresModuleTemplateRepository {
  constructor(
    dependencies: { client: QueryableClient },
    private readonly shouldFail: (record: ModuleTemplateRecord) => boolean,
  ) {
    super(dependencies);
  }

  override async save(record: ModuleTemplateRecord): Promise<void> {
    if (this.shouldFail(record)) {
      throw new Error(`Injected template write failure for ${record.id}.`);
    }

    await super.save(record);
  }
}

const activeTemplateFamilyConstraintName =
  "template_families_active_manuscript_type_uidx";

test("postgres template repositories persist template families, versions, and provenance", async () => {
  await withMigratedTemplatePool(async (pool) => {
    await seedLearningCandidate(pool, "11111111-1111-1111-1111-111111111111");
    const templateFamilyRepository = new PostgresTemplateFamilyRepository({
      client: pool,
    });
    const moduleTemplateRepository = new PostgresModuleTemplateRepository({
      client: pool,
    });

    await templateFamilyRepository.save({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      manuscript_type: "review",
      name: "Review family",
      status: "active",
    });
    await moduleTemplateRepository.save({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
      template_family_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      module: "editing",
      manuscript_type: "review",
      version_no: 1,
      status: "published",
      prompt: "Normalize medical terminology.",
      checklist: ["Terminology", "References"],
      section_requirements: ["results", "discussion"],
    });
    await moduleTemplateRepository.save({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
      template_family_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      module: "editing",
      manuscript_type: "review",
      version_no: 2,
      status: "draft",
      prompt: "Add evidence phrasing checks.",
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });

    const loadedFamily = await templateFamilyRepository.findById(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const listedFamilies = await templateFamilyRepository.list();
    const loadedTemplate = await moduleTemplateRepository.findById(
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
    );
    const listedTemplates = await moduleTemplateRepository.listByTemplateFamilyId(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );

    assert.deepEqual(loadedFamily, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      manuscript_type: "review",
      name: "Review family",
      status: "active",
    });
    assert.deepEqual(listedFamilies, [
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        manuscript_type: "review",
        name: "Review family",
        status: "active",
      },
    ]);
    assert.deepEqual(loadedTemplate, {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
      template_family_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      module: "editing",
      manuscript_type: "review",
      version_no: 2,
      status: "draft",
      prompt: "Add evidence phrasing checks.",
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });
    assert.deepEqual(
      listedTemplates.map((template) => ({
        id: template.id,
        version_no: template.version_no,
        status: template.status,
        checklist: template.checklist,
        section_requirements: template.section_requirements,
        source_learning_candidate_id: template.source_learning_candidate_id,
      })),
      [
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
          version_no: 1,
          status: "published",
          checklist: ["Terminology", "References"],
          section_requirements: ["results", "discussion"],
          source_learning_candidate_id: undefined,
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
          version_no: 2,
          status: "draft",
          checklist: undefined,
          section_requirements: undefined,
          source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
        },
      ],
    );
  });
});

test("postgres template governance reserves unique version numbers under concurrent draft creation", async () => {
  await withMigratedTemplatePool(async (pool) => {
    const {
      service,
      moduleTemplateRepository,
      createTemplateFamily,
    } = createPostgresTemplateHarness(pool, {
      issuedIds: [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
      ],
    });

    const family = await createTemplateFamily({
      manuscriptType: "review",
      name: "Concurrent review family",
    });

    const [firstDraft, secondDraft] = await Promise.all([
      service.createModuleTemplateDraft({
        templateFamilyId: family.id,
        module: "screening",
        manuscriptType: "review",
        prompt: "Concurrent screening draft A",
      }),
      service.createModuleTemplateDraft({
        templateFamilyId: family.id,
        module: "screening",
        manuscriptType: "review",
        prompt: "Concurrent screening draft B",
      }),
    ]);

    const storedTemplates =
      await moduleTemplateRepository.listByTemplateFamilyIdAndModule(
        family.id,
        "screening",
      );

    assert.deepEqual(
      [firstDraft.version_no, secondDraft.version_no].sort(
        (left, right) => left - right,
      ),
      [1, 2],
    );
    assert.deepEqual(
      storedTemplates.map((template) => ({
        id: template.id,
        version_no: template.version_no,
        status: template.status,
      })),
      [
        {
          id: storedTemplates[0]?.id,
          version_no: 1,
          status: "draft",
        },
        {
          id: storedTemplates[1]?.id,
          version_no: 2,
          status: "draft",
        },
      ],
    );
  });
});

test("postgres template governance publishes newer revisions, archives prior versions, and keeps learning provenance", async () => {
  await withMigratedTemplatePool(async (pool) => {
    await seedLearningCandidate(pool, "11111111-1111-1111-1111-111111111111");
    const learningCandidateRepository = new InMemoryLearningCandidateRepository();
    await learningCandidateRepository.save({
      id: "11111111-1111-1111-1111-111111111111",
      type: "template_update_candidate",
      status: "approved",
      module: "editing",
      manuscript_type: "review",
      created_by: "admin-1",
      created_at: "2026-03-30T09:00:00.000Z",
      updated_at: "2026-03-30T09:05:00.000Z",
    });

    const {
      service,
      moduleTemplateRepository,
      createTemplateFamily,
    } = createPostgresTemplateHarness(pool, {
      learningCandidateRepository,
      issuedIds: [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
      ],
    });

    const family = await createTemplateFamily({
      manuscriptType: "review",
      name: "Publishing review family",
    });
    const firstDraft = await service.createModuleTemplateDraft({
      templateFamilyId: family.id,
      module: "editing",
      manuscriptType: "review",
      prompt: "Editing prompt v1",
    });
    await service.publishModuleTemplate(firstDraft.id, "admin");

    const secondDraft =
      await service.createModuleTemplateDraftFromLearningCandidate("admin", {
        sourceLearningCandidateId: "11111111-1111-1111-1111-111111111111",
        templateFamilyId: family.id,
        module: "editing",
        manuscriptType: "review",
        prompt: "Editing prompt v2",
        checklist: ["Flow"],
      });
    const secondPublished = await service.publishModuleTemplate(
      secondDraft.id,
      "admin",
    );

    const storedTemplates =
      await moduleTemplateRepository.listByTemplateFamilyIdAndModule(
        family.id,
        "editing",
      );

    assert.equal(secondDraft.source_learning_candidate_id, "11111111-1111-1111-1111-111111111111");
    assert.equal(secondPublished.status, "published");
    assert.deepEqual(
      storedTemplates.map((template) => ({
        id: template.id,
        status: template.status,
        version_no: template.version_no,
        source_learning_candidate_id: template.source_learning_candidate_id,
      })),
      [
        {
          id: firstDraft.id,
          status: "archived",
          version_no: 1,
          source_learning_candidate_id: undefined,
        },
        {
          id: secondDraft.id,
          status: "published",
          version_no: 2,
          source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
        },
      ],
    );
  });
});

test("postgres template governance updates draft content in place without changing version lineage", async () => {
  await withMigratedTemplatePool(async (pool) => {
    const { service, moduleTemplateRepository, createTemplateFamily } =
      createPostgresTemplateHarness(pool, {
        issuedIds: [
          "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
        ],
      });

    const family = await createTemplateFamily({
      manuscriptType: "review",
      name: "Draft update family",
    });
    const draft = await service.createModuleTemplateDraft({
      templateFamilyId: family.id,
      module: "editing",
      manuscriptType: "review",
      prompt: "Draft prompt v1",
      checklist: ["Terminology"],
      sectionRequirements: ["discussion"],
    });

    const updated = await service.updateModuleTemplateDraft(draft.id, {
      prompt: "Draft prompt v2",
      checklist: ["Terminology", "Consistency"],
      sectionRequirements: ["results", "discussion"],
    });
    const stored = await moduleTemplateRepository.findById(draft.id);

    assert.deepEqual(updated, {
      id: draft.id,
      template_family_id: family.id,
      module: "editing",
      manuscript_type: "review",
      version_no: 1,
      status: "draft",
      prompt: "Draft prompt v2",
      checklist: ["Terminology", "Consistency"],
      section_requirements: ["results", "discussion"],
    });
    assert.deepEqual(stored, updated);
  });
});

test("postgres template governance rejects activating a second family for the same manuscript type", async () => {
  await withMigratedTemplatePool(async (pool) => {
    const { service } = createPostgresTemplateHarness(pool, {
      issuedIds: [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab",
      ],
    });
    const firstFamily = await service.createTemplateFamily({
      manuscriptType: "review",
      name: "Review Family A",
    });
    const secondFamily = await service.createTemplateFamily({
      manuscriptType: "review",
      name: "Review Family B",
    });

    await service.updateTemplateFamily(firstFamily.id, {
      status: "active",
    });

    await assert.rejects(
      () =>
        service.updateTemplateFamily(secondFamily.id, {
          status: "active",
        }),
      /active/i,
    );

    const templateFamilyRepository = new PostgresTemplateFamilyRepository({
      client: pool,
    });
    const listedFamilies = await templateFamilyRepository.list();
    assert.deepEqual(
      listedFamilies.map((family) => ({
        id: family.id,
        status: family.status,
      })),
      [
        {
          id: firstFamily.id,
          status: "active",
        },
        {
          id: secondFamily.id,
          status: "draft",
        },
      ],
    );
  });
});

test("postgres template schema rejects multiple active families for the same manuscript type", async () => {
  await withMigratedTemplatePool(async (pool) => {
    await pool.query(
      `
        insert into template_families (
          id,
          manuscript_type,
          name,
          status
        )
        values (
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
          'review',
          'Schema review family A',
          'active'
        )
      `,
    );

    await assert.rejects(
      () =>
        pool.query(
          `
            insert into template_families (
              id,
              manuscript_type,
              name,
              status
            )
            values (
              'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
              'review',
              'Schema review family B',
              'active'
            )
          `,
        ),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "23505");
        assert.equal(
          (error as { constraint?: string }).constraint,
          activeTemplateFamilyConstraintName,
        );
        return true;
      },
      "Expected PostgreSQL to reject a second active family for the same manuscript type.",
    );
  });
});

test("postgres template family repository translates active-family unique violations into a domain conflict", async () => {
  await withMigratedTemplatePool(async (pool) => {
    const templateFamilyRepository = new PostgresTemplateFamilyRepository({
      client: pool,
    });

    await templateFamilyRepository.save({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      manuscript_type: "review",
      name: "Repository review family A",
      status: "active",
    });

    await assert.rejects(
      () =>
        templateFamilyRepository.save({
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
          manuscript_type: "review",
          name: "Repository review family B",
          status: "active",
        }),
      (error: unknown) => {
        assert.ok(error instanceof TemplateFamilyActiveConflictError);
        assert.match(error.message, /already active/i);
        return true;
      },
      "Expected repository save to translate unique violations into TemplateFamilyActiveConflictError.",
    );
  });
});

test("postgres template governance rolls back archived prior versions when the publish write fails", async () => {
  await withMigratedTemplatePool(async (pool) => {
    let failOnTemplateId: string | undefined;
    const {
      service,
      moduleTemplateRepository,
      createTemplateFamily,
    } = createPostgresTemplateHarness(pool, {
      issuedIds: [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
      ],
      createModuleTemplateRepository: (client) =>
        new FailingPostgresModuleTemplateRepository(
          { client },
          (record) =>
            record.id === failOnTemplateId && record.status === "published",
        ),
    });

    const family = await createTemplateFamily({
      manuscriptType: "clinical_study",
      name: "Rollback family",
    });
    const firstDraft = await service.createModuleTemplateDraft({
      templateFamilyId: family.id,
      module: "editing",
      manuscriptType: "clinical_study",
      prompt: "Editing prompt v1",
    });
    await service.publishModuleTemplate(firstDraft.id, "admin");

    const secondDraft = await service.createModuleTemplateDraft({
      templateFamilyId: family.id,
      module: "editing",
      manuscriptType: "clinical_study",
      prompt: "Editing prompt v2",
    });
    failOnTemplateId = secondDraft.id;

    await assert.rejects(
      () => service.publishModuleTemplate(secondDraft.id, "admin"),
      /template write failure/i,
    );

    const storedTemplates =
      await moduleTemplateRepository.listByTemplateFamilyIdAndModule(
        family.id,
        "editing",
      );

    assert.deepEqual(
      storedTemplates.map((template) => ({
        id: template.id,
        status: template.status,
        version_no: template.version_no,
      })),
      [
        {
          id: firstDraft.id,
          status: "published",
          version_no: 1,
        },
        {
          id: secondDraft.id,
          status: "draft",
          version_no: 2,
        },
      ],
    );
  });
});

function createPostgresTemplateHarness(
  pool: Pool,
  options: {
    issuedIds: string[];
    learningCandidateRepository?: InMemoryLearningCandidateRepository;
    createModuleTemplateRepository?: (
      client: QueryableClient,
    ) => PostgresModuleTemplateRepository;
  },
): {
  service: TemplateGovernanceService;
  moduleTemplateRepository: PostgresModuleTemplateRepository;
  createTemplateFamily: (input: {
    manuscriptType: "review" | "clinical_study";
    name: string;
  }) => Promise<{ id: string }>;
} {
  const templateFamilyRepository = new PostgresTemplateFamilyRepository({
    client: pool,
  });
  const moduleTemplateRepository =
    options.createModuleTemplateRepository?.(pool) ??
    new PostgresModuleTemplateRepository({ client: pool });
  const createId = (() => {
    const ids = [...options.issuedIds];
    return () => {
      const value = ids.shift();
      assert.ok(value, "Expected a PostgreSQL template id.");
      return value;
    };
  })();
  const service = new TemplateGovernanceService({
    templateFamilyRepository,
    moduleTemplateRepository,
    learningCandidateRepository: options.learningCandidateRepository,
    transactionManager: createPostgresWriteTransactionManager({
      getClient: async () => pool.connect(),
      createContext: (client) => ({
        templateFamilyRepository: new PostgresTemplateFamilyRepository({
          client: client as PoolClient,
        }),
        moduleTemplateRepository:
          options.createModuleTemplateRepository?.(client as PoolClient) ??
          new PostgresModuleTemplateRepository({
            client: client as PoolClient,
          }),
      }),
    }),
    createId,
  });

  return {
    service,
    moduleTemplateRepository,
    createTemplateFamily: async (input) => {
      const family = await service.createTemplateFamily(input);
      return { id: family.id };
    },
  };
}

async function withMigratedTemplatePool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary template persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
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
  client: QueryableClient,
  candidateId: string,
): Promise<void> {
  await client.query(
    `
      insert into learning_candidates (
        id,
        type,
        status,
        module,
        manuscript_type,
        created_by,
        title,
        proposal_text
      )
      values (
        $1,
        'template_update_candidate',
        'approved',
        'editing',
        'review',
        'test-seed',
        'Seeded template learning candidate',
        'Seeded provenance for template persistence tests.'
      )
    `,
    [candidateId],
  );
}
