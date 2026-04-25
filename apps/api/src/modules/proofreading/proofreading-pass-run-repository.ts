import type { ProofreadingPassRunRecord } from "./proofreading-pass-run-record.ts";

export interface ProofreadingPassRunRepository {
  saveMany(records: ProofreadingPassRunRecord[]): Promise<void>;
  findById(id: string): Promise<ProofreadingPassRunRecord | undefined>;
  save(record: ProofreadingPassRunRecord): Promise<void>;
  listByJobId(jobId: string): Promise<ProofreadingPassRunRecord[]>;
  listByManuscriptId(manuscriptId: string): Promise<ProofreadingPassRunRecord[]>;
}
