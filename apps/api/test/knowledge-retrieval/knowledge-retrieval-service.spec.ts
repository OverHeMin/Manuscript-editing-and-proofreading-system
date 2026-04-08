import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryKnowledgeRetrievalRepository,
  KnowledgeRetrievalService,
} from "../../src/modules/knowledge-retrieval/index.ts";

function createKnowledgeRetrievalHarness() {
  const repository = new InMemoryKnowledgeRetrievalRepository();
  const service = new KnowledgeRetrievalService({
    repository,
    createId: (() => {
      const ids = [
        "index-1",
        "index-2",
        "index-3",
        "index-4",
        "index-5",
        "snapshot-1",
        "run-1",
        "snapshot-2",
        "run-2",
      ];

      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a knowledge retrieval id.");
        return value;
      };
    })(),
    now: () => new Date("2026-04-04T11:00:00.000Z"),
  });

  return {
    repository,
    service,
  };
}

test("knowledge retrieval service records index entries, retrieval snapshots, and retrieval quality runs", async () => {
  const { repository, service } = createKnowledgeRetrievalHarness();

  const knowledgeItemIds = [
    "knowledge-1",
    "knowledge-2",
    "knowledge-3",
    "knowledge-4",
    "knowledge-5",
  ];

  for (const [index, knowledgeItemId] of knowledgeItemIds.entries()) {
    await service.upsertIndexEntry({
      knowledgeItemId,
      module: "editing",
      manuscriptTypes: ["review"],
      title: `Editing guidance ${index + 1}`,
      sourceText: `Editing guidance body ${index + 1}`,
      sourceHash: `sha256-editing-guidance-${index + 1}`,
      embeddingProvider: "local-e5",
      embeddingModel: "e5-small-v2",
      embeddingVector: [index + 0.1, index + 0.2, index + 0.3, index + 0.4],
      metadata: {
        template_binding_count: 1,
      },
    });
  }

  const snapshot = await service.recordRetrievalSnapshot({
    module: "editing",
    manuscriptId: "manuscript-1",
    manuscriptType: "review",
    queryText: "What editing guidance applies to section ordering?",
    queryContext: {
      template_family_id: "template-family-1",
      focus: "section_ordering",
    },
    retrieverConfig: {
      strategy: "hybrid",
      topK: 5,
      embeddingProvider: "local-e5",
      embeddingModel: "e5-small-v2",
      filters: {
        template_family_id: "template-family-1",
      },
    },
    retrievedItems: [
      {
        knowledgeItemId: "knowledge-1",
        retrievalRank: 1,
        retrievalScore: 0.81,
      },
      {
        knowledgeItemId: "knowledge-2",
        retrievalRank: 2,
        retrievalScore: 0.8,
      },
      {
        knowledgeItemId: "knowledge-3",
        retrievalRank: 3,
        retrievalScore: 0.78,
      },
      {
        knowledgeItemId: "knowledge-4",
        retrievalRank: 4,
        retrievalScore: 0.72,
      },
      {
        knowledgeItemId: "knowledge-5",
        retrievalRank: 5,
        retrievalScore: 0.69,
      },
    ],
    rerankedItems: [
      {
        knowledgeItemId: "knowledge-3",
        retrievalRank: 3,
        retrievalScore: 0.78,
        rerankScore: 0.93,
      },
      {
        knowledgeItemId: "knowledge-1",
        retrievalRank: 1,
        retrievalScore: 0.81,
        rerankScore: 0.88,
      },
      {
        knowledgeItemId: "knowledge-2",
        retrievalRank: 2,
        retrievalScore: 0.8,
        rerankScore: 0.87,
      },
    ],
  });

  const run = await service.recordRetrievalQualityRun({
    goldSetVersionId: "gold-set-version-1",
    module: "editing",
    templateFamilyId: "template-family-1",
    retrievalSnapshotIds: [snapshot.id],
    retrieverConfig: {
      strategy: "hybrid",
      topK: 5,
      embeddingProvider: "local-e5",
      embeddingModel: "e5-small-v2",
    },
    rerankerConfig: {
      provider: "local-bge-reranker",
      model: "bge-reranker-base",
      topK: 3,
    },
    metricSummary: {
      answerRelevancy: 0.88,
      contextPrecision: 0.91,
      contextRecall: 0.84,
    },
    createdBy: "admin-1",
  });

  const indexEntries = await repository.listIndexEntriesByKnowledgeItemId("knowledge-3");

  assert.equal(snapshot.module, "editing");
  assert.equal(snapshot.retrieved_items.length, 5);
  assert.equal(snapshot.reranked_items[0]?.knowledge_item_id, "knowledge-3");
  assert.equal(run.metric_summary.answer_relevancy, 0.88);
  assert.equal(indexEntries[0]?.embedding_dimensions, 4);
});

