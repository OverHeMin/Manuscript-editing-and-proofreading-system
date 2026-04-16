import type {
  LearningCandidateRecord,
  ReviewedCaseSnapshotRecord,
} from "./learning-record.ts";
import type {
  LearningCandidateRepository,
  ReviewedCaseSnapshotRepository,
} from "./learning-repository.ts";

function cloneSnapshotRecord(
  record: ReviewedCaseSnapshotRecord,
): ReviewedCaseSnapshotRecord {
  return { ...record };
}

function cloneCandidateRecord(
  record: LearningCandidateRecord,
): LearningCandidateRecord {
  return {
    ...record,
    review_actions: record.review_actions?.map((action) => ({ ...action })),
    ...(record.candidate_payload
      ? {
          candidate_payload: JSON.parse(
            JSON.stringify(record.candidate_payload),
          ) as Record<string, unknown>,
        }
      : {}),
  };
}

function compareCandidateRecords(
  left: LearningCandidateRecord,
  right: LearningCandidateRecord,
): number {
  if (left.updated_at !== right.updated_at) {
    return right.updated_at.localeCompare(left.updated_at);
  }

  if (left.created_at !== right.created_at) {
    return right.created_at.localeCompare(left.created_at);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryReviewedCaseSnapshotRepository
  implements ReviewedCaseSnapshotRepository
{
  private readonly records = new Map<string, ReviewedCaseSnapshotRecord>();

  async save(record: ReviewedCaseSnapshotRecord): Promise<void> {
    this.records.set(record.id, cloneSnapshotRecord(record));
  }

  async findById(id: string): Promise<ReviewedCaseSnapshotRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneSnapshotRecord(record) : undefined;
  }

  snapshotState(): Map<string, ReviewedCaseSnapshotRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        cloneSnapshotRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, ReviewedCaseSnapshotRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneSnapshotRecord(record));
    }
  }
}

export class InMemoryLearningCandidateRepository
  implements LearningCandidateRepository
{
  private readonly records = new Map<string, LearningCandidateRecord>();

  async save(record: LearningCandidateRecord): Promise<void> {
    this.records.set(record.id, cloneCandidateRecord(record));
  }

  async findById(id: string): Promise<LearningCandidateRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneCandidateRecord(record) : undefined;
  }

  async list(): Promise<LearningCandidateRecord[]> {
    return [...this.records.values()]
      .sort(compareCandidateRecords)
      .map(cloneCandidateRecord);
  }

  async listByStatus(
    status: LearningCandidateRecord["status"],
  ): Promise<LearningCandidateRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.status === status)
      .sort(compareCandidateRecords)
      .map(cloneCandidateRecord);
  }

  snapshotState(): Map<string, LearningCandidateRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        cloneCandidateRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, LearningCandidateRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneCandidateRecord(record));
    }
  }
}
