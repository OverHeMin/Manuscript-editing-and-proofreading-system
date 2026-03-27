import type { JobRecord } from "./job-record.ts";
import type { JobRepository } from "./job-repository.ts";

function cloneRecord(record: JobRecord): JobRecord {
  return {
    ...record,
    payload: record.payload ? { ...record.payload } : undefined,
  };
}

export class InMemoryJobRepository implements JobRepository {
  private readonly records = new Map<string, JobRecord>();

  async save(job: JobRecord): Promise<void> {
    this.records.set(job.id, cloneRecord(job));
  }

  async findById(id: string): Promise<JobRecord | undefined> {
    const record = this.records.get(id);

    return record ? cloneRecord(record) : undefined;
  }

  snapshotState(): Map<string, JobRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [id, cloneRecord(record)]),
    );
  }

  restoreState(snapshot: Map<string, JobRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneRecord(record));
    }
  }
}
