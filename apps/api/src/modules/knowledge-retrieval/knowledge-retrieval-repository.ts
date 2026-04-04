import type {
  KnowledgeRetrievalIndexEntryRecord,
  KnowledgeRetrievalQualityRunRecord,
  KnowledgeRetrievalSnapshotRecord,
} from "./knowledge-retrieval-record.ts";

export interface KnowledgeRetrievalRepository {
  saveIndexEntry(record: KnowledgeRetrievalIndexEntryRecord): Promise<void>;
  findIndexEntryById(
    id: string,
  ): Promise<KnowledgeRetrievalIndexEntryRecord | undefined>;
  listIndexEntriesByKnowledgeItemId(
    knowledgeItemId: string,
  ): Promise<KnowledgeRetrievalIndexEntryRecord[]>;
  listIndexEntriesByModule(
    module: KnowledgeRetrievalIndexEntryRecord["module"],
  ): Promise<KnowledgeRetrievalIndexEntryRecord[]>;

  saveRetrievalSnapshot(record: KnowledgeRetrievalSnapshotRecord): Promise<void>;
  findRetrievalSnapshotById(
    id: string,
  ): Promise<KnowledgeRetrievalSnapshotRecord | undefined>;
  listRetrievalSnapshotsByModule(
    module: KnowledgeRetrievalSnapshotRecord["module"],
  ): Promise<KnowledgeRetrievalSnapshotRecord[]>;

  saveRetrievalQualityRun(record: KnowledgeRetrievalQualityRunRecord): Promise<void>;
  findRetrievalQualityRunById(
    id: string,
  ): Promise<KnowledgeRetrievalQualityRunRecord | undefined>;
  findLatestRetrievalQualityRunByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<KnowledgeRetrievalQualityRunRecord | undefined>;
  listRetrievalQualityRunsByGoldSetVersionId(
    goldSetVersionId: string,
  ): Promise<KnowledgeRetrievalQualityRunRecord[]>;
}
