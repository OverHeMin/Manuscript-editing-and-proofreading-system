import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { TemplateModule } from "../templates/template-record.ts";

export type KnowledgeRetrievalStrategy = "vector" | "hybrid" | "template_pack";
export type KnowledgeRetrievalEmbeddingStorageBackend = "double_precision_array";

export interface KnowledgeRetrievalIndexEntryRecord {
  id: string;
  knowledge_item_id: string;
  module: TemplateModule;
  manuscript_types: ManuscriptType[];
  template_family_id?: string;
  title: string;
  source_text: string;
  source_hash: string;
  embedding_provider: string;
  embedding_model: string;
  embedding_dimensions: number;
  embedding_storage_backend: KnowledgeRetrievalEmbeddingStorageBackend;
  embedding_vector: number[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeRetrievalRetrieverConfigRecord {
  strategy: KnowledgeRetrievalStrategy;
  top_k: number;
  embedding_provider?: string;
  embedding_model?: string;
  filters?: Record<string, unknown>;
}

export interface KnowledgeRetrievalSnapshotItemRecord {
  knowledge_item_id: string;
  index_entry_id?: string;
  retrieval_rank: number;
  retrieval_score?: number;
  rerank_score?: number;
  matched_passage?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeRetrievalSnapshotRecord {
  id: string;
  module: TemplateModule;
  manuscript_id?: string;
  manuscript_type?: ManuscriptType;
  template_family_id?: string;
  query_text: string;
  query_context?: Record<string, unknown>;
  retriever_config: KnowledgeRetrievalRetrieverConfigRecord;
  retrieved_items: KnowledgeRetrievalSnapshotItemRecord[];
  reranked_items: KnowledgeRetrievalSnapshotItemRecord[];
  created_at: string;
}

export interface KnowledgeRetrievalRerankerConfigRecord {
  provider: string;
  model?: string;
  top_k: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeRetrievalMetricSummaryRecord {
  answer_relevancy: number;
  context_precision?: number;
  context_recall?: number;
  ranking_consistency?: number;
}

export interface KnowledgeRetrievalQualityRunRecord {
  id: string;
  gold_set_version_id: string;
  module: TemplateModule;
  template_family_id?: string;
  retrieval_snapshot_ids: string[];
  retriever_config: KnowledgeRetrievalRetrieverConfigRecord;
  reranker_config?: KnowledgeRetrievalRerankerConfigRecord;
  metric_summary: KnowledgeRetrievalMetricSummaryRecord;
  created_by: string;
  created_at: string;
}
