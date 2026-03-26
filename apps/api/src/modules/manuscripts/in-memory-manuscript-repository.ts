import type { ManuscriptRecord } from "./manuscript-record.ts";
import type { ManuscriptRepository } from "./manuscript-repository.ts";

function cloneRecord(record: ManuscriptRecord): ManuscriptRecord {
  return { ...record };
}

export class InMemoryManuscriptRepository implements ManuscriptRepository {
  private readonly records = new Map<string, ManuscriptRecord>();

  async save(manuscript: ManuscriptRecord): Promise<void> {
    this.records.set(manuscript.id, cloneRecord(manuscript));
  }

  async findById(id: string): Promise<ManuscriptRecord | undefined> {
    const record = this.records.get(id);

    return record ? cloneRecord(record) : undefined;
  }
}
