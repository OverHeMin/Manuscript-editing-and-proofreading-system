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

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface KnowledgeRetrievalIndexEntryRow {
  id: string;
  knowledge_item_id: string;
  module: KnowledgeRetrievalIndexEntryRecord["module"];
  manuscript_types:
    | KnowledgeRetrievalIndexEntryRecord["manuscript_types"]
    | string;
  template_family_id: string | null;
  title: string;
  source_text: string;
  source_hash: string;
  embedding_provider: string;
  embedding_model: string;
  embedding_dimensions: number;
  embedding_storage_backend: KnowledgeRetrievalIndexEntryRecord["embedding_storage_backend"];
  embedding_vector: number[] | string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface KnowledgeRetrievalSnapshotRow {
  id: string;
  module: KnowledgeRetrievalSnapshotRecord["module"];
  manuscript_id: string | null;
  manuscript_type: KnowledgeRetrievalSnapshotRecord["manuscript_type"] | null;
  template_family_id: string | null;
  query_text: string;
  query_context: Record<string, unknown> | null;
  retriever_config: KnowledgeRetrievalRetrieverConfigRecord;
  retrieved_items: KnowledgeRetrievalSnapshotItemRecord[];
  reranked_items: KnowledgeRetrievalSnapshotItemRecord[];
  created_at: Date;
}

interface KnowledgeRetrievalQualityRunRow {
  id: string;
  gold_set_version_id: string;
  module: KnowledgeRetrievalQualityRunRecord["module"];
  template_family_id: string | null;
  retrieval_snapshot_ids: string[] | string;
  retriever_config: KnowledgeRetrievalRetrieverConfigRecord;
  reranker_config: KnowledgeRetrievalRerankerConfigRecord | null;
  metric_summary: KnowledgeRetrievalMetricSummaryRecord;
  created_by: string;
  created_at: Date;
}

function cloneStructured<T>(value: T): T {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneSnapshotItem(
  record: KnowledgeRetrievalSnapshotItemRecord,
): KnowledgeRetrievalSnapshotItemRecord {
  return {
    ...record,
    metadata: cloneStructured(record.metadata),
  };
}

function decodeTextArray(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (!value || value === "{}") {
    return [];
  }

  return value
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/^"(.*)"$/, "$1"));
}

function decodeNumberArray(value: number[] | string): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item));
  }

  if (!value || value === "{}") {
    return [];
  }

  return value
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => Number(item));
}

