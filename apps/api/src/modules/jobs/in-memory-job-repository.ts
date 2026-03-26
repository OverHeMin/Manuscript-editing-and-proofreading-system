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
}
