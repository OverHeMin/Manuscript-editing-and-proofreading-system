import type {
  KnowledgeAssetRecord,
  KnowledgeRecord,
  KnowledgeRevisionBindingRecord,
  KnowledgeRevisionRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

export interface KnowledgeRepository {
  save(record: KnowledgeRecord): Promise<void>;
  findById(id: string): Promise<KnowledgeRecord | undefined>;
  findApprovedById(id: string): Promise<KnowledgeRecord | undefined>;
  list(): Promise<KnowledgeRecord[]>;
  listApproved(): Promise<KnowledgeRecord[]>;
  listByStatus(status: KnowledgeRecord["status"]): Promise<KnowledgeRecord[]>;
  saveAsset(record: KnowledgeAssetRecord): Promise<void>;
  findAssetById(id: string): Promise<KnowledgeAssetRecord | undefined>;
  listAssets(): Promise<KnowledgeAssetRecord[]>;
  saveRevision(record: KnowledgeRevisionRecord): Promise<void>;
  findRevisionById(id: string): Promise<KnowledgeRevisionRecord | undefined>;
  listRevisionsByAssetId(assetId: string): Promise<KnowledgeRevisionRecord[]>;
  listRevisionsByStatus(
    status: KnowledgeRevisionRecord["status"],
  ): Promise<KnowledgeRevisionRecord[]>;
  replaceRevisionBindings(
    revisionId: string,
    records: readonly KnowledgeRevisionBindingRecord[],
  ): Promise<void>;
  listBindingsByRevisionId(
    revisionId: string,
  ): Promise<KnowledgeRevisionBindingRecord[]>;
}

export interface KnowledgeReviewActionRepository {
  save(record: KnowledgeReviewActionRecord): Promise<void>;
  listByKnowledgeItemId(knowledgeItemId: string): Promise<KnowledgeReviewActionRecord[]>;
  listByRevisionId(revisionId: string): Promise<KnowledgeReviewActionRecord[]>;
}
