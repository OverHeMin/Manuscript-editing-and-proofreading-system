import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import {
  createPostgresWriteTransactionManager,
} from "../../src/modules/shared/write-transaction-manager.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";
import type { KnowledgeReviewActionRecord } from "../../src/modules/knowledge/knowledge-record.ts";
import {
  PostgresKnowledgeRepository,
  PostgresKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/postgres-knowledge-repository.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";

class FailingPostgresKnowledgeReviewActionRepository
  extends PostgresKnowledgeReviewActionRepository
{
  constructor(
    dependencies: { client: Client },
    private readonly shouldFail: (record: KnowledgeReviewActionRecord) => boolean,
  ) {
    super(dependencies);
  }

  override async save(record: KnowledgeReviewActionRecord): Promise<void> {
    if (this.shouldFail(record)) {
      throw new Error(`Injected review action write failure for ${record.action}.`);
    }

    await super.save(record);
  }
}

test("postgres knowledge repositories persist routing arrays, any scope, and provenance", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    await seedLearningCandidate(client, "11111111-1111-1111-1111-111111111111");
    const repository = new PostgresKnowledgeRepository({ client });

    await repository.save({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      title: "Persistent knowledge draft",
      canonical_text: "Clinical studies must disclose the primary endpoint.",
      knowledge_kind: "rule",
      status: "draft",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        sections: ["methods"],
        risk_tags: ["statistics"],
        discipline_tags: ["cardiology"],
      },
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.org/guideline",
      aliases: ["endpoint rule"],
      template_bindings: ["clinical-study-screening-core"],
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });
    await repository.save({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      title: "Any-scope privacy checklist",
      canonical_text: "Case report patient identifiers must be removed.",
      knowledge_kind: "checklist",
      status: "pending_review",
      routing: {
        module_scope: "any",
        manuscript_types: "any",
      },
    });

    const loaded = await repository.findById("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const pending = await repository.listByStatus("pending_review");

    assert.deepEqual(loaded, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      title: "Persistent knowledge draft",
      canonical_text: "Clinical studies must disclose the primary endpoint.",
      knowledge_kind: "rule",
      status: "draft",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
        sections: ["methods"],
        risk_tags: ["statistics"],
        discipline_tags: ["cardiology"],
      },
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.org/guideline",
      aliases: ["endpoint rule"],
      template_bindings: ["clinical-study-screening-core"],
      source_learning_candidate_id: "11111111-1111-1111-1111-111111111111",
    });
    assert.deepEqual(pending, [
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        title: "Any-scope privacy checklist",
        canonical_text: "Case report patient identifiers must be removed.",
        knowledge_kind: "checklist",
        status: "pending_review",
        routing: {
          module_scope: "any",
          manuscript_types: "any",
        },
      },
    ]);
  });
});

test("postgres knowledge review action repository returns note-aware history in created order", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const knowledgeRepository = new PostgresKnowledgeRepository({ client });
    const repository = new PostgresKnowledgeReviewActionRepository({ client });

    await knowledgeRepository.save({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      title: "History target item",
      canonical_text: "History target text.",
      knowledge_kind: "rule",
      status: "pending_review",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
    });

    await repository.save({
      id: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
      knowledge_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      action: "submitted_for_review",
      actor_role: "user",
      created_at: "2026-03-30T08:00:00.000Z",
    });
    await repository.save({
      id: "cccccccc-cccc-cccc-cccc-ccccccccccc2",
      knowledge_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      action: "approved",
      actor_role: "knowledge_reviewer",
      review_note: "Looks good.",
      created_at: "2026-03-30T08:05:00.000Z",
    });

    const history = await repository.listByKnowledgeItemId(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );

    assert.deepEqual(history, [
      {
        id: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
        knowledge_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        action: "submitted_for_review",
        actor_role: "user",
        created_at: "2026-03-30T08:00:00.000Z",
      },
      {
        id: "cccccccc-cccc-cccc-cccc-ccccccccccc2",
        knowledge_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        action: "approved",
        actor_role: "knowledge_reviewer",
        review_note: "Looks good.",
        created_at: "2026-03-30T08:05:00.000Z",
      },
    ]);
  });
});

test("postgres knowledge service rolls back status changes when review action persistence fails", async () => {
  await withMigratedKnowledgeClient(async (client) => {
    const repository = new PostgresKnowledgeRepository({ client });

    await repository.save({
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      title: "Rollback draft",
      canonical_text: "Rollback test text.",
      knowledge_kind: "rule",
      status: "draft",
      routing: {
        module_scope: "screening",
        manuscript_types: ["clinical_study"],
      },
    });

    const service = new KnowledgeService({
      repository,
      reviewActionRepository: new PostgresKnowledgeReviewActionRepository({ client }),
      transactionManager: createPostgresWriteTransactionManager({
        getClient: async () => client,
        createContext: (transactionClient) => ({
          repository: new PostgresKnowledgeRepository({
            client: transactionClient,
          }),
          reviewActionRepository: new FailingPostgresKnowledgeReviewActionRepository(
            { client: transactionClient as Client },
            (record) => record.action === "submitted_for_review",
          ),
        }),
      }),
      now: () => new Date("2026-03-30T09:00:00.000Z"),
      createId: (() => {
        const ids = ["eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"];
        return () => {
          const value = ids.shift();
          assert.ok(value, "Expected a review action id.");
          return value;
        };
      })(),
    });

    await assert.rejects(
      () => service.submitForReview("dddddddd-dddd-dddd-dddd-dddddddddddd"),
      /review action write failure/i,
    );

    const stored = await repository.findById("dddddddd-dddd-dddd-dddd-dddddddddddd");
    const reviewActions = await new PostgresKnowledgeReviewActionRepository({
      client,
    }).listByKnowledgeItemId("dddddddd-dddd-dddd-dddd-dddddddddddd");

    assert.equal(stored?.status, "draft");
    assert.deepEqual(reviewActions, []);
  });
});

async function withMigratedKnowledgeClient(
  run: (client: Client) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary knowledge persistence database.\n${migrate.stdout}\n${migrate.stderr}`,
    );

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      await run(client);
    } finally {
      await client.end();
    }
  });
}

async function seedLearningCandidate(client: Client, candidateId: string): Promise<void> {
  await client.query(
    `
      insert into learning_candidates (
        id,
        type,
        status,
        module,
        manuscript_type
      )
      values ($1, 'rule_candidate', 'approved', 'screening', 'clinical_study')
    `,
    [candidateId],
  );
}
