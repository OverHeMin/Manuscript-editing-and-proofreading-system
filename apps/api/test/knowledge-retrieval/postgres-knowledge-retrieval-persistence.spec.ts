import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  KnowledgeRetrievalService,
  PostgresKnowledgeRetrievalRepository,
} from "../../src/modules/knowledge-retrieval/index.ts";
import { createPostgresWriteTransactionManager } from "../../src/modules/shared/write-transaction-manager.ts";
import { runMigrateProcess } from "../database/support/migrate-process.ts";
import { withTemporaryDatabase } from "../database/support/postgres.ts";

test("postgres knowledge retrieval repository persists index entries, retrieval snapshots, and quality runs", async () => {
  await withMigratedKnowledgeRetrievalPool(async (pool) => {
    const repository = new PostgresKnowledgeRetrievalRepository({ client: pool });

    await repository.saveIndexEntry({
      id: "00000000-0000-0000-0000-000000001701",
      knowledge_item_id: "knowledge-1",
      module: "editing",
      manuscript_types: ["review"],
      template_family_id: "template-family-1",
      title: "Editing ordering guidance",
      source_text: "Keep introduction, methods, results, and discussion stable.",
      source_hash: "sha256-editing-order-guidance",
      embedding_provider: "local-e5",
      embedding_model: "e5-small-v2",
      embedding_dimensions: 4,
      embedding_storage_backend: "double_precision_array",
      embedding_vector: [0.11, 0.22, 0.33, 0.44],
      metadata: {
        template_binding_count: 2,
      },
      created_at: "2026-04-04T11:10:00.000Z",
      updated_at: "2026-04-04T11:10:00.000Z",
    });

    await repository.saveRetrievalSnapshot({
      id: "00000000-0000-0000-0000-000000001702",
      module: "editing",
      manuscript_id: "manuscript-1",
      manuscript_type: "review",
      template_family_id: "template-family-1",
      query_text: "What editing guidance applies to section ordering?",
      query_context: {
        template_family_id: "template-family-1",
      },
      retriever_config: {
        strategy: "hybrid",
        top_k: 5,
      },
      retrieved_items: [
        {
          knowledge_item_id: "knowledge-1",
          retrieval_rank: 1,
          retrieval_score: 0.81,
        },
        {
          knowledge_item_id: "knowledge-2",
          retrieval_rank: 2,
          retrieval_score: 0.8,
        },
        {
          knowledge_item_id: "knowledge-3",
          retrieval_rank: 3,
          retrieval_score: 0.79,
        },
        {
          knowledge_item_id: "knowledge-4",
          retrieval_rank: 4,
          retrieval_score: 0.74,
        },
        {
          knowledge_item_id: "knowledge-5",
          retrieval_rank: 5,
          retrieval_score: 0.7,
        },
      ],
      reranked_items: [
        {
          knowledge_item_id: "knowledge-3",
          retrieval_rank: 3,
          retrieval_score: 0.79,
          rerank_score: 0.92,
        },
        {
          knowledge_item_id: "knowledge-1",
          retrieval_rank: 1,
          retrieval_score: 0.81,
          rerank_score: 0.87,
        },
      ],
      created_at: "2026-04-04T11:15:00.000Z",
    });

    await repository.saveRetrievalQualityRun({
      id: "00000000-0000-0000-0000-000000001703",
      gold_set_version_id: "gold-set-version-1",
      module: "editing",
      template_family_id: "template-family-1",
      retrieval_snapshot_ids: [
        "00000000-0000-0000-0000-000000001702",
      ],
      retriever_config: {
        strategy: "hybrid",
        top_k: 5,
      },
      reranker_config: {
        provider: "local-bge-reranker",
        top_k: 2,
      },
      metric_summary: {
        answer_relevancy: 0.88,
        context_precision: 0.91,
      },
      created_by: "admin-1",
      created_at: "2026-04-04T11:20:00.000Z",
    });

    const snapshot = await repository.findRetrievalSnapshotById(
      "00000000-0000-0000-0000-000000001702",
    );
    const run = await repository.findRetrievalQualityRunById(
      "00000000-0000-0000-0000-000000001703",
    );
    const indexEntries = await repository.listIndexEntriesByKnowledgeItemId(
      "knowledge-1",
    );

    assert.equal(snapshot?.module, "editing");
    assert.equal(snapshot?.retrieved_items.length, 5);
    assert.equal(snapshot?.reranked_items[0]?.knowledge_item_id, "knowledge-3");
    assert.equal(run?.metric_summary.answer_relevancy, 0.88);
    assert.equal(indexEntries[0]?.embedding_dimensions, 4);
  });
});

