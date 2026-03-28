import type { LearningGovernanceRepository } from "./learning-governance-repository.ts";
import type { LearningWritebackRecord } from "./learning-governance-record.ts";

function cloneWritebackRecord(
  record: LearningWritebackRecord,
): LearningWritebackRecord {
  return { ...record };
}

export class InMemoryLearningGovernanceRepository
  implements LearningGovernanceRepository
{
  private readonly records = new Map<string, LearningWritebackRecord>();

  async save(record: LearningWritebackRecord): Promise<void> {
    this.records.set(record.id, cloneWritebackRecord(record));
  }

  async findById(id: string): Promise<LearningWritebackRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneWritebackRecord(record) : undefined;
  }

  async list(): Promise<LearningWritebackRecord[]> {
    return [...this.records.values()].map(cloneWritebackRecord);
  }

  async listByCandidateId(
    learningCandidateId: string,
  ): Promise<LearningWritebackRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.learning_candidate_id === learningCandidateId)
      .map(cloneWritebackRecord);
  }

  snapshotState(): Map<string, LearningWritebackRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        cloneWritebackRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, LearningWritebackRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneWritebackRecord(record));
    }
  }
}
