import type { ManuscriptType } from "../manuscripts/types.ts";
import type { TemplateModule } from "../templates/types.ts";

export type RetrievalInsightStatus =
  | "idle"
  | "not_started"
  | "available"
  | "partial"
  | "unavailable";

export type RetrievalSignalKind = "retrieval_drift" | "missing_knowledge";
export type RetrievalSignalSeverity = "info" | "warning";
export type KnowledgeRetrievalStrategy = "vector" | "hybrid" | "template_pack";

export interface KnowledgeRetrievalRetrieverConfigViewModel {
  strategy: KnowledgeRetrievalStrategy;
  top_k: number;
  embedding_provider?: string;
  embedding_model?: string;
  filters?: Record<string, unknown>;
}

export interface KnowledgeRetrievalQualityMetricSummaryViewModel {
  answer_relevancy: number;
  context_precision?: number;
  context_recall?: number;
  ranking_consistency?: number;
}

export interface KnowledgeRetrievalQualityRunViewModel {
  id: string;
  gold_set_version_id: string;
  module: TemplateModule;
  template_family_id?: string;
  retrieval_snapshot_ids: string[];
  retriever_config: KnowledgeRetrievalRetrieverConfigViewModel;
  metric_summary: KnowledgeRetrievalQualityMetricSummaryViewModel;
  created_by: string;
  created_at: string;
}

export interface KnowledgeRetrievalSnapshotItemViewModel {
  knowledge_item_id: string;
  index_entry_id?: string;
  retrieval_rank: number;
  retrieval_score?: number;
  rerank_score?: number;
  matched_passage?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeRetrievalSnapshotViewModel {
  id: string;
  module: TemplateModule;
  manuscript_id?: string;
  manuscript_type?: ManuscriptType;
  template_family_id?: string;
  query_text: string;
  query_context?: Record<string, unknown>;
  retriever_config: KnowledgeRetrievalRetrieverConfigViewModel;
  retrieved_items: KnowledgeRetrievalSnapshotItemViewModel[];
  reranked_items: KnowledgeRetrievalSnapshotItemViewModel[];
  created_at: string;
}

export interface TemplateFamilyRetrievalSnapshotSummaryViewModel {
  id: string;
  query_text: string;
  retrieved_count: number;
  reranked_count: number;
  top_knowledge_item_ids: string[];
  created_at: string;
}

export interface TemplateFamilyRetrievalSignalViewModel {
  kind: RetrievalSignalKind;
  severity: RetrievalSignalSeverity;
  title: string;
  body: string;
  evidence: {
    retrieval_run_id?: string;
    retrieval_snapshot_id?: string;
  };
}

export interface TemplateFamilyRetrievalInsightsViewModel {
  status: RetrievalInsightStatus;
  latestRun: KnowledgeRetrievalQualityRunViewModel | null;
  latestSnapshot: TemplateFamilyRetrievalSnapshotSummaryViewModel | null;
  signals: TemplateFamilyRetrievalSignalViewModel[];
  message: string;
}
