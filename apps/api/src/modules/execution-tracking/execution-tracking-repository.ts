import type {
  KnowledgeHitLogRecord,
  ModuleExecutionSnapshotRecord,
} from "./execution-tracking-record.ts";

export interface ExecutionTrackingRepository {
  saveSnapshot(record: ModuleExecutionSnapshotRecord): Promise<void>;
  findSnapshotById(id: string): Promise<ModuleExecutionSnapshotRecord | undefined>;
  listSnapshotsByManuscriptId(
    manuscriptId: string,
  ): Promise<ModuleExecutionSnapshotRecord[]>;
  listSnapshots(): Promise<ModuleExecutionSnapshotRecord[]>;
  saveKnowledgeHitLog(record: KnowledgeHitLogRecord): Promise<void>;
  listKnowledgeHitLogsBySnapshotId(snapshotId: string): Promise<KnowledgeHitLogRecord[]>;
}
