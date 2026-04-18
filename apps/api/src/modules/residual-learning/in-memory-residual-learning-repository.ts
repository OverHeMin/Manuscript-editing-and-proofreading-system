import type { ResidualIssueRecord } from "./residual-learning-record.ts";
import type { ResidualIssueRepository } from "./residual-learning-repository.ts";

function cloneResidualIssueRecord(
  record: ResidualIssueRecord,
): ResidualIssueRecord {
  return {
    ...record,
    ...(record.location
      ? {
          location: JSON.parse(
            JSON.stringify(record.location),
          ) as Record<string, unknown>,
        }
      : {}),
    ...(record.signal_breakdown
      ? {
          signal_breakdown: JSON.parse(
            JSON.stringify(record.signal_breakdown),
          ) as Record<string, unknown>,
        }
      : {}),
    ...(record.related_rule_ids
      ? { related_rule_ids: [...record.related_rule_ids] }
      : {}),
    ...(record.related_knowledge_item_ids
      ? {
          related_knowledge_item_ids: [...record.related_knowledge_item_ids],
        }
      : {}),
    ...(record.related_quality_issue_ids
      ? { related_quality_issue_ids: [...record.related_quality_issue_ids] }
      : {}),
  };
}

function compareResidualIssues(
  left: ResidualIssueRecord,
  right: ResidualIssueRecord,
): number {
  if (left.updated_at !== right.updated_at) {
    return right.updated_at.localeCompare(left.updated_at);
  }

  if (left.created_at !== right.created_at) {
    return right.created_at.localeCompare(left.created_at);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryResidualIssueRepository
  implements ResidualIssueRepository
{
  private readonly records = new Map<string, ResidualIssueRecord>();

  async save(record: ResidualIssueRecord): Promise<void> {
    this.records.set(record.id, cloneResidualIssueRecord(record));
  }

  async findById(id: string): Promise<ResidualIssueRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneResidualIssueRecord(record) : undefined;
  }

  async list(): Promise<ResidualIssueRecord[]> {
    return [...this.records.values()]
      .sort(compareResidualIssues)
      .map(cloneResidualIssueRecord);
  }

  async listByStatus(
    status: ResidualIssueRecord["status"],
  ): Promise<ResidualIssueRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.status === status)
      .sort(compareResidualIssues)
      .map(cloneResidualIssueRecord);
  }

  async listByHarnessValidationStatus(
    status: ResidualIssueRecord["harness_validation_status"],
  ): Promise<ResidualIssueRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.harness_validation_status === status)
      .sort(compareResidualIssues)
      .map(cloneResidualIssueRecord);
  }

  async listByExecutionSnapshotId(
    executionSnapshotId: string,
  ): Promise<ResidualIssueRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.execution_snapshot_id === executionSnapshotId)
      .sort(compareResidualIssues)
      .map(cloneResidualIssueRecord);
  }

  snapshotState(): Map<string, ResidualIssueRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        cloneResidualIssueRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, ResidualIssueRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneResidualIssueRecord(record));
    }
  }
}
