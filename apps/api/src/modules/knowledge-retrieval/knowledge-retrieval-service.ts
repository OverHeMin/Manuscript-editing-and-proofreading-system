import { randomUUID } from "node:crypto";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import { InMemoryKnowledgeRetrievalRepository } from "./in-memory-knowledge-retrieval-repository.ts";
import type {
  KnowledgeRetrievalIndexEntryRecord,
  KnowledgeRetrievalMetricSummaryRecord,
  KnowledgeRetrievalQualityRunRecord,
  KnowledgeRetrievalRerankerConfigRecord,
  KnowledgeRetrievalRetrieverConfigRecord,
  KnowledgeRetrievalSnapshotItemRecord,
  KnowledgeRetrievalSnapshotRecord,
} from "./knowledge-retrieval-record.ts";
import type { KnowledgeRetrievalRepository } from "./knowledge-retrieval-repository.ts";

export interface UpsertKnowledgeRetrievalIndexEntryInput {
  knowledgeItemId: string;
  module: KnowledgeRetrievalIndexEntryRecord["module"];
  manuscriptTypes: KnowledgeRetrievalIndexEntryRecord["manuscript_types"];
  templateFamilyId?: string;
  title: string;
  sourceText: string;
  sourceHash: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingVector: number[];
  metadata?: Record<string, unknown>;
}

export interface RecordKnowledgeRetrievalSnapshotInput {
  module: KnowledgeRetrievalSnapshotRecord["module"];
  manuscriptId?: string;
  manuscriptType?: NonNullable<KnowledgeRetrievalSnapshotRecord["manuscript_type"]>;
  templateFamilyId?: string;
  queryText: string;
  queryContext?: Record<string, unknown>;
  retrieverConfig: {
    strategy: KnowledgeRetrievalRetrieverConfigRecord["strategy"];
    topK: number;
    embeddingProvider?: string;
    embeddingModel?: string;
    filters?: Record<string, unknown>;
  };
  retrievedItems: Array<{
    knowledgeItemId: string;
    indexEntryId?: string;
    retrievalRank: number;
    retrievalScore?: number;
    rerankScore?: number;
    matchedPassage?: string;
    metadata?: Record<string, unknown>;
  }>;
  rerankedItems: Array<{
    knowledgeItemId: string;
    indexEntryId?: string;
    retrievalRank: number;
    retrievalScore?: number;
    rerankScore?: number;
    matchedPassage?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface RecordKnowledgeRetrievalQualityRunInput {
  goldSetVersionId: string;
  module: KnowledgeRetrievalQualityRunRecord["module"];
  templateFamilyId?: string;
  retrievalSnapshotIds: string[];
  retrieverConfig: {
    strategy: KnowledgeRetrievalRetrieverConfigRecord["strategy"];
    topK: number;
    embeddingProvider?: string;
    embeddingModel?: string;
    filters?: Record<string, unknown>;
  };
  rerankerConfig?: {
    provider: string;
    model?: string;
    topK: number;
    metadata?: Record<string, unknown>;
  };
  metricSummary: {
    answerRelevancy: number;
    contextPrecision?: number;
    contextRecall?: number;
    rankingConsistency?: number;
  };
  createdBy: string;
}

export interface RankKnowledgeRetrievalIndexEntriesInput {
  module: KnowledgeRetrievalIndexEntryRecord["module"];
  manuscriptType?: KnowledgeRetrievalIndexEntryRecord["manuscript_types"][number];
  templateFamilyId?: string;
  journalKey?: string;
  ruleObject?: string;
}

interface KnowledgeRetrievalWriteContext {
  repository: KnowledgeRetrievalRepository;
}

export interface KnowledgeRetrievalServiceOptions {
  repository: KnowledgeRetrievalRepository;
  transactionManager?: WriteTransactionManager<KnowledgeRetrievalWriteContext>;
  createId?: () => string;
  now?: () => Date;
}

export class KnowledgeRetrievalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeRetrievalValidationError";
  }
}

