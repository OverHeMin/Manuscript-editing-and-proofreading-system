import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
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

function cloneJson(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneSnapshotItem(
  record: KnowledgeRetrievalSnapshotItemRecord,
): KnowledgeRetrievalSnapshotItemRecord {
  return {
    ...record,
    metadata: cloneJson(record.metadata),
  };
}

function cloneRetrieverConfig(
  record: KnowledgeRetrievalRetrieverConfigRecord,
): KnowledgeRetrievalRetrieverConfigRecord {
  return {
    ...record,
    filters: cloneJson(record.filters),
  };
}

function cloneRerankerConfig(
  record: KnowledgeRetrievalRerankerConfigRecord | undefined,
): KnowledgeRetrievalRerankerConfigRecord | undefined {
  if (!record) {
    return undefined;
  }

  return {
    ...record,
    metadata: cloneJson(record.metadata),
  };
}

function cloneMetricSummary(
  record: KnowledgeRetrievalMetricSummaryRecord,
): KnowledgeRetrievalMetricSummaryRecord {
  return {
    ...record,
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
    retriever_config: cloneRetrieverConfig(record.retriever_config),
    retrieved_items: record.retrieved_items.map(cloneSnapshotItem),
    reranked_items: record.reranked_items.map(cloneSnapshotItem),
  };
}

function cloneQualityRun(
  record: KnowledgeRetrievalQualityRunRecord,
): KnowledgeRetrievalQualityRunRecord {
  return {
    ...record,
    retrieval_snapshot_ids: [...record.retrieval_snapshot_ids],
    retriever_config: cloneRetrieverConfig(record.retriever_config),
    reranker_config: cloneRerankerConfig(record.reranker_config),
    metric_summary: cloneMetricSummary(record.metric_summary),
  };
}

function compareByTimestampAsc<T extends { id: string; created_at: string }>(
  left: T,
  right: T,
): number {
  return (
    left.created_at.localeCompare(right.created_at) ||
    left.id.localeCompare(right.id)
  );
}

function compareIndexEntryAsc(
  left: KnowledgeRetrievalIndexEntryRecord,
  right: KnowledgeRetrievalIndexEntryRecord,
): number {
  return (
    left.updated_at.localeCompare(right.updated_at) ||
    left.id.localeCompare(right.id)
  );
}

export class InMemoryKnowledgeRetrievalRepository
  implements
    KnowledgeRetrievalRepository,
    SnapshotCapableRepository<{
      indexEntries: Map<string, KnowledgeRetrievalIndexEntryRecord>;
      snapshots: Map<string, KnowledgeRetrievalSnapshotRecord>;
      runs: Map<string, KnowledgeRetrievalQualityRunRecord>;
    }>
{
  private readonly indexEntries = new Map<string, KnowledgeRetrievalIndexEntryRecord>();
  private readonly snapshots = new Map<string, KnowledgeRetrievalSnapshotRecord>();
  private readonly runs = new Map<string, KnowledgeRetrievalQualityRunRecord>();

  async saveIndexEntry(record: KnowledgeRetrievalIndexEntryRecord): Promise<void> {
    this.indexEntries.set(record.id, cloneIndexEntry(record));
  }

  async findIndexEntryById(
    id: string,
  ): Promise<KnowledgeRetrievalIndexEntryRecord | undefined> {
    const record = this.indexEntries.get(id);
    return record ? cloneIndexEntry(record) : undefined;
  }

  async listIndexEntriesByKnowledgeItemId(
    knowledgeItemId: string,
  ): Promise<KnowledgeRetrievalIndexEntryRecord[]> {
    return [...this.indexEntries.values()]
      .filter((record) => record.knowledge_item_id === knowledgeItemId)
      .sort(compareIndexEntryAsc)
      .map(cloneIndexEntry);
  }

  async listIndexEntriesByModule(
    module: KnowledgeRetrievalIndexEntryRecord["module"],
  ): Promise<KnowledgeRetrievalIndexEntryRecord[]> {
    return [...this.indexEntries.values()]
      .filter((record) => record.module === module)
      .sort(compareIndexEntryAsc)
      .map(cloneIndexEntry);
  }

  async saveRetrievalSnapshot(
    record: KnowledgeRetrievalSnapshotRecord,
  ): Promise<void> {
    this.snapshots.set(record.id, cloneSnapshot(record));
  }

  async findRetrievalSnapshotById(
    id: string,
  ): Promise<KnowledgeRetrievalSnapshotRecord | undefined> {
    const record = this.snapshots.get(id);
    return record ? cloneSnapshot(record) : undefined;
  }

  async listRetrievalSnapshotsByModule(
    module: KnowledgeRetrievalSnapshotRecord["module"],
  ): Promise<KnowledgeRetrievalSnapshotRecord[]> {
    return [...this.snapshots.values()]
      .filter((record) => record.module === module)
      .sort(compareByTimestampAsc)
      .map(cloneSnapshot);
  }

  async saveRetrievalQualityRun(
    record: KnowledgeRetrievalQualityRunRecord,
  ): Promise<void> {
    this.runs.set(record.id, cloneQualityRun(record));
  }

  async findRetrievalQualityRunById(
    id: string,
  ): Promise<KnowledgeRetrievalQualityRunRecord | undefined> {
    const record = this.runs.get(id);
    return record ? cloneQualityRun(record) : undefined;
  }

  async listRetrievalQualityRunsByGoldSetVersionId(
    goldSetVersionId: string,
  ): Promise<KnowledgeRetrievalQualityRunRecord[]> {
    return [...this.runs.values()]
      .filter((record) => record.gold_set_version_id === goldSetVersionId)
      .sort(compareByTimestampAsc)
      .map(cloneQualityRun);
  }

  snapshotState(): {
    indexEntries: Map<string, KnowledgeRetrievalIndexEntryRecord>;
    snapshots: Map<string, KnowledgeRetrievalSnapshotRecord>;
    runs: Map<string, KnowledgeRetrievalQualityRunRecord>;
  } {
    return {
      indexEntries: new Map(
        [...this.indexEntries.entries()].map(([id, record]) => [
          id,
          cloneIndexEntry(record),
        ]),
      ),
      snapshots: new Map(
        [...this.snapshots.entries()].map(([id, record]) => [
          id,
          cloneSnapshot(record),
        ]),
      ),
      runs: new Map(
        [...this.runs.entries()].map(([id, record]) => [
          id,
          cloneQualityRun(record),
        ]),
      ),
    };
  }

  restoreState(snapshot: {
    indexEntries: Map<string, KnowledgeRetrievalIndexEntryRecord>;
    snapshots: Map<string, KnowledgeRetrievalSnapshotRecord>;
    runs: Map<string, KnowledgeRetrievalQualityRunRecord>;
  }): void {
    this.indexEntries.clear();
    for (const [id, record] of snapshot.indexEntries.entries()) {
      this.indexEntries.set(id, cloneIndexEntry(record));
    }

    this.snapshots.clear();
    for (const [id, record] of snapshot.snapshots.entries()) {
      this.snapshots.set(id, cloneSnapshot(record));
    }

    this.runs.clear();
    for (const [id, record] of snapshot.runs.entries()) {
      this.runs.set(id, cloneQualityRun(record));
    }
  }
}