test("postgres knowledge retrieval service keeps historical snapshots and quality runs additive", async () => {
  await withMigratedKnowledgeRetrievalPool(async (pool) => {
    const repository = new PostgresKnowledgeRetrievalRepository({ client: pool });
    const service = new KnowledgeRetrievalService({
      repository,
      transactionManager: createPostgresWriteTransactionManager({
        getClient: async () => pool.connect(),
        createContext: (client) => ({
          repository: new PostgresKnowledgeRetrievalRepository({ client }),
        }),
      }),
      createId: (() => {
        const ids = [
          "00000000-0000-0000-0000-000000001711",
          "00000000-0000-0000-0000-000000001712",
          "00000000-0000-0000-0000-000000001713",
          "00000000-0000-0000-0000-000000001714",
        ];

        return () => {
          const value = ids.shift();
          assert.ok(value, "Expected a PostgreSQL knowledge retrieval id.");
          return value;
        };
      })(),
      now: () => new Date("2026-04-04T11:30:00.000Z"),
    });

    const snapshotOne = await service.recordRetrievalSnapshot({
      module: "editing",
      manuscriptId: "manuscript-11",
      manuscriptType: "review",
      queryText: "First retrieval query",
      retrieverConfig: {
        strategy: "vector",
        topK: 2,
      },
      retrievedItems: [
        {
          knowledgeItemId: "knowledge-1",
          retrievalRank: 1,
          retrievalScore: 0.73,
        },
      ],
      rerankedItems: [
        {
          knowledgeItemId: "knowledge-1",
          retrievalRank: 1,
          retrievalScore: 0.73,
          rerankScore: 0.74,
        },
      ],
    });

    const runOne = await service.recordRetrievalQualityRun({
      goldSetVersionId: "gold-set-version-2",
      module: "editing",
      retrievalSnapshotIds: [snapshotOne.id],
      retrieverConfig: {
        strategy: "vector",
        topK: 2,
      },
      metricSummary: {
        answerRelevancy: 0.79,
      },
      createdBy: "admin-2",
    });

    const snapshotTwo = await service.recordRetrievalSnapshot({
      module: "editing",
      manuscriptId: "manuscript-12",
      manuscriptType: "review",
      queryText: "Second retrieval query",
      retrieverConfig: {
        strategy: "hybrid",
        topK: 3,
      },
      retrievedItems: [
        {
          knowledgeItemId: "knowledge-3",
          retrievalRank: 1,
          retrievalScore: 0.81,
        },
      ],
      rerankedItems: [
        {
          knowledgeItemId: "knowledge-3",
          retrievalRank: 1,
          retrievalScore: 0.81,
          rerankScore: 0.9,
        },
      ],
    });

    const runTwo = await service.recordRetrievalQualityRun({
      goldSetVersionId: "gold-set-version-2",
      module: "editing",
      retrievalSnapshotIds: [snapshotTwo.id],
      retrieverConfig: {
        strategy: "hybrid",
        topK: 3,
      },
      metricSummary: {
        answerRelevancy: 0.83,
      },
      createdBy: "admin-2",
    });

    const snapshots = await repository.listRetrievalSnapshotsByModule("editing");
    const runs = await repository.listRetrievalQualityRunsByGoldSetVersionId(
      "gold-set-version-2",
    );

    assert.deepEqual(
      snapshots.map((record) => record.id),
      [snapshotOne.id, snapshotTwo.id],
    );
    assert.deepEqual(
      runs.map((record) => ({
        id: record.id,
        answer_relevancy: record.metric_summary.answer_relevancy,
      })),
      [
        {
          id: runOne.id,
          answer_relevancy: 0.79,
        },
        {
          id: runTwo.id,
          answer_relevancy: 0.83,
        },
      ],
    );
  });
});

async function withMigratedKnowledgeRetrievalPool(
  run: (pool: Pool) => Promise<void>,
): Promise<void> {
  await withTemporaryDatabase(async (databaseUrl) => {
    const migrate = runMigrateProcess(databaseUrl);
    assert.equal(
      migrate.status,
      0,
      `Expected migrate to succeed for the temporary knowledge retrieval database.\n${migrate.stdout}\n${migrate.stderr}`,
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