export class KnowledgeRetrievalService {
  private readonly repository: KnowledgeRetrievalRepository;
  private readonly transactionManager: WriteTransactionManager<KnowledgeRetrievalWriteContext>;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: KnowledgeRetrievalServiceOptions) {
    this.repository = options.repository;
    this.transactionManager =
      options.transactionManager ??
      createKnowledgeRetrievalTransactionManager({
        repository: this.repository,
      });
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async upsertIndexEntry(
    input: UpsertKnowledgeRetrievalIndexEntryInput,
  ): Promise<KnowledgeRetrievalIndexEntryRecord> {
    assertEmbeddingVector(input.embeddingVector);
    const nowIso = this.now().toISOString();

    return this.transactionManager.withTransaction(async ({ repository }) => {
      const existing = (
        await repository.listIndexEntriesByKnowledgeItemId(input.knowledgeItemId)
      ).find((record) => record.source_hash === input.sourceHash);

      const record: KnowledgeRetrievalIndexEntryRecord = {
        id: existing?.id ?? this.createId(),
        knowledge_item_id: input.knowledgeItemId,
        module: input.module,
        manuscript_types: normalizeStringArray(input.manuscriptTypes),
        ...(input.templateFamilyId
          ? { template_family_id: input.templateFamilyId }
          : {}),
        title: input.title,
        source_text: input.sourceText,
        source_hash: input.sourceHash,
        embedding_provider: input.embeddingProvider,
        embedding_model: input.embeddingModel,
        embedding_dimensions: input.embeddingVector.length,
        embedding_storage_backend: "double_precision_array",
        embedding_vector: [...input.embeddingVector],
        metadata: cloneJson(input.metadata),
        created_at: existing?.created_at ?? nowIso,
        updated_at: nowIso,
      };

      await repository.saveIndexEntry(record);
      return cloneIndexEntry(record);
    });
  }

  async recordRetrievalSnapshot(
    input: RecordKnowledgeRetrievalSnapshotInput,
  ): Promise<KnowledgeRetrievalSnapshotRecord> {
    assertTopK(input.retrieverConfig.topK, "retrieverConfig.topK");

    const record: KnowledgeRetrievalSnapshotRecord = {
      id: this.createId(),
      module: input.module,
      ...(input.manuscriptId ? { manuscript_id: input.manuscriptId } : {}),
      ...(input.manuscriptType ? { manuscript_type: input.manuscriptType } : {}),
      ...(input.templateFamilyId
        ? { template_family_id: input.templateFamilyId }
        : {}),
      query_text: input.queryText,
      query_context: cloneJson(input.queryContext),
      retriever_config: normalizeRetrieverConfig(input.retrieverConfig),
      retrieved_items: input.retrievedItems.map(normalizeSnapshotItemInput),
      reranked_items: input.rerankedItems.map(normalizeSnapshotItemInput),
      created_at: this.now().toISOString(),
    };

    await this.repository.saveRetrievalSnapshot(record);
    return cloneSnapshot(record);
  }

  async recordRetrievalQualityRun(
    input: RecordKnowledgeRetrievalQualityRunInput,
  ): Promise<KnowledgeRetrievalQualityRunRecord> {
    if (input.retrievalSnapshotIds.length === 0) {
      throw new KnowledgeRetrievalValidationError(
        "Retrieval quality runs require at least one retrieval snapshot id.",
      );
    }

    assertTopK(input.retrieverConfig.topK, "retrieverConfig.topK");
    if (input.rerankerConfig) {
      assertTopK(input.rerankerConfig.topK, "rerankerConfig.topK");
    }

    const record: KnowledgeRetrievalQualityRunRecord = {
      id: this.createId(),
      gold_set_version_id: input.goldSetVersionId,
      module: input.module,
      ...(input.templateFamilyId
        ? { template_family_id: input.templateFamilyId }
        : {}),
      retrieval_snapshot_ids: normalizeStringArray(input.retrievalSnapshotIds),
      retriever_config: normalizeRetrieverConfig(input.retrieverConfig),
      ...(input.rerankerConfig
        ? { reranker_config: normalizeRerankerConfig(input.rerankerConfig) }
        : {}),
      metric_summary: normalizeMetricSummary(input.metricSummary),
      created_by: input.createdBy,
      created_at: this.now().toISOString(),
    };

    await this.repository.saveRetrievalQualityRun(record);
    return cloneQualityRun(record);
  }

  async rankIndexEntriesForContext(
    input: RankKnowledgeRetrievalIndexEntriesInput,
  ): Promise<KnowledgeRetrievalIndexEntryRecord[]> {
    const entries = await this.repository.listIndexEntriesByModule(input.module);

    return entries
      .map((entry) => ({
        entry,
        score: scoreIndexEntryForContext(entry, input),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.entry.updated_at.localeCompare(right.entry.updated_at) ||
          left.entry.id.localeCompare(right.entry.id),
      )
      .map(({ entry }) => cloneIndexEntry(entry));
  }
}

function scoreIndexEntryForContext(
  entry: KnowledgeRetrievalIndexEntryRecord,
  input: RankKnowledgeRetrievalIndexEntriesInput,
): number {
  const metadata = entry.metadata ?? {};
  let score = 0;

  if (
    input.manuscriptType &&
    entry.manuscript_types.includes(input.manuscriptType)
  ) {
    score += 4;
  }

  if (input.templateFamilyId && entry.template_family_id === input.templateFamilyId) {
    score += 4;
  }

  if (metadata.source_kind === "editorial_rule_projection") {
    score += 3;
  }

  if (input.journalKey && metadata.journal_key === input.journalKey) {
    score += 4;
  }

  if (input.ruleObject && metadata.rule_object === input.ruleObject) {
    score += 5;
  }

  return score;
}

function createKnowledgeRetrievalTransactionManager(
  context: KnowledgeRetrievalWriteContext,
): WriteTransactionManager<KnowledgeRetrievalWriteContext> {
  if (context.repository instanceof InMemoryKnowledgeRetrievalRepository) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository],
    });
  }

  return createDirectWriteTransactionManager(context);
}

