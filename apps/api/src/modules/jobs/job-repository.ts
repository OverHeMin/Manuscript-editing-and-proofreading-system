import type { JobRecord } from "./job-record.ts";

export interface JobRepository {
  save(job: JobRecord): Promise<void>;
  findById(id: string): Promise<JobRecord | undefined>;
}
