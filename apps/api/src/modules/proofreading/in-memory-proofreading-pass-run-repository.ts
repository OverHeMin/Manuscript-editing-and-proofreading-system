import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type { ProofreadingPassRunRecord } from "./proofreading-pass-run-record.ts";
import type { ProofreadingPassRunRepository } from "./proofreading-pass-run-repository.ts";

function cloneRecord(record: ProofreadingPassRunRecord): ProofreadingPassRunRecord {
  return structuredClone(record);
}

function comparePassRuns(
  left: ProofreadingPassRunRecord,
  right: ProofreadingPassRunRecord,
): number {
  if (left.pass_no !== right.pass_no) {
    return left.pass_no - right.pass_no;
  }
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }
  return left.id.localeCompare(right.id);
}

export class InMemoryProofreadingPassRunRepository
  implements
    ProofreadingPassRunRepository,
    SnapshotCapableRepository<Map<string, ProofreadingPassRunRecord>>
{
  private readonly records = new Map<string, ProofreadingPassRunRecord>();

  async saveMany(records: ProofreadingPassRunRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, cloneRecord(record));
    }
  }

  async findById(id: string): Promise<ProofreadingPassRunRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async save(record: ProofreadingPassRunRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  async listByJobId(jobId: string): Promise<ProofreadingPassRunRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.job_id === jobId)
      .sort(comparePassRuns)
      .map(cloneRecord);
  }

  async listByManuscriptId(manuscriptId: string): Promise<ProofreadingPassRunRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.manuscript_id === manuscriptId)
      .sort(comparePassRuns)
      .map(cloneRecord);
  }

  snapshotState(): Map<string, ProofreadingPassRunRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [id, cloneRecord(record)]),
    );
  }

  restoreState(snapshot: Map<string, ProofreadingPassRunRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneRecord(record));
    }
  }
}