function assertEmbeddingVector(vector: number[]): void {
  if (vector.length === 0) {
    throw new KnowledgeRetrievalValidationError(
      "Retrieval index entries require a non-empty embedding vector.",
    );
  }

  if (vector.some((value) => !Number.isFinite(value))) {
    throw new KnowledgeRetrievalValidationError(
      "Retrieval index entry embedding vectors must contain only finite numbers.",
    );
  }
}

function assertTopK(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new KnowledgeRetrievalValidationError(
      `${label} must be a positive integer.`,
    );
  }
}

function normalizeStringArray<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function cloneJson(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeRetrieverConfig(
  input:
    | RecordKnowledgeRetrievalSnapshotInput["retrieverConfig"]
    | RecordKnowledgeRetrievalQualityRunInput["retrieverConfig"],
): KnowledgeRetrievalRetrieverConfigRecord {
  return {
    strategy: input.strategy,
    top_k: input.topK,
    ...(input.embeddingProvider
      ? { embedding_provider: input.embeddingProvider }
      : {}),
    ...(input.embeddingModel
      ? { embedding_model: input.embeddingModel }
      : {}),
    ...(input.filters ? { filters: cloneJson(input.filters) } : {}),
  };
}

function normalizeSnapshotItemInput(
  input: RecordKnowledgeRetrievalSnapshotInput["retrievedItems"][number],
): KnowledgeRetrievalSnapshotItemRecord {
  return {
    knowledge_item_id: input.knowledgeItemId,
    ...(input.indexEntryId ? { index_entry_id: input.indexEntryId } : {}),
    retrieval_rank: input.retrievalRank,
    ...(input.retrievalScore != null
      ? { retrieval_score: input.retrievalScore }
      : {}),
    ...(input.rerankScore != null ? { rerank_score: input.rerankScore } : {}),
    ...(input.matchedPassage ? { matched_passage: input.matchedPassage } : {}),
    ...(input.metadata ? { metadata: cloneJson(input.metadata) } : {}),
  };
}

function normalizeRerankerConfig(
  input: NonNullable<RecordKnowledgeRetrievalQualityRunInput["rerankerConfig"]>,
): KnowledgeRetrievalRerankerConfigRecord {
  return {
    provider: input.provider,
    ...(input.model ? { model: input.model } : {}),
    top_k: input.topK,
    ...(input.metadata ? { metadata: cloneJson(input.metadata) } : {}),
  };
}

function normalizeMetricSummary(
  input: RecordKnowledgeRetrievalQualityRunInput["metricSummary"],
): KnowledgeRetrievalMetricSummaryRecord {
  return {
    answer_relevancy: input.answerRelevancy,
    ...(input.contextPrecision != null
      ? { context_precision: input.contextPrecision }
      : {}),
    ...(input.contextRecall != null
      ? { context_recall: input.contextRecall }
      : {}),
    ...(input.rankingConsistency != null
      ? { ranking_consistency: input.rankingConsistency }
      : {}),
  };
}

function cloneIndexEntry(
  record: KnowledgeRetrievalIndexEntryRecord,
): KnowledgeRetrievalIndexEntryRecord {
  return {
    ...record,
    manuscript_types: [...record.manuscript_types],
    embedding_vector: [...record.embedding_vector],
    metadata: cloneJson(record.metadata),
  };
}

function cloneSnapshot(
  record: KnowledgeRetrievalSnapshotRecord,
): KnowledgeRetrievalSnapshotRecord {
  return {
    ...record,
    query_context: cloneJson(record.query_context),
    retriever_config: {
      ...record.retriever_config,
      filters: cloneJson(record.retriever_config.filters),
    },
    retrieved_items: record.retrieved_items.map((item) => ({
      ...item,
      metadata: cloneJson(item.metadata),
    })),
    reranked_items: record.reranked_items.map((item) => ({
      ...item,
      metadata: cloneJson(item.metadata),
    })),
  };
}

function cloneQualityRun(
  record: KnowledgeRetrievalQualityRunRecord,
): KnowledgeRetrievalQualityRunRecord {
  return {
    ...record,
    retrieval_snapshot_ids: [...record.retrieval_snapshot_ids],
    retriever_config: {
      ...record.retriever_config,
      filters: cloneJson(record.retriever_config.filters),
    },
    reranker_config: record.reranker_config
      ? {
          ...record.reranker_config,
          metadata: cloneJson(record.reranker_config.metadata),
        }
      : undefined,
    metric_summary: {
      ...record.metric_summary,
    },
  };
}
