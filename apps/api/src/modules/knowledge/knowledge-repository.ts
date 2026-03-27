import type {
  KnowledgeRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

export interface KnowledgeRepository {
  save(record: KnowledgeRecord): Promise<void>;
  findById(id: string): Promise<KnowledgeRecord | undefined>;
  list(): Promise<KnowledgeRecord[]>;
}

export interface KnowledgeReviewActionRepository {
  save(record: KnowledgeReviewActionRecord): Promise<void>;
  listByKnowledgeItemId(knowledgeItemId: string): Promise<KnowledgeReviewActionRecord[]>;
}