test("knowledge retrieval service keeps snapshots and quality runs additive", async () => {
  const { repository, service } = createKnowledgeRetrievalHarness();

  const snapshotOne = await service.recordRetrievalSnapshot({
    module: "editing",
    manuscriptId: "manuscript-11",
    manuscriptType: "review",
    queryText: "First retrieval calibration query",
    retrieverConfig: {
      strategy: "vector",
      topK: 2,
      embeddingProvider: "local-e5",
      embeddingModel: "e5-small-v2",
    },
    retrievedItems: [
      {
        knowledgeItemId: "knowledge-1",
        retrievalRank: 1,
        retrievalScore: 0.7,
      },
      {
        knowledgeItemId: "knowledge-2",
        retrievalRank: 2,
        retrievalScore: 0.68,
      },
    ],
    rerankedItems: [
      {
        knowledgeItemId: "knowledge-1",
        retrievalRank: 1,
        retrievalScore: 0.7,
        rerankScore: 0.71,
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
      embeddingProvider: "local-e5",
      embeddingModel: "e5-small-v2",
    },
    metricSummary: {
      answerRelevancy: 0.77,
    },
    createdBy: "admin-2",
  });

  const snapshotTwo = await service.recordRetrievalSnapshot({
    module: "editing",
    manuscriptId: "manuscript-12",
    manuscriptType: "review",
    queryText: "Second retrieval calibration query",
    retrieverConfig: {
      strategy: "hybrid",
      topK: 3,
    },
    retrievedItems: [
      {
        knowledgeItemId: "knowledge-3",
        retrievalRank: 1,
        retrievalScore: 0.83,
      },
    ],
    rerankedItems: [
      {
        knowledgeItemId: "knowledge-3",
        retrievalRank: 1,
        retrievalScore: 0.83,
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
      answerRelevancy: 0.82,
    },
    createdBy: "admin-2",
  });

  const snapshots = await repository.listRetrievalSnapshotsByModule("editing");
  const runs = await repository.listRetrievalQualityRunsByGoldSetVersionId(
    "gold-set-version-2",
  );

  assert.deepEqual(
    snapshots.map((record) => ({
      id: record.id,
      query_text: record.query_text,
    })),
    [
      {
        id: snapshotOne.id,
        query_text: "First retrieval calibration query",
      },
      {
        id: snapshotTwo.id,
        query_text: "Second retrieval calibration query",
      },
    ],
  );
  assert.deepEqual(
    runs.map((record) => ({
      id: record.id,
      answer_relevancy: record.metric_summary.answer_relevancy,
    })),
    [
      {
        id: runOne.id,
        answer_relevancy: 0.77,
      },
      {
        id: runTwo.id,
        answer_relevancy: 0.82,
      },
    ],
  );
});

test("knowledge retrieval ranking prefers projected rule entries that match template, journal, and rule object context", async () => {
  const { service } = createKnowledgeRetrievalHarness();

  await service.upsertIndexEntry({
    knowledgeItemId: "knowledge-manual-1",
    module: "editing",
    manuscriptTypes: ["clinical_study"],
    templateFamilyId: "family-1",
    title: "Generic editing guidance",
    sourceText: "General editing guidance for manuscripts.",
    sourceHash: "sha256-generic-guidance",
    embeddingProvider: "local-e5",
    embeddingModel: "e5-small-v2",
    embeddingVector: [0.1, 0.2, 0.3],
    metadata: {
      source_kind: "manual_knowledge",
    },
  });

  await service.upsertIndexEntry({
    knowledgeItemId: "knowledge-rule-1",
    module: "editing",
    manuscriptTypes: ["clinical_study"],
    templateFamilyId: "family-1",
    title: "Abstract heading rule projection",
    sourceText: "摘要 目的 should normalize to （摘要　目的） for Journal Alpha.",
    sourceHash: "sha256-abstract-rule-projection",
    embeddingProvider: "local-e5",
    embeddingModel: "e5-small-v2",
    embeddingVector: [0.4, 0.5, 0.6],
    metadata: {
      source_kind: "editorial_rule_projection",
      journal_key: "journal-alpha",
      rule_object: "abstract",
      standard_example: "（摘要　目的）",
      incorrect_example: "摘要 目的",
    },
  });

  const rankedEntries = await service.rankIndexEntriesForContext({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    journalKey: "journal-alpha",
    ruleObject: "abstract",
  });

  assert.deepEqual(
    rankedEntries.map((entry) => entry.knowledge_item_id),
    ["knowledge-rule-1", "knowledge-manual-1"],
  );
});