function mapIndexEntryRow(
  row: KnowledgeRetrievalIndexEntryRow,
): KnowledgeRetrievalIndexEntryRecord {
  return {
    id: row.id,
    knowledge_item_id: row.knowledge_item_id,
    module: row.module,
    manuscript_types: decodeTextArray(
      row.manuscript_types,
    ) as KnowledgeRetrievalIndexEntryRecord["manuscript_types"],
    ...(row.template_family_id != null
      ? { template_family_id: row.template_family_id }
      : {}),
    title: row.title,
    source_text: row.source_text,
    source_hash: row.source_hash,
    embedding_provider: row.embedding_provider,
    embedding_model: row.embedding_model,
    embedding_dimensions: row.embedding_dimensions,
    embedding_storage_backend: row.embedding_storage_backend,
    embedding_vector: decodeNumberArray(row.embedding_vector),
    metadata: cloneStructured(row.metadata ?? undefined),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapSnapshotRow(
  row: KnowledgeRetrievalSnapshotRow,
): KnowledgeRetrievalSnapshotRecord {
  return {
    id: row.id,
    module: row.module,
    ...(row.manuscript_id != null ? { manuscript_id: row.manuscript_id } : {}),
    ...(row.manuscript_type != null
      ? { manuscript_type: row.manuscript_type }
      : {}),
    ...(row.template_family_id != null
      ? { template_family_id: row.template_family_id }
      : {}),
    query_text: row.query_text,
    query_context: cloneStructured(row.query_context ?? undefined),
    retriever_config: cloneStructured(row.retriever_config),
    retrieved_items: row.retrieved_items.map(cloneSnapshotItem),
    reranked_items: row.reranked_items.map(cloneSnapshotItem),
    created_at: row.created_at.toISOString(),
  };
}

function mapQualityRunRow(
  row: KnowledgeRetrievalQualityRunRow,
): KnowledgeRetrievalQualityRunRecord {
  return {
    id: row.id,
    gold_set_version_id: row.gold_set_version_id,
    module: row.module,
    ...(row.template_family_id != null
      ? { template_family_id: row.template_family_id }
      : {}),
    retrieval_snapshot_ids: decodeTextArray(row.retrieval_snapshot_ids),
    retriever_config: cloneStructured(row.retriever_config),
    ...(row.reranker_config != null
      ? { reranker_config: cloneStructured(row.reranker_config) }
      : {}),
    metric_summary: {
      ...row.metric_summary,
    },
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
  };
}

export class PostgresKnowledgeRetrievalRepository
  implements KnowledgeRetrievalRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveIndexEntry(record: KnowledgeRetrievalIndexEntryRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_retrieval_index_entries (
          id,
          knowledge_item_id,
          module,
          manuscript_types,
          template_family_id,
          title,
          source_text,
          source_hash,
          embedding_provider,
          embedding_model,
          embedding_dimensions,
          embedding_storage_backend,
          embedding_vector,
          metadata,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14::jsonb,
          $15,
          $16
        )
        on conflict (id) do update
        set
          knowledge_item_id = excluded.knowledge_item_id,
          module = excluded.module,
          manuscript_types = excluded.manuscript_types,
          template_family_id = excluded.template_family_id,
          title = excluded.title,
          source_text = excluded.source_text,
          source_hash = excluded.source_hash,
          embedding_provider = excluded.embedding_provider,
          embedding_model = excluded.embedding_model,
          embedding_dimensions = excluded.embedding_dimensions,
          embedding_storage_backend = excluded.embedding_storage_backend,
          embedding_vector = excluded.embedding_vector,
          metadata = excluded.metadata,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.knowledge_item_id,
        record.module,
        record.manuscript_types,
        record.template_family_id ?? null,
        record.title,
        record.source_text,
        record.source_hash,
        record.embedding_provider,
        record.embedding_model,
        record.embedding_dimensions,
        record.embedding_storage_backend,
        record.embedding_vector,
        JSON.stringify(record.metadata ?? {}),
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findIndexEntryById(
    id: string,
  ): Promise<KnowledgeRetrievalIndexEntryRecord | undefined> {
    const result =
      await this.dependencies.client.query<KnowledgeRetrievalIndexEntryRow>(
        `
          select
            id,
            knowledge_item_id,
            module,
            manuscript_types,
            template_family_id,
            title,
            source_text,
            source_hash,
            embedding_provider,
            embedding_model,
            embedding_dimensions,
            embedding_storage_backend,
            embedding_vector,
            metadata,
            created_at,
            updated_at
          from knowledge_retrieval_index_entries
          where id = $1
        `,
        [id],
      );

    return result.rows[0] ? mapIndexEntryRow(result.rows[0]) : undefined;
  }

  async listIndexEntriesByKnowledgeItemId(
    knowledgeItemId: string,
  ): Promise<KnowledgeRetrievalIndexEntryRecord[]> {
    const result =
      await this.dependencies.client.query<KnowledgeRetrievalIndexEntryRow>(
        `
          select
            id,
            knowledge_item_id,
            module,
            manuscript_types,
            template_family_id,
            title,
            source_text,
            source_hash,
            embedding_provider,
            embedding_model,
            embedding_dimensions,
            embedding_storage_backend,
            embedding_vector,
            metadata,
            created_at,
            updated_at
          from knowledge_retrieval_index_entries
          where knowledge_item_id = $1
          order by updated_at asc, id asc
        `,
        [knowledgeItemId],
      );

    return result.rows.map(mapIndexEntryRow);
  }

  async listIndexEntriesByModule(
    module: KnowledgeRetrievalIndexEntryRecord["module"],
  ): Promise<KnowledgeRetrievalIndexEntryRecord[]> {
    const result =
      await this.dependencies.client.query<KnowledgeRetrievalIndexEntryRow>(
        `
          select
            id,
            knowledge_item_id,
            module,
            manuscript_types,
            template_family_id,
            title,
            source_text,
            source_hash,
            embedding_provider,
            embedding_model,
            embedding_dimensions,
            embedding_storage_backend,
            embedding_vector,
            metadata,
            created_at,
            updated_at
          from knowledge_retrieval_index_entries
          where module = $1
          order by updated_at asc, id asc
        `,
        [module],
      );

    return result.rows.map(mapIndexEntryRow);
  }

  async saveRetrievalSnapshot(
    record: KnowledgeRetrievalSnapshotRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_retrieval_snapshots (
          id,
          module,
          manuscript_id,
          manuscript_type,
          template_family_id,
          query_text,
          query_context,
          retriever_config,
          retrieved_items,
          reranked_items,
          created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
          $10::jsonb,
          $11
        )
        on conflict (id) do update
        set
          module = excluded.module,
          manuscript_id = excluded.manuscript_id,
          manuscript_type = excluded.manuscript_type,
          template_family_id = excluded.template_family_id,
          query_text = excluded.query_text,
          query_context = excluded.query_context,
          retriever_config = excluded.retriever_config,
          retrieved_items = excluded.retrieved_items,
          reranked_items = excluded.reranked_items,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.module,
        record.manuscript_id ?? null,
        record.manuscript_type ?? null,
        record.template_family_id ?? null,
        record.query_text,
        JSON.stringify(record.query_context ?? {}),
        JSON.stringify(record.retriever_config),
        JSON.stringify(record.retrieved_items),
        JSON.stringify(record.reranked_items),
        record.created_at,
      ],
    );
  }

  async findRetrievalSnapshotById(
    id: string,
  ): Promise<KnowledgeRetrievalSnapshotRecord | undefined> {
    const result =
      await this.dependencies.client.query<KnowledgeRetrievalSnapshotRow>(
        `
          select
            id,
            module,
            manuscript_id,
            manuscript_type,
            template_family_id,
            query_text,
            query_context,
            retriever_config,
            retrieved_items,
            reranked_items,
            created_at
          from knowledge_retrieval_snapshots
          where id = $1
        `,
        [id],
      );

    return result.rows[0] ? mapSnapshotRow(result.rows[0]) : undefined;
  }

  async listRetrievalSnapshotsByModule(
    module: KnowledgeRetrievalSnapshotRecord["module"],
  ): Promise<KnowledgeRetrievalSnapshotRecord[]> {
    const result =
      await this.dependencies.client.query<KnowledgeRetrievalSnapshotRow>(
        `
          select
            id,
            module,
            manuscript_id,
            manuscript_type,
            template_family_id,
            query_text,
            query_context,
            retriever_config,
            retrieved_items,
            reranked_items,
            created_at
          from knowledge_retrieval_snapshots
          where module = $1
          order by created_at asc, id asc
        `,
        [module],
      );

    return result.rows.map(mapSnapshotRow);
  }

  async saveRetrievalQualityRun(
    record: KnowledgeRetrievalQualityRunRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into knowledge_retrieval_quality_runs (
          id,
          gold_set_version_id,
          module,
          template_family_id,
          retrieval_snapshot_ids,
          retriever_config,
          reranker_config,
          metric_summary,
          created_by,
          created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          $7::jsonb,
          $8::jsonb,
          $9,
          $10
        )
        on conflict (id) do update
        set
          gold_set_version_id = excluded.gold_set_version_id,
          module = excluded.module,
          template_family_id = excluded.template_family_id,
          retrieval_snapshot_ids = excluded.retrieval_snapshot_ids,
          retriever_config = excluded.retriever_config,
          reranker_config = excluded.reranker_config,
          metric_summary = excluded.metric_summary,
          created_by = excluded.created_by,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.gold_set_version_id,
        record.module,
        record.template_family_id ?? null,
        record.retrieval_snapshot_ids,
        JSON.stringify(record.retriever_config),
        JSON.stringify(record.reranker_config ?? null),
        JSON.stringify(record.metric_summary),
        record.created_by,
        record.created_at,
      ],
    );
  }

  async findRetrievalQualityRunById(
    id: string,
  ): Promise<KnowledgeRetrievalQualityRunRecord | undefined> {
    const result =
      await this.dependencies.client.query<KnowledgeRetrievalQualityRunRow>(
        `
          select
            id,
            gold_set_version_id,
            module,
            template_family_id,
            retrieval_snapshot_ids,
            retriever_config,
            reranker_config,
            metric_summary,
            created_by,
            created_at
          from knowledge_retrieval_quality_runs
          where id = $1
        `,
        [id],
      );

    return result.rows[0] ? mapQualityRunRow(result.rows[0]) : undefined;
  }

  async findLatestRetrievalQualityRunByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<KnowledgeRetrievalQualityRunRecord | undefined> {
    const result =
      await this.dependencies.client.query<KnowledgeRetrievalQualityRunRow>(
        `
          select
            id,
            gold_set_version_id,
            module,
            template_family_id,
            retrieval_snapshot_ids,
            retriever_config,
            reranker_config,
            metric_summary,
            created_by,
            created_at
          from knowledge_retrieval_quality_runs
          where template_family_id = $1
          order by created_at desc, id desc
          limit 1
        `,
        [templateFamilyId],
      );

    return result.rows[0] ? mapQualityRunRow(result.rows[0]) : undefined;
  }

  async listRetrievalQualityRunsByGoldSetVersionId(
    goldSetVersionId: string,
  ): Promise<KnowledgeRetrievalQualityRunRecord[]> {
    const result =
      await this.dependencies.client.query<KnowledgeRetrievalQualityRunRow>(
        `
          select
            id,
            gold_set_version_id,
            module,
            template_family_id,
            retrieval_snapshot_ids,
            retriever_config,
            reranker_config,
            metric_summary,
            created_by,
            created_at
          from knowledge_retrieval_quality_runs
          where gold_set_version_id = $1
          order by created_at asc, id asc
        `,
        [goldSetVersionId],
      );

    return result.rows.map(mapQualityRunRow);
  }
}
