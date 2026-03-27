import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type {
  ExecutionTrackingRepository,
} from "./execution-tracking-repository.ts";
import type {
  KnowledgeHitLogRecord,
  ModuleExecutionSnapshotRecord,
} from "./execution-tracking-record.ts";

function cloneSnapshotRecord(
  record: ModuleExecutionSnapshotRecord,
): ModuleExecutionSnapshotRecord {
  return {
    ...record,
    skill_package_ids: [...record.skill_package_ids],
    skill_package_versions: [...record.skill_package_versions],
    knowledge_item_ids: [...record.knowledge_item_ids],
    created_asset_ids: [...record.created_asset_ids],
  };
}

function cloneKnowledgeHitLogRecord(
  record: KnowledgeHitLogRecord,
): KnowledgeHitLogRecord {
  return {
    ...record,
    match_reasons: [...record.match_reasons],
  };
}

function compareSnapshots(
  left: ModuleExecutionSnapshotRecord,
  right: ModuleExecutionSnapshotRecord,
): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return left.id.localeCompare(right.id);
}

function compareKnowledgeHitLogs(
  left: KnowledgeHitLogRecord,
  right: KnowledgeHitLogRecord,
): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryExecutionTrackingRepository
  implements
    ExecutionTrackingRepository,
    SnapshotCapableRepository<{
      snapshots: Map<string, ModuleExecutionSnapshotRecord>;
      hitLogs: Map<string, KnowledgeHitLogRecord>;
    }>
{
  private readonly snapshots = new Map<string, ModuleExecutionSnapshotRecord>();
  private readonly hitLogs = new Map<string, KnowledgeHitLogRecord>();

  async saveSnapshot(record: ModuleExecutionSnapshotRecord): Promise<void> {
    this.snapshots.set(record.id, cloneSnapshotRecord(record));
  }

  async findSnapshotById(
    id: string,
  ): Promise<ModuleExecutionSnapshotRecord | undefined> {
    const record = this.snapshots.get(id);
    return record ? cloneSnapshotRecord(record) : undefined;
  }

  async listSnapshots(): Promise<ModuleExecutionSnapshotRecord[]> {
    return [...this.snapshots.values()]
      .sort(compareSnapshots)
      .map(cloneSnapshotRecord);
  }

  async saveKnowledgeHitLog(record: KnowledgeHitLogRecord): Promise<void> {
    this.hitLogs.set(record.id, cloneKnowledgeHitLogRecord(record));
  }

  async listKnowledgeHitLogsBySnapshotId(
    snapshotId: string,
  ): Promise<KnowledgeHitLogRecord[]> {
    return [...this.hitLogs.values()]
      .filter((record) => record.snapshot_id === snapshotId)
      .sort(compareKnowledgeHitLogs)
      .map(cloneKnowledgeHitLogRecord);
  }

  snapshotState(): {
    snapshots: Map<string, ModuleExecutionSnapshotRecord>;
    hitLogs: Map<string, KnowledgeHitLogRecord>;
  } {
    return {
      snapshots: new Map(
        [...this.snapshots.entries()].map(([id, record]) => [
          id,
          cloneSnapshotRecord(record),
        ]),
      ),
      hitLogs: new Map(
        [...this.hitLogs.entries()].map(([id, record]) => [
          id,
          cloneKnowledgeHitLogRecord(record),
        ]),
      ),
    };
  }

  restoreState(snapshot: {
    snapshots: Map<string, ModuleExecutionSnapshotRecord>;
    hitLogs: Map<string, KnowledgeHitLogRecord>;
  }): void {
    this.snapshots.clear();
    for (const [id, record] of snapshot.snapshots.entries()) {
      this.snapshots.set(id, cloneSnapshotRecord(record));
    }

    this.hitLogs.clear();
    for (const [id, record] of snapshot.hitLogs.entries()) {
      this.hitLogs.set(id, cloneKnowledgeHitLogRecord(record));
    }
  }
}
